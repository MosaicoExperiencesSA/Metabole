import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { KcalNeedService } from '../menu/kcal-need.service';
import { MonitoringService } from './monitoring.service';

/**
 * Il MONITORAGGIO IN ABBONAMENTO (€19/mese) come deve funzionare (decisione Simone, 9/8):
 * Gaia chiede il peso **senza obbligo di inserimento**; se il peso risale oltre la soglia
 * prepara **una settimana** di menu scelti fra quelli che su quella cliente hanno fatto
 * perdere di più; tutto il resto dell'app e la coach restano raggiungibili.
 *
 * Il difetto che questi test bloccano è quello che rendeva il piano un guscio vuoto: nel
 * commercio «qualsiasi piano a pagamento chiude il monitoraggio in corso» valeva anche per il
 * piano che *è* monitoraggio. Chi pagava si comprava la fine del servizio che stava comprando:
 * il giro giornaliero lavora sui periodi attivi, quindi niente più richieste del peso e — la
 * parte grave — niente menu di rientro quando il peso saliva. Senza nessun errore: semplicemente
 * non succedeva più niente, per €19 al mese.
 */

const CONFIG: Record<string, number> = {
  monitoring_regain_kg: 3,
  monitoring_offer_days: 7,
  monitoring_measure_ask_days: 3,
  monitoring_duration_days: 30,
  monitoring_rientro_days: 7,
};

function makeService(prisma: Record<string, unknown>) {
  const configParams = { getNumber: jest.fn((k: string, def?: number) => Promise.resolve(CONFIG[k] ?? def ?? 0)) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new MonitoringService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    configParams as unknown as ConfigParamsService,
    audit as unknown as AuditService,
    // ⚠️ Il kit di rientro riporziona sul fabbisogno (voce 255): qui non si eroga niente, ma il
    // costruttore lo vuole.
    { computeTargetKcal: jest.fn().mockResolvedValue(null) } as unknown as KcalNeedService,
  );
  return { service, notifications, audit };
}

const GIORNO = 86_400_000;

/**
 * Un periodo di Monitoraggio **in corso**: cominciato tre settimane fa, finisce fra otto giorni.
 *
 * ⛔ **La finestra si conta da ADESSO, non è scritta a mano** — 23/8. Qui c'era
 * `2026-08-01 → 2026-09-01`, e dal **2 settembre** quel periodo sarebbe risultato finito da solo:
 * `dailyTick` lo avrebbe chiuso (`status: 'expired'`) invece di fissare il peso di riferimento, e il
 * test sarebbe diventato rosso **per sempre**. ⚠️ Una CI rossa per sempre è una CI che si smette di
 * guardare, e allora il primo difetto vero arriva in produzione in mezzo al rumore.
 *
 * ⚠️ E `Date.now() + n` qui è la porta **giusta**, mentre altrove in questa consegna è stata tolta:
 * `endsAt` non è un giorno di calendario — il servizio lo scrive con `Date.now() + giorni * 86_400_000`
 * e lo confronta con `p.endsAt.getTime() <= now.getTime()`. La regola non è «mai `Date.now()`»: è che
 * il test chieda alla **stessa porta del codice**.
 */
const periodo = (over: Record<string, unknown> = {}) => ({
  id: 'per-1', clientId: 'cli-1', status: 'active',
  startedAt: new Date(Date.now() - 22 * GIORNO),
  endsAt: new Date(Date.now() + 8 * GIORNO),
  referenceWeightKg: 70, regainOfferedAt: null, frozenAt: null, closedAt: null,
  convertedTo: null, lastMeasureAskAt: null,
  ...over,
});

