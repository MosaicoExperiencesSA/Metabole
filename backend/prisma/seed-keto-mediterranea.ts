/**
 * Keto-Mediterranea — inserimento nel catalogo (richiesta Simone, 6/8/2026, voce #2).
 *
 * COSA FA
 *   Crea la dieta `keto_mediterranean` con 30 ricette e 7 giornate di rotazione su due livelli,
 *   costruite SOLO con ingredienti reperibili in qualunque supermercato italiano.
 *
 * PERCHÉ ESISTE
 *   Il feedback del 5/8 diceva che i menu Keto avevano «ingredienti molto complessi». Non era
 *   questione di tempo di preparazione: erano farine speciali, dolcificanti particolari e prodotti
 *   "keto" confezionati, che si comprano solo in negozi specializzati o online. Su un percorso che
 *   vive di aderenza quotidiana, ogni ostacolo di quel tipo è un motivo per mollare.
 *
 * LA LOGICA NUTRIZIONALE (dalla ricerca, non inventata)
 *   La combinazione chetogenica + mediterranea è studiata: esiste uno studio italiano su pazienti
 *   sovrappeso con prediabete e diabete di tipo 2, e ci sono lavori su chetogeniche basate
 *   sull'olio d'oliva. Harvard (The Nutrition Source) sottolinea che, a parità di schema, è la
 *   QUALITÀ DEI GRASSI a cambiare gli esiti: olio d'oliva, pesce azzurro, frutta secca e avocado
 *   invece di burro e insaccati. Da qui i tre criteri usati per ogni piatto:
 *     1. grasso principale = olio extravergine d'oliva, olive, frutta secca, pesce grasso;
 *     2. proteine soprattutto da pesce e uova, carni rosse e salumi rari;
 *     3. verdure a basso contenuto di carboidrati in abbondanza, per le fibre — che sono il punto
 *        debole noto delle chetogeniche.
 *   Ripartizione di riferimento: ~70-75% grassi, ~20-25% proteine, ~5% carboidrati.
 *
 * ⚠️ NASCE COME BOZZA, E NON È UN CASO
 *   `status: 'draft'` e `clientVisible: false`. Il motore serve menu SOLO da diete approvate,
 *   quindi finché la nutrizionista non la approva dal backoffice **nessuna cliente la vede né la
 *   riceve**. Le kcal e i macro qui sotto sono STIME coerenti fra loro, utili a far girare il
 *   motore, ma vanno verificate: la regola ferrea n.1 del progetto dice che i menu li valida il
 *   nutrizionista, e questa bozza serve a farle risparmiare la battitura, non il giudizio.
 *   Per lo stesso motivo `allergensReviewed` resta false: gli allergeni indicati sono quelli ovvi,
 *   non una revisione clinica.
 *
 * USO
 *   npx ts-node prisma/seed-keto-mediterranea.ts
 *   Idempotente: se la dieta esiste già non fa nulla (non sovrascrive il lavoro della nutrizionista).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STYLE = 'keto_mediterranean';

type R = {
  name: string;
  slot: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';
  kcal: number;
  /** grammi: [proteine, carboidrati, grassi] */
  macros: [number, number, number];
  ingredients: string[];
  seasons?: string[];
  allergens?: string[];
  difficulty?: 'semplice' | 'media';
};

/**
 * 30 piatti: 6 per slot. Tutti con ingredienti da supermercato, niente prodotti keto confezionati.
 * Le stagioni sono compilate dove il piatto è chiaramente estivo o invernale; vuoto = tutto l'anno.
 */
