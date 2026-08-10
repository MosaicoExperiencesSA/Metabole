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
 *    finestre corte invece di una lunga. Sta in elenco perché Simone l'ha chiesto e perché è un
 *    modo di mangiare che le clienti usano, ma l'etichetta non promette un 16:8 che non c'è.
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
   * Vero se è già la finestra più stretta possibile (un pasto solo): a chi la fa non si propone la
   * 20-4, perché la sta già facendo.
   */
  unicoPasto: boolean;
}

export const FINESTRE_DIGIUNO: FinestraDigiuno[] = [
  {
    valore: 'skip_breakfast',
    salta: ['breakfast', 'morning_snack'],
    etichettaStaff: 'Salta la colazione (mangia da pranzo a cena)',
    etichettaCliente: 'Salti la colazione — mangi da pranzo a cena',
    etichettaBreve: 'Colazione',
    pastoPrincipale: 'cena',
    unicoPasto: false,
  },
  {
    valore: 'skip_dinner',
    salta: ['dinner', 'afternoon_snack'],
    etichettaStaff: 'Salta la cena (mangia da colazione a pranzo)',
    etichettaCliente: 'Salti la cena — mangi da colazione a pranzo',
    etichettaBreve: 'Cena',
    pastoPrincipale: 'pranzo',
    unicoPasto: false,
  },
  {
    valore: 'skip_lunch',
    // Solo il pranzo: gli spuntini li decide il numero di pasti, non questa scelta. Con due pasti
    // lontani non c'è uno spuntino «adiacente» da togliere.
    salta: ['lunch'],
    etichettaStaff: 'Salta il pranzo (colazione e cena)',
    etichettaCliente: 'Salti il pranzo — mangi a colazione e a cena',
    etichettaBreve: 'Pranzo',
    pastoPrincipale: 'cena',
    unicoPasto: false,
  },
  {
    valore: 'skip_breakfast_lunch',
    salta: ['breakfast', 'morning_snack', 'lunch'],
    etichettaStaff: 'Salta colazione e pranzo (solo cena)',
    etichettaCliente: 'Salti colazione e pranzo — solo la cena',
    etichettaBreve: 'Colazione e pranzo',
    pastoPrincipale: 'cena',
    unicoPasto: true,
  },
  {
    valore: 'skip_dinner_breakfast',
    salta: ['breakfast', 'morning_snack', 'dinner', 'afternoon_snack'],
    etichettaStaff: 'Salta cena e colazione (finestra al mattino)',
    etichettaCliente: 'Salti cena e colazione — finestra a metà giornata',
    etichettaBreve: 'Cena e colazione',
    pastoPrincipale: 'pranzo',
    unicoPasto: true,
  },
];

/** I valori ammessi, per le `IsIn` dei DTO: uno solo, e non tre elenchi che divergono. */
export const VALORI_FINESTRA_DIGIUNO: string[] = FINESTRE_DIGIUNO.map((f) => f.valore);

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

/** Il pasto che resta più tardi: per la 20-4 e per la mail del primo giorno. */
export const pastoPrincipaleDigiuno = (fastingWindow?: string | null): 'colazione' | 'pranzo' | 'cena' =>
  finestraDigiuno(fastingWindow)?.pastoPrincipale ?? 'cena';

/** Già a un pasto solo: la 20-4 non si propone a chi la sta già facendo. */
export const eUnicoPasto = (fastingWindow?: string | null): boolean =>
  finestraDigiuno(fastingWindow)?.unicoPasto === true;
