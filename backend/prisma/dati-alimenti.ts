/**
 * GLI ALIMENTI COMPILATI DALLA NUTRIZIONISTA — 19/8, dal foglio che Simone le ha fatto riempire.
 *
 * Sono i buchi che `npm run diag:crudo-cotto` aveva trovato, in due gruppi:
 *   · «Da aggiungere» — non c'erano affatto in tabella (aglio, sale, limone, cipolla, aromi);
 *   · «Riga a crudo» — c'erano **solo da cotto**, e nelle ricette le grammature sono a crudo.
 *
 * ⚠️ È un modulo TypeScript e non un JSON accanto allo script, ed è una lezione già pagata in questo
 * progetto: un file di dati che in `dist/` non c'è fa fallire lo script proprio il giorno che serve.
 *
 * ⚠️ I valori li ha messi una nutrizionista con la fonte accanto (CREA, BDA, USDA). Non si
 * ritoccano da qui: se un numero è sbagliato si corregge dalla pagina Alimenti, dove la correzione
 * resta scritta con chi l'ha fatta.
 */
/**
 * ⚠️ Il tipo vive in `src/nutrient-facts/riga-alimento.ts` e qui si riesporta: `src/` non deve
 * importare niente da `prisma/` — fuori da `rootDir` `nest build` si ferma (TS6059, 20/8).
 */
/**
 * ⚠️ **`import type` + `export type`, non `export type … from …` in una riga.** La riesportazione
 * diretta rimanda il tipo a chi importa questo file, ma **non lo porta in questo file**: la riga
 * `ALIMENTI_19_8: RigaAlimento[]` qui sotto diventa `TS2304: Cannot find name 'RigaAlimento'`.
 * Trovato dalla CI il 20/8, non da me: in locale la cache di jest teneva ancora la versione
 * compilata di prima e il test passava (vedi `src/common/src-non-esce-da-src.spec.ts`).
 */
import type { RigaAlimento } from '../src/nutrient-facts/riga-alimento';

export type { RigaAlimento };

