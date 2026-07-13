/**
 * Seed — parametri del motore (Appendice A della specifica).
 * Idempotente: upsert per chiave, non sovrascrive valori modificati dall'admin
 * (aggiorna solo la descrizione).
 */
import * as argon2 from 'argon2';
import { PrismaClient, ConfigParamType } from '@prisma/client';
import { BACKOFFICE_PAGES, DEFAULT_PERMISSIONS } from '../src/permissions/pages';
import { ROLES } from '../src/common/roles';
import { DEFAULT_PDF_TEMPLATES } from '../src/pdf/pdf.defaults';

const prisma = new PrismaClient();

// Estremi reali del conto (Wise, Mosaico Experiences SA). Non sono un segreto:
// vengono inviati alla cliente via email a ogni acquisto con bonifico.
// Restano modificabili dall'admin dal backoffice (config_param).
const BANK_TRANSFER_DETAILS = [
  'Intestatario: MOSAICO EXPERIENCES SA',
  'IBAN: BE67 9051 6266 7387',
  'Swift/BIC: TRWIBEB1XXX',
  'Banca: Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium',
].join('\n');

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
  {
    key: 'low_energy_chronic_threshold',
    value: '2.5',
    type: 'number',
    description: 'Media energia (1-5) sotto cui scatta il guardrail "energia bassa cronica"',
  },
  {
    key: 'agent_pre_event_days',
    value: '3',
    type: 'number',
    description: 'Giorni prima di un evento in cui l\'agente passa a stato "pre-evento" (più proteico)',
  },
  {
    key: 'agent_plateau_cycles',
    value: '2',
    type: 'number',
    description: 'Cicli consecutivi senza calo peso dopo cui l\'agente passa a stato "plateau"',
  },
  {
    key: 'menu_state_boost',
    value: '1.8',
    type: 'number',
    description: 'Fattore con cui l\'agente potenzia gradimento (conforto) o efficacia (plateau) nella selezione',
  },
  {
    key: 'menu_pre_event_protein_bonus',
    value: '0.6',
    type: 'number',
    description: 'Bonus alle ricette proteiche nello stato pre-evento (selezione menu)',
  },
  {
    key: 'menu_select_w_eff',
    value: '1',
    type: 'number',
    description: 'Peso dell\'efficacia appresa (MenuWeight) nella selezione delle ricette',
  },
  {
    key: 'menu_select_w_grad',
    value: '1',
    type: 'number',
    description: 'Peso del gradimento (stelle) nella selezione delle ricette',
  },
  {
    key: 'menu_kcal_balance_tolerance_pct',
    value: '15',
    type: 'number',
    description: 'Tolleranza kcal (%) entro cui una ricetta alternativa può sostituire quella del template (bilanciamento)',
  },
  {
    key: 'cycle_weight_delta_kg',
    value: '0.2',
    type: 'number',
    description: 'Soglia (kg) sotto/sopra cui l\'esito peso del ciclo è "stabile"',
  },
  {
    key: 'cycle_cm_delta',
    value: '0.5',
    type: 'number',
    description: 'Soglia (cm, vita+fianchi) sotto/sopra cui l\'esito cm del ciclo è "stabile"',
  },
  {
    key: 'expiring_plan_days',
    value: '14',
    type: 'number',
    description: 'Giorni entro cui un piano è considerato "in scadenza" nella dashboard coach',
  },
  // --- Soglie Alert engine (coda coach) ---
  {
    key: 'alert_inactive_days',
    value: '3',
    type: 'number',
    description: 'Giorni senza attività nell\'app prima dell\'alert coach "inattiva"',
  },
  {
    key: 'alert_water_low_days',
    value: '3',
    type: 'number',
    description: 'Giorni consecutivi con acqua sotto obiettivo prima dell\'alert coach',
  },
  {
    key: 'alert_low_ratings_count',
    value: '3',
    type: 'number',
    description: 'Numero di valutazioni basse recenti che attivano l\'alert coach',
  },
  {
    key: 'alert_event_incoming_days',
    value: '3',
    type: 'number',
    description: 'Giorni di anticipo per l\'alert coach "evento in arrivo"',
  },
  {
    key: 'alert_weight_gain_days',
    value: '7',
    type: 'number',
    description: 'Finestra (giorni) per rilevare aumento di peso e alzare l\'alert coach',
  },
  {
    key: 'ai_composer_enabled',
    value: 'false',
    type: 'string',
    description: 'Layer AI di supporto: se "true" (e AI_API_KEY configurata su Render) i testi delle notifiche vengono riformulati da Claude; il tono resta deciso dal motore',
  },
  {
    key: 'ai_assistant_enabled',
    value: 'false',
    type: 'string',
    description: 'Assistente AI in chat: se "true" (e AI_API_KEY configurata su Render) l\'assistente risponde con Claude ai messaggi generici; i temi sensibili/sanitari restano instradati al nutrizionista',
  },
  {
    key: 'bank_transfer_details',
    value: BANK_TRANSFER_DETAILS,
    type: 'string',
    description: 'Estremi bancari inviati via email per i pagamenti con bonifico (modificabili dal backoffice)',
  },
  {
    key: 'payment_method_card_enabled',
    value: 'true',
    type: 'boolean',
    description: 'Abilita il pagamento con carta (Stripe) nel checkout dell\'app',
  },
  {
    key: 'payment_method_bank_enabled',
    value: 'true',
    type: 'boolean',
    description: 'Abilita il pagamento con bonifico nel checkout dell\'app',
  },
  {
    key: 'commission_coach_percent',
    value: '10',
    type: 'number',
    description: 'Provvigione della coach sugli acquisti approvati (%)',
  },
  {
    key: 'commission_manager_coach_percent',
    value: '3',
    type: 'number',
    description: 'Provvigione della manager coach (responsabile della coach assegnata) sugli acquisti approvati (%)',
  },
  {
    key: 'commission_nutritionist_percent',
    value: '15',
    type: 'number',
    description: 'Provvigione della nutrizionista sugli acquisti approvati (%)',
  },
  {
    key: 'commission_head_nutritionist_percent',
    value: '5',
    type: 'number',
    description: 'Provvigione del capo nutrizionista (responsabile della nutrizionista assegnata) sugli acquisti approvati (%)',
  },
  {
    key: 'visit_compensation_amount_cents',
    value: '4000',
    type: 'number',
    description: 'Compenso per visita completata (centesimi)',
  },
  {
    key: 'referral_reward_days',
    value: '30',
    type: 'number',
    description: 'Giorni di abbonamento regalati a chi invita ("porta un\'amica") quando l\'invitata attiva il primo abbonamento (0 = ricompensa disattivata)',
  },
];

