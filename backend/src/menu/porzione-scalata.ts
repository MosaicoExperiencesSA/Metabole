/**
 * LE PORZIONI SI SCALANO SUL FABBISOGNO — decisione di Simone, 18/8 (voce 255, strada C).
 *
 * Parola sua: **«va riproporzionato il pasto correggendo le quantità in base al fabbisogno»**.
 *
 * ## Il buco che chiude
 *
 * Le ricette del catalogo nascono dimensionate su una quota della giornata, e la giornata del
 * catalogo vale `menu_daycombo_kcal_target` (1500 di default). L'erogazione invece punta al
 * **fabbisogno** della singola cliente. Quando la finestra del digiuno toglie dei pasti — o quando
 * la nutrizionista toglie gli spuntini — quello che resta **non si ingrandiva**: `DayCombo` sceglie
 * una ricetta per slot dentro il pool, e un moltiplicatore di porzione non esisteva da nessuna
 * parte. Chi salta la cena riceveva il 65% del suo fabbisogno; chi salta cena e colazione, il 45%.
 *
 * ## Le tre scelte, e perché queste
 *
 * Sono le «consigliate» del foglio `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`, §4-§6. Tutti
 * i numeri stanno in `config_param`: se la nutrizionista li vuole diversi si cambiano senza un
 * rilascio, che è la regola n.1 del progetto sulle soglie del motore.
 *
 * 1. **Un tetto per TIPO di pasto**, non uno solo. ⚠️ Un tetto unico a ×1,6 porterebbe uno spuntino
 *    da 160 a 256 kcal: non è più uno spuntino, è un pasto. I pasti principali reggono ×1,8, la
 *    colazione ×1,6, gli spuntini ×1,25.
 * 2. **Un fattore uniforme**, non una regola di ripartizione a parte — ma con i tetti per slot, che
 *    è la versione pesata ottenuta senza una seconda regola: lo spuntino si ferma al suo tetto e
 *    quello che manca si **ridistribuisce** su chi ha ancora margine. Una regola sola, e il tetto la
 *    governa.
 * 3. **Non si rimpicciolisce mai.** Se la giornata del catalogo vale già più del fabbisogno, i
 *    fattori restano a 1. ⚠️ Non è una svista: scalare all'ingiù toccherebbe il menu di **tutte** le
 *    clienti sotto i 1500 kcal, ed è una decisione clinica diversa da quella che è stata presa.
 *    Quella che è stata presa è «chi riceve meno del suo fabbisogno deve ricevere di più».
 *
 * ## ⚠️ Il limite che nessun tetto risolve
 *
 * Una porzione ×1,5 di un piatto «a pezzo» non esiste: un frutto, un vasetto di yogurt, un uovo.
 * ×1,5 vuol dire una mela e mezza. Il tetto basso sugli spuntini è anche il modo di non doverlo dire
 * troppo spesso, ma **non lo risolve**: o si accetta l'arrotondamento, o le ricette a pezzo si
 * escludono dalla scalatura. È una decisione da prendere con la nutrizionista, e finché non è presa
 * questo modulo non fa finta di averla presa.
 *
 * ## ⚠️ E quando nemmeno i tetti bastano
 *
 * `restaCorta` lo dice. Non si scala oltre il tetto in silenzio: chi chiama continua a scrivere il
 * `daily_kcal_below_target` — che da oggi vuol dire «resta corta **anche col moltiplicatore**», cioè
 * una cosa più grave e più rara di prima.
 */

/** Il minimo che serve di un pasto per decidere. Strutturale: la spec non importa Prisma. */
export interface PastoDaScalare {
  slot: string;
  kcal: number;
}

export interface TettiPorzione {
  /** Pranzo e cena. */
  principale: number;
  colazione: number;
  /** Spuntino di mattina e di pomeriggio. */
  spuntino: number;
}

/** I valori predefiniti (§4 del foglio, colonna B). Sovrascrivibili da `config_param`. */
export const TETTI_PREDEFINITI: TettiPorzione = {
  principale: 1.8,
  colazione: 1.6,
  spuntino: 1.25,
};

/**
 * Il tetto di questo slot.
 *
 * ⚠️ Uno slot **sconosciuto** prende il tetto dello spuntino, che è il più basso. Su una scala che
 * moltiplica il cibo di una persona, un nome che non riconosciamo deve costare prudenza, non
 * generosità: il valore di scorta sbagliato in eccesso è quello che si nota solo nel piatto.
 */
export function tettoDelloSlot(slot: string, tetti: TettiPorzione = TETTI_PREDEFINITI): number {
  if (slot === 'lunch' || slot === 'dinner') return tetti.principale;
  if (slot === 'breakfast') return tetti.colazione;
  return tetti.spuntino;
}