export const ALIMENTI_19_8: RigaAlimento[] = [
  { name: 'aglio', synonyms: [], category: 'Verdura', state: 'crudo', kcal: 41.0, protein: 3.5, carbs: 8.4, sugars: 1.0, fat: 0.6, fiber: 3.1, source: 'BDA / CREA', foglio: 'Da aggiungere' },
  { name: 'sale', synonyms: ['sale da cucina'], category: 'Condimenti', state: 'secco', kcal: 0.0, protein: 0.0, carbs: 0.0, sugars: 0.0, fat: 0.0, fiber: 0.0, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'limone', synonyms: ['limoni', 'succo e polpa'], category: 'Frutta', state: 'crudo', kcal: 11.0, protein: 0.7, carbs: 1.4, sugars: 1.4, fat: 0.0, fiber: 1.9, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'pepe nero', synonyms: ['pepe'], category: 'Aromi', state: 'secco', kcal: 255.0, protein: 10.4, carbs: 38.3, sugars: 0.6, fat: 3.3, fiber: 25.3, source: 'USDA', foglio: 'Da aggiungere' },
  { name: 'cipolla', synonyms: ['cipolle'], category: 'Verdura', state: 'crudo', kcal: 26.0, protein: 1.0, carbs: 5.7, sugars: 5.7, fat: 0.1, fiber: 1.0, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'sale marino', synonyms: ['sale fino', 'sale grosso'], category: 'Condimenti', state: 'secco', kcal: 0.0, protein: 0.0, carbs: 0.0, sugars: 0.0, fat: 0.0, fiber: 0.0, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'brodo vegetale', synonyms: ['brodo'], category: 'Condimenti', state: 'liquido', kcal: 5.0, protein: 0.4, carbs: 0.7, sugars: 0.5, fat: 0.1, fiber: 0.0, source: 'USDA', foglio: 'Da aggiungere' },
  { name: 'succo di limone', synonyms: ['succo limone'], category: 'Condimenti', state: 'crudo', kcal: 6.0, protein: 0.2, carbs: 1.4, sugars: 1.4, fat: 0.0, fiber: 0.0, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'prezzemolo', synonyms: [], category: 'Aromi', state: 'crudo', kcal: 20.0, protein: 3.7, carbs: 0.7, sugars: 0.7, fat: 0.6, fiber: 5.0, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'basilico', synonyms: [], category: 'Aromi', state: 'crudo', kcal: 39.0, protein: 3.1, carbs: 5.1, sugars: 0.3, fat: 0.8, fiber: 3.9, source: 'BDA', foglio: 'Da aggiungere' },
  { name: 'acqua', synonyms: ['acqua naturale'], category: 'Condimenti', state: 'liquido', kcal: 0.0, protein: 0.0, carbs: 0.0, sugars: 0.0, fat: 0.0, fiber: 0.0, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'cipolla rossa', synonyms: ['cipolla di Tropea'], category: 'Verdura', state: 'crudo', kcal: 26.0, protein: 1.0, carbs: 5.7, sugars: 5.7, fat: 0.1, fiber: 1.0, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'sedano', synonyms: ['sedano costa'], category: 'Verdura', state: 'crudo', kcal: 20.0, protein: 2.3, carbs: 2.4, sugars: 2.2, fat: 0.2, fiber: 1.6, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'timo', synonyms: [], category: 'Aromi', state: 'crudo', kcal: 101.0, protein: 5.6, carbs: 24.5, sugars: 1.7, fat: 1.7, fiber: 14.0, source: 'USDA', foglio: 'Da aggiungere' },
  { name: 'cannella', synonyms: ['cannella in polvere'], category: 'Aromi', state: 'secco', kcal: 247.0, protein: 4.0, carbs: 27.5, sugars: 2.2, fat: 1.2, fiber: 53.1, source: 'USDA', foglio: 'Da aggiungere' },
  { name: 'rucola', synonyms: ['rucola comune'], category: 'Verdura', state: 'crudo', kcal: 18.0, protein: 2.6, carbs: 3.9, sugars: 2.1, fat: 0.3, fiber: 0.9, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'mirtilli', synonyms: ['mirtillo'], category: 'Frutta', state: 'crudo', kcal: 25.0, protein: 0.5, carbs: 5.1, sugars: 5.1, fat: 0.2, fiber: 3.1, source: 'CREA', foglio: 'Da aggiungere' },
  { name: 'aceto balsamico', synonyms: ['aceto'], category: 'Condimenti', state: 'liquido', kcal: 88.0, protein: 0.5, carbs: 17.0, sugars: 15.0, fat: 0.0, fiber: 0.0, source: 'USDA', foglio: 'Da aggiungere' },
  { name: 'carote', synonyms: ['carota'], category: 'Verdura', state: 'crudo', kcal: 35.0, protein: 1.1, carbs: 7.6, sugars: 7.6, fat: 0.2, fiber: 3.1, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'broccoli', synonyms: ['broccolo', 'cavolo broccolo'], category: 'Verdura', state: 'crudo', kcal: 27.0, protein: 3.0, carbs: 2.0, sugars: 2.0, fat: 0.4, fiber: 3.0, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'pane di segale', synonyms: ['pane nero'], category: 'Cereali', state: 'fresco', kcal: 219.0, protein: 8.3, carbs: 45.4, sugars: 3.8, fat: 1.0, fiber: 4.6, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'barbabietola', synonyms: ['barbabietola rossa'], category: 'Verdura', state: 'crudo', kcal: 19.0, protein: 1.1, carbs: 4.0, sugars: 4.0, fat: 0.0, fiber: 2.6, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'zucca', synonyms: ['zucca gialla'], category: 'Verdura', state: 'crudo', kcal: 18.0, protein: 1.1, carbs: 3.5, sugars: 2.5, fat: 0.1, fiber: 0.5, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'spinaci', synonyms: ['spinacio'], category: 'Verdura', state: 'crudo', kcal: 31.0, protein: 3.4, carbs: 2.9, sugars: 0.4, fat: 0.7, fiber: 1.9, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'pane di farro', synonyms: ['pane di farro integrale'], category: 'Cereali', state: 'fresco', kcal: 240.0, protein: 10.0, carbs: 46.0, sugars: 2.0, fat: 1.8, fiber: 6.5, source: 'USDA', foglio: 'Riga a crudo' },
  { name: 'patate', synonyms: ['patata'], category: 'Verdura', state: 'crudo', kcal: 80.0, protein: 2.1, carbs: 17.9, sugars: 0.4, fat: 1.0, fiber: 1.6, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'ceci', synonyms: ['ceci secchi'], category: 'Legumi', state: 'secco', kcal: 334.0, protein: 20.9, carbs: 46.9, sugars: 3.7, fat: 6.3, fiber: 13.6, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'spaghetti integrali', synonyms: ['pasta integrale'], category: 'Cereali', state: 'secco', kcal: 335.0, protein: 13.0, carbs: 64.8, sugars: 3.2, fat: 2.5, fiber: 8.4, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'polenta', synonyms: ['farina di mais per polenta'], category: 'Cereali', state: 'secco', kcal: 350.0, protein: 8.7, carbs: 77.0, sugars: 0.6, fat: 0.6, fiber: 4.0, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'fagioli neri', synonyms: ['fagioli neri secchi'], category: 'Legumi', state: 'secco', kcal: 341.0, protein: 21.6, carbs: 62.4, sugars: 2.1, fat: 1.4, fiber: 15.2, source: 'USDA', foglio: 'Riga a crudo' },
  { name: 'lenticchie', synonyms: ['lenticchie secche'], category: 'Legumi', state: 'secco', kcal: 325.0, protein: 22.7, carbs: 51.1, sugars: 1.8, fat: 1.0, fiber: 13.8, source: 'CREA', foglio: 'Riga a crudo' },
  { name: 'popcorn', synonyms: ['mais da scoppio'], category: 'Cereali', state: 'secco', kcal: 375.0, protein: 12.0, carbs: 74.0, sugars: 0.9, fat: 4.3, fiber: 14.5, source: 'USDA', foglio: 'Riga a crudo' },
];
