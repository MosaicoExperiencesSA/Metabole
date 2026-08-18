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
import { RegistroVeraService } from '../vera/registro.service';
import { PauseService } from '../pause/pause.service';
import { AlertsService } from '../alerts/alerts.service';
import { ConversationSummaryService } from '../chat/conversation-summary.service';
import { ChatService } from '../chat/chat.service';
import { AuditService } from '../audit/audit.service';
import { CommerceService } from '../commerce/commerce.service';
import { CrmService } from '../commerce/crm.service';
import { LeadAssignmentService } from '../commerce/lead-assignment.service';
import { Public } from '../common/decorators/public.decorator';
import { EngineService } from '../engine/engine.service';
import { EngineRulesService } from '../engine-rules/engine-rules.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReportsService } from '../reports/reports.service';
import { PlanReportService } from '../reports/plan-report.service';
import { SignalsService } from '../signals/signals.service';
import { VisitsService } from '../health-area/visits.service';
import { PrivacyService } from '../privacy/privacy.service';

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
    private readonly engineRules: EngineRulesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly leadAssignment: LeadAssignmentService,
    private readonly reports: ReportsService,
    private readonly planReports: PlanReportService,
    private readonly alerts: AlertsService,
    private readonly summaries: ConversationSummaryService,
    /** Serve al passo che chiude le conversazioni di Gaia lasciate a metà. */
    private readonly chat: ChatService,
    private readonly commerce: CommerceService,
    private readonly signals: SignalsService,
    private readonly visits: VisitsService,
    private readonly agentOrchestrator: AgentOrchestratorService,
    private readonly coachTasks: CoachTasksService,
    private readonly monitoring: MonitoringService,
    private readonly registroVera: RegistroVeraService,
    private readonly pause: PauseService,
    private readonly crm: CrmService,
    private readonly privacy: PrivacyService,
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
    /**
     * Le conversazioni di Gaia rimaste senza risposta: dopo un giorno le chiude lei, dicendo che ha
     * capito (18/8). ⚠️ Sta QUI e non fra i `reminders` — che girano ogni dieci minuti — perché
     * questo scrive alla cliente: una volta al giorno basta, e non c'è niente da rincorrere.
     */
    await step('chiusureGaia', () => this.chat.chiudiSostituzioniLasciateAMeta());
    await step('leadAssignments', () => this.leadAssignment.expireStale());
    await step('stalePayments', () => this.commerce.autoCancelStalePayments());
    // Prova gratuita: scadenza automatica + purge del profilo a +7 giorni (handoff lancio).
    await step('trials', () => this.commerce.expireTrialsAndPurge());
    // Task coach sui momenti chiave (G0/G1/G4/G7, fine piano, +7). Dopo l'expire, così vede gli stati aggiornati.
    await step('coachTasks', () => this.coachTasks.generateDaily());
    // Monitoraggio post-percorso: scadenze, trigger di rientro, congelamenti, richieste misure.
    await step('monitoring', () => this.monitoring.dailyTick());
    // Il report mensile di Vera: parte SOLO il 1° del mese (il metodo controlla da solo la data
    // ed è idempotente — la notifica del mese fa da marcatore). Notifica in app + email ai capi.
    await step('veraReportMensile', () => this.registroVera.spedisciReportMensile());
    // Sorveglianza durante le pause vacanza: peso di riferimento, promemoria misure e
    // avviso alla coach se il peso sale oltre soglia. Nessuna proposta commerciale.
    await step('pauseWatch', () => this.pause.surveillanceTick());
    // Report di fine piano (handoff punto 4): uno per ogni piano concluso, consegnato in app.
    await step('planReports', () => this.planReports.generateDaily());
    await step('adherence', () => this.signals.runAdherenceSweep());
    // Agenti AI con esecuzione giornaliera attiva: accodati qui, processati dal ticker.
    await step('agents', () => this.agentOrchestrator.enqueueDaily());
    // Report MENSILE in app al "mesiversario" di ogni piano attivo (stesso impianto
    // del report di fine piano; sostituisce il PDF via email — dati sanitari).
    await step('monthlyReports', () => this.planReports.generateMonthly());
    // «Percorso concluso»: la scheda entra nell'ultima colonna quando il piano è finito da una
    // settimana senza rinnovo. Va DOPO `trials` e `stalePayments`, che sono i due passi che
    // possono ancora chiudere o annullare qualcosa: così si guarda lo stato definitivo di oggi
    // e non si archivia una persona il cui pagamento è appena stato sistemato.
    await step('percorsiConclusi', () => this.crm.chiudiPercorsiConclusi());
    /**
     * REVOCA DEL CONSENSO: l'avviso «domani cancelliamo» e le cancellazioni scadute.
     *
     * ULTIMO passo della notte, dopo tutto il resto, e non per eleganza: cancella e anonimizza
     * un'utenza, quindi ogni passo che gira dopo di lui lavorerebbe su una persona che non c'è più
     * — report, segnalazioni, task della coach. Mettendolo in fondo, tutto quello che riguarda la
     * giornata di ieri è già stato fatto quando i dati esistevano ancora.
     */
    await step('cancellazioniPrivacy', () => this.privacy.passoGiornaliero());

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

  /**
   * SOLLECITO MISURE (voce #6 del 5/8): va chiamato OGNI DUE ORE, non una volta al giorno.
   * Manda il sollecito a chi ha il menu fermo per le misure mancanti e apre un'attività alla
   * coach la prima volta. Non fa nulla di notte: la finestra oraria è nei parametri.
   */
  @Public()
  @HttpCode(200)
  @Post('measures-nudge')
  async measuresNudge(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    return this.notifications.measuresNudgeTick();
  }

  /**
   * UNA SETTIMANA DI CATALOGO, PER CHIAMATA — richiesta della nutrizionista, 17/8: «invece di farlo
   * lei una alla volta col pulsante *genera*, possiamo farli tutti noi fino alla settimana 12, poi
   * lei piano piano le controlla».
   *
   * Sta **fuori** da `daily` di proposito: `daily` è la notte del prodotto — motore, notifiche,
   * scadenze — e deve restare corta e prevedibile. Questa invece chiama l'AI, costa, e va accesa e
   * spenta quando serve. Su Render è un Cron Job a parte, ogni pochi minuti; dalla shell è un
   * `curl` in un ciclo, e si guarda mentre va.
   *
   * ⚠️ Un'unità di lavoro per chiamata. Un giro da cinquecento chiamate all'AI che cade a metà
   * lascia un lavoro di cui nessuno sa il punto; così ogni chiamata finisce, e la successiva
   * riparte da dove serve — lo stato è il catalogo stesso, non una variabile.
   *
   * ⚠️ Si può fermare in qualsiasi momento: basta spegnere il cron. Niente resta a metà, perché
   * l'unità è la settimana.
   *
   * La priorità la decide `prossima-generazione.ts`: prima le famiglie con clienti sopra, dentro un
   * gruppo prima la variante a 5 pasti (le altre due riusano le sue ricette e non costano una
   * seconda generazione), e le settimane in ordine — con le settimane **magre** prima di quelle
   * nuove, perché una settimana magra la sta mangiando qualcuno adesso.
   */
  @Public()
  @HttpCode(200)
  @Post('genera-catalogo')
  async generaCatalogo(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    const startedAt = Date.now();
    let esito: Record<string, unknown>;
    try {
      esito = { ok: true, ...(await this.engineRules.generaProssimoCatalogo()) };
    } catch (e) {
      // ⚠️ Non si rilancia: un cron che risponde 500 su Render diventa un allarme, e qui il caso
      // normale — l'AI momentaneamente fuori uso — non è un guasto del prodotto. Si dice cos'è
      // successo e si riproverà al giro dopo. Se è definitivo (credito finito, chiave non valida)
      // il messaggio lo dice, e va spento il cron invece di lasciarlo sbattere.
      esito = { ok: false, errore: e instanceof Error ? e.message : String(e) };
    }
    const risposta = { ...esito, ms: Date.now() - startedAt };

    /**
     * ⚠️ IL BATTITO — richiesta di Simone del 18/8: «come facciamo a sapere se sta lavorando?».
     *
     * Si scrive **sempre**, anche quando il giro non genera niente, ed è tutto il punto. Prima la
     * riga di registro la lasciava solo `generateCatalogFromPreset` **quando riusciva**: i tre
     * motivi per cui un giro può finire a mani vuote — catalogo completo, AI fuori uso, cron spento
     * su Render — avevano lo stesso aspetto, cioè nessuna riga. E il terzo è quello che fa danno,
     * perché un cron che non parte non lascia traccia da nessuna parte.
     *
     * Da qui in avanti il silenzio vuol dire **una cosa sola**: non sta girando. `npm run
     * diag:catalogo` legge queste righe.
     *
     * ⚠️ In `try` a parte: se il registro non scrive, il giro è comunque andato — perdere la
     * generazione per un battito sarebbe il rimedio peggiore del male.
     */
    try {
      await this.audit.log({ action: 'cron.genera_catalogo', metadata: risposta });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[cron.genera-catalogo] battito non scritto:', e);
    }
    return risposta;
  }

}
