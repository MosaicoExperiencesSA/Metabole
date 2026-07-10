import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '../i18n/i18n.service';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Email transazionali via Brevo (API HTTP v3), localizzate (i18n, spec sez. 12).
 * Se BREVO_API_KEY manca o è un segnaposto, il contenuto viene loggato
 * invece che inviato (utile in dev): l'operazione chiamante non fallisce mai.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  private get apiKey(): string | null {
    const key = this.config.get<string>('BREVO_API_KEY');
    if (!key || key === 'todo' || key.length < 10) return null;
    return key;
  }

  private get sender(): { name: string; email: string } {
    const raw = this.config.get<string>('MAIL_FROM') ?? 'Metabole <no-reply@metabole.app>';
    const match = raw.match(/^(.*)<(.+)>$/);
    if (match) return { name: match[1].trim() || 'Metabole', email: match[2].trim() };
    return { name: 'Metabole', email: raw.trim() };
  }

  async send(input: SendMailInput): Promise<boolean> {
    const key = this.apiKey;
    if (!key) {
      this.logger.warn(
        `BREVO_API_KEY non configurata: email NON inviata. to=${input.to} subject="${input.subject}"`,
      );
      return false;
    }
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': key,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: input.to }],
          subject: input.subject,
          htmlContent: input.html,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Brevo ha risposto ${res.status}: ${body.slice(0, 300)}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Invio email fallito (to=${input.to})`,
        err instanceof Error ? err.stack : String(err),
      );
      return false;
    }
  }

  async sendEmailVerification(to: string, token: string, locale?: string | null): Promise<boolean> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://metabole-backend.onrender.com';
    const link = `${appUrl}/api/v1/auth/verify-email?token=${token}`;
    return this.send({
      to,
      subject: this.i18n.text(locale, 'mail.verify.subject'),
      html: this.i18n.text(locale, 'mail.verify.body', { link, token }),
    });
  }

  /** Estremi per il bonifico (flusso: richiesta → email → contabile → approvazione). */
  async sendBankTransferInstructions(
    to: string,
    input: { description: string; amountCents: number; bankDetails: string; reference: string },
    locale?: string | null,
  ): Promise<boolean> {
    const amount = (input.amountCents / 100).toFixed(2).replace('.', ',');
    return this.send({
      to,
      subject: this.i18n.text(locale, 'mail.bank.subject', { description: input.description }),
      html: this.i18n.text(locale, 'mail.bank.body', {
        description: input.description,
        amount,
        bankDetails: input.bankDetails,
        reference: input.reference,
      }),
    });
  }

  /** Ricevuta: inviata a OGNI acquisto approvato. */
  async sendPaymentReceipt(
    to: string,
    input: { description: string; amountCents: number; paymentId: string; date: Date },
    locale?: string | null,
  ): Promise<boolean> {
    const amount = (input.amountCents / 100).toFixed(2).replace('.', ',');
    const loc = this.i18n.normalize(locale);
    return this.send({
      to,
      subject: this.i18n.text(locale, 'mail.receipt.subject'),
      html: this.i18n.text(locale, 'mail.receipt.body', {
        description: input.description,
        amount,
        date: input.date.toLocaleDateString(loc === 'en' ? 'en-GB' : 'it-IT'),
        paymentId: input.paymentId,
      }),
    });
  }

  async sendPasswordReset(to: string, token: string, locale?: string | null): Promise<boolean> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://metabole-backend.onrender.com';
    const link = `${appUrl}/reset-password?token=${token}`;
    return this.send({
      to,
      subject: this.i18n.text(locale, 'mail.reset.subject'),
      html: this.i18n.text(locale, 'mail.reset.body', { link, token }),
    });
  }

  /** Copia email di una notifica in-app (solo se la cliente l'ha attivata). */
  async sendNotificationEmail(
    to: string,
    locale: string | null | undefined,
    title: string,
    body: string,
  ): Promise<boolean> {
    return this.send({
      to,
      subject: this.i18n.text(locale, 'mail.notification.subject', { title }),
      html: this.i18n.text(locale, 'mail.notification.body', { title, body }),
    });
  }
}
