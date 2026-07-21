import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { deriveKey, encryptBuffer, decryptBuffer } from '../health-area/crypto.util';

/**
 * Casella di posta @metabole.eu dell'utente (MVP webmail, solo staff).
 * - La password della casella è cifrata a riposo (AES-256-GCM, chiave FILE_ENCRYPTION_KEY).
 * - Server IMAP/SMTP uguali per tutti (mail.metabole.eu 993/465, SSL) → env con default.
 * - Lettura via IMAP (imapflow), invio via SMTP (nodemailer). Nessuna password loggata o restituita.
 */
@Injectable()
export class MailboxService {
  private readonly logger = new Logger(MailboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  private settings() {
    return {
      imapHost: process.env.MAIL_IMAP_HOST || 'mail.metabole.eu',
      imapPort: Number(process.env.MAIL_IMAP_PORT || 993),
      smtpHost: process.env.MAIL_SMTP_HOST || 'mail.metabole.eu',
      smtpPort: Number(process.env.MAIL_SMTP_PORT || 465),
      secure: true,
    };
  }

  private key() {
    const secret = process.env.FILE_ENCRYPTION_KEY;
    if (!secret) throw new BadRequestException('Cifratura non configurata sul server.');
    return deriveKey(secret);
  }

  private encrypt(pw: string): string {
    return encryptBuffer(Buffer.from(pw, 'utf8'), this.key()).toString('base64');
  }

  private decrypt(enc: string): string {
    return decryptBuffer(Buffer.from(enc, 'base64'), this.key()).toString('utf8');
  }

  private imapClient(email: string, password: string): ImapFlow {
    const s = this.settings();
    return new ImapFlow({
      host: s.imapHost,
      port: s.imapPort,
      secure: s.secure,
      auth: { user: email, pass: password },
      logger: false,
    });
  }

  private async credsOf(userId: string): Promise<{ email: string; password: string }> {
    const acc = await this.prisma.mailAccount.findUnique({ where: { userId } });
    if (!acc) throw new BadRequestException('Casella non configurata. Impostala prima dalle impostazioni.');
    return { email: acc.email, password: this.decrypt(acc.encPassword) };
  }

  /** Stato configurazione (mai la password). */
  async status(userId: string) {
    const acc = await this.prisma.mailAccount.findUnique({ where: { userId } });
    return { configured: !!acc, email: acc?.email ?? null };
  }

  /**
   * Traduce un errore IMAP/SMTP in una spiegazione utile a chi deve sistemare:
   * distinguere "password sbagliata" da "server giù" o "IP bloccato dall'hosting"
   * cambia completamente l'intervento. Usata da TUTTE le operazioni di posta.
   */
  private describeMailError(err: unknown, context: string): string {
    const e = err as { authenticationFailed?: boolean; code?: string; message?: string; responseText?: string; responseCode?: number };
    this.logger.warn(`${context}: code=${e?.code ?? '-'} auth=${e?.authenticationFailed ?? '-'} msg=${e?.message ?? '-'}`);
    const msg = e?.message ?? '';
    return e?.authenticationFailed || /auth|login|credentials/i.test(e?.responseText ?? '')
      ? 'il server ha RIFIUTATO indirizzo o password (verifica le credenziali, es. dal webmail)'
      : e?.code === 'ENOTFOUND'
        ? 'server di posta non trovato (DNS): verifica mail.metabole.eu'
        : e?.code === 'ETIMEDOUT' || /timeout/i.test(msg)
          ? 'il server di posta NON RISPONDE (timeout): probabile problema lato hosting (o IP del backend bloccato dal firewall SiteGround), non di password'
          : e?.code === 'ECONNREFUSED'
            ? 'connessione RIFIUTATA dal server (porta chiusa, servizio fermo o IP del backend bloccato dal firewall dell\'hosting)'
            : e?.code === 'ECONNRESET' || /socket|closed|reset/i.test(msg)
              ? 'connessione INTERROTTA dal server durante l\'operazione (instabilità o protezione anti-abuso lato hosting)'
              : /certificate|tls|ssl/i.test(msg)
                ? 'problema di certificato SSL del server di posta'
                : `errore: ${e?.responseText || msg || 'sconosciuto'}`;
  }

  /** Imposta/aggiorna la casella: prova la connessione IMAP, poi salva cifrato. */
  async setAccount(userId: string, email: string, password: string) {
    const client = this.imapClient(email, password);
    try {
      await client.connect();
      await client.logout();
    } catch (err) {
      const detail = this.describeMailError(err, `Collegamento casella ${email} fallito`);
      throw new BadRequestException(`Connessione alla casella non riuscita: ${detail}.`);
    }
    await this.prisma.mailAccount.upsert({
      where: { userId },
      create: { userId, email, encPassword: this.encrypt(password) },
      update: { email, encPassword: this.encrypt(password) },
    });
    return { configured: true, email };
  }

  async remove(userId: string) {
    await this.prisma.mailAccount.deleteMany({ where: { userId } });
    return { ok: true };
  }

  /**
   * Trova la cartella "Inviata" della casella: prima per flag speciale IMAP
   * (\Sent), poi per nome comune (Sent, INBOX.Sent, Sent Items…). I server di
   * posta usano nomi diversi, quindi non possiamo assumerne uno solo.
   */
  private async resolveSentFolder(client: ImapFlow): Promise<string> {
    try {
      const boxes = await client.list();
      const special = boxes.find((b) => b.specialUse === '\\Sent');
      if (special?.path) return special.path;
      const named = boxes.find(
        (b) => /(^|\.)sent( items| messages)?$/i.test(b.path ?? '') || /^sent( items)?$/i.test(b.name ?? ''),
      );
      if (named?.path) return named.path;
    } catch {
      /* si prova comunque il nome di default qui sotto */
    }
    return 'Sent';
  }

  /** Legge gli ultimi N messaggi di una cartella (già connesso). Più recenti in cima. */
  private async collectRecent(client: ImapFlow, mailbox: string, limit: number) {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const st = await client.status(mailbox, { messages: true });
      const total = st.messages ?? 0;
      if (total === 0) return [];
      const start = Math.max(1, total - limit + 1);
      const out: Array<Record<string, unknown>> = [];
      for await (const msg of client.fetch(`${start}:*`, { uid: true, envelope: true, flags: true })) {
        const fromAddr = msg.envelope?.from?.[0];
        const toAddr = msg.envelope?.to?.[0];
        out.push({
          uid: msg.uid,
          from: fromAddr?.address ?? '',
          fromName: fromAddr?.name ?? '',
          to: toAddr?.address ?? '',
          toName: toAddr?.name ?? '',
          subject: msg.envelope?.subject ?? '(nessun oggetto)',
          date: msg.envelope?.date ?? null,
          seen: msg.flags?.has('\\Seen') ?? false,
        });
      }
      return out.reverse();
    } finally {
      lock.release();
    }
  }

