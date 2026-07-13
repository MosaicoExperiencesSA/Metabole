import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigParamsService } from '../config-params/config-params.service';

/**
 * Servizio AI generativo (Claude / Anthropic) condiviso.
 * Attivo SOLO se AI_API_KEY è configurata (pannello Render) e il relativo
 * parametro è "true". Qualsiasi errore ritorna null → chi chiama usa il fallback.
 * Vincoli di sicurezza: nessun consiglio medico/diagnosi; i temi sanitari
 * restano gestiti dal filtro deterministico (escalation al nutrizionista).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly configParams: ConfigParamsService,
  ) {}

  private hasKey(): boolean {
    const key = this.config.get<string>('AI_API_KEY');
    return !!key && key.length >= 10;
  }

  /** L'assistente chat usa Claude solo se c'è la chiave E il parametro è attivo. */
  async assistantEnabled(): Promise<boolean> {
    if (!this.hasKey()) return false;
    return (await this.configParams.getString('ai_assistant_enabled', 'false')) === 'true';
  }

  /** Risposta conversazionale dell'assistente. Ritorna null se non disponibile. */
  async assistantReply(userMessage: string, locale: 'it' | 'en'): Promise<string | null> {
    const key = this.config.get<string>('AI_API_KEY');
    if (!key) return null;
    const model = this.config.get<string>('AI_MODEL') ?? 'claude-haiku-4-5';
    const language = locale === 'en' ? 'English' : 'italiano';
    const system =
      `Sei l'assistente di Metabole, un'app di dimagrimento sano e sostenibile (NON un dispositivo medico). ` +
      `Rispondi in ${language} in modo caldo, breve e concreto (massimo 3 frasi). ` +
      `Aiuti con dubbi su menu e pasti, abitudini, motivazione e uso dell'app. ` +
      `NON dare mai consigli medici, diagnosi, dosaggi o terapie: per qualsiasi tema di salute invita gentilmente a scrivere al nutrizionista. ` +
      `Non inventare dati personali della persona (peso, misure, piano). Rispondi SOLO con il messaggio, senza premesse.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9_000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          system,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`AI assistente: risposta ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const out = data.content?.find((c) => c.type === 'text')?.text?.trim();
      return out && out.length > 0 && out.length < 800 ? out : null;
    } catch (err) {
      this.logger.warn(`AI assistente non disponibile: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Riassume una conversazione (chiusura giornaliera): titolo breve + una frase.
   * Ritorna null se l'AI non è disponibile → chi chiama usa un fallback deterministico.
   */
  async summarizeConversation(
    transcript: string,
    locale: 'it' | 'en',
  ): Promise<{ title: string; summary: string } | null> {
    const key = this.config.get<string>('AI_API_KEY');
    if (!key) return null;
    const model = this.config.get<string>('AI_MODEL') ?? 'claude-haiku-4-5';
    const language = locale === 'en' ? 'English' : 'italiano';
    const system =
      `Riassumi la conversazione seguente in ${language}. ` +
      `Rispondi ESATTAMENTE in due righe: ` +
      `riga 1 = un TITOLO breve (massimo 6 parole, senza virgolette); ` +
      `riga 2 = un riassunto in UNA frase. ` +
      `Niente dati sanitari sensibili nel testo, nessun consiglio medico.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9_000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 200,
          system,
          messages: [{ role: 'user', content: transcript.slice(0, 6000) }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`AI riassunto: risposta ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const out = data.content?.find((c) => c.type === 'text')?.text?.trim();
      if (!out) return null;
      const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
      const title = (lines[0] ?? '').replace(/^["']|["']$/g, '').slice(0, 80);
      const summary = (lines[1] ?? lines[0] ?? '').slice(0, 300);
      if (!title) return null;
      return { title, summary };
    } catch (err) {
      this.logger.warn(`AI riassunto non disponibile: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