export interface EsitoScalatura {
  /** Il fattore per ogni pasto, nell'ordine ricevuto. `1` = porzione di catalogo. */
  fattori: number[];
  /** Le kcal della giornata prima e dopo (dopo = somma dei valori arrotondati per pasto). */
  kcalPrima: number;
  kcalDopo: number;
  /** Quanto del target si raggiunge, 0-1. `1` = ci si arriva. */
  quota: number;
  /** ⚠️ Vero se nemmeno coi tetti si arriva al target: chi chiama lo deve dire a qualcuno. */
  restaCorta: boolean;
  /** Gli slot fermati dal loro tetto: servono al messaggio e alla diagnostica. */
  alTetto: string[];
  /** Vero se almeno un pasto è stato scalato: chi chiama non riscrive niente quando è falso. */
  scalata: boolean;
}

/** Quante iterazioni di ridistribuzione. Gli slot sono al massimo cinque: cinque giri bastano
 *  sempre, e il limite esiste perché un `while` senza fondo in un motore che eroga cibo no. */
const GIRI_MASSIMI = 8;

/**
 * I fattori di porzione per i pasti di una giornata.
 *
 * ⚠️ **L'ordine dei fattori è quello dei pasti ricevuti**, non una mappa per slot: una giornata può
 * avere due spuntini, e una mappa per slot ne perderebbe uno.
 */
export function porzioniScalate(
  pasti: PastoDaScalare[],
  targetKcal: number,
  tetti: TettiPorzione = TETTI_PREDEFINITI,
): EsitoScalatura {
  const uno = (motivo: Partial<EsitoScalatura> = {}): EsitoScalatura => {
    const kcal = pasti.reduce((s, p) => s + (Number.isFinite(p.kcal) ? p.kcal : 0), 0);
    return {
      fattori: pasti.map(() => 1),
      kcalPrima: kcal,
      kcalDopo: kcal,
      quota: targetKcal > 0 ? kcal / targetKcal : 1,
      restaCorta: false,
      alTetto: [],
      scalata: false,
      ...motivo,
    };
  };

  if (!pasti.length) return uno();
  // ⚠️ Un target che non c'è o non è un numero non vale «scala a zero»: vale «non lo so», e su
  // «non lo so» non si tocca il piatto di nessuno.
  if (!targetKcal || !Number.isFinite(targetKcal) || targetKcal <= 0) return uno();

  const base = pasti.map((p) => (Number.isFinite(p.kcal) && p.kcal > 0 ? p.kcal : 0));
  const kcalPrima = base.reduce((s, k) => s + k, 0);
  if (kcalPrima <= 0) return uno();
  // Non si rimpicciolisce: vedi il docstring, punto 3.
  if (kcalPrima >= targetKcal) return uno();

  const tettoDi = pasti.map((p) => Math.max(1, tettoDelloSlot(p.slot, tetti)));
  const fattori = pasti.map(() => 1);

  /**
   * ⚠️ FATTORE UNIFORME, POI I TETTI, POI DI NUOVO UNIFORME SU CHI RESTA.
   *
   * Il primo giro chiede a tutti lo stesso moltiplicatore (`target / kcal della giornata`). Chi
   * sfonda il proprio tetto viene **fissato al tetto**, e il giro dopo ricalcola il fattore
   * uniforme su quello che manca, diviso fra i pasti che hanno ancora margine.
   *
   * ⚠️ La sfumatura che conta, ed è quella che ho sbagliato alla prima scrittura: ridistribuire
   * **in proporzione al margine** invece che riformulare l'uniforme dà a ogni pasto una fetta
   * diversa, e la colazione e il pranzo finiscono con moltiplicatori diversi fra loro. Ma il
   * rapporto fra colazione e pranzo lo ha deciso la dieta, non noi: quella proporzione va tenuta.
   * Chi non è al tetto deve crescere **della stessa percentuale** di chiunque altro non sia al
   * tetto. Sul caso di Sonia la differenza è 509/891 (giusto) contro 478/929 (sbagliato).
   */
  const alTettoIdx = pasti.map(() => false);
  for (let giro = 0; giro < GIRI_MASSIMI; giro++) {
    const kcalFissate = base.reduce((s, k, i) => s + (alTettoIdx[i] ? k * tettoDi[i] : 0), 0);
    const baseLibera = base.reduce((s, k, i) => s + (alTettoIdx[i] || k <= 0 ? 0 : k), 0);
    if (baseLibera <= 0) break;
    const uniforme = Math.max(1, (targetKcal - kcalFissate) / baseLibera);
    const nuoviAlTetto = base
      .map((k, i) => (!alTettoIdx[i] && k > 0 && uniforme > tettoDi[i] ? i : -1))
      .filter((i) => i >= 0);
    if (nuoviAlTetto.length === 0) {
      for (let i = 0; i < base.length; i++) if (!alTettoIdx[i] && base[i] > 0) fattori[i] = uniforme;
      break;
    }
    for (const i of nuoviAlTetto) {
      alTettoIdx[i] = true;
      fattori[i] = tettoDi[i];
    }
  }

  // ⚠️ Le kcal finali sono la somma dei valori **arrotondati per pasto**, non il totale teorico:
  // è il numero che la cliente somma guardando le tre righe del suo menu. Se qui si scrivesse il
  // totale esatto, la giornata direbbe 1600 e le righe ne farebbero 1599.
  const kcalDopo = base.reduce((s, k, i) => s + Math.round(k * fattori[i]), 0);
  const alTetto = pasti.filter((_, i) => base[i] > 0 && alTettoIdx[i]).map((p) => p.slot);

  return {
    fattori,
    kcalPrima,
    kcalDopo,
    quota: kcalDopo / targetKcal,
    // ⚠️ Mezzo kcal di tolleranza: senza, un arrotondamento farebbe suonare l'allarme su una
    // giornata che è arrivata.
    restaCorta: kcalDopo < targetKcal - 0.5,
    alTetto,
    scalata: fattori.some((f) => f > 1.0001),
  };
}

