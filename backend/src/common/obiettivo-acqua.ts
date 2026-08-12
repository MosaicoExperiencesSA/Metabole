/**
 * QUANTA ACQUA DEVE BERE — un solo calcolo, per la home e per il report.
 *
 * Decisione di Simone (12/8): «33 ml/kg dal parametro, ovunque».
 *
 * ## Il difetto da cui nasce
 *
 * La stessa domanda aveva due risposte, e le due schermate si contraddicevano davanti alla stessa
 * persona:
 *
 * - la **home** usava `water_ml_per_kg` (dai Parametri, default 33), lo divideva in bicchieri da
 *   250 ml e lo teneva fra 6 e 16;
 * - il **report** usava `peso × 30 / 1000`, con il **30 scritto a mano in due file diversi**, senza
 *   parametro e senza limiti.
 *
 * Una cliente di 70 kg leggeva **2,25 L** in home e **2,1 L** nel report. Chi beveva 2,2 litri
 * trovava scritto «ci sei» nel report e vedeva il cerchio incompleto in home, nella stessa app, lo
 * stesso giorno. E se un admin toccava il parametro, il report non se ne accorgeva affatto.
 *
 * ## ⚠️ Il conto vero è in BICCHIERI, e i litri vengono dopo
 *
 * Non è un dettaglio di unità di misura: il limite fra 6 e 16 bicchieri **cambia il risultato** agli
 * estremi. A 130 kg il calcolo grezzo darebbe 4,29 L, la home ne mostra 4,0 (16 bicchieri). Se il
 * report calcolasse i litri per conto suo tornerebbe a dire un numero diverso — solo un po' meno
 * diverso di prima. Quindi il report parte dagli stessi bicchieri e li converte.
 */

/** Un bicchiere. È l'unità in cui la cliente segna l'acqua in app. */
export const ML_PER_BICCHIERE = 250;

/**
 * Il minimo e il massimo, in bicchieri (1,5 L – 4 L).
 *
 * ⚠️ Non sono estetica: sotto il minimo l'obiettivo non sarebbe salutare per nessuno, e sopra il
 * massimo diventa irraggiungibile — e un obiettivo irraggiungibile smette di essere un obiettivo,
 * diventa una cosa che si ignora.
 */
export const BICCHIERI_MIN = 6;
export const BICCHIERI_MAX = 16;

/**
 * I bicchieri al giorno per quel peso. `null` se il peso non si sa: chi chiama usa il suo ripiego
 * invece di inventare un numero su un peso che non ha.
 */
export function bicchieriObiettivo(pesoKg: number | null | undefined, mlPerKg: number): number | null {
  if (!pesoKg || pesoKg <= 0 || !Number.isFinite(mlPerKg) || mlPerKg <= 0) return null;
  const grezzi = Math.round((pesoKg * mlPerKg) / ML_PER_BICCHIERE);
  return Math.min(BICCHIERI_MAX, Math.max(BICCHIERI_MIN, grezzi));
}

/**
 * Gli stessi bicchieri, detti in litri: è così che li scrive il report.
 *
 * ⚠️ **Due decimali, non uno.** Nove bicchieri fanno 2,25 L: con un decimale solo diventavano 2,3, e
 * il report sarebbe tornato a dire un numero diverso dalla home — uno scarto più piccolo di quello
 * di prima, ma della stessa natura. Un quarto di litro, per giunta, è esattamente un bicchiere:
 * perderlo nell'arrotondamento vuol dire perdere l'unità in cui lei conta.
 */
export function litriDaBicchieri(bicchieri: number | null): number | null {
  if (bicchieri == null) return null;
  return Math.round((bicchieri * ML_PER_BICCHIERE) / 10) / 100;
}

/** Scorciatoia per chi vuole direttamente i litri (il report). */
export function litriObiettivo(pesoKg: number | null | undefined, mlPerKg: number): number | null {
  return litriDaBicchieri(bicchieriObiettivo(pesoKg, mlPerKg));
}
