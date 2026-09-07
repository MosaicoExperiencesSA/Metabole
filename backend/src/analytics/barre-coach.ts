/**
 * FATTURATO COACH e PROVVIGIONI MATURATE, **una barra per coach, mese per mese** — logica pura.
 *
 * Richiesta di Simone del 7/9: «due grafici nuovi visibili ad admin, Responsabile Coach e
 * Coordinatrice Coach, sempre con la regola della visibilità che si può vedere chi è collegato
 * sotto di me: grafico uno filtrato per mese "Fatturato coach", grafico due filtrato per mese
 * "Provvigioni maturate"» · «scegli dal menu a tendina il mese e mi fai vedere una barra verticale
 * per ogni coach».
 *
 * ## Perché sta in un file a parte, e puro
 *
 * Perché le due cose che qui si possono sbagliare non hanno bisogno del database per essere
 * sbagliate, e nemmeno per essere verificate:
 *
 *  1. **In che mese cade una riga.** Il mese di un incasso e di una provvigione è quello di
 *     **Europe/Rome**, non quello del processo (su Render, UTC). Un pagamento delle 00:30 del 1°
 *     settembre è di agosto per UTC e di settembre per noi: finirebbe nella barra del mese prima,
 *     con l'aggravante che il totale del mese resta giusto e solo la barra non torna. Il taglio lo
 *     fa `meseDi` (→ `meseLocale`), lo stesso che usa il portafoglio staff e il tetto di guadagno.
 *  2. **A chi si attribuisce.** Il fatturato va alla **coach assegnata alla cliente**, una sola,
 *     senza risalire la rete: se il fatturato di una coach comparisse anche nella barra della sua
 *     coordinatrice, la somma delle barre non sarebbe il fatturato della rete — sarebbe il
 *     fatturato contato due volte, e un grafico in cui il totale non è la somma di quello che
 *     mostra è un grafico che mente. La rete decide **quali barre si vedono** (chi sta sotto di
 *     me), non dove finiscono i soldi. Le provvigioni seguono la stessa regola per costruzione:
 *     una riga del registro contabile ha un `staffId` solo, e la provvigione di catena della
 *     coordinatrice è già una riga sua.
 *
 * ## Lo zero è un dato, non un buco
 *
 * Ogni coach della rete compare in **ogni** mese, anche a zero. Una barra a zero dice «questa coach
 * non ha fatturato a luglio»; una barra che manca dice «di questa coach non so niente», e sono due
 * risposte diverse. Chi guarda una squadra ha bisogno della prima.
 */

import { meseLocale } from '../common/date-only';

/** `2026-08` del mese in cui cade quell'istante, nel fuso dell'azienda. */
export const meseDi = (d: Date): string => meseLocale(d);

/** Una coach della rete visibile. `nome` è il `displayName` della sua scheda staff. */
export interface CoachDellaRete {
  staffId: string;
  nome: string;
}

/** Un incasso approvato, già attribuito alla coach della cliente (`null` = cliente senza coach). */
export interface IncassoDaAttribuire {
  coachStaffId: string | null;
  amountCents: number;
  quando: Date;
}

/** Una riga di compenso dal registro contabile (categorie `CATEGORIE_COMPENSO`). */
export interface CompensoDaAttribuire {
  staffId: string | null;
  amountCents: number;
  quando: Date;
}

/** Una barra del grafico: una coach, in un mese. */
export interface BarraCoach {
  staffId: string;
  nome: string;
  fatturatoCents: number;
  provvigioniCents: number;
}

/**
 * Le barre di ogni mese, per ogni coach della rete.
 *
 * `mesi` sono chiavi `AAAA-MM`: le decide il chiamante (oggi: gli ultimi dodici). Le righe fuori da
 * quei mesi si scartano — non si inventa un mese che la tendina non ha.
 *
 * ⚠️ Gli importi **non si arrotondano né si azzerano**: uno storno è una riga negativa nel registro
 * e in un mese di soli storni la provvigione maturata è davvero negativa. Tagliarla a zero qui
 * farebbe sparire dal grafico l'unico mese in cui c'è qualcosa da capire. Il colore lo sceglie la
 * pagina.
 */
export function barrePerMese(input: {
  mesi: string[];
  coach: CoachDellaRete[];
  incassi: IncassoDaAttribuire[];
  compensi: CompensoDaAttribuire[];
}): Record<string, BarraCoach[]> {
  const { mesi, coach, incassi, compensi } = input;
  const ammessi = new Set(mesi);
  const dellaRete = new Set(coach.map((c) => c.staffId));

  /** `mese` → `staffId` → totale. */
  const fatturato = new Map<string, Map<string, number>>();
  const provvigioni = new Map<string, Map<string, number>>();
  const somma = (dove: Map<string, Map<string, number>>, mese: string, staffId: string, cents: number) => {
    let perMese = dove.get(mese);
    if (!perMese) { perMese = new Map(); dove.set(mese, perMese); }
    perMese.set(staffId, (perMese.get(staffId) ?? 0) + cents);
  };

  /**
   * ⚠️ **`dellaRete` è la SECONDA serratura, e oggi non chiude niente** — detto qui perché non lo
   * dice nessuna prova, e una difesa che nessuno verifica va almeno dichiarata.
   *
   * Chi è fuori dalla rete non compare comunque: le barre si costruiscono scorrendo `coach`, quindi
   * un `staffId` estraneo finirebbe in una mappa che nessuno legge. Togliendo questi due controlli
   * i test restano verdi — l'ho provato. Restano perché il giorno che quella proiezione cambia (una
   * barra «altre», un ordinamento che parte dai dati invece che dall'elenco) la perdita sarebbe
   * silenziosa e sarebbe di soldi di qualcun altro.
   */
  for (const i of incassi) {
    // Una cliente senza coach assegnata non ha una barra a cui appartenere: il suo incasso c'è nel
    // «Fatturato / mese» della rete, ma qui non si può attribuire, e attribuirlo a caso è peggio.
    if (!i.coachStaffId || !dellaRete.has(i.coachStaffId)) continue;
    const mese = meseDi(i.quando);
    if (!ammessi.has(mese)) continue;
    somma(fatturato, mese, i.coachStaffId, i.amountCents);
  }
  for (const c of compensi) {
    if (!c.staffId || !dellaRete.has(c.staffId)) continue;
    const mese = meseDi(c.quando);
    if (!ammessi.has(mese)) continue;
    somma(provvigioni, mese, c.staffId, c.amountCents);
  }

  const perPeriodo: Record<string, BarraCoach[]> = {};
  for (const mese of mesi) {
    perPeriodo[mese] = coach.map((c) => ({
      staffId: c.staffId,
      nome: c.nome,
      fatturatoCents: fatturato.get(mese)?.get(c.staffId) ?? 0,
      provvigioniCents: provvigioni.get(mese)?.get(c.staffId) ?? 0,
    }));
  }
  return perPeriodo;
}