// Modelli email predefiniti (modificabili dall'admin). {{var}} = segnaposto.
const EMAIL_TEMPLATES = [
  { key: 'email_verification', name: 'Conferma email (registrazione)', subject: 'Metabole — conferma la tua email', bodyHtml: '<p>Benvenuta/o in Metabole!</p><p>Per confermare il tuo indirizzo clicca qui: <a href="{{link}}">conferma email</a></p><p>Oppure usa questo codice nell\'app: <code>{{token}}</code></p><p>Il link scade tra 48 ore. Se non ti sei registrata/o tu, ignora questa email.</p>' },
  { key: 'password_reset', name: 'Reset password', subject: 'Metabole — reimposta la password', bodyHtml: '<p>Hai chiesto di reimpostare la password del tuo account Metabole.</p><p>Clicca qui per procedere: <a href="{{link}}">reimposta password</a></p><p>Se non sei stata/o tu, ignora questa email.</p>' },
  { key: 'bank_transfer', name: 'Estremi per il bonifico', subject: 'Metabole — estremi per il bonifico ({{description}})', bodyHtml: '<p>Per completare l\'acquisto <b>{{description}}</b> (€ {{amount}}) esegui un bonifico con questi estremi:</p><pre>{{bankDetails}}</pre><p>Causale: <b>{{reference}}</b></p><p>Poi carica la contabile dall\'app per l\'approvazione.</p>' },
  { key: 'payment_receipt', name: 'Ricevuta di pagamento', subject: 'Metabole — ricevuta di pagamento', bodyHtml: '<p>Grazie! Abbiamo registrato il tuo pagamento.</p><p><b>{{description}}</b><br/>Importo: € {{amount}}<br/>Data: {{date}}</p><p>Trovi la ricevuta in allegato a questa email.</p>' },
  { key: 'notification', name: 'Notifica generica', subject: 'Metabole — {{title}}', bodyHtml: '<p><b>{{title}}</b></p><p>{{body}}</p>' },
  { key: 'client_assigned_nutritionist', name: 'Cliente assegnata (al nutrizionista)', subject: 'Metabole — nuova cliente assegnata', bodyHtml: '<p>Ciao,</p><p>ti è stata assegnata una nuova cliente: <b>{{clientName}}</b>.</p><p>La trovi nel tuo elenco clienti su Metabole.</p>' },
  { key: 'monthly_report', name: 'Report mensile (al cliente)', subject: 'Metabole — il tuo report di {{period}}', bodyHtml: '<p>Ciao {{name}},</p><p>ecco il tuo report di <b>{{period}}</b>.</p><ul><li>Perso questo mese: <b>{{lostThisMonth}}</b></li><li>Perso dall\'inizio: <b>{{lostTotal}}</b></li><li>Peso attuale: {{currentWeight}}</li><li>Obiettivo: {{target}}</li><li>Check-in registrati: {{checkins}}</li></ul><p>{{trend}}</p><p>Trovi il report completo in allegato.</p>' },
];

