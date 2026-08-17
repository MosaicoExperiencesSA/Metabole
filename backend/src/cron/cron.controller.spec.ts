import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';
import { ConversationSummaryService } from '../chat/conversation-summary.service';
import { CoachTasksService } from '../coach-tasks/coach-tasks.service';
import { CommerceService } from '../commerce/commerce.service';
import { CrmService } from '../commerce/crm.service';
import { LeadAssignmentService } from '../commerce/lead-assignment.service';
import { EngineService } from '../engine/engine.service';
import { EngineRulesService } from '../engine-rules/engine-rules.service';
import { VisitsService } from '../health-area/visits.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { RegistroVeraService } from '../vera/registro.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PauseService } from '../pause/pause.service';
import { PlanReportService } from '../reports/plan-report.service';
import { ReportsService } from '../reports/reports.service';
import { SignalsService } from '../signals/signals.service';
import { PrivacyService } from '../privacy/privacy.service';
import { CronController } from './cron.controller';

/**
 * Il cron notturno è l'unica cosa che gira senza nessuno a guardare: se salta, di giorno non
 * se ne accorge nessuno finché una cliente non riceve il menu. Questa suite era rimasta ferma a
 * quando gli step erano due (motore e notifiche) e il risultato era tipizzato: da allora gli
 * step sono sedici, ognuno isolato dagli altri, e la suite non compilava più — cioè da mesi non
 * verificava niente.
 *
 * Riscritta intorno a quello che conta davvero oggi:
 *  1. il segreto condiviso protegge l'endpoint (è pubblico, non ha il JWT davanti);
 *  2. gli step girano tutti e il risultato li riporta;
 *  3. **uno step che fallisce NON ferma gli altri** — è la ragione per cui il codice ha quella
 *     struttura, ed è la cosa che prima nessuno controllava.
 */

// Il risultato è un dizionario di step + `_meta`: qui lo leggiamo come tale.
type EsitoCron = Record<string, unknown> & {
  _meta: { durationMs: number; ok: boolean; failures: { step: string; error: string }[] };
};