/** Il fattore, arrotondato come si scrive: «×1,6». Due decimali sono già troppi da leggere. */
export const porzioneLeggibile = (fattore: number): number => Math.round(fattore * 10) / 10;

/**
 * SOTTO QUESTO FATTORE NON SI DICE NIENTE, E NON SI RISCRIVE NIENTE DI QUELLO CHE LEGGE LA CLIENTE.
 *
 * Un ×1,03 su 80 g di farro sono due grammi: nessuno li pesa, e una riga «porzione più abbondante»
 * che compare per due grammi è un avviso che si impara a saltare — così il giorno che il numero
 * conta davvero non lo legge più nessuno.
 *
 * ⚠️ **Lo stesso numero sta in `app/src/lib/meals.ts` (`testoPorzione`)**, e i due DEVONO
 * coincidere: se il server scalasse le grammature della scheda a un fattore che la riga sotto il
 * nome del piatto tace, la cliente vedrebbe cambiare gli ingredienti senza nessuna spiegazione. Un
 * test per parte tiene fermo il numero.
 *
 * ⚠️ Non vale per la **lista della spesa**, che scala sempre: lì i grammi si sommano su sette
 * giorni e su tutti i pasti, e il 3% smette di essere invisibile.
 */
export const PORZIONE_DA_DIRE = 1.05;

/**
 * Le unità che si comprano a peso o a volume: lì un decimale è rumore, e si arrotonda all'intero.
 * Tutto il resto (cucchiai, pezzi, tazze) tiene un decimale, perché «1 uovo» e «1,5 uova» sono
 * due cose diverse e nasconderlo sarebbe peggio che mostrarlo.
 */
const UNITA_A_PESO = new Set(['g', 'gr', 'grammi', 'ml', 'l', 'kg']);

/**
 * La quantità di un ingrediente con la porzione applicata, per la lista della spesa.
 *
 * ⚠️ Senza questo, la lista della spesa restava sulle grammature di catalogo mentre il piatto
 * cresceva: la cliente comprava il cibo per la porzione piccola e a metà settimana finiva.
 *
 * ⚠️ **Non risolve il problema dei pezzi**, e non fa finta: ×1,5 di una mela è una mela e mezza, e
 * qui esce «1,5». Accettare l'arrotondamento («2 frutti») o togliere le ricette a pezzo dalla
 * scalatura è una decisione da prendere con la nutrizionista — vedi
 * `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md` §4. Finché non è presa, il numero vero è meno
 * dannoso di un numero comodo.
 */
export function quantitaScalata(
  qty: number | null | undefined,
  fattore: number | null | undefined,
  unit?: string | null,
): number | null {
  if (qty === null || qty === undefined || !Number.isFinite(qty)) return null;
  const f = Number.isFinite(fattore) && (fattore as number) > 0 ? (fattore as number) : 1;
  const scalata = qty * f;
  const u = (unit ?? '').trim().toLowerCase();
  return UNITA_A_PESO.has(u) ? Math.round(scalata) : Math.round(scalata * 10) / 10;
}
