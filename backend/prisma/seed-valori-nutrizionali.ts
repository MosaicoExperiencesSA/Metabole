/**
 * SEED DELLA BANCA DATI NUTRIZIONALE — i valori con cui Gaia può rispondere.
 *
 * I dati vengono dalla ricerca dell'11/8, con le fonti scritte riga per riga:
 * `progetto/ricerche/valori-nutrizionali-fonti.md`.
 *  - **indici glicemici**: International Tables of Glycemic Index and Glycemic Load Values (Atkinson,
 *    Brand-Miller et al., 2008 e 2021), Università di Sydney, Linus Pauling Institute, Harvard Health;
 *  - **valori per 100 g**: CREA — Banca Dati di Composizione degli Alimenti (alimentinutrizione.it),
 *    che è il riferimento italiano.
 *
 * ## Le due regole di questo seed
 *
 * 1. **NON sovrascrive un valore confermato.** Se la nutrizionista ha guardato una riga e l'ha
 *    approvata (o corretta), quella riga è sua: il seed le aggiorna solo la fonte e le note. È la
 *    stessa regola del seed dei parametri, e per lo stesso motivo — un deploy non deve disfare una
 *    decisione clinica.
 * 2. **L'affidabilità è un dato, non un commento.** `debole` vuol dire che il numero da solo non si
 *    dice: la ricerca ha trovato l'IG delle patate da 73 a 111 e quello dell'anguria da 50 a 76
 *    secondo la fonte. Chi legge questa tabella (`ValoriNutrizionaliService`) usa il range in quei
 *    casi, e questa colonna è il modo in cui lo sa.
 *
 * `npm run seed:nutrienti`  ·  gira anche dentro `prisma/seed.ts` a ogni deploy.
 */
import { PrismaClient } from '@prisma/client';

export interface RigaNutriente {
  name: string;
  synonyms?: string[];
  category: string;
  state?: string;
  gi?: number;
  giMin?: number;
  giMax?: number;
  giSource?: string;
  giReliability?: 'solida' | 'media' | 'debole';
  kcal?: number;
  protein?: number;
  carbs?: number;
  sugars?: number;
  fat?: number;
  fiber?: number;
  source?: string;
  sourceRef?: string;
  note?: string;
}

const CREA = 'CREA — Banca Dati di Composizione degli Alimenti';
const IT2008 = 'International Tables of Glycemic Index (Atkinson et al., 2008)';
const IT2021 = 'International Tables of Glycemic Index (Atkinson et al., 2021)';
const SYDNEY = 'Università di Sydney — glycemicindex.com';
const LPI = 'Linus Pauling Institute (da International Tables 2008)';