describe('CronController (endpoint per Render Cron)', () => {
  let controller: CronController;
  let engine: { runBatch: jest.Mock };
  let notifications: { generateDailyBatch: jest.Mock; measuresNudgeTick: jest.Mock };
  let monitoring: { dailyTick: jest.Mock };
  let audit: { log: jest.Mock };
  let engineRules: { generaProssimoCatalogo: jest.Mock };

  beforeEach(async () => {
    engine = { runBatch: jest.fn().mockResolvedValue({ total: 1, run: 1, flagged: 0, skipped: 0 }) };
    notifications = {
      generateDailyBatch: jest.fn().mockResolvedValue({ clients: 1, notifications: 2, errors: 0 }),
      measuresNudgeTick: jest.fn().mockResolvedValue({ inviati: 0 }),
    };
    monitoring = { dailyTick: jest.fn().mockResolvedValue({ ok: true }) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    engineRules = { generaProssimoCatalogo: jest.fn().mockResolvedValue({ fatto: true, variante: 'Flexitariana · omnivore · dimagrimento · 5 pasti', settimana: 3 }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [CronController],
      providers: [
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('segreto-cron') } },
        { provide: EngineService, useValue: engine },
        /**
         * ⚠️ Il generatore di catalogo NON è uno step di `daily`: sta su un endpoint suo, perché
         * chiama l'AI e costa. Sta qui solo perché il costruttore lo chiede — e il test più sotto
         * verifica che `daily` non lo sfiori nemmeno.
         */
        { provide: EngineRulesService, useValue: engineRules },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
        { provide: LeadAssignmentService, useValue: { expireStale: jest.fn().mockResolvedValue({ expired: 0 }) } },
        { provide: ReportsService, useValue: { sendMonthlyBatch: jest.fn().mockResolvedValue({ sent: 0 }) } },
        { provide: PlanReportService, useValue: { generateDaily: jest.fn().mockResolvedValue({ sent: 0 }), generateMonthly: jest.fn().mockResolvedValue({ sent: 0 }) } },
        { provide: AlertsService, useValue: { recomputeAllBatch: jest.fn().mockResolvedValue({ clients: 1, errors: 0 }) } },
        { provide: ConversationSummaryService, useValue: { generateDailyBatch: jest.fn().mockResolvedValue({ threads: 0, created: 0, errors: 0 }) } },
        { provide: CommerceService, useValue: { autoCancelStalePayments: jest.fn().mockResolvedValue({ cancelled: 0 }), expireTrialsAndPurge: jest.fn().mockResolvedValue({ expired: 0 }) } },
        { provide: SignalsService, useValue: { runAdherenceSweep: jest.fn().mockResolvedValue({ clients: 0 }) } },
        { provide: VisitsService, useValue: { sendUpcomingReminders: jest.fn().mockResolvedValue({ sent: 3 }) } },
        { provide: AgentOrchestratorService, useValue: { enqueueDaily: jest.fn().mockResolvedValue({ queued: 0 }) } },
        { provide: CoachTasksService, useValue: { generateDaily: jest.fn().mockResolvedValue({ created: 0 }) } },
        { provide: MonitoringService, useValue: monitoring },
        // Il report mensile di Vera: nei test non è mai il 1° del mese.
        { provide: RegistroVeraService, useValue: { spedisciReportMensile: jest.fn().mockResolvedValue({ inviato: false, motivo: 'non è il primo del mese' }) } },
        { provide: PauseService, useValue: { surveillanceTick: jest.fn().mockResolvedValue({ visti: 0 }) } },
        // «Percorso concluso» a +7 giorni dalla fine del piano (richiesta delle coach, 8/8).
        { provide: CrmService, useValue: { chiudiPercorsiConclusi: jest.fn().mockResolvedValue({ esaminati: 0, spostati: 0 }) } },
        // Revoca del consenso: avvisi del giorno prima e cancellazioni scadute (richiesta dell'8/8).
        // È l'ULTIMO passo della notte, perché anonimizza un'utenza: tutto quello che riguarda ieri
        // deve essere già stato fatto quando i dati esistevano ancora.
        {
          provide: PrivacyService,
          useValue: { passoGiornaliero: jest.fn().mockResolvedValue({ aperte: 0, avvisate: 0, cancellate: 0, errori: [] }) },
        },
      ],
    }).compile();
    controller = moduleRef.get(CronController);
  });

  it('col segreto giusto esegue tutti gli step e riporta gli esiti', async () => {
    const res = (await controller.daily('segreto-cron')) as EsitoCron;
    expect(res.engine).toEqual({ total: 1, run: 1, flagged: 0, skipped: 0 });
    expect(res.notifications).toEqual({ clients: 1, notifications: 2, errors: 0 });
    expect(res._meta.ok).toBe(true);
    expect(res._meta.failures).toEqual([]);
    // Heartbeat: registrato sempre, così ogni notte si vede che il cron è girato.
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'cron.daily' }));
  });

  it('uno step che esplode NON ferma gli altri, e finisce nei failures', async () => {
    monitoring.dailyTick.mockRejectedValue(new Error('database irraggiungibile'));
    const res = (await controller.daily('segreto-cron')) as EsitoCron;
    // il passo rotto è registrato...
    expect(res.monitoring).toEqual({ error: 'database irraggiungibile' });
    expect(res._meta.ok).toBe(false);
    expect(res._meta.failures).toEqual([{ step: 'monitoring', error: 'database irraggiungibile' }]);
    // ...ma quelli DOPO sono girati lo stesso: è tutto il punto della struttura a step isolati.
    expect(res.adherence).toBeDefined();
    expect(res.monthlyReports).toBeDefined();
  });

  it('se anche il log dell\'heartbeat fallisce, l\'endpoint risponde comunque', async () => {
    audit.log.mockRejectedValue(new Error('DB giù'));
    const res = (await controller.daily('segreto-cron')) as EsitoCron;
    expect(res._meta.ok).toBe(true);
  });

  it('segreto sbagliato o assente → 403', async () => {
    await expect(controller.daily('sbagliato')).rejects.toThrow(ForbiddenException);
    await expect(controller.daily(undefined)).rejects.toThrow(ForbiddenException);
    await expect(controller.reminders(undefined)).rejects.toThrow(ForbiddenException);
    await expect(controller.measuresNudge(undefined)).rejects.toThrow(ForbiddenException);
    expect(engine.runBatch).not.toHaveBeenCalled();
  });

  it('gli endpoint frequenti (promemoria visite, sollecito misure) rispondono col segreto giusto', async () => {
    expect(await controller.reminders('segreto-cron')).toEqual({ appointmentReminders: { sent: 3 } });
    expect(await controller.measuresNudge('segreto-cron')).toEqual({ inviati: 0 });
  });

  /**
   * IL GENERATORE DI CATALOGO STA FUORI DA `daily`, ED È UNA DECISIONE — 17/8.
   *
   * `daily` è la notte del prodotto: motore, notifiche, scadenze. Deve restare corta e prevedibile,
   * e soprattutto **non deve costare**. Il riempimento del catalogo chiama l'AI cinque volte a giro:
   * infilarlo lì dentro vorrebbe dire spendere ogni notte senza che nessuno l'abbia chiesto, e
   * scoprirlo dalla fattura.
   *
   * ⚠️ Questi due test esistono perché la dipendenza ADESSO c'è nel costruttore: senza di loro, il
   * giorno che qualcuno aggiunge `await step('catalogo', …)` in mezzo agli altri non se ne accorge
   * nessuno finché non arriva il conto.
   */
  it('⚠️ `daily` NON genera catalogo: quella notte non deve chiamare l\'AI', async () => {
    await controller.daily('segreto-cron');
    expect(engineRules.generaProssimoCatalogo).not.toHaveBeenCalled();
  });

  it('l\'endpoint del catalogo genera, e risponde dicendo cosa ha fatto', async () => {
    const r = (await controller.generaCatalogo('segreto-cron')) as { ok: boolean; variante?: string };
    expect(engineRules.generaProssimoCatalogo).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    expect(r.variante).toContain('Flexitariana');
  });

  it('⚠️ e senza il segreto non genera niente: è un endpoint che spende', async () => {
    await expect(controller.generaCatalogo('sbagliato')).rejects.toBeInstanceOf(ForbiddenException);
    expect(engineRules.generaProssimoCatalogo).not.toHaveBeenCalled();
  });

  it('⚠️ se la generazione esplode l\'endpoint NON risponde 500: lo dice e basta', async () => {
    // Un cron che risponde 500 su Render diventa un allarme, e l'AI momentaneamente fuori uso non è
    // un guasto del prodotto. Si dice cos'è successo e si riprova al giro dopo.
    engineRules.generaProssimoCatalogo.mockRejectedValueOnce(new Error('credito esaurito'));
    const r = (await controller.generaCatalogo('segreto-cron')) as { ok: boolean; errore?: string };
    expect(r.ok).toBe(false);
    expect(r.errore).toContain('credito esaurito');
  });

});
