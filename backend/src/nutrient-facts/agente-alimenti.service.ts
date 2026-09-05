import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AZIONE_RIGA, AZIONE_TAG, CHIAVE_ACCESO, CHIAVE_MAX, GIRI_A_VUOTO_MAX, MAX_PER_NOTTE, RICERCHE_PER_ALIMENTO, SCRITTO_DA, SYSTEM,
  contaTag, fonteDellaRiga, prompt, tagDallaTabella, vaglia,
  type ContoTag, type MotivoScarto, type RicettaDaTaggare, type RigaConAllergeni, type RispostaGrezza,
} from './agente-alimenti';
import { eAroma } from './aromi';
import type { RigaDaControllare } from './gemelli-alimenti';
import { normalizzaNome } from './valori-nutrizionali.service';

/**
 * ⚠️ **Il servizio non giudica: chiama `agente-alimenti.ts` e basta.** Il giudizio — cosa entra in
 * tabella, quali tag si aggiungono — sta nel modulo puro con le prove; qui ci sono la coda
 * (`nutrient_lookup_miss`), le chiamate all'AI, le scritture e il registro. Il perché di tutto sta
 * in testa a quel modulo.
 */

export interface EsitoCompilazione {
  acceso: boolean;
  /** Termini presi dalla coda. */
  guardati: number;
  scritte: number;
  /** Termini chiusi come «non è un alimento». */
  nonAlimenti: number;
  scartate: Partial<Record<MotivoScarto, number>>;
  /** Quante ricerche in rete ha fatto l'AI in tutto (si pagano a parte). */
  ricerche: number;
  fermatoPer?: string;
}

export interface EsitoTag {
  /** Righe della tabella con almeno un allergene dichiarato. */
  righeConAllergeni: number;
  ricette: number;
  tag: number;
  perAllergene: ContoTag['perAllergene'];
}

const AZIONE_A_MANO = 'catalog.recipe.allergens.set';
/** Dopo uno scarto il termine aspetta questi giorni prima di essere richiesto. */
export const GIORNI_DI_PAUSA = 30;
/**
 * ⚠️ «Non è un alimento» detto dall'AI NON chiude il termine come `ignored`: quello stato è di una
 * persona (`valori-nutrizionali.service.ts`), e dalla pagina non si riapre. Il termine resta nella
 * lista di lavoro, e l'agente non lo richiede per un anno.
 */
export const GIORNI_DI_PAUSA_NON_ALIMENTO = 365;

/** Tre ricette che usano quel nome, così l'AI capisce di che si parla («panna» da cucina, non da barba). */
export function esempiDiRicette(termine: string, ricette: readonly { name: string; ingredients: unknown }[]): string[] {
  const k = normalizzaNome(termine);
  const out: string[] = [];
  for (const r of ricette) {
    const nomi = Array.isArray(r.ingredients) ? (r.ingredients as { name?: unknown }[]).map((i) => normalizzaNome(String(i?.name ?? ''))) : [];
    if (nomi.includes(k)) out.push(r.name);
    if (out.length >= 3) break;
  }
  return out;
}

