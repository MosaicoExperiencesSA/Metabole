/**
 * ACCENSIONE degli automatismi decisi l'8/8. Si lancia UNA VOLTA, a mano.
 *
 * ## Perché uno script e non un default nel seed
 *
 * Il seed gira a ogni deploy. Se mettessimo qui dentro «acceso» come valore di default, il
 * giorno in cui qualcuno spegne un interruttore dal backoffice il deploy successivo glielo
 * riaccenderebbe, e nessuno capirebbe perché. Gli interruttori sono di chi gestisce, non del
 * codice: il codice li accende una volta perché gliel'hanno chiesto, poi si toglie di mezzo.
 *
 * ## Che cosa accende
 *
 * 1. **Assistente AI in chat** (`ai_assistant_enabled`). Oggi la chat è un instradatore a
 *    espressioni regolari con sette risposte pre-scritte: tutto quello che non riconosce lo
 *    gira alla coach — comprese le domande innocue tipo «cos'è il bok choy?». Acceso, quelle
 *    domande le risponde l'AI e la coach non viene disturbata. I temi sensibili (medici,
 *    umore, farmaci) NON passano mai dall'AI nemmeno da acceso: quelli sono già intercettati
 *    prima e vanno a una persona.
 *    ⚠️ Serve anche `AI_API_KEY` valorizzata su Render, altrimenti il flag non basta.
 *
 * 2. **Motore delle mail automatiche** (master) con SOLO gli inneschi chiesti:
 *    · `profilo_incompleto` — registrata da 1-14 giorni e questionario non compilato;
 *    · `ev_compleanno` — auguri il giorno del compleanno (solo per chi ha la data di nascita);
 *    · `trial_fine` — ultimo giorno della prova gratuita, invito a continuare.
 *    Tutti gli altri inneschi implementati vengono messi **esplicitamente a spento**, perché
 *    il motore funziona a opt-out: acceso il master, parte tutto quello che non è marcato
 *    `false`. Senza questa lista, accendere il master vorrebbe dire far partire benvenuto,
 *    onboarding, promemoria rinnovo, win-back e anniversario tutti insieme, a clienti che non
 *    li hanno mai ricevuti. Si accendono dal backoffice (Marketing → Automazione), uno alla
 *    volta, guardando che effetto fanno.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run accendi:automazioni              → mostra che cosa farebbe, non scrive niente
 *   CONFERMA=1 npm run accendi:automazioni   → applica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Gli inneschi che devono partire. Tutto il resto resta spento. */
const DA_ACCENDERE = ['profilo_incompleto', 'ev_compleanno', 'trial_fine'];

/**
 * Tutti gli inneschi IMPLEMENTATI del catalogo. L'elenco è copiato da
 * `src/marketing/lifecycle.service.ts` (LIFECYCLE_CATALOG, voci con `implemented: true`):
 * lo script gira con ts-node e importare il servizio Nest tirerebbe dentro mezzo backend.
 * Se in futuro se ne aggiunge uno e non finisce qui, l'effetto è che parte da solo appena
 * si accende il master — quindi vale la pena tenerlo allineato.
 */
const IMPLEMENTATI = [
  'welcome', 'profilo_pronto', 'profilo_incompleto', 'piano_domani',
  'onb_g1', 'onb_g4', 'onb_g7', 'trial_g6_offer',
  'cart_1h', 'cart_24h', 'cart_72h',
  'ev_rientro', 'ev_compleanno', 'ev_anniversario', 'ev_mantenimento',
  'rin_t7', 'rin_t3', 'rin_t1',
  'mon_t8', 'mon_fine',
  'trial_fine', 'wb_t3', 'wb_t7',
];

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  // --- 1) Assistente AI in chat -------------------------------------------------
  const flagAi = (await prisma.configParam.findUnique({
    where: { key: 'ai_assistant_enabled' },
    select: { value: true },
  })) as { value: string } | null;
  const aiGiaAcceso = flagAi?.value === 'true';

  // --- 2) Mail automatiche ------------------------------------------------------
  const settings = (await prisma.lifecycleSettings.findUnique({
    where: { id: 'singleton' },
    select: { enabled: true, triggers: true },
  })) as { enabled: boolean; triggers: unknown } | null;
  const attuali = (settings?.triggers as Record<string, boolean> | null) ?? {};

  const nuovi: Record<string, boolean> = { ...attuali };
  for (const k of IMPLEMENTATI) nuovi[k] = DA_ACCENDERE.includes(k);

  // Modelli email mancanti: senza il modello, l'innesco è acceso e non manda niente.
  const chiavi = await prisma.emailTemplate.findMany({
    where: { key: { in: DA_ACCENDERE } },
    select: { key: true, active: true },
  }) as { key: string; active: boolean }[];
  const perKey = new Map(chiavi.map((t) => [t.key, t]));
  const problemi = DA_ACCENDERE.filter((k) => !perKey.get(k)?.active);

  console.log('=== ASSISTENTE AI IN CHAT ===');
  console.log(aiGiaAcceso ? 'già acceso ✓' : `da accendere (ora: ${flagAi?.value ?? 'non impostato'})`);
  console.log('\n=== MAIL AUTOMATICHE ===');
  console.log(`master: ${settings?.enabled ? 'già acceso ✓' : 'da accendere'}`);
  console.table(
    IMPLEMENTATI.map((k) => ({
      innesco: k,
      prima: attuali[k] === undefined ? '(default)' : attuali[k] ? 'acceso' : 'spento',
      dopo: nuovi[k] ? 'ACCESO' : 'spento',
      modello: DA_ACCENDERE.includes(k) ? (perKey.get(k)?.active ? 'ok' : '⚠ mancante o disattivato') : '—',
    })),
  );

  if (problemi.length) {
    console.log(
      `\n⚠️  Modelli email mancanti o disattivati: ${problemi.join(', ')}.\n` +
      "    L'innesco resterebbe acceso senza mandare niente. Lancia prima `npm run seed`\n" +
      '    (il deploy lo fa da solo) e controlla in Backoffice → Modelli email che siano attivi.',
    );
  }

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run accendi:automazioni');
    return;
  }

  await prisma.configParam.upsert({
    where: { key: 'ai_assistant_enabled' },
    create: {
      key: 'ai_assistant_enabled',
      value: 'true',
      type: 'boolean',
      description: "Assistente AI in chat: risponde alle domande generiche invece di girarle alla coach",
    } as never,
    update: { value: 'true' },
  });

  await prisma.lifecycleSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', enabled: true, triggers: nuovi as never },
    update: { enabled: true, triggers: nuovi as never },
  });

  console.log('\n✓ Assistente AI acceso (serve AI_API_KEY su Render).');
  console.log(`✓ Mail automatiche accese, con ${DA_ACCENDERE.length} inneschi attivi: ${DA_ACCENDERE.join(', ')}.`);
  console.log('  Gli altri restano spenti: si accendono dal backoffice, in Marketing → Automazione.');
  console.log('\nNota: il parametro AI è in cache lato server per qualche minuto — se in chat');
  console.log('non cambia subito, aspetta o riavvia il servizio da Render.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
