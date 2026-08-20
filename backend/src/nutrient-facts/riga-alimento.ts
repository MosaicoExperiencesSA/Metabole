/**
 * LA FORMA DI UNA RIGA DEL FOGLIO ALIMENTI.
 *
 * ⛔ **STA IN `src/`, E IL 20/8 STAVA IN `prisma/`.** Quando ho spostato `piano-alimenti.ts` dentro
 * `src/` per poterlo provare, gli ho lasciato un `import type` che puntava a `prisma/dati-alimenti`.
 * `tsc --noEmit -p tsconfig.json` e i 4058 test passavano; **`nest build` no**, perché usa
 * `tsconfig.build.json`, dove `rootDir` è `src` e un file fuori da lì è un errore (TS6059).
 * Risultato: il backend non si è deployato per un'ora, e tre consegne sono rimaste ferme dietro
 * quell'errore mentre io dicevo che erano verdi.
 *
 * ⚠️ La direzione giusta è questa: **`src/` non sa che `prisma/` esiste**. Gli script di `prisma/`
 * sono attrezzi che usano l'applicazione, non il contrario. `prisma/dati-alimenti.ts` riesporta
 * questo tipo, così gli script continuano a scrivere `from './dati-alimenti'` come prima.
 */
export interface RigaAlimento {
  name: string;
  synonyms: string[];
  category: string | null;
  /** crudo · secco · bollito · cotto · liquido · fresco — vedi `normalizzaStato`. */
  state: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  sugars: number | null;
  fat: number | null;
  fiber: number | null;
  source: string | null;
  /**
   * ⚠️ L'INDICE GLICEMICO, aggiunto il 20/8 e **opzionale**: le 32 righe del 19/8 non ce l'hanno, e
   * il foglio nuovo sì. Senza questi campi l'import avrebbe buttato via l'IG di 245 righe — cioè
   * metà del lavoro di chi ha compilato il foglio — e nessuno se ne sarebbe accorto, perché una
   * colonna che non arriva non produce nessun errore.
   */
  glycemicIndex?: number | null;
  glycemicIndexMin?: number | null;
  glycemicIndexMax?: number | null;
  /** solida | media | debole | non_applicabile — gli unici che il motore legge. */
  glycemicIndexReliability?: string | null;
  /** Da quale foglio del file viene: serve solo a raccontarlo nella prova a vuoto. */
  foglio: string;
}
