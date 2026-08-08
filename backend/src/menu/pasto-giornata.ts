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

/**
 * Il piatto è stato CAMBIATO in chat (non un ingrediente: tutto il piatto).
 *
 * È un evento registrato, e non una semplice riscrittura di `recipeId`, per una ragione precisa
 * (requisito di Simone, 8/8): «i cambi vanno poi salvati nella scheda cliente e nel report di fine
 * mese». Se ci limitassimo a sovrascrivere il `recipeId`, in scheda e nel report non comparirebbe
 * mai niente — il piatto vecchio non lascerebbe traccia e nessuno saprebbe che c'è stato un cambio.
 *
 * Resta separato da `substitutions`, che sono gli scambi di **ingrediente**: mischiarli renderebbe
 * illeggibile l'elenco in scheda, dove la nutrizionista deve distinguere «ha cambiato l'olio» da
 * «ha cambiato la colazione».
 */
export interface CambioPiatto {
  /** Il piatto che c'era prima: senza questo il cambio è invisibile. */
  daRecipeId: string;
  daNome: string;
  daKcal: number;
  /** Che cosa aveva chiesto: proteico | leggero | veloce | diverso. */
  preferenza?: string;
  /** Chi ha deciso il cambio. Per ora solo la chat. */
  origine: 'chat';
  /** Come per le sostituzioni: nasce `da_verificare`, la nutrizionista lo ricontrolla. */
  stato: 'da_verificare' | 'verificata' | 'corretta';
  /** Quando è stato concordato (ISO). */
  concordataIl: string;
  /** Il messaggio in cui la cliente ha scelto: la conversazione è la prova. */
  messageId?: string;
}

export interface MealSnapshot {
  slot: string;
  recipeId: string;
  name: string;
  kcal: number;
  substitutions?: Substitution[];
  /** Presente solo se il piatto è stato cambiato in chat. Vedi `CambioPiatto`. */
  cambioPiatto?: CambioPiatto;
}

/** Un ingrediente come sta in `Recipe.ingredients`. */
export interface IngredienteRicetta {
  name?: string;
  qty?: number;
  unit?: string;
}
