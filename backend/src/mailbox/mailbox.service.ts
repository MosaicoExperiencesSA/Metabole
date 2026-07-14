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

  /** Imposta/aggiorna la casella: prova la connessione IMAP, poi salva cifrato. */
  async setAccount(userId: string, email: string, password: string) {
    const client = this.imapClient(email, password);
    try {
      await client.connect();
      await client.logout();
    } catch {
      throw new BadRequestException('Connessione alla casella non riuscita: controlla indirizzo e password.');
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

  /** Posta in arrivo: ultimi N messaggi (più recenti in cima). */
  async listInbox(userId: string, limit = 25) {
    const { email, password } = await this.credsOf(userId);
    const client = this.imapClient(email, password);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const st = await client.status('INBOX', { messages: true });
        const total = st.messages ?? 0;
        if (total === 0) return [];
        const start = Math.max(1, total - limit + 1);
        const out: Array<Record<string, unknown>> = [];
        for await (const msg of client.fetch(`${start}:*`, { uid: true, envelope: true, flags: true })) {
          const fromAddr = msg.envelope?.from?.[0];
          out.push({
            uid: msg.uid,
            from: fromAddr?.address ?? '',
            fromName: fromAddr?.name ?? '',
            subject: msg.envelope?.subject ?? '(nessun oggetto)',
            date: msg.envelope?.date ?? null,
            seen: msg.flags?.has('\\Seen') ?? false,
          });
        }
        return out.reverse();
      } finally {
        lock.release();
      }
    } catch (e) {
      this.logger.warn(`IMAP inbox fallita: ${e instanceof Error ? e.message : e}`);
      throw new BadRequestException('Lettura della posta non riuscita.');
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Legge un messaggio (per uid) e lo segna come letto. */
  async getMessage(userId: string, uid: number) {
    const { email, password } = await this.credsOf(userId);
    const client = this.imapClient(email, password);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) throw new NotFoundException('Messaggio non trovato.');
        const parsed = await simpleParser(msg.source);
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => undefined);
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
      this.logger.warn(`IMAP message fallita: ${e instanceof Error ? e.message : e}`);
      throw new BadRequestException('Apertura del messaggio non riuscita.');
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
      return { ok: true, messageId: info.messageId };
    } catch (e) {
      this.logger.warn(`SMTP invio fallito: ${e instanceof Error ? e.message : e}`);
      throw new BadRequestException("Invio dell'email non riuscito.");
    }
  }
}