export const VALORI: RigaNutriente[] = [
  // ---------- Cereali e derivati ----------
  {
    name: 'riso bianco', synonyms: ['riso brillato', 'riso comune'], category: 'cereali', state: 'crudo',
    gi: 73, giMin: 66, giMax: 89, giSource: IT2021, giReliability: 'debole',
    kcal: 334, protein: 6.7, carbs: 80.4, sugars: 0.2, fat: 0.4, fiber: 1, source: CREA, sourceRef: 'CREA 000100',
    note: 'IG molto variabile per varietà: la categoria «riso» nelle tabelle 2021 ha media 67 con estremi 19-116.',
  },
  {
    name: 'riso basmati', synonyms: ['basmati'], category: 'cereali', state: 'crudo',
    gi: 62, giMin: 57, giMax: 67, giSource: IT2008, giReliability: 'debole',
    kcal: 367, protein: 9, carbs: 82.9, sugars: 1.1, fat: 1.9, fiber: 1.3, source: CREA, sourceRef: 'CREA 000130',
    note:
      'È la riga da cui è nato tutto (11/8). Il dato è DEBOLE: la voce delle tabelle 2008 è «quick cooking white basmati» (67), ' +
      'Henry 2005 lo classifica genericamente «basso IG». Rispetto al riso integrale (65, con voci a 50) è VICINO, non più basso di molto: ' +
      'la differenza dipende più dalla varietà e dalla cottura che dal tipo.',
  },
  {
    name: 'riso integrale', category: 'cereali', state: 'crudo',
    gi: 65, giMin: 50, giMax: 68, giSource: IT2021, giReliability: 'media',
    kcal: 341, protein: 7.5, carbs: 77.4, sugars: 1.2, fat: 1.9, fiber: 1.9, source: CREA, sourceRef: 'CREA 000110',
    note: 'Le tabelle 2021 dicono 65; Harvard e LPI riportano 50 sulla stessa voce del 2008.',
  },
  {
    name: 'riso parboiled', category: 'cereali', state: 'crudo',
    gi: 68, giMin: 68, giMax: 75, giSource: IT2008, giReliability: 'media',
    note: '68 con 10 minuti di cottura, 75 con 20: qui la cottura conta più della varietà.',
  },
  {
    name: 'pasta di semola', synonyms: ['pasta', 'spaghetti', 'pasta normale'], category: 'cereali', state: 'cruda',
    gi: 46, giMin: 46, giMax: 55, giSource: IT2008, giReliability: 'media',
    kcal: 341, protein: 13.5, carbs: 72.7, sugars: 2.2, fat: 1.2, fiber: 1.7, source: CREA, sourceRef: 'CREA 000800',
    note: 'L\'IG è quello AL DENTE: cotta venti minuti sale a 58. Dodici punti di differenza per la cottura.',
  },
  {
    name: 'pasta integrale', category: 'cereali', state: 'cruda',
    gi: 42, giMin: 42, giMax: 52, giSource: IT2008, giReliability: 'media',
    kcal: 330, protein: 13.3, carbs: 64.8, sugars: 3, fat: 2.2, fiber: 7.1, source: CREA, sourceRef: 'CREA 000850',
    note: 'Quattro volte le fibre della pasta di semola (7,1 contro 1,7): è la differenza che si vede davvero.',
  },
  {
    name: 'pane bianco', synonyms: ['pane', 'pane tipo 0'], category: 'cereali',
    gi: 75, giMin: 59, giMax: 89, giSource: IT2008, giReliability: 'media',
    kcal: 268, protein: 8.1, carbs: 59.5, sugars: 2, fat: 0.5, fiber: 3.8, source: CREA, sourceRef: 'CREA 000530',
    note: 'Media di 16 studi (75 ± 2); Harvard e LPI selezionano 71.',
  },
  {
    name: 'pane integrale', category: 'cereali',
    gi: 74, giMin: 68, giMax: 85, giSource: IT2008, giReliability: 'media',
    kcal: 224, protein: 8.5, carbs: 44.1, sugars: 2, fat: 1.3, fiber: 6.5, source: CREA, sourceRef: 'CREA 000550',
    note: 'L\'IG è quasi uguale al pane bianco: la differenza sta nelle fibre (6,5 contro 3,8), non nell\'indice glicemico.',
  },
  {
    name: 'farro perlato', synonyms: ['farro'], category: 'cereali', state: 'crudo',
    gi: 63, giSource: SYDNEY, giReliability: 'debole',
    kcal: 353, protein: 14.6, carbs: 69.3, sugars: 2.4, fat: 2.4, fiber: 6.5, source: CREA, sourceRef: 'CREA 000020',
    note: 'L\'Università di Sydney scrive che nelle tabelle internazionali esiste UN SOLO dato per il farro perlato: 63.',
  },
  {
    name: 'orzo perlato', synonyms: ['orzo'], category: 'cereali', state: 'crudo',
    gi: 28, giMin: 25, giMax: 35, giSource: IT2008, giReliability: 'media',
    kcal: 346, protein: 9.4, carbs: 73.7, sugars: 1.5, fat: 1.5, fiber: 9.2, source: CREA, sourceRef: 'CREA 000090',
  },
  {
    name: 'quinoa', category: 'cereali', state: 'cruda',
    gi: 53, giSource: IT2008, giReliability: 'solida',
    kcal: 376, protein: 15.4, carbs: 57.8, sugars: 5.3, fat: 8.1, fiber: 12.2, source: CREA, sourceRef: 'CREA 000096',
    note: 'CREA e USDA discordano su fibre (12,2 contro ~7) e grassi (8,1 contro ~6): qui vale il CREA, che è il riferimento italiano.',
  },
  {
    name: 'fiocchi d\'avena', synonyms: ['avena', 'porridge'], category: 'cereali', state: 'secco',
    gi: 55, giMin: 49, giMax: 63, giSource: IT2008, giReliability: 'media',
    kcal: 367, protein: 8, carbs: 66.8, sugars: 0.6, fat: 7.5, fiber: 8.3, source: CREA, sourceRef: 'CREA 003030',
    note: 'I FIOCCHI stanno a 55; l\'avena istantanea a 83. Non sono lo stesso alimento.',
  },
  {
    name: 'couscous', category: 'cereali', state: 'crudo',
    gi: 65, giSource: IT2008, giReliability: 'media',
    kcal: 361, protein: 13.7, carbs: 76.5, sugars: 2.7, fat: 1.1, fiber: 4.5, source: CREA, sourceRef: 'CREA 000045',
  },
  {
    name: 'gallette di riso', category: 'cereali',
    gi: 82, giSource: IT2008, giReliability: 'solida',
    note: 'Uno degli IG più alti in tabella, e le fonti concordano.',
  },
  {
    name: 'patate', synonyms: ['patata'], category: 'verdura', state: 'crude',
    gi: 78, giMin: 73, giMax: 82, giSource: IT2008, giReliability: 'media',
    kcal: 72, protein: 2, carbs: 16, sugars: 1, fat: 0.1, fiber: 1.8, source: CREA, sourceRef: 'CREA 006500',
    note:
      'Il range dipende dalla preparazione più che dalla patata: bollite 73-82, al forno fino a 111 (varietà russet), ' +
      'purè istantaneo 87 — e bollite e RAFFREDDATE una notte scendono a 49.',
  },
  {
    name: 'patata dolce', synonyms: ['batata'], category: 'verdura', state: 'cruda',
    gi: 70, giSource: IT2008, giReliability: 'media',
    kcal: 80, protein: 1.6, carbs: 16.8, sugars: 4.2, fat: 0.1, fiber: 3, source: 'Matvaretabellen (da USDA SR28)',
    note: 'Unico alimento di questa tabella senza una riga nel CREA.',
  },

  // ---------- Legumi ----------
  {
    name: 'lenticchie', category: 'legumi', state: 'bollite',
    gi: 29, giMin: 16, giMax: 32, giSource: LPI, giReliability: 'media',
    kcal: 109, protein: 6.9, carbs: 16.3, sugars: 0.7, fat: 0.4, fiber: 8.3, source: CREA, sourceRef: 'CREA 004505',
    note: 'Valori da BOLLITE. Da secche sono 319 kcal e 22,7 g di proteine (CREA 004500): tre volte tanto.',
  },
  {
    name: 'ceci', category: 'legumi', state: 'bolliti',
    gi: 28, giMin: 28, giMax: 41, giSource: IT2008, giReliability: 'debole',
    kcal: 132, protein: 7, carbs: 18.9, sugars: 1.3, fat: 2.4, fiber: 5.8, source: CREA, sourceRef: 'CREA 004005',
    note: 'Le fonti discordano molto sull\'IG (Harvard riporta 10, che è anomalo). Da secchi: 343 kcal, 20,9 g di proteine.',
  },
  {
    name: 'fagioli borlotti', synonyms: ['borlotti', 'fagioli'], category: 'legumi', state: 'secchi',
    kcal: 312, protein: 20.2, carbs: 47.7, sugars: 3.5, fat: 2, fiber: 17.3, source: CREA, sourceRef: 'CREA 004120',
    note: 'Nessun IG specifico per i borlotti da fonte affidabile: la riga resta senza indice invece di prenderlo da un altro fagiolo.',
  },
  {
    name: 'fagioli cannellini', synonyms: ['cannellini'], category: 'legumi', state: 'secchi',
    gi: 31, giSource: SYDNEY, giReliability: 'debole',
    note: 'L\'IG è quello dei fagioli bianchi navy/haricot: surrogato dichiarato, non un dato sui cannellini.',
  },
  {
    name: 'piselli', category: 'legumi', state: 'freschi',
    gi: 51, giMin: 48, giMax: 54, giSource: IT2008, giReliability: 'media',
    kcal: 64, protein: 5.5, carbs: 6.5, sugars: 4, fat: 0.6, fiber: 6.3, source: CREA, sourceRef: 'CREA 004700',
  },

  // ---------- Frutta ----------
  { name: 'mela', category: 'frutta', gi: 39, giMin: 36, giMax: 39, giSource: LPI, giReliability: 'solida', kcal: 44, protein: 0.2, carbs: 10, sugars: 10, fiber: 2.6, source: CREA, sourceRef: 'CREA 007120' },
  { name: 'banana', category: 'frutta', gi: 62, giMin: 48, giMax: 62, giSource: IT2008, giReliability: 'media', kcal: 76, protein: 1.2, carbs: 17.4, sugars: 14.8, fat: 0.3, fiber: 1.8, source: CREA, sourceRef: 'CREA 007510', note: 'L\'IG dipende dalla maturazione: poco matura 48-55, matura 62.' },
  { name: 'pera', category: 'frutta', gi: 38, giMin: 29, giMax: 38, giSource: LPI, giReliability: 'media', kcal: 43, protein: 0.3, carbs: 8.8, sugars: 8.8, fat: 0.1, fiber: 3.8, source: CREA, sourceRef: 'CREA 007260' },
  { name: 'arancia', category: 'frutta', gi: 40, giMin: 40, giMax: 45, giSource: IT2008, giReliability: 'solida', kcal: 37, protein: 0.7, carbs: 7.8, sugars: 7.8, fat: 0.2, fiber: 1.6, source: CREA, sourceRef: 'CREA 008000' },
  { name: 'kiwi', category: 'frutta', kcal: 48, protein: 1.2, carbs: 9, sugars: 9, fat: 0.6, fiber: 2.2, source: CREA, sourceRef: 'CREA 007570', note: 'Nessun IG trovato da fonte affidabile: la riga resta senza indice.' },
  { name: 'fragole', category: 'frutta', gi: 40, giSource: SYDNEY, giReliability: 'media', kcal: 30, protein: 0.9, carbs: 5.3, sugars: 5.3, fat: 0.4, fiber: 1.6, source: CREA, sourceRef: 'CREA 007730' },
  { name: 'anguria', synonyms: ['melone d\'acqua', 'cocomero'], category: 'frutta', gi: 60, giMin: 50, giMax: 76, giSource: IT2021, giReliability: 'debole', note: 'Dato molto instabile: le tabelle 2008 danno 72-76, le 2021 danno 50. Il carico glicemico resta comunque basso (4 per 120 g).' },
  { name: 'pesca', category: 'frutta', gi: 42, giSource: IT2008, giReliability: 'media', note: 'Pesca FRESCA: quella sciroppata è più alta.' },
  { name: 'ananas', category: 'frutta', gi: 58, giMin: 58, giMax: 66, giSource: LPI, giReliability: 'media' },
  { name: 'uva', category: 'frutta', gi: 59, giSource: IT2008, giReliability: 'media' },

  // ---------- Latte e derivati ----------
  { name: 'latte intero', category: 'latticini', gi: 41, giSource: IT2008, giReliability: 'media', kcal: 64, protein: 3.3, carbs: 4.9, sugars: 4.9, fat: 3.6, fiber: 0, source: CREA, sourceRef: 'CREA 135010' },
  { name: 'latte parzialmente scremato', category: 'latticini', kcal: 46, protein: 3.5, carbs: 5, sugars: 5, fat: 1.5, fiber: 0, source: CREA, sourceRef: 'CREA 135020', note: 'Nessun IG per il parzialmente scremato: le tabelle hanno solo intero (41) e scremato (32).' },
  { name: 'yogurt bianco intero', synonyms: ['yogurt intero'], category: 'latticini', gi: 12, giSource: SYDNEY, giReliability: 'debole', kcal: 66, protein: 3.8, carbs: 4.3, sugars: 4.3, fat: 3.9, fiber: 0, source: CREA, sourceRef: 'CREA 150010', note: 'L\'IG viene dalla voce «greek style, full cream»: non è esattamente lo yogurt bianco intero.' },
  { name: 'yogurt greco 0%', synonyms: ['yogurt greco magro', 'yogurt greco'], category: 'latticini', gi: 19, giSource: SYDNEY, giReliability: 'debole', kcal: 51, protein: 9, carbs: 4, sugars: 4, fat: 0, fiber: 0, source: CREA, sourceRef: 'CREA 150030' },
  { name: 'ricotta di vacca', synonyms: ['ricotta'], category: 'latticini', kcal: 146, protein: 8.8, carbs: 3.5, sugars: 3.5, fat: 10.9, fiber: 0, source: CREA, sourceRef: 'CREA 166820' },
  { name: 'mozzarella di vacca', synonyms: ['mozzarella'], category: 'latticini', kcal: 253, protein: 18.7, carbs: 0.7, sugars: 0.7, fat: 19.5, fiber: 0, source: CREA, sourceRef: 'CREA 164820' },
  { name: 'parmigiano reggiano', synonyms: ['parmigiano', 'grana'], category: 'latticini', kcal: 397, protein: 32.4, carbs: 0, sugars: 0, fat: 29.7, fiber: 0, source: CREA, sourceRef: 'CREA 166000' },

  // ---------- Alimenti proteici ----------
  { name: 'petto di pollo', synonyms: ['pollo'], category: 'proteici', state: 'crudo', kcal: 100, protein: 23.3, carbs: 0, sugars: 0, fat: 0.8, fiber: 0, source: CREA, sourceRef: 'CREA 106500' },
  { name: 'fesa di tacchino', synonyms: ['tacchino'], category: 'proteici', state: 'cruda', kcal: 107, protein: 24, carbs: 0, sugars: 0, fat: 1.2, fiber: 0, source: CREA, sourceRef: 'CREA 106850' },
  { name: 'uovo', synonyms: ['uova', 'uovo intero'], category: 'proteici', state: 'crudo', kcal: 128, protein: 12.4, carbs: 0, sugars: 0, fat: 8.7, fiber: 0, source: CREA, sourceRef: 'CREA 181100' },
  { name: 'tonno al naturale', synonyms: ['tonno'], category: 'proteici', kcal: 103, protein: 25.1, carbs: 0, sugars: 0, fat: 0.3, fiber: 0, source: CREA, sourceRef: 'CREA 123550', note: 'Sgocciolato.' },
  { name: 'salmone', category: 'proteici', state: 'crudo', kcal: 185, protein: 18.4, carbs: 1, sugars: 1, fat: 12, fiber: 0, source: CREA, sourceRef: 'CREA 122400' },
  { name: 'merluzzo', synonyms: ['nasello'], category: 'proteici', state: 'crudo', kcal: 71, protein: 17, carbs: 0, sugars: 0, fat: 0.3, fiber: 0, source: CREA, sourceRef: 'CREA 121410' },
  { name: 'manzo magro', synonyms: ['fesa di manzo', 'manzo'], category: 'proteici', state: 'crudo', kcal: 103, protein: 21.8, carbs: 0, sugars: 0, fat: 1.8, fiber: 0, source: CREA, sourceRef: 'CREA 101160', note: 'Taglio: fesa. Altri tagli vanno da ~2 a oltre 10 g di grassi: «manzo» da solo non dice le calorie.' },
  { name: 'prosciutto crudo', category: 'proteici', kcal: 269, protein: 25.9, carbs: 0.3, fat: 18.3, fiber: 0, source: CREA, sourceRef: 'CREA 110510', note: 'Prosciutto di Parma.' },
  { name: 'bresaola', category: 'proteici', kcal: 152, protein: 33.1, carbs: 0.4, fat: 2, fiber: 0, source: CREA, sourceRef: 'CREA 110020' },

  // ---------- Grassi ----------
  { name: 'olio extravergine di oliva', synonyms: ['olio evo', 'olio di oliva', 'olio'], category: 'grassi', kcal: 899, protein: 0, carbs: 0, sugars: 0, fat: 99.9, fiber: 0, source: CREA, sourceRef: 'CREA 009210' },
  { name: 'mandorle', category: 'grassi', kcal: 628, protein: 22, carbs: 4.6, sugars: 3.7, fat: 55.3, fiber: 12.7, source: CREA, sourceRef: 'CREA 008540', note: 'Secche.' },
  { name: 'noci', category: 'grassi', kcal: 702, protein: 14.3, carbs: 5.1, sugars: 3.1, fat: 68.1, fiber: 6.2, source: CREA, sourceRef: 'CREA 008570', note: 'Secche.' },
  { name: 'avocado', category: 'grassi', kcal: 238, protein: 4.4, carbs: 1.8, sugars: 1.8, fat: 23, fiber: 3.3, source: CREA, sourceRef: 'CREA 007490' },
  { name: 'burro', category: 'grassi', kcal: 758, protein: 0.8, carbs: 1.1, sugars: 1.1, fat: 83.4, fiber: 0, source: CREA, sourceRef: 'CREA 190010' },

  // ---------- Dolci e zuccheri ----------
  { name: 'zucchero', synonyms: ['saccarosio', 'zucchero bianco'], category: 'dolci', gi: 63, giSource: LPI, giReliability: 'media', kcal: 392, protein: 0, carbs: 100, sugars: 100, fat: 0, fiber: 0, source: CREA, sourceRef: 'CREA 201500', note: 'Il CREA esprime i carboidrati in monosaccaridi e dà 104,5 g su 100 g: qui normalizzato a 100, altrimenti la somma dei macro sfora.' },
  { name: 'miele', category: 'dolci', gi: 61, giMin: 58, giMax: 61, giSource: IT2008, giReliability: 'media', kcal: 304, protein: 0.6, carbs: 80.3, sugars: 80.3, fat: 0, fiber: 0, source: CREA, sourceRef: 'CREA 210010', note: 'L\'IG varia col rapporto fruttosio/glucosio, che cambia col tipo di miele.' },
  { name: 'cioccolato fondente', synonyms: ['cioccolato'], category: 'dolci', gi: 29, giSource: SYDNEY, giReliability: 'debole', kcal: 531, protein: 6.6, carbs: 49.7, sugars: 49.7, fat: 33.6, fiber: 8, source: CREA, sourceRef: 'CREA 203020', note: 'Voce generica, non specifica per il 70% di cacao — né per l\'IG né per i valori.' },

  // ---------- Verdura ----------
  { name: 'carote', synonyms: ['carota'], category: 'verdura', state: 'bollite', gi: 35, giMin: 33, giMax: 39, giSource: IT2008, giReliability: 'media', note: 'Il carico glicemico è bassissimo (2 per 80 g): l\'IG da solo, qui, dice poco.' },
  { name: 'zucca', category: 'verdura', state: 'bollita', gi: 51, giMin: 51, giMax: 75, giSource: SYDNEY, giReliability: 'debole', note: 'Il dato è della butternut; in letteratura ci sono voci di zucca fino a 75.' },
];

