/**
 * ⛔ **GLI STATI COME LI SCRIVE IL FOGLIO, TRADOTTI IN QUELLI CHE IL MOTORE LEGGE.**
 *
 * Il foglio «Alimenti da correggere» compilato il 2/9 ha 262 righe, e in `Stato` scrive
 * **«crudo / naturale»** su 238 di esse e **«lavorato / cotto»** su altre 7.
 *
 * ⛔ `normalizzaStato` rende `altro` a qualunque valore che contenga una barra o un « o »
 * (`stato-alimento.ts`, riga 202), perché una riga che dichiara due stati sta dichiarando la
 * propria ambiguità. La regola è giusta — ma applicata a questo foglio vuol dire che **il 91%
 * degli alimenti appena compilati entrerebbe in tabella come «non lo so»**, cioè con la condizione
 * che li rimette dentro l'elenco «Alimenti da correggere» da cui il foglio è nato. Il lavoro di chi
 * l'ha riempito tornerebbe indietro da solo, senza un errore, senza che nessuno se ne accorga.
 *
 * ⚠️ **La traduzione sta qui e non dentro `normalizzaStato`**: quella funzione risponde alla domanda
 * «cosa dice questa riga di tabella?», e per lei «crudo / naturale» è davvero ambiguo. Questa
 * risponde a un'altra domanda — «cosa intendeva chi ha compilato questa casella?» — e vale solo
 * all'ingresso, una volta.
 *
 * ## Le scelte, e perché
 *
 * · **«crudo / naturale» → `crudo`.** È la convenzione del progetto (le grammature delle ricette si
 *   scrivono a crudo, decisione di Simone del 19/8), ed è la prima delle due parole. ⚠️ Per l'olio,
 *   il sale e il miele sarebbe più preciso `non_applicabile` — crudi o cotti sono la stessa cosa —
 *   ma `crudo` non è **sbagliato** per loro, sta comunque in `STATI_A_CRUDO`, e non li rimette nella
 *   lista da correggere. Distinguere quali dei 238 siano «non si applica» è un giudizio per una
 *   nutrizionista, non per una tabella di conversione.
 * · **«lavorato / cotto» → `cotto`.**
 *
 * ⛔ **E quello che non si riconosce NON diventa `crudo` per comodità**: resta com'è, e chi importa
 * si ferma. Una traduzione che indovina è il modo in cui 238 righe prendono lo stato sbagliato tutte
 * insieme.
 */
import { normalizzaStato } from './stato-alimento';

/** Le scritture del foglio che il motore non legge, e cosa intendevano. */
export const STATI_DEL_FOGLIO: Readonly<Record<string, string>> = {
  'crudo / naturale': 'crudo',
  'lavorato / cotto': 'cotto',
};

/**
 * Lo stato da scrivere in tabella, partendo da quello che c'è nella casella del foglio.
 * Rende `null` per una casella vuota — «nessuno l'ha guardato» resta tale.
 */
export function statoDalFoglio(casella: string | null | undefined): string | null {
  const t = (casella ?? '').trim();
  if (!t) return null;
  const tradotto = STATI_DEL_FOGLIO[t.toLowerCase()];
  return tradotto ?? t;
}

/**
 * ⛔ **IL CONTROLLO CHE IMPEDISCE AL LAVORO DI TORNARE INDIETRO.**
 *
 * Dopo la traduzione, uno stato che `normalizzaStato` legge come `altro` o come vuoto è una riga
 * che entrerà in tabella come «non lo so». Chi importa deve **fermarsi** e farsi dire quale
 * scrittura non è stata prevista, invece di scrivere 238 righe che si rimetteranno in coda da sole.
 *
 * ⚠️ `non_applicabile` va benissimo: è una dichiarazione, non un buco.
 */
export function statiCheTornanoIndietro(
  righe: readonly { name: string; state?: string | null }[],
): { name: string; state: string; letto: string }[] {
  const out: { name: string; state: string; letto: string }[] = [];
  for (const r of righe ?? []) {
    const scritto = statoDalFoglio(r.state);
    if (!scritto) continue; // vuoto: è «non lo so» dichiarato, e non è colpa della traduzione
    const letto = normalizzaStato(scritto);
    if (letto === '' || letto === 'altro') out.push({ name: r.name, state: scritto, letto: letto || '(vuoto)' });
  }
  return out;
}