async function seedEmailTemplates(): Promise<void> {
  for (const t of EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      create: t,
      update: { name: t.name }, // non tocca subject/body: l'admin può averli modificati
    });
  }
}

async function seedPdfTemplates(): Promise<void> {
  for (const t of DEFAULT_PDF_TEMPLATES) {
    await prisma.pdfTemplate.upsert({
      where: { key: t.key },
      create: { key: t.key, name: t.name, html: t.html },
      update: { name: t.name }, // non tocca html: l'admin può averlo modificato
    });
  }
}

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

/**
 * Le 5 regole della tabella decisionale della specifica (sez. 7.2),
 * seminate come protocolli APPROVED (sono la libreria di partenza validata).
 * Create solo se non esistono protocolli: le nutrizioniste le evolveranno.
 */
async function seedProtocols(): Promise<void> {
  const count = await prisma.protocol.count();
  if (count > 0) return;

  const protocols = [
    {
      name: 'Calo troppo rapido con energia bassa',
      type: 'threshold',
      appliesTo: 'senza condizioni cliniche',
      definition: {
        priority: 10,
        conditions: [
          { field: 'rapidLoss', op: 'is_true' },
          { field: 'energyAvg', op: 'lte', value: 3 },
        ],
        action: {
          menu: 'increase_calories',
          tone: 'gentle',
          timing: 'morning',
          levelDelta: -1,
          flagForReview: true,
          note: 'Alza le calorie e rallenta: verifica del nutrizionista.',
        },
      },
    },
    {
      name: 'Stallo con umore basso e vita intensa',
      type: 'menu_correction',
      appliesTo: 'senza condizioni cliniche',
      definition: {
        priority: 20,
        conditions: [
          { field: 'stallDays', op: 'gte', value: 6 },
          { field: 'moodAvg', op: 'lte', value: 2.5 },
          { field: 'busyLifestyle', op: 'is_true' },
        ],
        action: {
          menu: 'practical',
          tone: 'supportive',
          timing: 'evening',
          note: 'Non stringere: menu pratici, messaggio di sostegno, correzione rimandata.',
        },
      },
    },
    {
      name: 'Stallo con serenità e tempo per cucinare',
      type: 'menu_correction',
      appliesTo: 'senza condizioni cliniche',
      definition: {
        priority: 30,
        conditions: [
          { field: 'stallDays', op: 'gte', value: 6 },
          { field: 'moodAvg', op: 'gte', value: 3.5 },
          { field: 'cookingTime', op: 'in', value: ['some', 'love_cooking'] },
        ],
        action: {
          menu: 'correction',
          tone: 'encouraging',
          timing: 'morning',
          levelDelta: 1,
          note: 'Variante di correzione: più proteica / minor carico.',
        },
      },
    },
    {
      name: 'In calo con evento in agenda',
      type: 'library',
      appliesTo: 'senza condizioni cliniche',
      definition: {
        priority: 40,
        conditions: [
          { field: 'direction', op: 'eq', value: 'down' },
          { field: 'upcomingEvent', op: 'is_true' },
        ],
        action: {
          menu: 'lighten_before_event',
          tone: 'neutral',
          timing: 'morning',
          levelDelta: -1,
          note: 'Alleggerire prima, libertà il giorno dell\'evento, rientro dopo.',
        },
      },
    },
    {
      name: 'Aderente, umore alto, obiettivo vicino',
      type: 'library',
      appliesTo: 'senza condizioni cliniche',
      definition: {
        priority: 50,
        conditions: [
          { field: 'adherenceLast7', op: 'gte', value: 0.8 },
          { field: 'moodAvg', op: 'gte', value: 4 },
          { field: 'progressPercent', op: 'gte', value: 75 },
        ],
        action: {
          menu: 'celebrate_step',
          tone: 'celebratory',
          timing: 'morning',
          note: 'Celebra il traguardo vicino e proponi lo step successivo.',
        },
      },
    },
  ];
  for (const p of protocols) {
    await prisma.protocol.create({
      data: {
        name: p.name,
        type: p.type,
        appliesTo: p.appliesTo,
        definition: p.definition as never,
        status: 'approved',
        validatedAt: new Date(),
      },
    });
  }
  console.log(`Seed: ${protocols.length} protocolli della specifica creati (approved).`);
}