/** Il seed vero e proprio, riusabile da `prisma/seed.ts`. */
export async function seedValoriNutrizionali(prisma: PrismaClient): Promise<{ creati: number; aggiornati: number; saltati: number }> {
  let creati = 0;
  let aggiornati = 0;
  let saltati = 0;

  for (const r of VALORI) {
    const dati = {
      synonyms: r.synonyms ?? [],
      category: r.category,
      state: r.state ?? null,
      glycemicIndex: r.gi ?? null,
      glycemicIndexMin: r.giMin ?? null,
      glycemicIndexMax: r.giMax ?? null,
      glycemicIndexSource: r.giSource ?? null,
      glycemicIndexReliability: r.giReliability ?? null,
      kcal: r.kcal ?? null,
      protein: r.protein ?? null,
      carbs: r.carbs ?? null,
      sugars: r.sugars ?? null,
      fat: r.fat ?? null,
      fiber: r.fiber ?? null,
      source: r.source ?? null,
      sourceRef: r.sourceRef ?? null,
      note: r.note ?? null,
    };

    const esistente = (await prisma.nutrientFact.findUnique({
      where: { name: r.name },
      select: { id: true, verifiedAt: true },
    })) as { id: string; verifiedAt: Date | null } | null;

    if (!esistente) {
      await prisma.nutrientFact.create({ data: { name: r.name, ...dati } as never });
      creati += 1;
      continue;
    }
    if (esistente.verifiedAt) {
      /**
       * CONFERMATA DALLA NUTRIZIONISTA: non si tocca il valore.
       *
       * Stessa regola del seed dei parametri, e per lo stesso motivo: un deploy non deve disfare una
       * decisione clinica. Si aggiornano solo fonte e nota, che sono documentazione — se domani la
       * ricerca trova una fonte migliore, è giusto che si veda accanto al valore che lei ha scelto.
       */
      await prisma.nutrientFact.update({
        where: { id: esistente.id },
        data: { source: dati.source, sourceRef: dati.sourceRef, glycemicIndexSource: dati.glycemicIndexSource } as never,
      });
      saltati += 1;
      continue;
    }
    await prisma.nutrientFact.update({ where: { id: esistente.id }, data: dati as never });
    aggiornati += 1;
  }

  return { creati, aggiornati, saltati };
}

/** Esecuzione a mano: `npm run seed:nutrienti`. */
if (require.main === module) {
  const prisma = new PrismaClient();
  seedValoriNutrizionali(prisma)
    .then((esito) => {
      console.log(
        `\nBanca dati nutrizionale: ${esito.creati} creati, ${esito.aggiornati} aggiornati, ` +
          `${esito.saltati} lasciati intatti perché confermati dalla nutrizionista.\n`,
      );
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