describe('onPlanActivated — il Monitoraggio a €19 non si chiude da solo', () => {
  it('attivando il piano «monitoring» il periodo NON viene convertito: viene prolungato', async () => {
    const prisma = {
      monitoringPeriod: { findFirst: jest.fn().mockResolvedValue(periodo({ regainOfferedAt: new Date() })), update: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ weightKg: 70, date: new Date() }) },
      analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service } = makeService(prisma);

    await service.onPlanActivated('cli-1', { id: 'p19', name: 'Monitoraggio Metabole', priceCents: 1900, period: 'monitoring' });

    const chiamata = prisma.monitoringPeriod.update.mock.calls[0][0];
    expect(chiamata.where).toEqual({ id: 'per-1' });
    expect(chiamata.data.status).toBe('active');
    // Mai 'converted': era la riga che spegneva il servizio appena veniva pagato.
    expect(chiamata.data.convertedTo).toBeUndefined();
    // Mese nuovo, occasione nuova: il rientro può riscattare.
    expect(chiamata.data.regainOfferedAt).toBeNull();
  });

  it('senza un periodo aperto lo CREA, anche se la cliente non si è mai pesata', async () => {
    const prisma = {
      monitoringPeriod: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
      analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service, notifications } = makeService(prisma);

    await service.onPlanActivated('cli-1', { id: 'p19', name: 'Monitoraggio Metabole', priceCents: 1900, period: 'monitoring' });

    expect(prisma.monitoringPeriod.create).toHaveBeenCalled();
    const dati = prisma.monitoringPeriod.create.mock.calls[0][0].data;
    expect(dati.status).toBe('active');
    // Nessuna pesata: il riferimento resta 0 e lo prenderà la prima volta che sale sulla
    // bilancia. Pretenderla all'ingresso vorrebbe dire far pagare e poi non erogare.
    expect(dati.referenceWeightKg).toBe(0);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'monitoring_started' }));
  });

  it('gli ALTRI piani a pagamento continuano a chiudere il monitoraggio (comportamento di sempre)', async () => {
    const prisma = {
      monitoringPeriod: { findFirst: jest.fn().mockResolvedValue(periodo()), update: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
      measurement: { findFirst: jest.fn() },
      analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service } = makeService(prisma);

    await service.onPlanActivated('cli-1', { id: 'p49', name: 'Mantenimento Metabole', priceCents: 4900, period: 'maintenance' });

    expect(prisma.monitoringPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'converted', convertedTo: 'Mantenimento Metabole' }) }),
    );
  });
});

describe('dailyTick — peso di riferimento mancante', () => {
  it('alla prima pesata FISSA il riferimento e non erogа niente', async () => {
    const prisma = {
      monitoringPeriod: { findMany: jest.fn().mockResolvedValue([periodo({ referenceWeightKg: 0 })]), update: jest.fn().mockResolvedValue({}) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ weightKg: 71.4, date: new Date() }) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const { service } = makeService(prisma);

    const res = await service.dailyTick();

    // Senza questo, il confronto sarebbe `71,4 − 0 = 71,4 ≥ 3`: menu di rientro il giorno
    // stesso, a una persona che non è aumentata di un grammo.
    expect(res.offered).toBe(0);
    expect(prisma.monitoringPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { referenceWeightKg: 71.4 } }),
    );
  });
});

describe('generateRientroMenus — una settimana, non otto giorni', () => {
  it('prepara 7 giornate (monitoring_rientro_days)', async () => {
    const storico = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (i + 1) * 86_400_000),
      dietId: 'd1', level: 2, meals: [{ slot: 'lunch', recipeId: `r${i}` }],
    }));
    const prisma = {
      menuDay: { findMany: jest.fn().mockResolvedValue(storico), upsert: jest.fn().mockResolvedValue({}) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([]) },
      measurement: { findMany: jest.fn().mockResolvedValue([]) },
      analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service } = makeService(prisma);

    const creati = await service.generateRientroMenus('cli-1');

    // Erano 8, numero ereditato dal prodotto «Menu di rientro (8 giorni)» che non esiste più.
    expect(creati).toBe(7);
    expect(prisma.menuDay.upsert).toHaveBeenCalledTimes(7);
  });
});
