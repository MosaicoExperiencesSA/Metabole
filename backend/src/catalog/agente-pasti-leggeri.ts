import { PASTI_SENZA_CARNE_PESCE_VERDURA, diCosaE, vaBeneAColazione, type IngredientePesato } from './piatto-di-cosa';

/**
 * L'AGENTE CHE RIEMPIE COLAZIONI, SPUNTINI E MERENDE — la parte che decide.
 *
 * ⛔ **Non è un generatore in più: è un generatore che si RILEGGE.** Il difetto che questa consegna
 * esiste per non ripetere è quello misurato il 31/8: il generatore ha riempito le colazioni di
 * «Merluzzo crudo in tartare» e «Polpo freddo marinato», nessuno ha mai riletto, e nessuno se n'è
 * accorto per mesi. Chiedere all'AI di rispettare un criterio non è farglielo rispettare.
 *
 * Quindi il giro è: **conta cosa manca → chiedi → RILEGGI quello che è arrivato → tieni solo quello
 * che passa → richiedi il resto**. Quello che non passa non si salva e si conta, perché un agente
 * che scarta in silenzio è un agente di cui non si può sapere se sta funzionando.
 *
 * ⚠️ E il criterio è lo stesso di `diag:colazioni`, letto dalla stessa porta (`piatto-di-cosa.ts`):
 * se l'agente giudicasse con una regola sua, riempirebbe i panieri di piatti che il tabulato conta
 * ancora come mancanti — e i due numeri non tornerebbero mai.
 */

/** Il piano dice quante ne mancano, dove, e in che ordine si fanno. */
export interface CellaDaRiempire {
  famiglia: string;
  regime: string;
  slot: string;
  /** Quante ce ne sono adesso che rispettano il criterio. */
  ora: number;
  /** Quante ne servono in tutto. */
  obiettivo: number;
  /** Quante clienti stanno su questo paniere: decide l'ordine, non l'obiettivo. */
  clienti: number;
}

export interface PassoDelPiano extends CellaDaRiempire {
  mancano: number;
}

/** L'obiettivo del piano panieri: 84 ricette per pasto (§1.4). */
export const OBIETTIVO_PER_PASTO = 84;

/**
 * Le celle da riempire, in ordine di lavoro.
 *
 * ⛔ **Prima quelle con clienti sopra**, poi le più vuote. Non è una preferenza estetica: un paniere
 * con otto colazioni e nessuna cliente non fa male a nessuno oggi; lo stesso paniere con dodici
 * clienti sopra sta già servendo lo stesso piatto ogni pochi giorni.
 *
 * ⚠️ Le celle già a posto non entrano nel piano: un piano che contiene lavoro già fatto è un piano
 * che si smette di leggere.
 */
export function pianoDiRiempimento(celle: readonly CellaDaRiempire[]): PassoDelPiano[] {
  return (celle ?? [])
    .map((c) => ({ ...c, mancano: Math.max(0, (c.obiettivo || OBIETTIVO_PER_PASTO) - c.ora) }))
    .filter((c) => c.mancano > 0)
    .sort((a, b) => b.clienti - a.clienti || b.mancano - a.mancano
      || `${a.famiglia}|${a.regime}|${a.slot}`.localeCompare(`${b.famiglia}|${b.regime}|${b.slot}`));
}

export interface RicettaGenerata {
  name?: unknown;
  ingredients?: unknown;
  kcal?: unknown;
}

export type MotivoScarto = 'senza nome' | 'senza ingredienti' | 'doppione' | 'carne' | 'pesce' | 'verdura' | 'non si sa';

export interface Vaglio {
  buone: { name: string; ingredienti: IngredientePesato[]; grezza: RicettaGenerata }[];
  scartate: { name: string; motivo: MotivoScarto }[];
}

const pulito = (s: unknown) => String(s ?? '').trim();
const chiave = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * ⛔ **IL PASSO CHE FA LA DIFFERENZA: si rilegge quello che l'AI ha risposto.**
 *
 * `categoriaDi` è la stessa funzione del tabulato. `giaInCatalogo` sono i nomi che esistono già —
 * ⚠️ un doppione non è un errore dell'AI, è un piatto che non aggiunge scelta a nessuno, e contarlo
 * come riempito farebbe salire un numero senza far salire la varietà.
 *
 * ⚠️ **«Non si sa» si SCARTA**, come nel tabulato: se l'ingrediente principale non è in tabella non
 * sappiamo se è una verdura, e tenerlo vorrebbe dire mettere a colazione un piatto che nessuno ha
 * guardato — per far tornare un numero.
 */
