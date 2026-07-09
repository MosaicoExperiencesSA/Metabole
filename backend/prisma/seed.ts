/**
 * Seed — parametri del motore (Appendice A della specifica).
 * Idempotente: upsert per chiave, non sovrascrive valori modificati dall'admin
 * (aggiorna solo la descrizione).
 */
import { PrismaClient, ConfigParamType } from '@prisma/client';
import { BACKOFFICE_PAGES, DEFAULT_PERMISSIONS } from '../src/permissions/pages';
import { ROLES } from '../src/common/roles';

const prisma = new PrismaClient();

type SeedParam = {
  key: string;
  value: string;
  type: ConfigParamType;
  description: string;
};

const CONFIG_PARAMS: SeedParam[] = [
  {
    key: 'sustainable_rate_max_kg_week',
    value: '0.7',
    type: 'number',
    description: 'Ritmo sostenibile massimo (kg/settimana) — oltre, obiettivo irreale',
  },
  {
    key: 'ambitious_rate_max_kg_week',
    value: '1.0',
    type: 'number',
    description: 'Ritmo ambizioso massimo (kg/settimana)',
  },
  {
    key: 'unreal_objective_action',
    value: 'warn',
    type: 'string',
    description: 'Azione su obiettivo irreale: warn | block_propose_date | require_nutritionist',
  },
  {
    key: 'min_daily_kcal',
    value: '1200',
    type: 'number',
    description: 'Calorie minime giornaliere',
  },
  {
    key: 'max_weight_change_alert_kg_week',
    value: '1.5',
    type: 'number',
    description: 'Variazione peso massima (kg/settimana) prima dell\'alert al nutrizionista',
  },
  {
    key: 'moving_average_window',
    value: '3',
    type: 'number',
    description: 'Finestra della media mobile (numero di rilevazioni)',
  },
  {
    key: 'stall_days_before_coach_alert',
    value: '6',
    type: 'number',
    description: 'Giorni di stallo prima dell\'alert alla coach',
  },
  {
    key: 'no_checkin_days_before_alert',
    value: '4',
    type: 'number',
    description: 'Giorni senza check-in prima dell\'alert alla coach',
  },
  {
    key: 'pause_deviation_trigger',
    value: '1.5',
    type: 'number',
    description: 'Scostamento (kg/cm) che attiva il mini-piano durante una pausa',
  },
  {
    key: 'menu_days_delivered',
    value: '2',
    type: 'number',
    description: 'Giorni di menu erogati per volta',
  },
  {
    key: 'menu_visible_days_before_start',
    value: '2',
    type: 'number',
    description: 'Giorni prima dell\'inizio piano in cui il menu diventa visibile',
  },
  {
    key: 'low_rating_threshold_stars',
    value: '2',
    type: 'number',
    description: 'Soglia stelle sotto cui una ricetta viene riproposta di rado',
  },
  {
    key: 'water_goal_glasses',
    value: '8',
    type: 'number',
    description: 'Obiettivo giornaliero bicchieri d\'acqua',
  },
  {
    key: 'steps_goal',
    value: '8000',
    type: 'number',
    description: 'Obiettivo giornaliero passi',
  },
];

async function seedPermissions(): Promise<void> {
  // Crea solo le combinazioni mancanti: le modifiche dell'admin non vengono mai sovrascritte.
  for (const role of ROLES) {
    for (const pageKey of BACKOFFICE_PAGES) {
      const def = DEFAULT_PERMISSIONS[role]?.[pageKey];
      await prisma.rolePagePermission.upsert({
        where: { role_pageKey: { role, pageKey } },
        create: {
          role,
          pageKey,
          canView: def?.view ?? false,
          canManage: def?.manage ?? false,
        },
        update: {}, // mai sovrascrivere scelte fatte a runtime
      });
    }
  }
}

/**
 * Dieta demo "Equilibrio Mediterraneo" (onnivora, 5 pasti, 2 giornate):
 * creata SOLO se il catalogo è vuoto, per collaudare l'erogazione del menu.
 * Le diete vere le inseriranno le nutrizioniste dal backoffice.
 */