@Injectable()
export class AgenteAlimentiService {
  private readonly logger = new Logger(AgenteAlimentiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Il passo del cron: prima compila (se acceso), poi porta i tag dalla tabella alle ricette.
   * ⚠️ La seconda metà gira **anche a interruttore spento**: non chiama l'AI, non costa niente, e
   * una riga a cui la nutrizionista ha aggiunto un allergene a mano deve valere lo stesso.
   */
  async passoNotturno(): Promise<{ compilazione: EsitoCompilazione; tag: EsitoTag }> {
    const compilazione = await this.compila();
    const tag = await this.propagaTag();
    return { compilazione, tag };
  }

  async compila(): Promise<EsitoCompilazione> {
    const spento: EsitoCompilazione = { acceso: false, guardati: 0, scritte: 0, nonAlimenti: 0, scartate: {}, ricerche: 0 };
    const acceso = await this.configParams.getBool(CHIAVE_ACCESO, false);
    if (!acceso) return spento;
    const max = Math.max(0, Math.floor(await this.configParams.getNumber(CHIAVE_MAX, MAX_PER_NOTTE)));
    const esito: EsitoCompilazione = { ...spento, acceso: true };
    if (!max) return esito;

    /**
     * La coda è l'elenco che `alimentiDaCorreggere` riempie ogni notte: i nomi che le ricette usano
     * e la tabella non ha, dai più usati. ⚠️ Gli aromi (sale, pepe, prezzemolo) si saltano: le loro
     * calorie non contano per decisione scritta in `aromi.ts`, e una riga per «sale e pepe» sarebbe
     * una chiamata pagata per niente.
     */
    /**
     * ⛔ **UN TERMINE SCARTATO NON SI RICHIEDE PER TRENTA GIORNI.** Senza questa memoria le stesse venti
     * risposte bocciate tornerebbero in cima ogni notte (la coda è ordinata per uso, e resta `open`),
     * e il tetto per notte si spenderebbe tutto a rifare ieri. La memoria è il registro stesso.
     */
    const adesso = Date.now();
    const daNonRichiedere = new Set(((await this.prisma.auditLog.findMany({
      where: { action: AZIONE_RIGA, entityType: 'nutrient_lookup_miss', createdAt: { gte: new Date(adesso - GIORNI_DI_PAUSA_NON_ALIMENTO * 86_400_000) } } as never,
      select: { entityId: true, createdAt: true, metadata: true } as never,
    })) as { entityId: string | null; createdAt: Date; metadata: { esito?: string } | null }[])
      .filter((x) => x.metadata?.esito === 'non_alimento' || adesso - new Date(x.createdAt).getTime() <= GIORNI_DI_PAUSA * 86_400_000)
      .map((x) => String(x.entityId ?? '')));
    /** ⚠️ Gli esclusi si tolgono nella query: con la finestra presa prima del filtro, bastavano gli aromi in cima a svuotare la notte. */
    const coda = (await this.prisma.nutrientLookupMiss.findMany({
      where: { status: 'open', motivo: 'non_in_tabella', id: { notIn: [...daNonRichiedere] } } as never,
      orderBy: [{ ricette: 'desc' }, { times: 'desc' }] as never,
      take: 200,
      select: { id: true, term: true, ricette: true } as never,
    })) as unknown as { id: string; term: string; ricette: number }[];
    const daFare = coda.filter((m) => !eAroma(m.term)).slice(0, max);
    if (!daFare.length) return esito;

    const righe = (await this.prisma.nutrientFact.findMany({
      select: { name: true, synonyms: true, kcal: true, protein: true, carbs: true, sugars: true, fat: true, fiber: true } as never,
    })) as unknown as (RigaDaControllare & { synonyms: string[] })[];
    const nomiInTabella = new Set<string>();
    for (const r of righe) for (const n of [r.name, ...(r.synonyms ?? [])]) nomiInTabella.add(normalizzaNome(n));
    const esistenti: RigaDaControllare[] = righe.map(({ name, kcal, protein, carbs, sugars, fat, fiber }) => ({ name, kcal, protein, carbs, sugars, fat, fiber }));

    /** Le ricette recenti, lette una volta: servono solo per dare all'AI tre esempi d'uso del nome. */
    const ricetteRecenti = (await this.prisma.recipe.findMany({
      where: { active: true } as never,
      select: { name: true, ingredients: true } as never,
      take: 3000,
      orderBy: { createdAt: 'desc' } as never,
    })) as unknown as { name: string; ingredients: unknown }[];

    let vuoti = 0;
    for (const m of daFare) {
      if (vuoti >= GIRI_A_VUOTO_MAX) {
        esito.fermatoPer = `${GIRI_A_VUOTO_MAX} risposte a vuoto di fila`;
        break;
      }
      esito.guardati += 1;
      /** ⚠️ Nome o sinonimo già in tabella (qualcuno ha associato nel frattempo): si chiude senza chiamare. */
      if (nomiInTabella.has(normalizzaNome(m.term))) {
        await this.prisma.nutrientLookupMiss.update({ where: { id: m.id }, data: { status: 'filled' } as never });
        continue;
      }
      const esempi = esempiDiRicette(m.term, ricetteRecenti);
      const grezza = await this.ai.generateJsonConRicerca<RispostaGrezza>(SYSTEM, prompt(m.term, esempi), 3000, RICERCHE_PER_ALIMENTO);
      esito.ricerche += this.ai.lastRicerche;
      if (grezza === null) {
        /**
         * ⛔ Credito finito, chiave non valida, modello inesistente: riprovare non cambia niente (12/8,
         * 270 chiamate allo stesso 400). Ci si ferma qui e lo si dice.
         */
        if (this.ai.lastErrorFatale) {
          esito.fermatoPer = this.ai.lastError ?? 'errore AI';
          this.logger.warn(`Agente alimenti fermato: ${esito.fermatoPer}`);
          break;
        }
        vuoti += 1;
        esito.scartate.risposta_vuota = (esito.scartate.risposta_vuota ?? 0) + 1;
        continue;
      }
      const v = vaglia(m.term, grezza, esistenti);
      if (v.esito === 'non_alimento') {
        vuoti = 0;
        esito.nonAlimenti += 1;
        await this.audit.log({ action: AZIONE_RIGA, entityType: 'nutrient_lookup_miss', entityId: m.id, metadata: { termine: m.term, esito: 'non_alimento' } });
        continue;
      }
      if (v.esito === 'scartata') {
        vuoti += 1;
        esito.scartate[v.motivo] = (esito.scartate[v.motivo] ?? 0) + 1;
        this.logger.warn(`Agente alimenti: «${m.term}» scartato (${v.motivo}: ${v.dettaglio})`);
        await this.audit.log({ action: AZIONE_RIGA, entityType: 'nutrient_lookup_miss', entityId: m.id, metadata: { termine: m.term, esito: 'scartata', motivo: v.motivo, dettaglio: v.dettaglio } });
        continue;
      }
      vuoti = 0;
      const { riga } = v;
      const creata = (await this.prisma.nutrientFact.create({
        data: {
          name: riga.name, synonyms: [], category: riga.category, state: riga.state,
          kcal: riga.kcal, protein: riga.protein, carbs: riga.carbs, sugars: riga.sugars, fat: riga.fat, fiber: riga.fiber,
          allergens: riga.allergens,
          source: fonteDellaRiga(riga), sourceRef: riga.sourceRef, note: null,
          filledBy: SCRITTO_DA,
          /** ⛔ Da confermare — e usata subito: decisione di Simone del 5/9, il perché in testa al modulo puro. */
          verifiedAt: null, verifiedById: null,
        } as never,
        select: { id: true } as never,
      })) as { id: string };
      /**
       * ⚠️ Il termine si chiude solo se la riga RISOLVE il conto (stato a crudo o non applicabile). Con
       * «cotto» il termine resta aperto: domani `alimentiDaCorreggere` lo rimette come «solo da cotto»
       * nella lista della nutrizionista, e questo agente non lo prende più (guarda solo `non_in_tabella`).
       */
      if (riga.risolve) await this.prisma.nutrientLookupMiss.update({ where: { id: m.id }, data: { status: 'filled' } as never });
      esistenti.push({ name: riga.name, kcal: riga.kcal, protein: riga.protein, carbs: riga.carbs, sugars: riga.sugars, fat: riga.fat, fiber: riga.fiber });
      nomiInTabella.add(riga.name);
      esito.scritte += 1;
      await this.audit.log({
        action: AZIONE_RIGA, entityType: 'nutrient_fact', entityId: creata.id,
        metadata: { termine: m.term, esito: 'scritta', allergens: riga.allergens, kcal: riga.kcal, stato: riga.state, risolve: riga.risolve, fonte: riga.sourceRef, affidabilita: riga.affidabilita, ricerche: this.ai.lastRicerche, ricetteCheLoUsano: m.ricette },
      });
    }
    this.logger.log(
      `Agente alimenti: ${esito.scritte} righe scritte su ${esito.guardati} guardate `
      + `(${esito.nonAlimenti} non alimenti, ${Object.values(esito.scartate).reduce((a, b) => a + (b ?? 0), 0)} scartate, ${esito.ricerche} ricerche)`
      + (esito.fermatoPer ? ` — fermato: ${esito.fermatoPer}` : ''),
    );
    return esito;
  }

  /**
   * ⛔ **I TAG DALLA TABELLA ALLE RICETTE**: per ogni riga con allergeni dichiarati, le ricette che
   * hanno quell'ingrediente (nome uguale) prendono il tag. Aggiunge, mai toglie, salta chi ha scelto
   * i tag a mano, non tocca `allergensReviewed` — le stesse tre regole di `ripara:allergeni-mancanti`.
   */
  async propagaTag(): Promise<EsitoTag> {
    const righe = (await this.prisma.nutrientFact.findMany({
      where: { NOT: { allergens: { isEmpty: true } } } as never,
      select: { name: true, synonyms: true, allergens: true } as never,
    })) as unknown as RigaConAllergeni[];
    const vuoto: EsitoTag = { righeConAllergeni: righe.length, ricette: 0, tag: 0, perAllergene: [] };
    if (!righe.length) return vuoto;

    const [ricette, aMano] = await Promise.all([
      this.prisma.recipe.findMany({ select: { id: true, name: true, ingredients: true, allergens: true } as never }) as unknown as Promise<RicettaDaTaggare[]>,
      this.prisma.auditLog.findMany({ where: { action: AZIONE_A_MANO, entityType: 'recipe' } as never, select: { entityId: true } as never }) as unknown as Promise<{ entityId: string | null }[]>,
    ]);
    const toccate = new Set(aMano.map((x) => String(x.entityId ?? '')));
    const tag = tagDallaTabella(ricette.map((r) => ({ ...r, toccataAMano: toccate.has(r.id) })), righe);
    if (!tag.length) return vuoto;

    const perRicetta = new Map<string, Set<string>>();
    for (const t of tag) perRicetta.set(t.recipeId, new Set([...(perRicetta.get(t.recipeId) ?? []), t.allergen]));
    const attuali = new Map(ricette.map((r) => [r.id, r.allergens ?? []]));
    for (const [id, nuovi] of perRicetta) {
      await this.prisma.recipe.update({ where: { id }, data: { allergens: [...new Set([...(attuali.get(id) ?? []), ...nuovi])] } as never });
    }
    const conto = contaTag(tag);
    /**
     * ⚠️ Una riga di registro PER RICETTA, con l'ingrediente e la riga della tabella da cui viene il
     * tag: è quello che serve per disfare, se una riga dell'AI si rivela sbagliata («aggiunge, mai
     * toglie» vale per il vocabolario; qui la sorgente è l'AI, e deve restare rintracciabile).
     */
    await this.audit.logMany([...perRicetta.keys()].map((id) => ({
      action: AZIONE_TAG, entityType: 'recipe', entityId: id,
      metadata: { aggiunti: tag.filter((t) => t.recipeId === id).map((t) => ({ allergen: t.allergen, ingrediente: t.ingrediente, alimento: t.alimento })) },
    })));
    this.logger.log(`Allergeni dalla tabella alimenti: ${tag.length} tag aggiunti su ${conto.ricette} ricette.`);
    return { righeConAllergeni: righe.length, ricette: conto.ricette, tag: tag.length, perAllergene: conto.perAllergene };
  }
}
