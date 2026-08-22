/**
 * LE FINESTRE DEL DIGIUNO — una tabella sola, per tutto il prodotto.
 *
 * Nasce da una segnalazione di Simone dell'11/8: nella tendina della scheda cliente mancavano
 * «salta la cena» e «salta il pranzo». Aggiungerle voleva dire toccare **otto** punti diversi —
 * la mappa degli slot del motore, tre DTO con la loro `IsIn`, le domande del questionario, il
 * suggerimento della 20-4, la mail del primo pasto, e le etichette in due frontend — e sette su
 * otto sarebbero passati inosservati fino al giorno in cui una cliente sceglie la voce nuova e il
 * motore non sa cosa saltare.
 *
 * Da qui in avanti si aggiunge **una riga in questa tabella**. Quello che resta fuori sono soltanto
 * le etichette dei due frontend, che non possono importare dal backend: là c'è un commento che
 * rimanda qui.
 *
 * ## Le due regole nutrizionali dentro la tabella
 *
 * 1. **Lo spuntino adiacente segue il pasto saltato.** Se salti la colazione, uno spuntino alle
 *    dieci riaprirebbe la finestra e il digiuno non sarebbe più tale; per simmetria, se salti la
 *    cena, lo spuntino del pomeriggio accorcia il digiuno serale. La regola c'era già per la
 *    colazione, l'ho estesa alla cena: se la nutrizionista la vuole diversa, si cambia **qui**.
 * 2. **`skip_lunch` non è una finestra di digiuno**, ed è dichiarato: colazione e cena lasciano due
 *    finestre corte invece di una lunga. ⛔ **Dal 21/8 non si sceglie più** (decisione di Simone del
 *    19/8): l'orologio non sa produrla, e offrirla sotto «digiuno intermittente» prometteva un
 *    digiuno che con colazione e cena non c'è. La riga **resta**, perché serve a *leggere* i valori
 *    già scritti — la differenza fra «non si sceglie» e «non esiste» la fa `selezionabile`.
 */

/** Gli slot del motore, nell'ordine della giornata. */
export type SlotPasto = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';

export interface FinestraDigiuno {
  valore: string;
  /** Gli slot che il motore NON eroga. */
  salta: SlotPasto[];
  /** Come la legge lo staff (scheda cliente). */
  etichettaStaff: string;
  /** Come la legge la cliente (profilo dell'app). */
  etichettaCliente: string;
  /** Voce breve per il questionario, dove lo spazio è quello di un pulsante. */
  etichettaBreve: string;
  /**
   * Il pasto che resta più tardi nella giornata: è quello che la 20-4 propone come unico pasto, e
   * quello con cui la mail del primo giorno dice «riparti da…». Prima erano due `if` in due file
   * diversi, e nessuno dei due sapeva delle voci nuove.
   */
  pastoPrincipale: 'colazione' | 'pranzo' | 'cena';
  /**
   * ⛔ **IL PRIMO PASTO DELLA GIORNATA — che NON è `pastoPrincipale`** (trovato in revisione, 21/8).
   *
   * `pastoPrincipale` è documentato come «il pasto che resta più tardi»: è l'**ultimo**. Ma
   * `marketing/lifecycle.service.ts` lo usava per riempire *«comincia dal tuo primo pasto ({{...}})»*
   * nella mail del primo giorno — cioè un campo solo per due domande opposte.
   *
   * ⚠️ Il danno era **già in produzione**: a una cliente 16:8 classica (pranzo · merenda · cena) la
   * mail diceva «comincia dal tuo primo pasto (cena)». E la finestra lunga nata dall'orologio lo
   * avrebbe peggiorato: `skip_morning_snack` **tiene la colazione**, e le si sarebbe detto lo stesso
   * di cominciare dalla cena.
   */
  primoPasto: 'colazione' | 'pranzo' | 'merenda' | 'cena';
  /**
   * Vero se è già la finestra più stretta possibile (un pasto solo): a chi la fa non si propone la
   * 20-4, perché la sta già facendo.
   */
  unicoPasto: boolean;
  /**
   * ⛔ **SI PUÒ SCEGLIERE A MANO DA UNA TENDINA?** (21/8)
   *
   * Quattro delle cinque righe storiche sì: nascono da una domanda — «quali pasti preferisci
   * saltare?» — e le loro etichette nominano il pasto **saltato**. Le tre nate dall'orologio no:
   * nascono dalla **durata** della finestra, le calcola `orologio-digiuno.ts`, e nessuno le sceglie.
   *
   * ⚠️ `false` qui dentro vuol dire **due cose diverse**, e il commento accanto a ogni riga dice
   * quale: le tre dell'orologio *non si scelgono perché si calcolano*; `skip_lunch` *non si sceglie
   * più perché è stata ritirata*. Il campo è uno solo perché la conseguenza è una sola — fuori dalle
   * tendine, dentro alla lettura — ma un campo che vale per due motivi va detto, o fra un anno
   * qualcuno rimette `skip_lunch` in elenco credendo che l'orologio la produca.
   *
   * ⚠️ Senza questo campo ci finivano dentro lo stesso: il questionario costruisce i suoi pulsanti
   * con `FINESTRE_DIGIUNO.map(...)`, e «Solo cena» sotto la domanda «quali pasti preferisci
   * saltare?» si legge come *«salto solo la cena»* — mentre vuol dire l'opposto, un pasto al
   * giorno. Una riga in più nella tabella diventava una risposta sbagliata a una domanda diversa.
   *
   * Chi mostra una tendina filtra su questo campo. Chi mostra un valore **già scritto** (la scheda
   * della cliente, quella dello staff) le deve saper leggere **tutte**: una finestra derivata che
   * non si vede è un dato che agisce e non si vede.
   */
  selezionabile: boolean;
}