export function vaglia(
  generate: readonly RicettaGenerata[],
  categoriaDi: (nome: string) => string | null,
  giaInCatalogo: ReadonlySet<string>,
): Vaglio {
  const buone: Vaglio['buone'] = [];
  const scartate: Vaglio['scartate'] = [];
  const viste = new Set<string>();

  for (const g of generate ?? []) {
    const name = pulito(g?.name);
    if (!name) { scartate.push({ name: '(senza nome)', motivo: 'senza nome' }); continue; }
    const k = chiave(name);
    if (giaInCatalogo.has(k) || viste.has(k)) { scartate.push({ name, motivo: 'doppione' }); continue; }

    const ingredienti = Array.isArray(g?.ingredients)
      ? (g.ingredients as Record<string, unknown>[]).map((i) => ({
        name: pulito(i?.name),
        grammi: grammiDi(i),
      })).filter((i) => i.name)
      : [];
    if (!ingredienti.length) { scartate.push({ name, motivo: 'senza ingredienti' }); continue; }

    const di = diCosaE(ingredienti, categoriaDi);
    if (!vaBeneAColazione(di)) {
      /**
       * ⚠️ `altro` non arriva mai qui — `vaBeneAColazione` lo lascia passare — ma il tipo non lo sa
       * e scriverlo come motivo di scarto sarebbe una bugia. Si dichiara l'unico caso residuo.
       */
      const motivo: MotivoScarto = di === 'carne' || di === 'pesce' || di === 'verdura' ? di : 'non si sa';
      scartate.push({ name, motivo });
      continue;
    }

    viste.add(k);
    buone.push({ name, ingredienti, grezza: g });
  }
  return { buone, scartate };
}

/** I grammi di un ingrediente generato. ⚠️ Solo i grammi: «2 pz» non si confronta con «150 g». */
export function grammiDi(i: unknown): number | null {
  if (!i || typeof i !== 'object') return null;
  const o = i as { qty?: unknown; unit?: unknown };
  const n = typeof o.qty === 'number' ? o.qty : Number(String(o.qty ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(o.unit ?? 'g').toLowerCase().trim();
  return u === 'g' || u === 'gr' || u === 'grammi' || u === 'ml' ? n : null;
}

/**
 * Quante chiederne in un giro, e quando fermarsi.
 *
 * ⚠️ Se ne chiedono **più di quante ne servono**, perché una parte verrà scartata: il tabulato dice
 * che oggi in catalogo un piatto su tre di quegli slot non rispetta il criterio, quindi chiederne
 * esattamente quante mancano vorrebbe dire tornare sempre a mani mezze vuote.
 *
 * ⛔ Ma il moltiplicatore non è un modo per chiedere di più a caso: ha un tetto, perché ogni ricetta
 * chiesta è una chiamata pagata, e un agente che non ha un tetto è un agente che una notte spende
 * quanto un mese.
 */
export const PER_GIRO_MAX = 12;

export function quanteChiederne(mancano: number, per_giro_max = PER_GIRO_MAX): number {
  if (mancano <= 0) return 0;
  return Math.min(per_giro_max, Math.max(1, Math.ceil(mancano * 1.5)));
}

/**
 * ⛔ **Quando smettere di insistere su una cella.** Se dopo tre giri di fila non è entrata nemmeno
 * una ricetta, il problema non è il caso: è che per quel paniere e quel pasto il criterio e il
 * regime insieme lasciano poco spazio (una colazione keto vegana che non sia carne, pesce o verdura
 * è un problema vero). Si passa oltre e **si dichiara**, invece di bruciare chiamate.
 */
export const GIRI_A_VUOTO_MAX = 3;

export const eUnPastoLeggero = (slot: string): boolean =>
  (PASTI_SENZA_CARNE_PESCE_VERDURA as readonly string[]).includes(slot);
