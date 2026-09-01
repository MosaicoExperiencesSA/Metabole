import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { abbinaPerRicetta, paroleChe } from '../nutrient-facts/abbinamento-alimenti';
import { normalizzaNome } from '../nutrient-facts/valori-nutrizionali.service';
import { suggestAllergens } from './allergens';
import { paniereDellaVariante, ricetteDellaGiornata } from './appartenenza-panieri';
import {
  GIRI_A_VUOTO_MAX, OBIETTIVO_PER_PASTO, type PassoDelPiano, eUnPastoLeggero,
  grammiDi, pianoDiRiempimento, quanteChiederne, vaglia,
} from './agente-pasti-leggeri';
import { diCosaE, vaBeneAColazione } from './piatto-di-cosa';
import { slotCapofila } from '../common/slot-pasto';

/**
 * L'AGENTE CHE TIENE PIENI COLAZIONI, SPUNTINI E MERENDE.
 *
 * ⛔ **Non è uno strumento di migrazione: è un pezzo del prodotto.** Richiesta di Simone, 31/8:
 * *«l'agente servirà anche quando le clienti esauriranno quelle presenti»*. Quindi vive qui e non in
 * uno script di `prisma/`: gira dal cron della notte come tutti gli altri passi, con un tetto suo, e
 * quando i panieri sono pieni non fa niente e non costa niente.
 *
 * ## Perché non è «un altro generatore»
 *
 * Il generatore che c'è ha riempito le colazioni di «Merluzzo crudo in tartare» e «Polpo freddo
 * marinato», e nessuno se n'è accorto per mesi. ⚠️ **Chiedere all'AI di rispettare un criterio non è
 * farglielo rispettare.** Questo si rilegge: chiede, guarda cos'è arrivato con la **stessa** regola
 * del tabulato (`piatto-di-cosa.ts`), tiene solo quello che passa, richiede il resto — e quello che
 * scarta lo conta, perché un agente che scarta in silenzio è un agente di cui non si può sapere se
 * sta funzionando.
 *
 * ## I tre freni, e perché ce ne vogliono tre
 *
 * · **il tetto per giro** (`agente_leggeri_max`, default 20 di notte): ogni ricetta è una chiamata
 *   pagata, e un agente senza tetto è un agente che una notte spende quanto un mese;
 * · **i giri a vuoto** (3): se su una cella non esce niente per tre volte, lì il criterio e il
 *   regime insieme lasciano poco spazio — una colazione keto vegana che non sia carne, pesce o
 *   verdura è un problema vero. Si passa oltre e si dichiara, invece di bruciare chiamate;
 * · **l'interruttore** (`agente_leggeri_acceso`, default spento): un agente che scrive in catalogo
 *   si accende quando qualcuno decide, non perché è stato distribuito.
 *
 * ⚠️ **Le ricette nascono BOZZE** (`active: false`, `allergensReviewed: false`): non entrano in
 * nessun menu finché una persona non le approva. È la stessa regola di tutto il catalogo generato.
 */