export const FINESTRE_DIGIUNO: FinestraDigiuno[] = [
  {
    valore: 'skip_breakfast',
    salta: ['breakfast', 'morning_snack'],
    etichettaStaff: 'Salta la colazione (mangia da pranzo a cena)',
    etichettaCliente: 'Salti la colazione — mangi da pranzo a cena',
    etichettaBreve: 'Colazione',
    pastoPrincipale: 'cena',
    primoPasto: 'pranzo',
    unicoPasto: false,
    selezionabile: true,
  },
  {
    valore: 'skip_dinner',
    salta: ['dinner', 'afternoon_snack'],
    etichettaStaff: 'Salta la cena (mangia da colazione a pranzo)',
    etichettaCliente: 'Salti la cena — mangi da colazione a pranzo',
    etichettaBreve: 'Cena',
    pastoPrincipale: 'pranzo',
    primoPasto: 'colazione',
    unicoPasto: false,
    selezionabile: true,
  },
  {
    valore: 'skip_lunch',
    // Solo il pranzo: gli spuntini li decide il numero di pasti, non questa scelta. Con due pasti
    // lontani non c'è uno spuntino «adiacente» da togliere.
    salta: ['lunch'],
    // ⚠️ L'etichetta resta quella che era: descrive come mangia chi ce l'ha scritta, e «ritirata»
    // non è una cosa che si mangia. Che non si scelga più lo dice `selezionabile`, in un punto solo.
    etichettaStaff: 'Salta il pranzo (colazione e cena)',
    etichettaCliente: 'Salti il pranzo — mangi a colazione e a cena',
    etichettaBreve: 'Pranzo',
    pastoPrincipale: 'cena',
    primoPasto: 'colazione',
    unicoPasto: false,
    // ⛔ RITIRATA il 21/8 (decisione di Simone del 19/8) — e per un motivo diverso dalle tre
    // dell'orologio: quelle non si scelgono perché si calcolano, questa perché non è un digiuno.
    // `diag:digiuni` del 21/8: **zero** clienti in digiuno ce l'hanno.
    // ⚠️ La riga **resta** lo stesso, perché quel conteggio guardava solo chi digiuna: un valore
    // rimasto scritto su un profilo passato a un altro percorso prima della correzione delle due
    // porte di scrittura si deve ancora poter leggere come una frase. Il conteggio senza filtro sta
    // in `diag:digiuni` (parte 1, prima riga): se torna zero anche lì, la riga si toglie davvero.
    selezionabile: false,
  },
  {
    valore: 'skip_breakfast_lunch',
    salta: ['breakfast', 'morning_snack', 'lunch'],
    etichettaStaff: 'Salta colazione e pranzo (solo cena)',
    etichettaCliente: 'Salti colazione e pranzo — solo la cena',
    etichettaBreve: 'Colazione e pranzo',
    pastoPrincipale: 'cena',
    primoPasto: 'merenda',
    unicoPasto: true,
    selezionabile: true,
  },
  {
    valore: 'skip_dinner_breakfast',
    salta: ['breakfast', 'morning_snack', 'dinner', 'afternoon_snack'],
    etichettaStaff: 'Salta cena e colazione (finestra al mattino)',
    etichettaCliente: 'Salti cena e colazione — finestra a metà giornata',
    etichettaBreve: 'Cena e colazione',
    pastoPrincipale: 'pranzo',
    primoPasto: 'pranzo',
    unicoPasto: true,
    selezionabile: true,
  },
  /*
   * ─── LE TRE RIGHE CHE NASCONO DALL'OROLOGIO (21/8) ───────────────────────────────────────────
   *
   * Le cinque sopra sono state scelte a mano, una per una, da una tendina. Queste tre no: sono i
   * gruppi di pasti che `orologio-digiuno.ts` **produce** quando la cliente sposta la durata della
   * sua finestra — 4 pasti sopra le 9 ore, 2 fra 3,5 e 7, uno sotto. Stanno qui e non là perché il
   * motore legge `fastingWindow`, e la regola del file vale ancora: **si aggiunge una riga in
   * questa tabella**, e `finestraPerPasti` la trova da sé senza una seconda mappa.
   *
   * ⚠️ La regola 1 in testa (lo spuntino adiacente segue il pasto saltato) qui non è violata, è
   * **inapplicabile**: non stiamo saltando un pasto principale e lasciando il suo spuntino, stiamo
   * dicendo quante occasioni di pasto ci stanno in una finestra. Lo spuntino che non c'è è quello
   * che non ci sta, non quello che riaprirebbe il digiuno.
   */
  {
    valore: 'skip_morning_snack',
    // Finestra lunga (14:10): ci stanno quattro occasioni. L'unica che salta è quella del mattino,
    // che cadrebbe a ridosso della colazione.
    salta: ['morning_snack'],
    etichettaStaff: 'Finestra lunga (colazione, pranzo, merenda, cena)',
    etichettaCliente: 'Mangi da colazione a cena, senza lo spuntino del mattino',
    etichettaBreve: 'Spuntino del mattino',
    pastoPrincipale: 'cena',
    primoPasto: 'colazione',
    unicoPasto: false,
    selezionabile: false, // la deriva l'orologio: nessuno la sceglie da una tendina
  },
  {
    valore: 'skip_breakfast_and_snacks',
    // Finestra stretta (18:6, 20:4): due pasti pieni, nessuno spuntino.
    salta: ['breakfast', 'morning_snack', 'afternoon_snack'],
    etichettaStaff: 'Finestra stretta (solo pranzo e cena)',
    etichettaCliente: 'Mangi due volte al giorno — pranzo e cena',
    etichettaBreve: 'Pranzo e cena',
    pastoPrincipale: 'cena',
    primoPasto: 'pranzo',
    unicoPasto: false,
    selezionabile: false, // la deriva l'orologio: nessuno la sceglie da una tendina
  },
  {
    valore: 'skip_all_but_dinner',
    // OMAD (23:1). ⚠️ Diversa da `skip_breakfast_lunch`, che lascia anche la merenda: qui resta la
    // sola cena. Due valori vicini, e la differenza è un pasto intero.
    salta: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack'],
    etichettaStaff: 'Un pasto solo, la sera (OMAD)',
    etichettaCliente: 'Un pasto solo al giorno',
    etichettaBreve: 'Solo cena',
    pastoPrincipale: 'cena',
    primoPasto: 'cena',
    unicoPasto: true,
    selezionabile: false, // la deriva l'orologio: nessuno la sceglie da una tendina
  },
];

