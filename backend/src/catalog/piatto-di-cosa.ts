import { exclusionKeys, hitsExclusion } from '../menu/exclusions';

/**
 * DI COSA È QUESTO PIATTO — carne, pesce, verdura, o altro.
 *
 * ⛔ **Richiesta di Simone, 31/8: «carne, pesce e verdure evitiamole nelle colazioni, merende e
 * spuntini».** E la lettura è quella che ha scelto lui: **il PIATTO** non dev'essere di carne,
 * pesce o verdura — non «nessuna verdura fra gli ingredienti».
 *
 * ⚠️ La differenza vale il catalogo. Con la lettura stretta uscirebbero la frittata con gli
 * spinaci, il pane coi pomodorini, l'avocado toast: colazioni normali, e il paniere delle colazioni
 * si svuoterebbe. Con questa escono «Petto di pollo alla piastra», «Tonno con olive», «Insalata
 * mista», «Vellutata di broccoli» — cioè i piatti che a colazione non ci vanno.
 *
 * ## Come si decide «di cosa è»
 *
 * Dall'**ingrediente principale**, cioè quello che pesa di più. ⚠️ Non dal nome: «Vellutata di
 * broccoli e patate» e «Purè di patate con broccoli» si chiamano quasi uguale e sono due piatti
 * diversi, e il nome mette davanti quello che suona meglio, non quello che c'è di più.
 *
 * ⛔ **E se le grammature non ci sono, non si indovina**: si risponde `null`, che vuol dire «non lo
 * so» e non «va bene». Chi legge decide cosa farne — l'elenco di quelle che non si sanno è la coda
 * da guardare, non un via libera silenzioso.
 *
 * ⚠️ Il vocabolario del pesce è quello delle esclusioni (67 termini) e il confronto passa da
 * `hitsExclusion`: è un'altra domanda — «questo piatto è di pesce» invece di «questo piatto
 * contiene una cosa esclusa» — ma il vocabolario è lo stesso, e scriverne un secondo vorrebbe dire
 * che un giorno uno dei due impara «gallinella» e l'altro no.
 */

/**
 * ⛔ **I termini della CARNE, elenco chiuso e nuovo.** Non ce n'era nessuno in casa: i regimi
 * sanno dire «vegetariano = niente carne né pesce» a parole, ma nessuna lista lo mette per iscritto.
 *
 * ⚠️ Ci vanno i **tagli e gli animali**, non i piatti: «polpette» non è qui, perché esistono le
 * polpette di ceci e di melanzane — a decidere è l'ingrediente principale, e se quello è manzo lo
 * dice `manzo`. ⛔ E niente radici corte: `pol` prenderebbe polpa, polenta e pollice.
 */
export const CARNE: readonly string[] = [
  // Animali e carni bianche
  'pollo', 'gallina', 'tacchino', 'coniglio', 'anatra', 'faraona', 'quaglia',
  // Carni rosse
  'manzo', 'bovino', 'vitello', 'vitellone', 'bresaola', 'maiale', 'suino', 'agnello', 'capretto',
  'cavallo', 'cinghiale', 'cervo',
  // Tagli e forme
  'fesa', 'petto di pollo', 'petto di tacchino', 'lombata', 'controfiletto', 'filetto di manzo',
  'ossobuco', 'spezzatino', 'straccetti', 'scaloppin', 'cotoletta', 'arrosto di', 'brasato',
  'macinato di', 'hamburger di', 'tagliata',
  // Salumi e trasformati
  'prosciutto', 'speck', 'bacon', 'pancetta', 'salame', 'salsiccia', 'mortadella', 'wurstel',
  'coppa', 'guanciale', 'porchetta',
  // Frattaglie
  'fegato', 'trippa',
];

export type DiCosa = 'carne' | 'pesce' | 'verdura' | 'altro';

export interface IngredientePesato {
  name: string;
  /** Grammi. ⚠️ Senza, quell'ingrediente non può essere il principale: non si indovina. */
  grammi: number | null;
}