/** Piani e prodotti demo: SOLO se le tabelle sono vuote (prezzi da rivedere in admin). */
async function seedCommerce(): Promise<void> {
  if ((await prisma.plan.count()) === 0) {
    await prisma.plan.createMany({
      data: [
        { name: 'Percorso Metabole 3 mesi', priceCents: 29700, period: '3m', features: ['Menu adattivo', 'Coach dedicata', 'Prima visita inclusa'] },
        { name: 'Percorso Metabole 6 mesi', priceCents: 49700, period: '6m', features: ['Menu adattivo', 'Coach dedicata', 'Prima visita inclusa', 'Controlli in televisita'] },
        { name: 'Percorso Metabole 12 mesi', priceCents: 79700, period: '12m', features: ['Menu adattivo', 'Coach dedicata', 'Prima visita inclusa', 'Controlli in televisita', 'Priorità in chat'] },
      ],
    });
    console.log('Seed: 3 piani demo creati (prezzi da confermare in admin).');
  }
  if ((await prisma.product.count()) === 0) {
    await prisma.product.createMany({
      data: [
        { name: 'Integratore multivitaminico Metabole', priceCents: 2490, description: 'Demo: sostituire col catalogo reale' },
        { name: 'Omega 3 Metabole', priceCents: 1990, description: 'Demo: sostituire col catalogo reale' },
      ],
    });
    console.log('Seed: 2 prodotti demo creati.');
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

  // Migrazione una-tantum: se gli estremi del bonifico sono ancora il segnaposto
  // (mai configurati dall'admin) li imposta ai dati reali. Non tocca un valore
  // già personalizzato dal backoffice.
  const bank = await prisma.configParam.findUnique({ where: { key: 'bank_transfer_details' } });
  if (bank && bank.value.includes('DA CONFIGURARE')) {
    await prisma.configParam.update({
      where: { key: 'bank_transfer_details' },
      data: { value: BANK_TRANSFER_DETAILS },
    });
    console.log('Seed: estremi bonifico impostati sui dati reali (erano segnaposto).');
  }

  await ensureAdminFromEnv();
  await seedPipelineStages();
  await seedPermissions();
  await seedDemoCatalog();
  await seedProtocols();
  await seedCommerce();
  await backfillPaidClientsIntoCrm();
  await backfillCoachRefCodes();
  await seedEmailTemplates();
  await seedPdfTemplates();
  const count = await prisma.configParam.count();
  const permCount = await prisma.rolePagePermission.count();
  console.log(
    `Seed completato: ${CONFIG_PARAMS.length} parametri processati (${count} in config_param), ${permCount} permessi ruolo×pagina.`,
  );
}

/**
 * Backfill: clienti con un pagamento approvato ma senza record CRM vengono
 * inseriti nel CRM (stage 'paid'), così compaiono nella tabella clienti/lead
 * come chi arriva dalla pipeline. Idempotente.
 */
async function backfillPaidClientsIntoCrm(): Promise<void> {
  const paid = await prisma.payment.findMany({
    where: { status: 'approved' },
    select: { clientId: true, amountCents: true, approvedAt: true, createdAt: true },
    orderBy: { approvedAt: 'desc' },
  });
  const seen = new Set<string>();
  let created = 0;
  for (const p of paid) {
    if (seen.has(p.clientId)) continue;
    seen.add(p.clientId);
    const existing = await prisma.crmRecord.findUnique({ where: { clientId: p.clientId } });
    if (existing) continue;
    await prisma.crmRecord.create({
      data: {
        clientId: p.clientId,
        stage: 'paid',
        stageDates: { paid: { at: (p.approvedAt ?? p.createdAt).toISOString(), byUserId: null } } as never,
        valueCents: p.amountCents,
      },
    });
    created++;
  }
  if (created) console.log(`Seed: inseriti ${created} clienti paganti nel CRM (backfill).`);
}

/** Genera un ref code per le coach che non ne hanno uno. */
async function backfillCoachRefCodes(): Promise<void> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = () => Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const coaches = await prisma.staff.findMany({ where: { refCode: null, user: { role: 'coach' } }, select: { id: true } });
  for (const c of coaches) {
    let ref = code();
    for (let i = 0; i < 8; i++) {
      const exists = await prisma.staff.findUnique({ where: { refCode: ref } });
      if (!exists) break;
      ref = code();
    }
    await prisma.staff.update({ where: { id: c.id }, data: { refCode: ref } });
  }
  if (coaches.length) console.log(`Seed: generati ${coaches.length} ref code coach.`);
}