/**
 * I valori ammessi, per le `IsIn` dei DTO: uno solo, e non tre elenchi che divergono.
 * ⚠️ Ci sono **tutti**, comprese le derivate: un valore che il motore scrive e il DTO rifiuta è un
 * dato che non si può più correggere dal punto che l'ha creato.
 */
export const VALORI_FINESTRA_DIGIUNO: string[] = FINESTRE_DIGIUNO.map((f) => f.valore);

/**
 * Le finestre che una persona può **scegliere** da una tendina — il questionario e la scheda staff.
 * ⚠️ È un elenco diverso da `VALORI_FINESTRA_DIGIUNO` apposta: «cosa si accetta» e «cosa si propone»
 * sono due domande, e confonderle mette in una tendina risposte che nessuno ha voluto scrivere lì.
 */
export const FINESTRE_SELEZIONABILI: FinestraDigiuno[] = FINESTRE_DIGIUNO.filter((f) => f.selezionabile);
export const VALORI_FINESTRA_SELEZIONABILI: string[] = FINESTRE_SELEZIONABILI.map((f) => f.valore);

export const finestraDigiuno = (valore?: string | null): FinestraDigiuno | undefined =>
  FINESTRE_DIGIUNO.find((f) => f.valore === valore);

/**
 * Gli slot che il motore non eroga per questa cliente. Vuoto se non è in digiuno o se la finestra
 * non è impostata: in quel caso i pasti li decide la dieta, come è sempre stato.
 */
export function slotSaltati(pathType?: string | null, fastingWindow?: string | null): Set<string> {
  if (pathType !== 'intermittent_fasting' || !fastingWindow) return new Set();
  return new Set(finestraDigiuno(fastingWindow)?.salta ?? []);
}