/** Le categorie della tabella alimenti che contano come verdura. */
const CATEGORIE_VERDURA = new Set(['verdura', 'verdure', 'ortaggi']);

const normale = (s: string) => (s ?? '').toLowerCase().trim();

/**
 * Vero se il nome contiene un termine della carne.
 *
 * ⚠️ **Una regex compilata una volta, non un `some(...includes(...))`**: quella forma la pesca
 * `una-porta-per-le-esclusioni.spec.ts` in ogni file che importa dalle esclusioni, e a ragione — è
 * la firma di chi si riscrive il confronto invece di passare dalla porta. Qui la domanda è un'altra
 * («questo piatto È di carne», e la carne non è un'esclusione), ma la strada comoda era dichiarare
 * l'eccezione, e un guardiano si consuma un'eccezione ragionevole alla volta.
 */
const RE_CARNE = new RegExp(CARNE.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));

export function eCarne(nome: string): boolean {
  return RE_CARNE.test(normale(nome));
}

/** Vero se il nome contiene un termine del pesce, dal vocabolario delle esclusioni. */
export function ePesce(nome: string): boolean {
  const n = normale(nome);
  return hitsExclusion(n, exclusionKeys(['pesce'])) !== null
    || hitsExclusion(n, exclusionKeys(['crostacei'])) !== null
    || hitsExclusion(n, exclusionKeys(['molluschi'])) !== null;
}

/**
 * L'ingrediente che pesa di più, o `null` se le grammature non ci sono.
 *
 * ⚠️ A parità di grammi vince il **primo scritto**: chi scrive una ricetta mette per primo quello
 * che considera il protagonista, ed è l'unico segnale che resta quando i numeri non decidono.
 */
export function ingredientePrincipale(ingredienti: readonly IngredientePesato[]): string | null {
  let miglioreNome: string | null = null;
  let migliori = -1;
  for (const i of ingredienti ?? []) {
    const g = typeof i?.grammi === 'number' && Number.isFinite(i.grammi) ? i.grammi : null;
    if (g === null || g <= 0 || !normale(i.name)) continue;
    if (g > migliori) { migliori = g; miglioreNome = i.name; }
  }
  return miglioreNome;
}

/**
 * Di cosa è il piatto. `null` = **non si sa**, e non vuol dire «va bene».
 *
 * `categoriaDi` è la categoria della tabella alimenti per un nome di ingrediente, quando c'è: serve
 * alle verdure, che a differenza di carne e pesce non hanno un elenco di parole ma una colonna
 * scritta da una nutrizionista.
 */
export function diCosaE(
  ingredienti: readonly IngredientePesato[],
  categoriaDi: (nome: string) => string | null,
): DiCosa | null {
  const principale = ingredientePrincipale(ingredienti);
  if (!principale) return null;
  if (ePesce(principale)) return 'pesce';
  if (eCarne(principale)) return 'carne';
  const cat = normale(categoriaDi(principale) ?? '');
  if (cat && CATEGORIE_VERDURA.has(cat)) return 'verdura';
  /**
   * ⚠️ Categoria sconosciuta ≠ «altro». Se la tabella non conosce l'ingrediente principale non
   * sappiamo se è una verdura, e dirlo «altro» lo farebbe passare a colazione senza che nessuno
   * l'abbia guardato. Si torna `null`: la coda da guardare.
   */
  if (!cat) return null;
  return 'altro';
}

/** I pasti in cui la regola vale (Simone, 31/8). */
export const PASTI_SENZA_CARNE_PESCE_VERDURA = ['breakfast', 'morning_snack', 'afternoon_snack'] as const;

/** ⛔ `null` (non lo so) **non** entra: entra solo quello che sappiamo essere «altro». */
export function vaBeneAColazione(di: DiCosa | null): boolean {
  return di === 'altro';
}
