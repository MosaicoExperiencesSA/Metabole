import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Email transazionali via Brevo (API HTTP v3).
 * Se BREVO_API_KEY manca o è un segnaposto, il contenuto viene loggato
 * invece che inviato (utile in dev): l'operazione chiamante non fallisce mai.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

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

  async sendEmailVerification(to: string, token: string): Promise<boolean> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://metabole-backend.onrender.com';
    const link = `${appUrl}/api/v1/auth/verify-email?token=${token}`;
    return this.send({
      to,
      subject: 'Metabole — conferma la tua email',
      html: `<p>Benvenuta/o in Metabole!</p>
<p>Per confermare il tuo indirizzo email clicca qui: <a href="${link}">conferma email</a></p>
<p>Oppure usa questo codice nell'app: <code>${token}</code></p>
<p>Il link scade tra 48 ore. Se non ti sei registrata/o tu, ignora questa email.</p>`,
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<boolean> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://metabole-backend.onrender.com';
    const link = `${appUrl}/reset-password?token=${token}`;
    return this.send({
      to,
      subject: 'Metabole — reimposta la password',
      html: `<p>Hai chiesto di reimpostare la password del tuo account Metabole.</p>
<p>Usa questo codice: <code>${token}</code> (oppure il link: <a href="${link}">reimposta password</a>)</p>
<p>Il codice scade tra 1 ora. Se non l'hai richiesto tu, ignora questa email: la password resta invariata.</p>`,
    });
  }
}
