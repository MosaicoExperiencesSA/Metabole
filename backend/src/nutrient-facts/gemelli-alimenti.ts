/**
 * I GEMELLI — riconoscere i numeri copiati prima che entrino in tabella.
 *
 * ## Perché serve, e perché il controllo che c'era non bastava
 *
 * Prima di caricare il foglio del 20/8 avevo passato le 245 righe a un controllo di coerenza
 * (Atwater: `4·proteine + 4·carboidrati + 9·grassi` deve avvicinarsi alle kcal dichiarate). Ne
 * segnalò **una sola**, e questo mi bastò per dire che il foglio era buono.
 *
 * ⛔ Era una misura che non misurava quello che credevo. Le 99 righe a «25 kcal» — tahina, ghee,
 * miele, fichi secchi, tempeh, branzino, sesamo, patate dolci — **passano** il controllo Atwater,
 * perché non sono numeri a caso: sono **una riga vera copiata novantanove volte**, e una riga vera è
 * coerente con sé stessa ovunque la si incolli. Un controllo sulla plausibilità interna di una riga
 * non può vedere un riempimento: guarda una riga per volta, e ogni singola riga è impeccabile.
 *
 * ⚠️ La cosa che si vede solo guardando **le righe insieme** è che sono identiche. È questo il
 * controllo che mancava, ed è l'unico che poteva accorgersene.
 *
 * ## Cosa distingue un riempimento da due nomi per la stessa cosa
 *
 * Righe con gli stessi identici valori esistono anche per un motivo legittimo: «pomodoro fresco»,
 * «pomodori freschi» e «pomodoro pelato» *sono* la stessa cosa scritta in tre modi, ed è giusto che
 * abbiano gli stessi numeri. Bloccarle sarebbe un avviso che compare sempre, cioè nessun avviso.
 *
 * La differenza è nei **nomi**: nel gruppo legittimo una parola ricorre in tutti («pomodor…»); nel
 * riempimento no — «tahina» e «peperone rosso» non hanno niente in comune tranne un numero. Da qui
 * `radiceComune`: se una parola di almeno quattro lettere comincia uguale in **ogni** nome del
 * gruppo, il gruppo è plausibile e si lascia passare, dicendolo. Altrimenti è un riempimento.
 *
 * ⚠️ Non è infallibile e non finge di esserlo: «olio di oliva» e «pomodori secchi sott'olio»
 * condividono «olio» e passerebbero insieme. Prende il caso grosso — decine di alimenti diversi con
 * lo stesso numero — che è quello che è successo davvero e che nessun altro controllo vedeva.
 */
import { normalizzaNome } from './valori-nutrizionali.service';

/**
 * Sotto le tre righe non si dice niente. Due alimenti diversi con gli stessi valori càpitano
 * (il sale e il bicarbonato hanno zero di tutto), e un avviso su ogni coppia sarebbe rumore.
 */
export const GEMELLI_MINIMI = 3;

/** Quante lettere deve avere una parola perché il suo inizio conti come «parlano della stessa cosa». */
export const LETTERE_RADICE = 4;

export interface RigaDaControllare {
  name: string;
  kcal: number | null;
  protein?: number | null;
  carbs?: number | null;
  sugars?: number | null;
  fat?: number | null;
  fiber?: number | null;
}

export interface Gemelli {
  /** I valori che le righe hanno in comune, come stringa leggibile. */
  valori: string;
  nomi: string[];
  /** La parola comune a tutti i nomi, se c'è: allora è la stessa cosa scritta in modi diversi. */
  radiceComune: string | null;
}

/** Gli inizi di parola (4 lettere) di un nome: «carote» e «carota» danno tutti e due «caro». */
export function radiciDi(nome: string): Set<string> {
  const parole = normalizzaNome(nome).split(' ').filter((p) => p.length >= LETTERE_RADICE);
  return new Set(parole.map((p) => p.slice(0, LETTERE_RADICE)));
}

/** La parola che comincia uguale in tutti i nomi, se ce n'è una. */
export function radiceComune(nomi: string[]): string | null {
  if (nomi.length === 0) return null;
  let comuni = radiciDi(nomi[0]);
  for (const n of nomi.slice(1)) {
    const sue = radiciDi(n);
    comuni = new Set([...comuni].filter((r) => sue.has(r)));
    if (comuni.size === 0) return null;
  }
  return [...comuni][0] ?? null;
}

const chiaveValori = (r: RigaDaControllare): string =>
  [r.kcal, r.protein, r.carbs, r.sugars, r.fat, r.fiber].map((v) => (v ?? '–')).join('/');

/**
 * I gruppi di righe con valori identici, dal più grande al più piccolo.
 */
export function trovaGemelli(righe: RigaDaControllare[], minimo = GEMELLI_MINIMI): Gemelli[] {
  const gruppi = new Map<string, string[]>();
  for (const r of righe) {
    /**
     * ⚠️ Fuori le righe **senza kcal** (le scarta già l'import) e quelle **a zero kcal**.
     * Lo zero non è un numero copiato: è l'assenza, e sale, sale marino e acqua hanno davvero
     * zero di tutto. Sul foglio del 19/8 quei tre facevano scattare l'avviso, ed era falso —
     * nessuno li aveva riempiti, sono così. Un avviso che grida sul foglio giusto insegna a
     * ignorarlo sul foglio sbagliato.
     */
    if (!r.kcal) continue;
    const k = chiaveValori(r);
    gruppi.set(k, [...(gruppi.get(k) ?? []), r.name]);
  }
  return [...gruppi.entries()]
    .filter(([, nomi]) => nomi.length >= minimo)
    .map(([valori, nomi]) => ({ valori, nomi, radiceComune: radiceComune(nomi) }))
    .sort((a, b) => b.nomi.length - a.nomi.length);
}

/** I soli gruppi che non si spiegano con «è lo stesso alimento scritto in un altro modo». */
export const riempimenti = (g: Gemelli[]): Gemelli[] => g.filter((x) => x.radiceComune === null);
