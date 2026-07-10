import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigParamsService } from '../config-params/config-params.service';
import { I18nService, MessageParams } from '../i18n/i18n.service';

export type MessageTone = 'supportive' | 'neutral' | 'encouraging' | 'celebratory' | 'gentle';

export interface ComposeInput {
  locale?: string | null;
  key: string; // chiave nel catalogo i18n
  params?: MessageParams;
  tone?: MessageTone; // deciso dal MOTORE, mai dall'AI
  seed?: string; // per la scelta deterministica della variante
}

export interface ComposedMessage {
  title: string;
  body: string;
  composer: 'template' | 'ai';
}

const TONE_INSTRUCTIONS: Record<MessageTone, { it: string; en: string }> = {
  supportive: { it: 'tono di sostegno, caldo, senza pressione', en: 'supportive, warm, zero pressure' },
  neutral: { it: 'tono neutro e chiaro', en: 'neutral and clear tone' },
  encouraging: { it: 'tono incoraggiante e positivo', en: 'encouraging, upbeat tone' },
  celebratory: { it: 'tono festoso: si celebra un risultato', en: 'celebratory tone: a result is being celebrated' },
  gentle: { it: 'tono delicato e rassicurante', en: 'gentle, reassuring tone' },
};

/**
 * Layer AI di supporto (spec 7.2): l'AI generativa NON decide mai —
 * il motore sceglie menu, tono e timing; qui si compone solo il testo.
 *
 * - Base: varianti di template dal catalogo i18n (deterministiche, testabili).
 * - Se AI_API_KEY è configurata (pannello Render) E il parametro
 *   `ai_composer_enabled` è "true", il corpo viene riformulato da Claude
 *   mantenendo tono e contenuto; qualsiasi errore → fallback al template.
 * - Tracciabilità: il campo `composer` dice chi ha scritto il testo.
 */
@Injectable()
export class MessageComposerService {
  private readonly logger = new Logger(MessageComposerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly configParams: ConfigParamsService,
    private readonly i18n: I18nService,
  ) {}

  async compose(input: ComposeInput): Promise<ComposedMessage> {
    const rendered = this.i18n.render(input.locale, input.key, input.params, input.seed ?? '');
    const base: ComposedMessage = { ...rendered, composer: 'template' };

    if (!(await this.aiEnabled())) return base;
    try {
      const rewritten = await this.rewriteWithAi(base.body, input.tone ?? 'neutral', this.i18n.normalize(input.locale));
      if (rewritten) return { title: base.title, body: rewritten, composer: 'ai' };
    } catch (err) {
      this.logger.warn(`AI composer non disponibile, uso il template: ${err instanceof Error ? err.message : String(err)}`);
    }
    return base;
  }

  private async aiEnabled(): Promise<boolean> {
    const key = this.config.get<string>('AI_API_KEY');
    if (!key || key.length < 10) return false;
    const enabled = await this.configParams.getString('ai_composer_enabled', 'false');
    return enabled === 'true';
  }

  /** Riformulazione vincolata: stesso significato, stesso tono, max 2 frasi. */
  private async rewriteWithAi(text: string, tone: MessageTone, locale: 'it' | 'en'): Promise<string | null> {
    const key = this.config.get<string>('AI_API_KEY');
    const model = this.config.get<string>('AI_MODEL') ?? 'claude-haiku-4-5';
    const toneText = TONE_INSTRUCTIONS[tone][locale];
    const language = locale === 'en' ? 'English' : 'italiano';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key as string,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 200,
          system:
            `Riformula il messaggio dell'utente per una app di benessere. Lingua: ${language}. ` +
            `Mantieni ESATTAMENTE lo stesso significato e le stesse informazioni (numeri inclusi), ${toneText}. ` +
            'Massimo 2 frasi. Nessun claim medico o terapeutico. Rispondi SOLO col testo riformulato.',
          messages: [{ role: 'user', content: text }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`AI composer: risposta ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const out = data.content?.find((c) => c.type === 'text')?.text?.trim();
      return out && out.length > 0 && out.length < 500 ? out : null;
    } finally {
      clearTimeout(timer);
    }
  }
}