/**
 * Admin principale da variabili d'ambiente (impostate nel pannello Render,
 * mai nel repo né in chat):
 *   ADMIN_EMAIL    → email dell'admin (default: simone.salogni@gmail.com)
 *   ADMIN_PASSWORD → password iniziale (min. 8 caratteri)
 * - Se l'account non esiste e ADMIN_PASSWORD è impostata → lo crea (admin, email
 *   già verificata) con quella password (salvata solo come hash argon2).
 * - Se esiste ma non è admin → lo promuove ad admin.
 * - Se esiste già → NON tocca la password (la gestisce l'admin dal backoffice).
 * Idempotente: non ricrea né sovrascrive un account esistente.
 */
async function ensureAdminFromEnv(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'simone.salogni@gmail.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'admin') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'admin' } });
      console.log(`Seed: ${email} promosso ad admin.`);
    }
    return;
  }

  // Crea comunque l'account admin: con ADMIN_PASSWORD se fornita (≥8),
  // altrimenti con una password non valida da impostare con "Password dimenticata".
  const usable = Boolean(password && password.length >= 8);
  const passwordHash = usable ? await argon2.hash(password as string) : 'SET_VIA_PASSWORD_RESET';
  await prisma.user.create({
    data: { email, passwordHash, role: 'admin', locale: 'it', emailVerifiedAt: new Date() },
  });
  console.log(`Seed: creato admin ${email}${usable ? '' : ' (password da impostare via reset)'}.`);
}

/**
 * Stati predefiniti della pipeline CRM (chiavi stabili = ciclo di vita della
 * specifica). Create-only: l'admin può rinominare/riordinare/aggiungere dal
 * backoffice senza che il seed sovrascriva. lead_in e paid sono "di sistema"
 * (referenziati dall'automazione: registrazione e approvazione pagamento).
 */
async function seedPipelineStages(): Promise<void> {
  const stages = [
    { key: 'lead_in', label: 'Nuovo contatto', color: '#7c8c88', order: 0, isSystem: true },
    { key: 'worked', label: 'Lavorato', color: '#3a6ea5', order: 1, isSystem: false },
    { key: 'paid', label: 'Pagato', color: '#0e7c66', order: 2, isSystem: true },
    { key: 'coach_assigned', label: 'Coach assegnata', color: '#12a386', order: 3, isSystem: false },
    { key: 'coach_call', label: 'Call con la coach', color: '#12a386', order: 4, isSystem: false },
    { key: 'nutritionist_assigned', label: 'Nutrizionista assegnata', color: '#6c5ab7', order: 5, isSystem: false },
    { key: 'first_visit', label: 'Prima visita', color: '#6c5ab7', order: 6, isSystem: false },
    { key: 'follow_up', label: 'Follow-up', color: '#b8863b', order: 7, isSystem: false },
  ];
  for (const s of stages) {
    await prisma.pipelineStage.upsert({
      where: { key: s.key },
      create: s,
      update: { isSystem: s.isSystem }, // non tocca label/color/order scelti dall'admin
    });
  }
  console.log(`Seed: ${stages.length} stati pipeline verificati.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
