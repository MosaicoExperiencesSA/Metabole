/**
 * ⛔ **I GRUPPI DI EQUIVALENZA CON LO STESSO NOME** — e perché non sono solo brutti da vedere.
 *
 * Richiesta di Simone (2/9): «nelle equivalenze ci sono parecchi gruppi doppi, se il nome del gruppo
 * è uguale vanno accorpati». Nella pagina «Bevande vegetali» compare sei volte, con dentro elenchi
 * simili ma non uguali.
 *
 * ## ⛔ Il danno vero: con dei doppioni APPROVATI, cinque su sei sono già invisibili
 *
 * `menu/sostituzione-chat.service.ts` cerca il gruppo dei grassi **per nome** fra gli approvati,
 * ordinati per `createdAt`, e prende **il primo che combacia**. Con sei omonimi approvati, i pesi
 * che la nutrizionista scrive nel secondo non li legge nessuno — e la frase che la cliente riceve
 * dice «gruppo senza pesi» mentre i pesi ci sono, nel gruppo accanto. Non è disordine: è lavoro
 * fatto che non arriva.
 *
 * ⚠️ `menu.service.ts` invece li usa **tutti** (quelli della dieta o globali) per il trova-gemella:
 * lì i doppioni non fanno male, e nemmeno bene.
 *
 * ## ⛔ Perché unire NON è sempre sicuro, e questo modulo dice quando
 *
 * · **L'ambito.** Un gruppo ha un `productId`: `null` = globale, altrimenti è **di una dieta**.
 *   Unire due omonimi di diete diverse rende gli alimenti dell'una equivalenti anche nell'altra —
 *   che è una decisione di nutrizione, non di pulizia. «bevanda di nocciola» che entra in una dieta
 *   dove nessuno l'aveva messa è esattamente il genere di cosa che non si fa con uno script.
 * · **I pesi.** `members.fattori` porta i grammi di conversione dei grassi. Due gruppi con fattori
 *   **diversi** non si possono unire scegliendo a caso: uno dei due numeri finirebbe nel piatto di
 *   una persona senza che nessuno l'abbia deciso.
 * · **Lo stato.** Unire una bozza dentro un approvato fa entrare nel motore alimenti che nessuno ha
 *   validato; il contrario butta via un'approvazione.
 *
 * ⚠️ Quindi qui si **classifica**, non si unisce d'ufficio: `sicura` va da sé, `da guardare` no.
 */
import { normalizza } from '../common/nomi-alimento';

export interface Gruppo {
  id: string;
  name: string;
  productId: string | null;
  status: string;
  members: unknown;
  createdAt?: Date;
}

/**
 * La chiave con cui due nomi sono «lo stesso nome».
 *
 * ⚠️ Minuscolo, senza accenti, **e con gli spazi interni collassati**: `normalizza` da sola non
 * tocca il doppio spazio, e «Bevande  vegetali» resterebbe un gruppo a parte per un tasto premuto
 * due volte. ⛔ Non si va oltre: togliere le parole di servizio unirebbe «Bevande vegetali» e
 * «Bevande vegetali non zuccherate», che sono **due gruppi diversi** — il secondo esiste apposta.
 */
export const chiaveNome = (nome: string): string => normalizza(nome).replace(/\s+/g, ' ');

/** Gli alimenti dichiarati in un gruppo, senza doppioni e senza vuoti. */
export function alimenti(members: unknown): string[] {
  const items = (members as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const visti = new Set<string>();
  const out: string[] = [];
  for (const x of items) {
    const s = typeof x === 'string' ? x.trim() : '';
    if (!s) continue;
    const k = normalizza(s);
    if (visti.has(k)) continue;
    visti.add(k);
    out.push(s);
  }
  return out;
}

const fattoriDi = (members: unknown): unknown => (members as { fattori?: unknown })?.fattori;
const haFattori = (members: unknown): boolean => {
  const f = fattoriDi(members);
  return f !== undefined && f !== null && Object.keys(f as object).length > 0;
};

export type Verdetto = 'sicura' | 'da guardare';

export interface Famiglia {
  chiave: string;
  /** Il nome come si legge, preso dal gruppo più vecchio: è quello che il motore trova per primo. */
  nome: string;
  gruppi: Gruppo[];
  verdetto: Verdetto;
  /** Perché non è sicura. Vuoto quando lo è. */
  motivi: string[];
  /** Gli alimenti che l'unione avrebbe. */
  alimentiUniti: string[];
  /** Quanti alimenti l'unione **aggiunge** al gruppo più vecchio — cioè quanto lavoro sta tornando a galla. */
  aggiunti: number;
}

/** Raggruppa per nome e dice, per ogni famiglia di omonimi, se unirla è sicuro. */
export function famiglieDiOmonimi(gruppi: readonly Gruppo[]): Famiglia[] {
  const per = new Map<string, Gruppo[]>();
  for (const g of gruppi) {
    const k = chiaveNome(g.name ?? '');
    if (!k) continue;
    per.set(k, [...(per.get(k) ?? []), g]);
  }

  const out: Famiglia[] = [];
  for (const [chiave, tutti] of per) {
    if (tutti.length < 2) continue;
    const ordinati = [...tutti].sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
    );
    const capofila = ordinati[0];

    const motivi: string[] = [];
    const ambiti = new Set(ordinati.map((g) => g.productId ?? '(globale)'));
    if (ambiti.size > 1) {
      motivi.push(`ambiti diversi (${[...ambiti].length}): unirli allargherebbe le equivalenze a diete che non le avevano`);
    }
    const stati = new Set(ordinati.map((g) => g.status));
    if (stati.size > 1) motivi.push(`stati diversi (${[...stati].sort().join(', ')})`);
    /**
     * ⛔ **Due elenchi di pesi diversi non si uniscono a caso**: uno dei due numeri finirebbe nel
     * piatto di una persona senza che nessuno l'abbia scelto.
     */
    const conPesi = ordinati.filter((g) => haFattori(g.members));
    if (conPesi.length > 1) {
      const distinti = new Set(conPesi.map((g) => JSON.stringify(fattoriDi(g.members))));
      if (distinti.size > 1) motivi.push(`${conPesi.length} gruppi hanno i pesi dei grassi e non coincidono`);
    }

    const visti = new Set<string>();
    const alimentiUniti: string[] = [];
    for (const g of ordinati) {
      for (const a of alimenti(g.members)) {
        const k = normalizza(a);
        if (visti.has(k)) continue;
        visti.add(k);
        alimentiUniti.push(a);
      }
    }

    out.push({
      chiave,
      nome: capofila.name,
      gruppi: ordinati,
      verdetto: motivi.length ? 'da guardare' : 'sicura',
      motivi,
      alimentiUniti,
      aggiunti: alimentiUniti.length - alimenti(capofila.members).length,
    });
  }
  return out.sort((a, b) => b.gruppi.length - a.gruppi.length || a.nome.localeCompare(b.nome));
}
