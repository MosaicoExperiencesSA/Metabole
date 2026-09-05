import { Injectable, Logger } from '@nestjs/common';
import { classificaErroreAi } from './errori-ai';
import { ConfigService } from '@nestjs/config';
import { ConfigParamsService } from '../config-params/config-params.service';

/**
 * Servizio AI generativo (Claude / Anthropic) condiviso.
 * Attivo SOLO se AI_API_KEY è configurata (pannello Render) e il relativo
 * parametro è "true". Qualsiasi errore ritorna null → chi chiama usa il fallback.
 * Vincoli di sicurezza: nessun consiglio medico/diagnosi; i temi sanitari
 * restano gestiti dal filtro deterministico (escalation al nutrizionista).
 */
/**
 * Ripara il JSON quasi-valido tipico degli LLM su output grandi: rimuove le
 * virgole finali, inserisce virgole mancanti fra valori adiacenti e chiude
 * eventuali parentesi/stringhe lasciate aperte (troncatura). Best-effort: gira
 * solo quando JSON.parse ha già fallito.
 */
function repairJson(input: string): string {
  const src = input.trim();
  // Pass 1: escapa i caratteri di controllo dentro le stringhe e traccia le parentesi.
  let out = '';
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const code = src.charCodeAt(i);
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { out += ch; inStr = false; continue; }
      if (code < 0x20) {
        out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : ' ';
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
    out += ch;
  }
  if (inStr) out += '"';
  // Pass 2: virgole finali + virgole mancanti fra token strutturali (fuori dalle stringhe).
  out = out
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}(\s*)\{/g, '},$1{')
    .replace(/](\s*)\[/g, '],$1[')
    .replace(/}(\s*)"/g, '},$1"')
    .replace(/](\s*)"/g, '],$1"')
    .replace(/"(\s*\n\s*)"/g, '",$1"')
    .replace(/(true|false|null|\d)(\s*\n\s*)"/g, '$1,$2"');
  // Pass 3: chiude parentesi/graffe lasciate aperte (troncatura).
  while (stack.length) { const b = stack.pop(); out += b === '{' ? '}' : ']'; }
  return out;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  /** Motivo dell'ultimo fallimento di generateJson (per messaggi d'errore veritieri). */
  lastError: string | null = null;
  /**
   * Vero se l'ultimo fallimento è **definitivo**: riprovare è inutile finché non intervieni tu.
   *
   * Serve al generatore di catalogo (12/8). Il credito Anthropic è finito nel mezzo di una
   * generazione, e ogni chiamata tornava 400: la funzione che genera un pasto riprova tre volte, il
   * giro passa cinque pasti, il backoffice passa diciotto varianti — **270 chiamate inutili** per un
   * errore che si sapeva già alla prima. E dall'altra parte una persona che guarda una barra avanzare
   * senza che possa succedere niente.
   *
   * Credito esaurito, chiave non valida e modello inesistente sono di questo tipo. Un 429 o un
   * timeout no: quelli passano da soli.
   */
  lastErrorFatale = false;

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

  /**
   * Risposta conversazionale dell'assistente. Ritorna null se non disponibile.
   *
   * `dati` sono i valori della banca dati nutrizionale che riguardano gli alimenti citati nel
   * messaggio (vedi `nutrient-facts/valori-nutrizionali.service.ts`). Quando ci sono, il divieto di
   * affermare numeri diventa il suo contrario: **usa questi e nessun altro**. È la richiesta di
   * Simone dell'11/8 — «può affermarlo ma deve prima verificare e dare dati corretti» — e chi
   * controlla che sia rispettata non è il prompt ma `chat/guardia-risposta-ai.ts`.
   */
  async assistantReply(
    userMessage: string,
    locale: 'it' | 'en',
    dati?: { righe: string[]; fonti: string[] } | null,
  ): Promise<string | null> {
    const key = this.config.get<string>('AI_API_KEY');
    if (!key) return null;
    const model = this.config.get<string>('AI_MODEL') ?? 'claude-haiku-4-5';
    const language = locale === 'en' ? 'English' : 'italiano';
    /**
     * IL NOME E IL GENERE, che qui non c'erano (13/8).
     *
     * Il prompt diceva «Sei l'assistente di Metabole»: senza nome e senza genere. Il modello
     * ripiegava sul maschile e usciva «sono felicissimo di festeggiare i tuoi progressi», firmato
     * **Gaia**. Segnalato da Simone su un messaggio dell'8/8.
     *
     * Non è una sfumatura di stile: le clienti la chiamano per nome, la vedono con la sua faccia, e
     * una che parla di sé al maschile smette di essere una persona e diventa un programma. Basta
     * dire chi è: il modello concorda da sé, in tutta la conversazione, senza che serva un
     * controllo sull'output.
     */
    const system =
      `Ti chiami Gaia e sei l'assistente di Metabole, un'app di dimagrimento sano e sostenibile ` +
      `(NON un dispositivo medico). Sei una DONNA: parla sempre di te al femminile — «sono felice», ` +
      `«sono contenta», «sono qui», «te lo dico io» — e mai al maschile, in nessuna frase. ` +
      `Rispondi in ${language} in modo caldo, breve e concreto (massimo 3 frasi). ` +
      `Aiuti con dubbi su menu e pasti, abitudini, motivazione e uso dell'app. ` +
      `NON dare mai consigli medici, diagnosi, dosaggi o terapie: per qualsiasi tema di salute invita gentilmente a scrivere al nutrizionista. ` +
      // Aggiunto l'11/8 dopo il basmati (vedi `chat/guardia-risposta-ai.ts`): il divieto di
      // «consigli medici» non copriva le AFFERMAZIONI nutrizionali, e il modello le faceva con la
      // sicurezza di chi cita una tabella — sbagliando il verso del confronto.
      `NON affermare MAI dati nutrizionali: niente indice glicemico, calorie, proteine, fibre, ` +
      `niente confronti fra due alimenti («ha più/meno…», «è più raffinato», «sazia meno»), ` +
      `niente effetti sull'organismo. Non li hai davanti e non li devi ricordare a memoria. ` +
      `Se la persona chiede se un alimento può stare al posto di un altro, NON giudicare: quella ` +
      `decisione è della nutrizionista (ci sono tabelle di equivalenza approvate da lei), quindi dille ` +
      `che la domanda la giri a lei. Dire «non lo so, te lo faccio dire da chi lo sa» è una risposta giusta. ` +
      `Non inventare dati personali della persona (peso, misure, piano). Rispondi SOLO con il messaggio, senza premesse.`;

    /**
     * MODALITÀ FONDATA: i dati arrivano dalla nostra banca dati, con la fonte. Le istruzioni si
     * capovolgono — non «non dire numeri» ma «di' SOLO questi numeri» — e i vincoli che restano sono
     * quelli che i dati non coprono: la sazietà non è in tabella, e cosa può sostituire cosa lo
     * decide la nutrizionista.
     */
    const systemFondato =
      dati && dati.righe.length
        ? `${system}\n\n` +
          `DATI VERIFICATI dal nostro archivio nutrizionale, con la fonte fra parentesi quadre:\n` +
          dati.righe.map((r) => `- ${r}`).join('\n') +
          `\n\nUsa SOLO questi numeri: non aggiungerne altri, non arrotondare, non stimare, non ricordare valori a memoria. ` +
          `Se un range è indicato (es. «fra 50 e 76»), dillo come range e spiega in una frase che dipende da varietà e cottura: ` +
          `non scegliere un numero al centro. Puoi confrontare fra loro i valori qui sopra. ` +
          `NON dire che un alimento sazia più o meno di un altro, né che si assorbe più lentamente: non lo sappiamo. ` +
          `NON dire se un alimento può sostituire un altro: quella decisione è della nutrizionista. ` +
          `Puoi citare la fonte in modo naturale («secondo le tabelle internazionali»).`
        : system;

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
          system: systemFondato,
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
   * Generazione STRUTTURATA: ritorna il JSON estratto dalla risposta (o null se l'AI
   * non è disponibile / risposta non parsabile). Usata per generare bozze di catalogo.
   */
  async generateJson<T = unknown>(system: string, userPrompt: string, maxTokens = 4000): Promise<T | null> {
    this.lastError = null;
    this.lastErrorFatale = false;
    const key = this.config.get<string>('AI_API_KEY');
    if (!key) {
      this.lastError = 'AI_API_KEY non configurata sul server.';
      this.lastErrorFatale = true;
      return null;
    }
    const model = this.config.get<string>('AI_MODEL') ?? 'claude-haiku-4-5';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userPrompt }] }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        // Che dire alla persona, e se ha senso riprovare: due domande diverse, una sola funzione che
        // le risponde (`errori-ai.ts`, con il caso vero del 12/8 fissato nei test).
        const { messaggio, fatale } = classificaErroreAi(res.status, body, model);
        this.lastError = messaggio;
        this.lastErrorFatale = fatale;
        this.logger.warn(`AI generateJson: risposta ${res.status} ${body.slice(0, 200)}`);
        return null;
      }
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
      return this.estraiJson<T>(text, 'generateJson');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = /aborted/i.test(msg) ? 'timeout della richiesta AI (90s)' : msg;
      this.logger.warn(`AI generateJson non disponibile: ${msg}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Il JSON dentro il testo dell'AI: recinto ```json, o la prima parentesi; poi la riparazione. */
  private estraiJson<T>(text: string, chi: string): T | null {
    const fence = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
    const blob = fence ? fence[1] : (text.match(/[[{][\s\S]*[\]}]/)?.[0] ?? text);
    try {
      return JSON.parse(blob) as T;
    } catch {
      // Secondo tentativo con riparazione (virgole mancanti/finali, troncature).
      try {
        return JSON.parse(repairJson(blob)) as T;
      } catch (e) {
        this.lastError = `l'AI non ha restituito JSON valido${e instanceof Error ? ` (${e.message})` : ''}`;
        this.logger.warn(`AI ${chi}: JSON non valido anche dopo repair`);
        return null;
      }
    }
  }

  /** Quante ricerche in rete ha fatto l'ultima chiamata di `generateJsonConRicerca` (si pagano a parte). */
  lastRicerche = 0;

  /**
   * ⛔ **GENERAZIONE STRUTTURATA CON LA RICERCA IN RETE** (5/9, per l'agente alimenti: «cerca in
   * internet gli allergeni e i valori nutrizionali»). È `generateJson` con lo strumento `web_search`
   * di Anthropic acceso: il modello cerca da solo, legge le pagine e risponde; qui si legge il JSON
   * dall'**ultimo** blocco di testo, perché con la ricerca la risposta arriva a pezzi (ricerca,
   * risultati, testo, ricerca, testo…) e il primo pezzo è quasi sempre «cerco».
   *
   * ⚠️ **Costa a parte**: ogni ricerca si paga oltre ai token (`maxRicerche` è il tetto per
   * chiamata, e chi chiama ha il suo tetto per notte). `lastRicerche` dice quante ne ha fatte,
   * per il log e per i conti.
   *
   * ⚠️ `pause_turn`: quando le ricerche sono lunghe l'API si ferma a metà e chiede di continuare
   * rimandandole la sua stessa risposta. Si continua al massimo tre volte, poi si prende quello
   * che c'è.
   */
  async generateJsonConRicerca<T = unknown>(
    system: string, userPrompt: string, maxTokens = 3000, maxRicerche = 3,
  ): Promise<T | null> {
    this.lastError = null;
    this.lastErrorFatale = false;
    this.lastRicerche = 0;
    const key = this.config.get<string>('AI_API_KEY');
    if (!key) {
      this.lastError = 'AI_API_KEY non configurata sul server.';
      this.lastErrorFatale = true;
      return null;
    }
    const model = this.config.get<string>('AI_MODEL') ?? 'claude-haiku-4-5';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    type Blocco = { type: string; text?: string };
    type Risposta = { content?: Blocco[]; stop_reason?: string; usage?: { server_tool_use?: { web_search_requests?: number } } };
    const messages: { role: 'user' | 'assistant'; content: unknown }[] = [{ role: 'user', content: userPrompt }];
    try {
      let testi: string[] = [];
      for (let giro = 0; giro < 4; giro += 1) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model, max_tokens: maxTokens, system, messages,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxRicerche }],
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          const { messaggio, fatale } = classificaErroreAi(res.status, body, model);
          this.lastError = messaggio;
          this.lastErrorFatale = fatale;
          this.logger.warn(`AI generateJsonConRicerca: risposta ${res.status} ${body.slice(0, 200)}`);
          return null;
        }
        const data = (await res.json()) as Risposta;
        this.lastRicerche += data.usage?.server_tool_use?.web_search_requests ?? 0;
        testi = [...testi, ...(data.content ?? []).filter((c) => c.type === 'text' && c.text).map((c) => c.text as string)];
        if (data.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: data.content ?? [] });
      }
      /**
       * ⛔ **TUTTI i blocchi di testo, incollati senza niente in mezzo.** Con la ricerca l'API spezza la
       * risposta in un blocco `text` per ogni citazione: `{"kcal": ` · `315` · `,"allergeni":…}`. Prendere
       * un blocco solo — anche «l'ultimo con una parentesi» — vuol dire leggere un terzo di JSON e
       * scartare una riga buona (trovato dalla revisione avversariale del 5/9).
       */
      return this.estraiJson<T>(testi.join(''), 'generateJsonConRicerca');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = /aborted/i.test(msg) ? 'timeout della richiesta AI (120s)' : msg;
      this.logger.warn(`AI generateJsonConRicerca non disponibile: ${msg}`);
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
