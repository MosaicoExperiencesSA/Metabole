import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '../i18n/i18n.service';
import { PrismaService } from '../prisma/prisma.service';

interface Attachment {
  name: string;
  content: string; // base64
}
interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  templateKey?: string;
  attachments?: Attachment[];
}

/** Sostituisce i segnaposto {{var}} nel testo del template. */
function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (k in vars ? vars[k] : ''));
}

/**
 * Email transazionali via Brevo (API HTTP v3), localizzate (i18n).
 * I testi sono personalizzabili dall'admin (tabella email_template): se un
 * modello attivo esiste per la chiave, si usa quello; altrimenti il testo
 * predefinito i18n. Ogni invio viene registrato in email_log.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
    private readonly prisma: PrismaService,
  ) {}

  private get apiKey(): string | null {
    const key = this.config.get<string>('BREVO_API_KEY');
    if (!key || key === 'todo' || key.length < 10) return null;
    return key;
  }

  private get sender(): { name: string; email: string } {
    const raw = this.config.get<string>('MAIL_FROM') ?? 'Metabole <no-reply@metabole.eu>';
    const match = raw.match(/^(.*)<(.+)>$/);
    if (match) return { name: match[1].trim() || 'Metabole', email: match[2].trim() };
    return { name: 'Metabole', email: raw.trim() };
  }

  /** Modello dall'admin (se attivo) reso coi segnaposto, altrimenti il default i18n. */
  private async resolve(
    templateKey: string,
    defaults: { subject: string; html: string },
    vars: Record<string, string>,
  ): Promise<{ subject: string; html: string }> {
    try {
      const tpl = (await this.prisma.emailTemplate.findUnique({ where: { key: templateKey } })) as
        | { subject: string; bodyHtml: string; active: boolean }
        | null;
      if (tpl && tpl.active) {
        return { subject: render(tpl.subject, vars), html: render(tpl.bodyHtml, vars) };
      }
    } catch {
      /* se la tabella non è ancora migrata, si usa il default */
    }
    return defaults;
  }

  private async log(to: string, subject: string, status: string, templateKey?: string, error?: string) {
    try {
      await this.prisma.emailLog.create({
        data: { to, subject, status, templateKey: templateKey ?? null, error: error ?? null },
      });
    } catch {
      /* il log non deve mai bloccare l'invio */
    }
  }

  async send(input: SendMailInput): Promise<boolean> {
    const key = this.apiKey;
    if (!key) {
      this.logger.warn(`BREVO_API_KEY non configurata: email NON inviata. to=${input.to} subject="${input.subject}"`);
      await this.log(input.to, input.subject, 'skipped', input.templateKey, 'BREVO_API_KEY non configurata');
      return false;
    }
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: input.to }],
          subject: input.subject,
          htmlContent: input.html,
          ...(input.attachments?.length ? { attachment: input.attachments } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Brevo ha risposto ${res.status}: ${body.slice(0, 300)}`);
        await this.log(input.to, input.subject, 'failed', input.templateKey, `Brevo ${res.status}`);
        return false;
      }
      await this.log(input.to, input.subject, 'sent', input.templateKey);
      return true;
    } catch (err) {
      this.logger.error(`Invio email fallito (to=${input.to})`, err instanceof Error ? err.stack : String(err));
      await this.log(input.to, input.subject, 'failed', input.templateKey, err instanceof Error ? err.message : 'errore');
      return false;
    }
  }

  async sendEmailVerification(to: string, token: string, locale?: string | null): Promise<boolean> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://app.metabole.eu';
    // Il link apre una pagina dell'app (che poi chiama l'API), non l'endpoint API diretto.
    const link = `${appUrl}/verifica-email?token=${token}`;
    const vars = { link, token };
    const { subject, html } = await this.resolve('email_verification', {
      subject: this.i18n.text(locale, 'mail.verify.subject'),
      html: this.i18n.text(locale, 'mail.verify.body', vars),
    }, vars);
    return this.send({ to, subject, html, templateKey: 'email_verification' });
  }

  /** Verifica della NUOVA email nel cambio email: il link apre una pagina dell'app. */
  async sendEmailChangeVerification(to: string, token: string, locale?: string | null): Promise<boolean> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://app.metabole.eu';
    const link = `${appUrl}/conferma-email?token=${token}`;
    const vars = { link, token };
    const { subject, html } = await this.resolve('email_verification', {
      subject: this.i18n.text(locale, 'mail.verify.subject'),
      html: this.i18n.text(locale, 'mail.verify.body', vars),
    }, vars);
    return this.send({ to, subject, html, templateKey: 'email_verification' });
  }

  /** Conferma allo staff che le provvigioni richieste sono state pagate. */
  async sendCommissionWithdrawalPaid(
    to: string,
    input: { amountCents: number; iban: string; date: Date },
    locale?: string | null,
  ): Promise<boolean> {
    const amount = (input.amountCents / 100).toFixed(2).replace('.', ',');
    const loc = this.i18n.normalize(locale);
    const html = loc === 'en'
      ? `<p>Hi,</p><p>we have paid out your requested commissions.</p><p><b>Amount:</b> € ${amount}<br/><b>IBAN:</b> ${input.iban}<br/><b>Date:</b> ${input.date.toLocaleDateString('en-GB')}</p><p>Thank you for your work!</p>`
      : `<p>Ciao,</p><p>abbiamo eseguito il bonifico delle provvigioni che avevi richiesto.</p><p><b>Importo:</b> € ${amount}<br/><b>IBAN:</b> ${input.iban}<br/><b>Data:</b> ${input.date.toLocaleDateString('it-IT')}</p><p>Grazie per il tuo lavoro!</p>`;
    const subject = loc === 'en' ? 'Metabole — commissions paid' : 'Metabole — provvigioni pagate';
    return this.send({ to, subject, html, templateKey: 'commission_paid' });
  }

  async sendBankTransferInstructions(
    to: string,
    input: { description: string; amountCents: number; bankDetails: string; reference: string },
    locale?: string | null,
  ): Promise<boolean> {
    const amount = (input.amountCents / 100).toFixed(2).replace('.', ',');
    const vars = { description: input.description, amount, bankDetails: input.bankDetails, reference: input.reference };
    const { subject, html } = await this.resolve('bank_transfer', {
      subject: this.i18n.text(locale, 'mail.bank.subject', { description: input.description }),
      html: this.i18n.text(locale, 'mail.bank.body', vars),
    }, vars);
    return this.send({ to, subject, html, templateKey: 'bank_transfer' });
  }

  /** Ricevuta: inviata a OGNI acquisto approvato, con la ricevuta PDF in allegato. */
  async sendPaymentReceipt(
    to: string,
    input: { description: string; amountCents: number; paymentId: string; date: Date },
    locale?: string | null,
    attachments?: Attachment[],
  ): Promise<boolean> {
    const amount = (input.amountCents / 100).toFixed(2).replace('.', ',');
    const loc = this.i18n.normalize(locale);
    const vars = {
      description: input.description,
      amount,
      date: input.date.toLocaleDateString(loc === 'en' ? 'en-GB' : 'it-IT'),
      paymentId: input.paymentId,
    };
    const { subject, html } = await this.resolve('payment_receipt', {
      subject: this.i18n.text(locale, 'mail.receipt.subject'),
      html: this.i18n.text(locale, 'mail.receipt.body', vars),
    }, vars);
    return this.send({ to, subject, html, templateKey: 'payment_receipt', attachments });
  }

  async sendPasswordReset(to: string, token: string, locale?: string | null): Promise<boolean> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://app.metabole.eu';
    const link = `${appUrl}/reset-password?token=${token}`;
    const vars = { link, token };
    const { subject, html } = await this.resolve('password_reset', {
      subject: this.i18n.text(locale, 'mail.reset.subject'),
      html: this.i18n.text(locale, 'mail.reset.body', vars),
    }, vars);
    return this.send({ to, subject, html, templateKey: 'password_reset' });
  }

  /** Copia email di una notifica in-app (solo se la cliente l'ha attivata). */
  async sendNotificationEmail(to: string, locale: string | null | undefined, title: string, body: string): Promise<boolean> {
    const vars = { title, body };
    const { subject, html } = await this.resolve('notification', {
      subject: this.i18n.text(locale, 'mail.notification.subject', { title }),
      html: this.i18n.text(locale, 'mail.notification.body', vars),
    }, vars);
    return this.send({ to, subject, html, templateKey: 'notification' });
  }

  /** Report mensile alla cliente (con PDF allegato). */
  async sendMonthlyReport(
    to: string,
    vars: Record<string, string>,
    locale?: string | null,
    attachments?: Attachment[],
  ): Promise<boolean> {
    const defaultHtml =
      `<p>Ciao ${vars.name},</p>` +
      `<p>ecco il tuo report di <b>${vars.period}</b>.</p>` +
      `<ul>` +
      `<li>Perso questo mese: <b>${vars.lostThisMonth}</b></li>` +
      `<li>Perso dall'inizio: <b>${vars.lostTotal}</b></li>` +
      `<li>Peso attuale: ${vars.currentWeight}</li>` +
      `<li>Obiettivo: ${vars.target}</li>` +
      `<li>Check-in registrati: ${vars.checkins}</li>` +
      `</ul>` +
      `<p>${vars.trend}</p>` +
      `<p>Trovi il report completo in allegato.</p>`;
    const { subject, html } = await this.resolve('monthly_report', {
      subject: `Metabole — il tuo report di ${vars.period}`,
      html: defaultHtml,
    }, vars);
    return this.send({ to, subject, html, templateKey: 'monthly_report', attachments });
  }

  /** Avviso al nutrizionista quando gli viene assegnata una cliente. */
  async sendClientAssignedToNutritionist(to: string, clientName: string, locale?: string | null): Promise<boolean> {
    const vars = { clientName };
    const defaultHtml = `<p>Ciao,</p><p>ti è stata assegnata una nuova cliente: <b>${clientName}</b>.</p><p>La trovi nel tuo elenco clienti su Metabole.</p>`;
    const { subject, html } = await this.resolve('client_assigned_nutritionist', {
      subject: 'Metabole — nuova cliente assegnata',
      html: defaultHtml,
    }, vars);
    return this.send({ to, subject, html, templateKey: 'client_assigned_nutritionist' });
  }
}