/**
 * TUTTI gli slot che il motore non deve erogare per questa cliente: la finestra del digiuno PIÙ
 * gli spuntini che ha chiesto di togliere (Vera, azione 3 — Decisioni 13/8 §14).
 *
 * ⚠️ Da `pastiEsclusi` passano SOLO gli spuntini: un pasto principale finito lì per sbaglio (un
 * dato scritto a mano, una migrazione storta) non deve poter togliere la cena a nessuno — i pasti
 * principali hanno la loro porta, `fastingWindow`, col suo permesso. Il filtro sta qui e non nei
 * chiamanti: è l'unico punto che decide, e la rete di sicurezza di `dayComboPools` (mai una
 * giornata vuota) resta dietro comunque.
 */
export function slotEsclusiTotali(
  pathType?: string | null,
  fastingWindow?: string | null,
  pastiEsclusi?: readonly string[] | null,
): Set<string> {
  const esclusi = slotSaltati(pathType, fastingWindow);
  for (const p of spuntiniTolti(pastiEsclusi)) esclusi.add(p);
  return esclusi;
}

/**
 * ⛔ **I DUE SPUNTINI CHE SI POSSONO TOGLIERE — l'elenco, non la regola scritta due volte.**
 *
 * Estratti il 22/8, in revisione. Il filtro viveva dentro `slotEsclusiTotali` come due confronti
 * scritti a mano, e `kcal-restano-corte.ts` doveva sapere **quali spuntini agiscono davvero** per
 * dire alla nutrizionista perché quella cliente resta corta. Ricopiare i due nomi lì voleva dire due
 * elenchi che divergono il giorno in cui se ne aggiunge un terzo — e il secondo elenco avrebbe
 * mentito su una causa clinica.
 */
export const SPUNTINI_TOGLIBILI: readonly string[] = ['morning_snack', 'afternoon_snack'];

/** Gli spuntini che il motore toglie davvero: quello che c'è scritto in colonna e che lui ascolta. */
export function spuntiniTolti(pastiEsclusi?: readonly string[] | null): string[] {
  return (pastiEsclusi ?? []).filter((p) => SPUNTINI_TOGLIBILI.includes(p));
}

/**
 * ⛔ **LA FINESTRA CHE AGISCE — non quella scritta in colonna.**
 *
 * `fastingWindow` può restare scritto addosso a una cliente che **non è più in digiuno**: le colonne
 * dell'orologio si azzerano da quattro porte (vedi `uscita-dal-digiuno.ts`) e una riga vecchia può
 * sopravvivere. `slotSaltati` lo sa già e torna un insieme vuoto; chi deve **raccontare** una causa
 * alla nutrizionista deve saperlo allo stesso modo, o le dice «è la sua finestra di digiuno» a
 * proposito di una cliente che digiuna solo in banca dati.
 *
 * ⛔ **«Allo stesso modo» vuol dire DUE controlli, non uno** (corretto in revisione, 22/8). La prima
 * stesura guardava solo il `pathType` e tornava la stringa grezza. Ma `slotSaltati` guarda anche
 * `finestraDigiuno(fastingWindow)`, che per un valore **non in tabella** — un dato storico, una riga
 * scritta a mano — torna `undefined`, quindi insieme vuoto: nessun pasto tolto. Con un controllo
 * solo, quella cliente riceveva *«La sua finestra di digiuno le toglie dei pasti»*, che è falso,
 * invece di essere mandata su `diag:varieta` dove il problema è davvero. E il valore fantasma
 * finiva pure nella chiave di deduplica. *Una ragione falsa è peggio di un ordine sbagliato.*
 */
export function finestraCheAgisce(pathType?: string | null, fastingWindow?: string | null): string | null {
  if (pathType !== 'intermittent_fasting') return null;
  if (!fastingWindow?.trim()) return null;
  // ⛔ Solo quello che il motore riconosce e applica davvero: vedi `slotSaltati`.
  return finestraDigiuno(fastingWindow) ? fastingWindow : null;
}

/** Il pasto che resta più tardi: per la 20-4 e per la mail del primo giorno. */
export const pastoPrincipaleDigiuno = (fastingWindow?: string | null): 'colazione' | 'pranzo' | 'cena' =>
  finestraDigiuno(fastingWindow)?.pastoPrincipale ?? 'cena';

/** Già a un pasto solo: la 20-4 non si propone a chi la sta già facendo. */
export const eUnicoPasto = (fastingWindow?: string | null): boolean =>
  finestraDigiuno(fastingWindow)?.unicoPasto === true;

/**
 * Il primo pasto della giornata, per chi deve dire «comincia da…». ⚠️ **Non è
 * `pastoPrincipaleDigiuno`**, che è l'ultimo: sono due domande, e per mesi hanno avuto una risposta
 * sola. Il ripiego è la colazione, che è il primo pasto di chi non digiuna.
 */
export const primoPastoDigiuno = (fastingWindow?: string | null): 'colazione' | 'pranzo' | 'merenda' | 'cena' =>
  finestraDigiuno(fastingWindow)?.primoPasto ?? 'colazione';
