/**
 * LA PORTA PER SCRIVERE UNA RICETTA — un token, non un `import`.
 *
 * Stessa forma di `SCRITTURA_CLIENTE` (`richieste.service.ts`) e per la stessa ragione, che è
 * pratica e non stilistica: importare `CatalogService` qui dentro trascina nel grafo di compilazione
 * di ts-jest mezzo catalogo, e i test di Vera smettono di girare da soli per colpa di un errore in
 * un file che non c'entra niente. Un modulo che si può collaudare in isolamento è un modulo che
 * qualcuno collauderà.
 *
 * ⚠️ Il servizio vero resta **quello**, legato con `useExisting` in `VeraModule`: le ricette si
 * scrivono da `CatalogService` e da nessun'altra parte, perché quella è la funzione che lascia la
 * traccia in audit e che domani, quando qualcuno aggiungerà un controllo alla creazione, lo
 * aggiungerà in un posto solo.
 *
 * L'interfaccia dichiara **solo i due metodi che servono**: è anche il modo di dire, leggendo, che
 * da qui non si fa altro sul catalogo — niente cancellazioni, niente allergeni, niente pubblicazioni.
 */
export interface ScritturaRicetta {
  createRecipe(userId: string, dto: unknown): Promise<unknown>;
  updateRecipe(userId: string, id: string, dto: unknown): Promise<unknown>;
  /**
   * Gli allergeni CONFERMATI (voce 227, 16/8). Terzo e ultimo metodo, e vale la pena dire perché è
   * qui e non fatto a mano: filtra sui 14 codici UE, mette `allergensReviewed: true` e lascia la
   * traccia in audit. È la stessa funzione del pulsante in scheda — una seconda strada per un dato
   * sanitario è il difetto che questo progetto ha già pagato due volte.
   */
  setRecipeAllergens(userId: string, id: string, allergens: string[]): Promise<unknown>;
}

export const SCRITTURA_RICETTA = 'VERA_SCRITTURA_RICETTA';

/** Cosa Vera scrive davvero in catalogo. Nessun campo in più: vedi il commento sopra. */
export interface RicettaDaScrivere {
  name: string;
  regime: string;
  mealSlot: string;
  kcal: number;
  ingredients: { name: string; qty: number | null; unit: string | null }[];
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  tags: string[];
  /**
   * ⚠️ SEMPRE `false` alla nascita, e non è un dettaglio: una ricetta attiva entra nel motore, e il
   * motore non chiede il permesso a nessuno. Nasce spenta, la accende il capo dalla coda.
   */
  active: false;
}
