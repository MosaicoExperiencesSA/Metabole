/**
 * LA TAGLIA CALORICA DEL CATALOGO SI CALCOLA SUL FABBISOGNO — decisione di Simone, 18/8 (voce 273).
 *
 * Parola sua: **«la taglia calorica va calcolata sulla base del fabbisogno della cliente»**.
 *
 * ## Il difetto che chiude
 *
 * Il generatore di catalogo scriveva ogni pasto come `menu_daycombo_kcal_target × quota`, e quel
 * parametro era un numero fisso (1500 di default, 1600-1800 in tre preset). L'erogazione invece
 * punta al **fabbisogno della cliente**. ⚠️ Chi ha un fabbisogno sopra ~1765 kcal (1500 ÷ 0,85, il
 * bordo della banda del 15%) riceveva giornate fuori banda **per costruzione, tutti i giorni** — e
 * per lei nessun moltiplicatore di porzione cambia il fatto che le ricette sono scritte più piccole.
 *
 * ## ⚠️ La MEDIANA, non la media
 *
 * Una cliente a 3200 kcal in mezzo a dieci a 1600 sposterebbe la media a 1750 e il catalogo con lei:
 * dieci persone riceverebbero piatti pensati per una. La mediana è **la persona in mezzo**, e non si
 * lascia spostare da un caso estremo — che è esattamente la proprietà che serve quando il numero
 * decide cosa mangiano tutte.
 *
 * ## ⚠️ Tre stati, non due
 *
 * «Nessun fabbisogno noto» non è «il fabbisogno è quello di scorta»: se su quella dieta non c'è
 * ancora nessuna cliente (o mancano i dati per calcolarlo), la taglia resta quella del preset e il
 * motivo **si dice**. Un numero calcolato sul nulla ha lo stesso aspetto di un numero calcolato bene.
 *
 * ## ⚠️ E la distanza fra la prima e l'ultima si dichiara
 *
 * Se le clienti su quella dieta vanno da 1400 a 2900, **nessuna taglia sola le serve tutte**: la
 * mediana è la scelta migliore possibile, non una soluzione. `larghezza` porta quel numero fuori,
 * perché chi genera il catalogo deve poter decidere se serve una seconda taglia (`Diet.levels`
 * nasce per questo, e il livello 2 non è mai stato usato).
 */

/** Il minimo e il massimo che una giornata di catalogo può valere: gli stessi del parametro. */
export const TAGLIA_MINIMA = 600;
export const TAGLIA_MASSIMA = 4000;

/** A quanto si arrotonda: una taglia di catalogo è un numero che si legge, non una misura. */
const PASSO = 50;

export type MotivoTaglia = 'dal_fabbisogno' | 'nessun_fabbisogno_noto';

export interface EsitoTaglia {
  /** La taglia da usare per generare, già arrotondata e dentro i limiti. */
  taglia: number;
  motivo: MotivoTaglia;
  /** Quante clienti hanno contribuito. `0` = nessuna, e allora `taglia` è quella del preset. */
  quante: number;
  /** La mediana grezza, prima dell'arrotondamento. `null` se non c'era niente da mediare. */
  mediana: number | null;
  /** Il fabbisogno più basso e più alto fra quelle contate. */
  minimo: number | null;
  massimo: number | null;
  /**
   * ⚠️ Quante clienti restano **fuori banda** anche con questa taglia, cioè per quante una taglia
   * sola non basta. È il numero che dice se serve una seconda taglia.
   */
  fuoriBanda: number;
}

const mediana = (v: readonly number[]): number => {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/**
 * La taglia calorica per generare il catalogo di questa dieta.
 *
 * `tolleranzaPct` è la stessa banda con cui l'erogazione giudica una giornata
 * (`menu_kcal_balance_tolerance_pct`): serve a contare quante clienti resterebbero fuori **anche**
 * con la taglia scelta.
 */
export function tagliaDalFabbisogno(
  fabbisogni: readonly (number | null | undefined)[],
  predefinita: number,
  tolleranzaPct = 15,
): EsitoTaglia {
  const dentroLimiti = (n: number) => Math.max(TAGLIA_MINIMA, Math.min(TAGLIA_MASSIMA, n));
  const validi = fabbisogni.filter((f): f is number => typeof f === 'number' && Number.isFinite(f) && f > 0);

  if (!validi.length) {
    return {
      taglia: dentroLimiti(Math.round(predefinita) || TAGLIA_MINIMA),
      motivo: 'nessun_fabbisogno_noto',
      quante: 0,
      mediana: null,
      minimo: null,
      massimo: null,
      fuoriBanda: 0,
    };
  }

  const med = mediana(validi);
  const taglia = dentroLimiti(Math.round(med / PASSO) * PASSO);
  const banda = Math.max(0, tolleranzaPct) / 100;
  // ⚠️ Fuori banda in TUTT'E DUE i versi: chi sta molto sopra riceve poco, chi sta molto sotto
  // riceve troppo. Contare solo i primi farebbe sembrare che alzare la taglia non costi niente.
  const fuoriBanda = validi.filter((f) => f > taglia * (1 + banda) || f < taglia * (1 - banda)).length;

  return {
    taglia,
    motivo: 'dal_fabbisogno',
    quante: validi.length,
    mediana: med,
    minimo: Math.min(...validi),
    massimo: Math.max(...validi),
    fuoriBanda,
  };
}

/**
 * La riga che legge chi genera il catalogo.
 *
 * ⚠️ Dice **su quante persone** è stato calcolato il numero e **quante restano fuori**: una taglia
 * scelta bene su un gruppo troppo largo resta la scelta migliore possibile, non una soluzione — e
 * chi genera deve poterlo sapere prima, non scoprirlo dai menu.
 */
export function fraseTaglia(e: EsitoTaglia): string {
  if (e.motivo === 'nessun_fabbisogno_noto') {
    return `Taglia ${e.taglia} kcal: nessuna cliente con un fabbisogno calcolabile su questa dieta, quindi resta quella del preset.`;
  }
  const coda =
    e.fuoriBanda > 0
      ? ` ⚠️ ${e.fuoriBanda} su ${e.quante} restano comunque fuori banda (da ${e.minimo} a ${e.massimo} kcal): una taglia sola non le serve tutte.`
      : ` Tutte e ${e.quante} stanno dentro la banda.`;
  return `Taglia ${e.taglia} kcal, dalla mediana dei fabbisogni di ${e.quante} client${e.quante === 1 ? 'e' : 'i'}.${coda}`;
}
