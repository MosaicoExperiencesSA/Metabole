import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRunnerService, CRON_INPUT_PREFIX } from './agent-runner.service';

/**
 * ORCHESTRATORE degli agenti (spec §3): coda + cron.
 * - CODA: le esecuzioni `queued` vengono reclamate con claim atomico e processate
 *   da un ticker interno (stesso pattern di LifecycleService/MarketingService),
 *   così i lavori non real-time non bloccano nessuno e sopravvivono al riavvio.
 * - CRON: gli agenti con l'esecuzione giornaliera attiva (tools.daily) vengono
 *   accodati una volta al giorno dal cron di Render (POST /internal/cron/daily),
 *   idempotente (marcatore [cron] sull'input: mai due accodamenti nello stesso giorno).
 * Budget, costi, audit e Giudice sono nel runner: la pipeline è identica per
 * esecuzioni manuali e accodate.
 */
@Injectable()
export class AgentOrchestratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentOrchestratorService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private static readonly TICK_MS = 60 * 1000; // ogni minuto
  private static readonly MAX_PER_TICK = 3; // prudenza: max 3 esecuzioni per giro

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: AgentRunnerService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.processQueue(), AgentOrchestratorService.TICK_MS);
    this.timer.unref?.();
    setTimeout(() => void this.processQueue(), 45 * 1000).unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Accoda un'esecuzione (parte entro un minuto dal ticker). */
  async enqueue(agentId: string, input: string, opts?: { cron?: boolean }) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, enabled: true, archivedAt: true, engine: true } });
    if (!agent || agent.archivedAt) throw new NotFoundException('Agente non trovato.');
    if (!agent.enabled) throw new BadRequestException('Questo agente è disattivato.');
    if (agent.engine === 'none' || agent.engine === 'elevenlabs') {
      throw new BadRequestException('Questo agente non è eseguibile dalla coda (pipeline dedicata).');
    }
    const text = (input ?? '').trim();
    if (!text) throw new BadRequestException('Input vuoto.');
    const run = await this.prisma.agentRun.create({
      data: { agentId, status: 'queued', inputRef: `${opts?.cron ? CRON_INPUT_PREFIX : ''}${text}`.slice(0, 2000) },
    });
    return { runId: run.id, status: 'queued' as const };
  }

  /**
   * Ticker della coda: reclama (claim atomico queued→running) e processa fino a
   * MAX_PER_TICK esecuzioni, dalla più vecchia. Un errore su una run non ferma le altre.
   */
  async processQueue(): Promise<{ processed: number }> {
    if (this.ticking) return { processed: 0 };
    this.ticking = true;
    let processed = 0;
    try {
      const due = (await this.prisma.agentRun.findMany({
        where: { status: 'queued' },
        orderBy: { startedAt: 'asc' },
        select: { id: true },
        take: AgentOrchestratorService.MAX_PER_TICK,
      })) as { id: string }[];
      for (const d of due) {
        // Claim atomico: vince un solo processo (multi-istanza safe).
        const claim = await this.prisma.agentRun.updateMany({ where: { id: d.id, status: 'queued' }, data: { status: 'running' } });
        if (claim.count === 0) continue;
        try {
          await this.runner.executeClaimedRun(d.id);
        } catch (e) {
          this.logger.warn(`Run ${d.id} fallita nel ticker: ${e instanceof Error ? e.message : e}`);
        }
        processed++;
      }
    } finally {
      this.ticking = false;
    }
    return { processed };
  }

  /**
   * Cron giornaliero: accoda gli agenti con l'esecuzione automatica attiva
   * (Agent.tools = { daily: { enabled: true, input: "..." } }).
   * Idempotente: se oggi esiste già una run [cron] per quell'agente, salta.
   */
  async enqueueDaily(): Promise<{ enqueued: number; skipped: number }> {
    const agents = (await this.prisma.agent.findMany({
      where: { enabled: true, archivedAt: null },
      select: { id: true, key: true, tools: true, engine: true },
    })) as { id: string; key: string; tools: unknown; engine: string }[];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let enqueued = 0;
    let skipped = 0;
    for (const a of agents) {
      const daily = ((a.tools ?? {}) as { daily?: { enabled?: boolean; input?: string } }).daily;
      if (!daily?.enabled || !daily.input?.trim()) continue;
      if (a.engine === 'none' || a.engine === 'elevenlabs') continue;
      const already = await this.prisma.agentRun.findFirst({
        where: { agentId: a.id, startedAt: { gte: todayStart }, inputRef: { startsWith: CRON_INPUT_PREFIX } },
        select: { id: true },
      });
      if (already) { skipped++; continue; }
      await this.prisma.agentRun.create({
        data: { agentId: a.id, status: 'queued', inputRef: `${CRON_INPUT_PREFIX}${daily.input.trim()}`.slice(0, 2000) },
      });
      enqueued++;
    }
    if (enqueued) this.logger.log(`Cron agenti: accodate ${enqueued} esecuzioni giornaliere.`);
    return { enqueued, skipped };
  }
}
