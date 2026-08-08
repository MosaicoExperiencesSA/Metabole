/**
 * Forma del JSON `MenuDay.meals`: lo snapshot dei pasti di una giornata erogata.
 *
 * Sta in un file condiviso perché ora ci scrivono in due — il motore
 * (`menu.service.ts`) e la sostituzione concordata in chat con Gaia
 * (`sostituzione-chat.service.ts`) — e due definizioni della stessa struttura
 * divergono in silenzio: il giorno scritto da una diventa illeggibile all'altra.
 *
 * Nessuna dipendenza da Nest né da Prisma.
 */

/**
 * Una sostituzione annotata su un pasto. `from`/`to`/`reason` sono i tre campi storici e
 * restano obbligatori: i giorni già scritti in produzione hanno solo quelli e devono
 * continuare a leggersi senza migrazioni.
 *
 * Tutto il resto è opzionale e lo valorizza SOLO la sostituzione concordata in chat: serve
 * al nutrizionista per verificare i grammi dalla scheda cliente senza rileggere le chat
 * (`stato: 'da_verificare'` è ciò che rende la verifica una cosa che si può davvero fare).
 */
export interface Substitution {
  from: string;
  to: string;
  reason: string;
  /** Quantità di partenza, come sta nella ricetta di catalogo. */
  fromQty?: number;
  /** Quantità del sostituto, quella che la cliente deve usare davvero. */
  toQty?: number;
  /** Unità delle due quantità (g, ml, pz…). */
  unit?: string;
  /** Chi ha deciso il cambio. Assente = il motore, come è sempre stato. */
  origine?: 'chat';
  /** Il motivo DICHIARATO dalla cliente (vedi `MOTIVI` in `sostituzione-chat.ts`). */
  motivo?: string;
  /**
   * Verifica del nutrizionista. Ogni cambio nato in chat parte `da_verificare`: senza
   * questo, verificare vorrebbe dire rileggere tutte le conversazioni.
   */
  stato?: 'da_verificare' | 'verificata' | 'corretta';
  /** Quando è stata concordata in chat (ISO). */
  concordataIl?: string;
  /** Il messaggio di chat in cui la cliente ha confermato: la conversazione è la prova. */
  messageId?: string;
  /**
   * Vero se la grammatura proposta era fuori scala ed è stata riportata a pari
   * grammatura dal controllo di plausibilità. Va mostrato al nutrizionista.
   */
  grammaturaCorretta?: boolean;
}

export interface MealSnapshot {
  slot: string;
  recipeId: string;
  name: string;
  kcal: number;
  substitutions?: Substitution[];
}

/** Un ingrediente come sta in `Recipe.ingredients`. */
export interface IngredienteRicetta {
  name?: string;
  qty?: number;
  unit?: string;
}