@Injectable()
export class AgentePastiLeggeriService {
  private readonly logger = new Logger(AgentePastiLeggeriService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /** Il passo del cron: legge i parametri e chiama il giro vero. */
  async passoNotturno(): Promise<Esito> {
    const acceso = await this.configParams.getBool('agente_leggeri_acceso', false);
    if (!acceso) return { acceso: false, piano: [], create: 0, scarti: {}, arrese: [] };
    const max = await this.configParams.getNumber('agente_leggeri_max', 20);
    return this.riempi({ max, scrive: true });
  }

  /**
   * Il giro.
   *
   * ⚠️ `scrive: false` è la modalità in cui **non si chiama nemmeno l'AI**: serve a vedere il piano
   * senza spendere niente, ed è come gira quando qualcuno vuole solo sapere quanto manca.
   */
  async riempi(opzioni: { max: number; scrive: boolean; soloFamiglia?: string | null }): Promise<Esito> {
    const { max, scrive } = opzioni;
    const solo = (opzioni.soloFamiglia ?? '').trim().toLowerCase();

    const [diete, giornate, ricette, alimenti, clienti] = await Promise.all([
      this.prisma.diet.findMany({ select: { id: true, name: true, regime: true } }) as unknown as
        Promise<{ id: string; name: string; regime: string }[]>,
      this.prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } }) as unknown as
        Promise<{ dietId: string; meals: unknown }[]>,
      this.prisma.recipe.findMany({ where: { active: true }, select: { id: true, name: true, ingredients: true } }) as unknown as
        Promise<{ id: string; name: string; ingredients: unknown }[]>,
      this.prisma.nutrientFact.findMany({ select: { name: true, synonyms: true, category: true } }) as unknown as
        Promise<{ name: string; synonyms: string[]; category: string | null }[]>,
      this.prisma.$queryRaw`
        SELECT diet_id AS "dietId", COUNT(DISTINCT client_id)::int AS clienti
        FROM menu_day WHERE date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY diet_id
      ` as Promise<{ dietId: string; clienti: number }[]>,
    ]);

    const categoriaDi = costruisciCategorie(alimenti);
    const passa = new Map<string, boolean>();
    const nomiEsistenti = new Set<string>();
    for (const r of ricette) {
      nomiEsistenti.add(chiaveNome(r.name));
      passa.set(r.id, vaBeneAColazione(diCosaE(ingredientiDi(r.ingredients), categoriaDi)));
    }

    const clientiPer = new Map(clienti.map((c) => [c.dietId, Number(c.clienti)]));
    const perDieta = new Map<string, { slot: string; recipeId: string }[]>();
    for (const g of giornate) {
      const righe = ricetteDellaGiornata(g.meals);
      if (righe.length) perDieta.set(g.dietId, [...(perDieta.get(g.dietId) ?? []), ...righe]);
    }

    /**
     * ⚠️ **UNA CELLA PER PANIERE, NON PER PASTO** (Fase 2, 1/9). Spuntino e merenda pescano dallo
     * stesso paniere, quindi si contano insieme sotto il capofila del gruppo. Se restassero due
     * righe, l'agente si darebbe due obiettivi da 84 su un paniere solo e genererebbe — pagandole —
     * il doppio delle ricette che servono.
     *
     * ⚠️ L'obiettivo però **cresce con i pasti che quella variante ha davvero**: chi mette in
     * tavola sia lo spuntino sia la merenda ha bisogno di due piatti diversi lo stesso giorno, e
     * con 84 in tutto le 84 giornate non sarebbero distinte. Per questo si moltiplica per quanti
     * slot del gruppo compaiono nelle sue giornate: uno solo → 84, tutti e due → 168.
     */
    const celle = new Map<string, { famiglia: string; regime: string; slot: string; ora: Set<string>; slotVisti: Set<string>; clienti: number }>();
    for (const d of diete) {
      const esito = paniereDellaVariante(d);
      if (esito.tipo !== 'paniere') continue;
      if (solo && !esito.famiglia.toLowerCase().includes(solo)) continue;
      for (const r of perDieta.get(d.id) ?? []) {
        if (!eUnPastoLeggero(r.slot)) continue;
        const capo = slotCapofila(r.slot);
        const k = `${esito.famiglia}|${esito.regime}|${capo}`;
        const c = celle.get(k)
          ?? { famiglia: esito.famiglia, regime: esito.regime, slot: capo, ora: new Set<string>(), slotVisti: new Set<string>(), clienti: 0 };
        c.slotVisti.add(r.slot);
        if (passa.get(r.recipeId)) c.ora.add(r.recipeId);
        c.clienti = Math.max(c.clienti, clientiPer.get(d.id) ?? 0);
        celle.set(k, c);
      }
    }

    const piano = pianoDiRiempimento([...celle.values()].map((c) => ({
      famiglia: c.famiglia, regime: c.regime, slot: c.slot,
      ora: c.ora.size, obiettivo: OBIETTIVO_PER_PASTO * Math.max(1, c.slotVisti.size), clienti: c.clienti,
    })));

    if (!scrive || !piano.length) return { acceso: true, piano, create: 0, scarti: {}, arrese: [] };

    let create = 0;
    const scarti: Record<string, number> = {};
    const arrese: string[] = [];

    for (const p of piano) {
      if (create >= max) break;
      let vuoti = 0;
      let mancano = p.mancano;
      while (mancano > 0 && create < max && vuoti < GIRI_A_VUOTO_MAX) {
        const quante = Math.min(quanteChiederne(mancano), Math.max(1, max - create));
        const gen = await this.ai.generateJson<{ recipes?: unknown[] }>(
          SYSTEM, prompt(p, quante), 4000,
        );
        const arrivate = Array.isArray(gen?.recipes) ? (gen.recipes as Record<string, unknown>[]) : [];
        const v = vaglia(arrivate, categoriaDi, nomiEsistenti);
        for (const s of v.scartate) scarti[s.motivo] = (scarti[s.motivo] ?? 0) + 1;

        if (!v.buone.length) {
          vuoti += 1;
          /**
           * ⛔ Credito finito, chiave non valida, modello inesistente: riprovare non cambia niente,
           * e il 12/8 questo ciclo ha sparato 270 chiamate tutte allo stesso 400. Ci si ferma qui.
           */
          if (this.ai.lastErrorFatale) {
            this.logger.warn(`Agente pasti leggeri fermato: ${this.ai.lastError ?? 'errore fatale AI'}`);
            return { acceso: true, piano, create, scarti, arrese, fermatoPer: this.ai.lastError ?? 'errore AI' };
          }
          continue;
        }
        vuoti = 0;
        for (const b of v.buone) {
          if (create >= max) break;
          const ingredients = Array.isArray(b.grezza.ingredients) ? b.grezza.ingredients : [];
          await this.prisma.recipe.create({
            data: {
              name: b.name.slice(0, 120),
              regime: p.regime,
              mealSlot: p.slot as never,
              kcal: Math.max(0, Math.round(Number(b.grezza.kcal) || 0)),
              ingredients: ingredients as never,
              macros: ((b.grezza as { macros?: unknown }).macros ?? undefined) as never,
              cookingMethods: [] as never,
              tags: ['gen:agente-leggeri', `paniere:${p.famiglia}`],
              /** ⛔ BOZZA: non entra in nessun menu finché non la approva una persona. */
              active: false,
              allergens: suggestAllergens(ingredients).map((a) => a.allergen),
              allergensReviewed: false,
            } as never,
          });
          nomiEsistenti.add(chiaveNome(b.name));
          create += 1;
          mancano -= 1;
        }
      }
      if (vuoti >= GIRI_A_VUOTO_MAX) {
        arrese.push(`${p.famiglia} × ${p.regime} · ${p.slot}`);
      }
    }

    if (create) this.logger.log(`Agente pasti leggeri: ${create} bozze create, ${somma(scarti)} scartate rileggendo.`);
    return { acceso: true, piano, create, scarti, arrese };
  }
}

