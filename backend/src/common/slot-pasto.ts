/**
 * GLI SLOT DI UNA GIORNATA — nomi ed etichette, in un posto solo.
 *
 * Vivevano dentro `personal-base.service.ts`, che è il file della base personale certificata. Sono
 * stati portati qui quando è nato il controllo del pool di Vera, perché da quel momento a chiedersi
 * «quali sono i pasti principali» e «come si chiama `dinner` in italiano» non è più un modulo solo.
 *
 * ⚠️ La ragione vera non è l'eleganza: è che la SOGLIA e i PASTI su cui si misura devono essere gli
 * stessi. Se il controllo del pool dicesse «restano 2 ricette per la cena, sotto la soglia» usando
 * un elenco di slot diverso da quello con cui la base personale blocca il piano, il sistema
 * direbbe due cose diverse sullo stesso dato — ed è così che nasce una terza verità.
 */

/**
 * ⚠️ **LE TRE FORME DI UNA GIORNATA, contate il 20/8.**
 *
 * Le stesse tre file di stringhe erano scritte a mano in **diciotto punti** del backend:
 *
 *   · i cinque pasti in ordine — **9 volte** (`collega-ricetta`, tre `@IsIn` in `catalog.dto`,
 *     `giornate-complete`, `copertura-catalogo`, `engine-rules` due volte, `giornata-dettata`);
 *   · i tre pasti — **5 volte**;
 *   · il digiuno (pranzo, merenda, cena) — **4 volte**.
 *
 * ✅ **Oggi combaciano tutte.** Non c'è un difetto aperto, e per questo qui sotto le forme si
 * *dichiarano* e non si va a riscrivere i diciotto punti: toccare l'ordine dei pasti dentro il
 * motore per fare ordine sarebbe rischiare la colazione dopo la cena — che è esattamente il danno
 * scritto nel commento di `collega-ricetta.ts` — in cambio di niente che si veda.
 *
 * ⚠️ Quello che mancava è **qualcuno che se ne accorga quando smetteranno di combaciare**, ed è
 * `giornata-in-tre-forme.spec.ts`: legge i file e pretende che ogni elenco di slot sia una di
 * queste tre forme. Il giorno che qualcuno ne scrive una quarta — o mette la colazione in fondo —
 * il test lo dice, e chi la scrive decide se è voluta.
 *
 * ⛔ Che serva è già dimostrato: **sul «4 pasti» le funzioni non dicevano la stessa cosa.**
 * `slotsForMeals` restituiva quattro slot (con la merenda), le altre tre lo trattavano come un tre,
 * e il generatore non lo conosceva affatto e ricadeva sul cinque. Non l'ha visto nessuno per mesi
 * perché nessuno guardava i quattro elenchi insieme. Vedi `catalog/quattro-pasti.spec.ts`.
 */
export const GIORNATA_CINQUE = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'] as const;
export const GIORNATA_TRE = ['breakfast', 'lunch', 'dinner'] as const;
export const GIORNATA_DIGIUNO = ['lunch', 'afternoon_snack', 'dinner'] as const;

/** Le forme ammesse di una giornata: quello che il test pretende di trovare nei file. */
export const FORME_DI_GIORNATA: readonly (readonly string[])[] = [GIORNATA_CINQUE, GIORNATA_TRE, GIORNATA_DIGIUNO];

/**
 * I pasti su cui si garantisce la soglia minima di ricette sicure.
 * ⚠️ È la giornata da tre, e non per caso: sono i pasti che ci sono in **tutte** le strutture
 * tranne il digiuno. Resta un nome suo perché la domanda è un'altra — «dove si misura la soglia»,
 * non «che pasti ha questa dieta».
 */
export const MAIN_SLOTS = GIORNATA_TRE;

export type MainSlot = (typeof MAIN_SLOTS)[number];

/** Come si chiamano in italiano, per i messaggi che legge una persona. */
export const SLOT_LABEL: Record<string, string> = {
  breakfast: 'colazione',
  lunch: 'pranzo',
  dinner: 'cena',
  morning_snack: 'spuntino',
  afternoon_snack: 'merenda',
};

/**
 * L'etichetta di uno slot, con ripiego sul nome tecnico.
 *
 * Il ripiego è voluto: uno slot nuovo in catalogo deve comparire nel messaggio col suo nome grezzo,
 * non sparire. Un pasto che non si vede è un pasto che nessuno verifica.
 */
export const etichettaSlot = (slot: string): string => SLOT_LABEL[slot] ?? slot;
