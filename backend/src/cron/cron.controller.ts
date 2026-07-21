import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { CoachTasksService } from '../coach-tasks/coach-tasks.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { AlertsService } from '../alerts/alerts.service';
import { ConversationSummaryService } from '../chat/conversation-summary.service';
import { AuditService } from '../audit/audit.service';
import { CommerceService } from '../commerce/commerce.service';
import { LeadAssignmentService } from '../commerce/lead-assignment.service';
import { Public } from '../common/decorators/public.decorator';
import { EngineService } from '../engine/engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReportsService } from '../reports/reports.service';
import { PlanReportService } from '../reports/plan-report.service';
import { SignalsService } from '../signals/signals.service';
import { VisitsService } from '../health-area/visits.service';

/**
 * Endpoint per Render Cron Jobs: il motore gira ogni giorno e le notifiche
 * vengono generate senza intervento umano. Protetto da segreto condiviso
 * (header x-cron-secret = env CRON_SECRET), non dal JWT.
 */
@SkipThrottle() // protetto dal segreto condiviso, non dal rate limit
@Controller('internal/cron')
export class CronController {
  constructor(
    private readonly config: ConfigService,
    private readonly engine: EngineService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly leadAssignment: LeadAssignmentService,
    private readonly reports: ReportsService,
    private readonly planReports: PlanReportService,
    private readonly alerts: AlertsService,
    private readonly summaries: ConversationSummaryService,
    private readonly commerce: CommerceService,
    private readonly signals: SignalsService,
    private readonly visits: VisitsService,
    private readonly agentOrchestrator: AgentOrchestratorService,
    private readonly coachTasks: CoachTasksService,
    private readonly monitoring: MonitoringService,
  ) {}

  private assertSecret(secret?: string): void {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected || !secret || secret !== expected) {
      throw new ForbiddenException('Cron secret non valido');
    }
  }

  @Public()
  @HttpCode(200)
  @Post('daily')
  async daily(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    const startedAt = Date.now();
    const results: Record<string, unknown> = {};
    const failures: { step: string; error: string }[] = [];

    // Ogni step è isolato: se uno fallisce viene registrato e si PROSEGUE con
    // gli altri (prima un errore a metà lista bloccava tutto il resto della
    // notte). Nessuno step può far saltare il cron intero.
    const step = async (name: string, fn: () => Promise<unknown>): Promise<void> => {
      try {
        results[name] = await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push({ step: name, error: msg });
        results[name] = { error: msg };
      }
    };

    await step('engine', () => this.engine.runBatch());
    await step('notifications', () => this.notifications.generateDailyBatch());
    await step('alerts', () => this.alerts.recomputeAllBatch());
    await step('conversationSummaries', () => this.summaries.generateDailyBatch());
    await step('leadAssignments', () => this.leadAssignment.expireStale());
    await step('stalePayments', () => this.commerce.autoCancelStalePayments());
    // Prova gratuita: scadenza automatica + purge del profilo a +7 giorni (handoff lancio).
    await step('trials', () => this.commerce.expireTrialsAndPurge());
    // Task coach sui momenti chiave (G0/G1/G4/G7, fine piano, +7). Dopo l'expire, così vede gli stati aggiornati.
    await step('coachTasks', () => this.coachTasks.generateDaily());
    // Monitoraggio post-percorso: scadenze, trigger di rientro, congelamenti, richieste misure.
    await step('monitoring', () => this.monitoring.dailyTick());
    // Report di fine piano (handoff punto 4): uno per ogni piano concluso, consegnato in app.
    await step('planReports', () => this.planReports.generateDaily());
    await step('adherence', () => this.signals.runAdherenceSweep());
    // Agenti AI con esecuzione giornaliera attiva: accodati qui, processati dal ticker.
    await step('agents', () => this.agentOrchestrator.enqueueDaily());
    // Report MENSILE in app al "mesiversario" di ogni piano attivo (stesso impianto
    // del report di fine piano; sostituisce il PDF via email — dati sanitari).
    await step('monthlyReports', () => this.planReports.generateMonthly());

    const durationMs = Date.now() - startedAt;
    const meta = { durationMs, ok: failures.length === 0, failures };
    // Heartbeat: registrato SEMPRE (anche con fallimenti parziali), così ogni
    // notte si vede che il cron è girato, quanto ha impiegato e cosa è fallito.
    // Se anche il log fallisce (DB giù) non facciamo cadere l'endpoint.
    try {
      await this.audit.log({
        action: 'cron.daily',
        metadata: { ...results, _meta: meta } as Record<string, unknown>,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[cron.daily] heartbeat audit log fallito:', e);
    }
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error('[cron.daily] step falliti:', JSON.stringify(failures));
    }

    return { ...results, _meta: meta };
  }

  /**
   * Promemoria appuntamenti: parte spesso (ogni ~10 min via Render Cron) per
   * avvisare la nutrizionista 30 minuti prima di ogni visita. Idempotente.
   */
  @Public()
  @HttpCode(200)
  @Post('reminders')
  async reminders(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    const appointmentReminders = await this.visits.sendUpcomingReminders();
    return { appointmentReminders };
  }
}