const RICETTE: R[] = [
  // ---------- COLAZIONE ----------
  { name: 'Uova strapazzate all\'olio con spinaci', slot: 'breakfast', kcal: 320, macros: [20, 4, 24], ingredients: ['uova', 'spinaci', 'olio extravergine d\'oliva', 'sale', 'pepe'], allergens: ['uova'], difficulty: 'semplice' },
  { name: 'Frittatina di zucchine e menta', slot: 'breakfast', kcal: 310, macros: [19, 5, 23], ingredients: ['uova', 'zucchine', 'menta', 'olio extravergine d\'oliva', 'parmigiano'], allergens: ['uova', 'latte'], seasons: ['spring', 'summer'], difficulty: 'semplice' },
  { name: 'Yogurt greco intero con noci e semi di zucca', slot: 'breakfast', kcal: 330, macros: [16, 8, 26], ingredients: ['yogurt greco intero', 'noci', 'semi di zucca'], allergens: ['latte', 'frutta a guscio'], difficulty: 'semplice' },
  { name: 'Avocado e uovo sodo con olio e limone', slot: 'breakfast', kcal: 340, macros: [14, 6, 29], ingredients: ['avocado', 'uova', 'olio extravergine d\'oliva', 'limone', 'sale'], allergens: ['uova'], difficulty: 'semplice' },
  { name: 'Ricotta con mandorle e cannella', slot: 'breakfast', kcal: 300, macros: [18, 7, 22], ingredients: ['ricotta', 'mandorle', 'cannella'], allergens: ['latte', 'frutta a guscio'], difficulty: 'semplice' },
  { name: 'Uova al tegamino con pomodorini e origano', slot: 'breakfast', kcal: 315, macros: [19, 6, 23], ingredients: ['uova', 'pomodorini', 'origano', 'olio extravergine d\'oliva'], allergens: ['uova'], seasons: ['summer'], difficulty: 'semplice' },

  // ---------- SPUNTINO DEL MATTINO ----------
  { name: 'Mandorle al naturale', slot: 'morning_snack', kcal: 160, macros: [6, 3, 14], ingredients: ['mandorle'], allergens: ['frutta a guscio'], difficulty: 'semplice' },
  { name: 'Olive taggiasche e sedano', slot: 'morning_snack', kcal: 140, macros: [2, 3, 13], ingredients: ['olive taggiasche', 'sedano'], difficulty: 'semplice' },
  { name: 'Noci e scaglie di grana', slot: 'morning_snack', kcal: 175, macros: [8, 2, 15], ingredients: ['noci', 'grana padano'], allergens: ['latte', 'frutta a guscio'], difficulty: 'semplice' },
  { name: 'Cetrioli con olio e sale', slot: 'morning_snack', kcal: 120, macros: [2, 4, 11], ingredients: ['cetrioli', 'olio extravergine d\'oliva', 'sale'], seasons: ['summer'], difficulty: 'semplice' },
  { name: 'Yogurt greco al naturale', slot: 'morning_snack', kcal: 150, macros: [12, 5, 10], ingredients: ['yogurt greco intero'], allergens: ['latte'], difficulty: 'semplice' },
  { name: 'Nocciole e qualche lampone', slot: 'morning_snack', kcal: 165, macros: [5, 6, 14], ingredients: ['nocciole', 'lamponi'], allergens: ['frutta a guscio'], seasons: ['summer', 'autumn'], difficulty: 'semplice' },

  // ---------- PRANZO ----------
  { name: 'Insalata di tonno, olive e uova', slot: 'lunch', kcal: 520, macros: [38, 8, 37], ingredients: ['tonno al naturale', 'uova', 'olive', 'insalata', 'olio extravergine d\'oliva', 'aceto'], allergens: ['pesce', 'uova'], difficulty: 'semplice' },
  { name: 'Sgombro al forno con cicoria ripassata', slot: 'lunch', kcal: 540, macros: [36, 7, 40], ingredients: ['sgombro', 'cicoria', 'aglio', 'olio extravergine d\'oliva', 'peperoncino'], allergens: ['pesce'], difficulty: 'media' },
  { name: 'Pollo al limone con zucchine trifolate', slot: 'lunch', kcal: 505, macros: [42, 8, 33], ingredients: ['petto di pollo', 'limone', 'zucchine', 'prezzemolo', 'olio extravergine d\'oliva'], seasons: ['spring', 'summer'], difficulty: 'media' },
  { name: 'Insalata caprese con avocado', slot: 'lunch', kcal: 530, macros: [26, 9, 43], ingredients: ['mozzarella', 'pomodori', 'avocado', 'basilico', 'olio extravergine d\'oliva'], allergens: ['latte'], seasons: ['summer'], difficulty: 'semplice' },
  { name: 'Frittata di carciofi', slot: 'lunch', kcal: 495, macros: [30, 9, 36], ingredients: ['uova', 'carciofi', 'parmigiano', 'olio extravergine d\'oliva', 'prezzemolo'], allergens: ['uova', 'latte'], seasons: ['winter', 'spring'], difficulty: 'media' },
  { name: 'Alici marinate con finocchi e arancia', slot: 'lunch', kcal: 480, macros: [34, 10, 33], ingredients: ['alici', 'finocchi', 'arancia', 'olio extravergine d\'oliva', 'aceto'], allergens: ['pesce'], seasons: ['winter'], difficulty: 'media' },

  // ---------- SPUNTINO DEL POMERIGGIO ----------
  { name: 'Semi di girasole e zucca tostati', slot: 'afternoon_snack', kcal: 155, macros: [6, 4, 13], ingredients: ['semi di girasole', 'semi di zucca'], difficulty: 'semplice' },
  { name: 'Bresaola e rucola con olio', slot: 'afternoon_snack', kcal: 170, macros: [16, 2, 11], ingredients: ['bresaola', 'rucola', 'olio extravergine d\'oliva', 'limone'], difficulty: 'semplice' },
  { name: 'Pecorino a scaglie con noci', slot: 'afternoon_snack', kcal: 180, macros: [10, 2, 15], ingredients: ['pecorino', 'noci'], allergens: ['latte', 'frutta a guscio'], difficulty: 'semplice' },
  { name: 'Finocchi in pinzimonio', slot: 'afternoon_snack', kcal: 125, macros: [2, 5, 11], ingredients: ['finocchi', 'olio extravergine d\'oliva', 'sale'], seasons: ['autumn', 'winter'], difficulty: 'semplice' },
  { name: 'Mirtilli e mandorle', slot: 'afternoon_snack', kcal: 160, macros: [5, 8, 12], ingredients: ['mirtilli', 'mandorle'], allergens: ['frutta a guscio'], seasons: ['summer'], difficulty: 'semplice' },
  { name: 'Uovo sodo con sale e pepe', slot: 'afternoon_snack', kcal: 140, macros: [12, 1, 10], ingredients: ['uova', 'sale', 'pepe', 'olio extravergine d\'oliva'], allergens: ['uova'], difficulty: 'semplice' },

  // ---------- CENA ----------
  { name: 'Orata al forno con verdure di stagione', slot: 'dinner', kcal: 470, macros: [40, 8, 31], ingredients: ['orata', 'zucchine', 'peperoni', 'olio extravergine d\'oliva', 'rosmarino'], allergens: ['pesce'], seasons: ['spring', 'summer'], difficulty: 'media' },
  { name: 'Salmone alla piastra con broccoli', slot: 'dinner', kcal: 490, macros: [38, 7, 34], ingredients: ['salmone', 'broccoli', 'olio extravergine d\'oliva', 'limone'], allergens: ['pesce'], difficulty: 'semplice' },
  { name: 'Seppie e piselli in umido con cavolo nero', slot: 'dinner', kcal: 455, macros: [36, 10, 29], ingredients: ['seppie', 'cavolo nero', 'aglio', 'prezzemolo', 'olio extravergine d\'oliva'], allergens: ['molluschi'], seasons: ['autumn', 'winter'], difficulty: 'media' },
  { name: 'Polpette di manzo al sugo di pomodoro con spinaci', slot: 'dinner', kcal: 500, macros: [39, 9, 33], ingredients: ['macinato di manzo', 'uova', 'parmigiano', 'passata di pomodoro', 'spinaci', 'olio extravergine d\'oliva'], allergens: ['uova', 'latte'], difficulty: 'media' },
  { name: 'Cozze in bianco con verza saltata', slot: 'dinner', kcal: 440, macros: [33, 9, 29], ingredients: ['cozze', 'verza', 'aglio', 'prezzemolo', 'olio extravergine d\'oliva'], allergens: ['molluschi'], seasons: ['autumn', 'winter'], difficulty: 'media' },
  { name: 'Merluzzo con olive e capperi, contorno di bietole', slot: 'dinner', kcal: 460, macros: [38, 8, 30], ingredients: ['merluzzo', 'olive', 'capperi', 'bietole', 'olio extravergine d\'oliva'], allergens: ['pesce'], difficulty: 'semplice' },
];