  /** Posta in arrivo: ultimi N messaggi (più recenti in cima). */
  async listInbox(userId: string, limit = 25) {
    const { email, password } = await this.credsOf(userId);
    const client = this.imapClient(email, password);
    try {
      await client.connect();
      return await this.collectRecent(client, 'INBOX', limit);
    } catch (e) {
      const detail = this.describeMailError(e, `IMAP inbox fallita (${email})`);
      throw new BadRequestException(`Lettura della posta non riuscita: ${detail}.`);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Posta inviata: ultimi N messaggi della cartella "Inviata". */
  async listSent(userId: string, limit = 25) {
    const { email, password } = await this.credsOf(userId);
    const client = this.imapClient(email, password);
    try {
      await client.connect();
      const box = await this.resolveSentFolder(client);
      return await this.collectRecent(client, box, limit);
    } catch (e) {
      const detail = this.describeMailError(e, `IMAP sent fallita (${email})`);
      throw new BadRequestException(`Lettura della posta inviata non riuscita: ${detail}.`);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Legge un messaggio (per uid) dalla cartella indicata; l'inbox lo segna come letto. */
  async getMessage(userId: string, uid: number, mailbox: 'inbox' | 'sent' = 'inbox') {
    const { email, password } = await this.credsOf(userId);
    const client = this.imapClient(email, password);
    try {
      await client.connect();
      const box = mailbox === 'sent' ? await this.resolveSentFolder(client) : 'INBOX';
      const lock = await client.getMailboxLock(box);
      try {
        const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) throw new NotFoundException('Messaggio non trovato.');
        const parsed = await simpleParser(msg.source);
        if (mailbox === 'inbox') {
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => undefined);
        }
        const toText = Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(', ') : parsed.to?.text ?? '';
        return {
          uid,
          from: parsed.from?.text ?? '',
          to: toText,
          subject: parsed.subject ?? '(nessun oggetto)',
          date: parsed.date ?? null,
          text: parsed.text ?? '',
          html: typeof parsed.html === 'string' ? parsed.html : null,
        };
      } finally {
        lock.release();
      }
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      const detail = this.describeMailError(e, `IMAP message fallita (${email})`);
      throw new BadRequestException(`Apertura del messaggio non riuscita: ${detail}.`);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Invia una mail dalla casella dell'utente (SMTP). */
  async send(userId: string, dto: { to: string; subject: string; text: string; html?: string }) {
    const { email, password } = await this.credsOf(userId);
    const s = this.settings();
    const transport = nodemailer.createTransport({
      host: s.smtpHost,
      port: s.smtpPort,
      secure: s.secure,
      auth: { user: email, pass: password },
    });
    try {
      const info = await transport.sendMail({
        from: email,
        to: dto.to,
        subject: dto.subject,
        text: dto.text,
        ...(dto.html ? { html: dto.html } : {}),
      });
      // Traccia l'invio (audit): sapere chi ha scritto a chi dalla casella, e ritrovare
      // il messaggio. Riusa email_log come per le mail di sistema. Non blocca l'invio.
      await this.prisma.emailLog
        .create({ data: { to: dto.to, subject: dto.subject, bodyHtml: dto.html ?? dto.text, templateKey: 'mailbox', status: 'sent' } })
        .catch(() => undefined);
      return { ok: true, messageId: info.messageId };
    } catch (e) {
      const detail = this.describeMailError(e, `SMTP invio fallito (${email})`);
      await this.prisma.emailLog
        .create({ data: { to: dto.to, subject: dto.subject, bodyHtml: dto.html ?? dto.text, templateKey: 'mailbox', status: 'failed', error: detail } })
        .catch(() => undefined);
      throw new BadRequestException(`Invio dell'email non riuscito: ${detail}.`);
    }
  }
}