export interface Esito {
  /** `false` = l'interruttore è spento: non ha fatto niente e non ha speso niente. */
  acceso: boolean;
  piano: PassoDelPiano[];
  create: number;
  /** ⚠️ Gli scarti non sono uno spreco da nascondere: sono la misura di quanto l'AI sbaglierebbe. */
  scarti: Record<string, number>;
  arrese: string[];
  fermatoPer?: string;
}

const somma = (r: Record<string, number>) => Object.values(r).reduce((s, n) => s + n, 0);
const chiaveNome = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * ⚠️ `morning_snack` è il **capofila** dello spuntino e della merenda (Fase 2, 1/9), e il prompt lo
 * dice: un piatto chiesto «per lo spuntino di metà mattina» finirebbe scritto pensando alle 10:30,
 * mentre lo stesso piatto verrà servito anche alle 17. Chiederlo per tutti e due è l'unico modo
 * perché l'AI scriva qualcosa che a entrambe le ore ha senso.
 */
const NOME_PASTO: Record<string, string> = {
  breakfast: 'colazione',
  morning_snack: 'spuntino di metà mattina o merenda del pomeriggio (lo stesso piatto va servito a tutte e due le ore)',
  afternoon_snack: 'merenda del pomeriggio',
};
const REGOLA_REGIME: Record<string, string> = {
  omnivore: 'onnivoro',
  pescetarian: 'vegetariano più pesce',
  vegetarian: 'niente carne né pesce (uova e latticini sì)',
  vegan: 'nessun alimento di origine animale',
};

