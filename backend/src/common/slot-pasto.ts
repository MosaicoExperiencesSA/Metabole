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

/** I pasti su cui si garantisce la soglia minima di ricette sicure. */
export const MAIN_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

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