async function seedDemoCatalog(): Promise<void> {
  const dietCount = await prisma.diet.count();
  if (dietCount > 0) return;

  const r = (
    name: string,
    mealSlot: string,
    kcal: number,
    ingredients: { name: string; qty?: number; unit?: string }[],
    tags: string[] = [],
  ) => ({ name, regime: 'omnivore' as const, mealSlot: mealSlot as never, kcal, ingredients: ingredients as never, tags });

  const recipes = await Promise.all(
    [
      r('Yogurt greco con miele e noci', 'breakfast', 320, [
        { name: 'Yogurt greco', qty: 170, unit: 'g' },
        { name: 'Miele', qty: 10, unit: 'g' },
        { name: 'Noci', qty: 20, unit: 'g' },
      ]),
      r('Porridge di avena e frutti rossi', 'breakfast', 340, [
        { name: 'Fiocchi di avena', qty: 50, unit: 'g' },
        { name: 'Latte parzialmente scremato', qty: 200, unit: 'ml' },
        { name: 'Frutti rossi', qty: 80, unit: 'g' },
      ]),
      r('Frutta fresca e mandorle', 'morning_snack', 150, [
        { name: 'Mela', qty: 1, unit: 'pz' },
        { name: 'Mandorle', qty: 15, unit: 'g' },
      ]),
      r('Pane integrale e ricotta', 'morning_snack', 160, [
        { name: 'Pane integrale', qty: 40, unit: 'g' },
        { name: 'Ricotta', qty: 50, unit: 'g' },
      ]),
      r('Insalata di farro con verdure e feta', 'lunch', 520, [
        { name: 'Farro', qty: 80, unit: 'g' },
        { name: 'Zucchine', qty: 100, unit: 'g' },
        { name: 'Pomodorini', qty: 100, unit: 'g' },
        { name: 'Feta', qty: 50, unit: 'g' },
        { name: 'Olio extravergine', qty: 10, unit: 'g' },
      ], ['da portare']),
      r('Petto di pollo alla griglia con quinoa', 'lunch', 540, [
        { name: 'Petto di pollo', qty: 150, unit: 'g' },
        { name: 'Quinoa', qty: 70, unit: 'g' },
        { name: 'Spinaci', qty: 100, unit: 'g' },
        { name: 'Olio extravergine', qty: 10, unit: 'g' },
      ]),
      r('Yogurt e cioccolato fondente', 'afternoon_snack', 140, [
        { name: 'Yogurt bianco', qty: 125, unit: 'g' },
        { name: 'Cioccolato fondente 70%', qty: 10, unit: 'g' },
      ]),
      r('Hummus con carote', 'afternoon_snack', 150, [
        { name: 'Hummus', qty: 50, unit: 'g' },
        { name: 'Carote', qty: 150, unit: 'g' },
      ]),
      r('Orata al forno con patate e broccoli', 'dinner', 480, [
        { name: 'Orata', qty: 200, unit: 'g' },
        { name: 'Patate', qty: 150, unit: 'g' },
        { name: 'Broccoli', qty: 150, unit: 'g' },
        { name: 'Olio extravergine', qty: 10, unit: 'g' },
      ]),
      r('Frittata di verdure con insalata', 'dinner', 450, [
        { name: 'Uova', qty: 2, unit: 'pz' },
        { name: 'Zucchine', qty: 100, unit: 'g' },
        { name: 'Insalata mista', qty: 80, unit: 'g' },
        { name: 'Pane integrale', qty: 40, unit: 'g' },
      ]),
    ].map((data) => prisma.recipe.create({ data })),
  );
  const byName = new Map(recipes.map((rec) => [rec.name, rec.id]));
  const m = (slot: string, name: string) => ({ slot, recipeId: byName.get(name) });

  await prisma.diet.create({
    data: {
      name: 'Equilibrio Mediterraneo',
      regime: 'omnivore',
      style: 'mediterranean',
      mealsPerDay: 5,
      levels: [{ level: 1, kcal: 1550 }] as never,
      status: 'approved',
      approvedAt: new Date(),
      dayTemplates: {
        create: [
          {
            level: 1,
            dayIndex: 1,
            meals: [
              m('breakfast', 'Yogurt greco con miele e noci'),
              m('morning_snack', 'Frutta fresca e mandorle'),
              m('lunch', 'Insalata di farro con verdure e feta'),
              m('afternoon_snack', 'Yogurt e cioccolato fondente'),
              m('dinner', 'Orata al forno con patate e broccoli'),
            ] as never,
          },
          {
            level: 1,
            dayIndex: 2,
            meals: [
              m('breakfast', 'Porridge di avena e frutti rossi'),
              m('morning_snack', 'Pane integrale e ricotta'),
              m('lunch', 'Petto di pollo alla griglia con quinoa'),
              m('afternoon_snack', 'Hummus con carote'),
              m('dinner', 'Frittata di verdure con insalata'),
            ] as never,
          },
        ],
      },
    },
  });
  console.log('Seed: dieta demo "Equilibrio Mediterraneo" creata (catalogo era vuoto).');
}

async function main(): Promise<void> {
  for (const param of CONFIG_PARAMS) {
    await prisma.configParam.upsert({
      where: { key: param.key },
      create: param,
      update: { description: param.description }, // non tocca value: l'admin può averlo cambiato
    });
  }
  await seedPermissions();
  await seedDemoCatalog();
  const count = await prisma.configParam.count();
  const permCount = await prisma.rolePagePermission.count();
  console.log(
    `Seed completato: ${CONFIG_PARAMS.length} parametri processati (${count} in config_param), ${permCount} permessi ruolo×pagina.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
