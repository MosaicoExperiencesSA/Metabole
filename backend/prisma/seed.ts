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

async function main(): Promise<void> {
  for (const param of CONFIG_PARAMS) {
    await prisma.configParam.upsert({
      where: { key: param.key },
      create: param,
      update: { description: param.description }, // non tocca value: l'admin può averlo cambiato
    });
  }
  await seedPermissions();
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