const SYSTEM = 'Sei un nutrizionista esperto che prepara BOZZE di catalogo. Rispondi SOLO con JSON valido e minificato, senza testo attorno. Niente claim medici. kcal e macro realistici.';

/**
 * ⚠️ Il criterio si scrive **come lo applica il vaglio**, non a parole vaghe: «l'ingrediente
 * principale, quello che pesa di più». Se il prompt dicesse solo «niente verdure», l'AI toglierebbe
 * anche gli spinaci dalla frittata — e la frittata con gli spinaci è una colazione.
 */
export function prompt(p: PassoDelPiano, quante: number): string {
  return `Genera ${quante} ricette per il pasto "${NOME_PASTO[p.slot] ?? p.slot}" della dieta "${p.famiglia}" (regime ${p.regime}: ${REGOLA_REGIME[p.regime] ?? p.regime}).
⚠️ Il piatto NON deve essere di carne, di pesce o di verdura: l'ingrediente PRINCIPALE — quello che pesa di più — dev'essere un cereale, un latticino, della frutta, delle uova, della frutta secca o un legume dolce. Una verdura come contorno va bene (una frittata con gli spinaci è una colazione), ma il piatto non dev'essere un secondo o un contorno di verdure.
Le ricette devono essere DIVERSE fra loro per ingrediente principale.
Formato: {"recipes":[{"name":"nome piatto","kcal":<int>,"ingredients":[{"name":"ingrediente","qty":<numero>,"unit":"g"}],"macros":{"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>}}]}`;
}

const ingredientiDi = (v: unknown) => (Array.isArray(v)
  ? (v as unknown[]).map((i) => ({ name: String((i as { name?: unknown })?.name ?? ''), grammi: grammiDi(i) }))
  : []);

/**
 * ⚠️ La categoria di un ingrediente si legge col nome esatto e poi con l'**abbinamento vero**, la
 * stessa porta del conto delle calorie: «mela renetta media» deve arrivare a «mela», o l'agente
 * scarterebbe le sue stesse ricette buone.
 */
function costruisciCategorie(
  alimenti: readonly { name: string; synonyms: string[]; category: string | null }[],
): (nome: string) => string | null {
  const esatto = new Map<string, string>();
  const perParola = new Map<string, (typeof alimenti)[number][]>();
  for (const a of alimenti) {
    const nomi = [a.name, ...(a.synonyms ?? [])].map(normalizzaNome).filter(Boolean);
    for (const n of nomi) if (a.category) esatto.set(n, a.category);
    const chiavi = new Set<string>();
    for (const n of nomi) for (const p of paroleChe(n)) chiavi.add(p);
    for (const k of chiavi) perParola.set(k, [...(perParola.get(k) ?? []), a]);
  }
  const memo = new Map<string, string | null>();
  return (nome: string): string | null => {
    const n = normalizzaNome(nome);
    if (!n) return null;
    if (memo.has(n)) return memo.get(n) ?? null;
    let c = esatto.get(n) ?? null;
    if (!c) {
      const cand = new Set<(typeof alimenti)[number]>();
      for (const p of paroleChe(n)) for (const a of perParola.get(p) ?? []) cand.add(a);
      c = (cand.size ? abbinaPerRicetta(n, [...cand]) : null)?.riga.category ?? null;
    }
    memo.set(n, c);
    return c;
  };
}