/** Rotazione di 7 giornate: un piatto per slot, ruotando l'elenco per non ripetere. */
function giornate(idBySlotIndex: Record<string, string[]>): { dayIndex: number; meals: { slot: string; recipeId: string }[] }[] {
  const slots = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
  const out: { dayIndex: number; meals: { slot: string; recipeId: string }[] }[] = [];
  for (let d = 0; d < 7; d++) {
    const meals = slots.map((slot) => {
      const ids = idBySlotIndex[slot];
      // Sfasamento diverso per slot: evita che le stesse combinazioni tornino insieme.
      const i = (d + slots.indexOf(slot)) % ids.length;
      return { slot, recipeId: ids[i] };
    });
    out.push({ dayIndex: d + 1, meals });
  }
  return out;
}

async function main(): Promise<void> {
  const esistente = await prisma.diet.findFirst({ where: { style: STYLE }, select: { id: true, status: true } });
  if (esistente) {
    console.log(`La dieta "${STYLE}" esiste già (stato: ${esistente.status}). Non tocco nulla.`);
    return;
  }

  console.log('Creo le ricette…');
  const idBySlot: Record<string, string[]> = {};
  for (const r of RICETTE) {
    const [protein_g, carbs_g, fat_g] = r.macros;
    // Idempotenza sulle ricette: se una con lo stesso nome c'è già, la riuso.
    const gia = await prisma.recipe.findFirst({ where: { name: r.name }, select: { id: true } });
    const rec = gia ?? (await prisma.recipe.create({
      data: {
        name: r.name,
        regime: 'omnivore',
        mealSlot: r.slot as never,
        kcal: r.kcal,
        ingredients: r.ingredients.map((name) => ({ name })) as never,
        macros: { protein_g, carbs_g, fat_g } as never,
        tags: ['keto', 'mediterranea'],
        difficulty: r.difficulty ?? 'semplice',
        seasons: r.seasons ?? [],
        allergens: r.allergens ?? [],
        // NON revisionati: gli allergeni qui sono quelli ovvi, non una revisione clinica.
        allergensReviewed: false,
        active: true,
      } as never,
    }));
    (idBySlot[r.slot] ??= []).push(rec.id);
  }

  const giorni = giornate(idBySlot);
  console.log(`Creo la dieta con ${RICETTE.length} ricette e ${giorni.length} giornate…`);

  await prisma.diet.create({
    data: {
      name: 'Keto-Mediterranea',
      regime: 'omnivore',
      style: STYLE,
      mealsPerDay: 5,
      fasting: false,
      levels: [
        { level: 1, kcal: 1450 },
        { level: 2, kcal: 1700 },
      ] as never,
      // ⚠️ BOZZA e non visibile: nessuna cliente la riceve finché la nutrizionista non approva.
      status: 'draft',
      clientVisible: false,
      recommended: false,
      objective: 'dimagrimento',
      clientName: 'Keto-Mediterranea',
      clientDescription:
        'La chetogenica fatta con la nostra dispensa: pesce, uova, verdure, olio d\'oliva e frutta secca. Tutti ingredienti che trovi al supermercato sotto casa, senza farine speciali né prodotti confezionati.',
      highlights: [
        'Ingredienti comuni: niente negozi specializzati',
        'I grassi vengono da olio d\'oliva, pesce e frutta secca',
        'Verdure in abbondanza a ogni pasto',
        'Percorso seguito dalla nutrizionista',
      ] as never,
      dayTemplates: {
        create: [
          ...giorni.map((g) => ({ level: 1, dayIndex: g.dayIndex, meals: g.meals as never })),
          ...giorni.map((g) => ({ level: 2, dayIndex: g.dayIndex, meals: g.meals as never })),
        ],
      },
    } as never,
  });

  console.log('');
  console.log('✅ Keto-Mediterranea creata come BOZZA.');
  console.log('   Nessuna cliente la vede: il motore serve menu solo da diete approvate.');
  console.log('   Per pubblicarla: backoffice → Creazione e validazione → rivedere i piatti,');
  console.log('   correggere kcal e macro dove serve, poi Approva + "visibile al cliente".');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
