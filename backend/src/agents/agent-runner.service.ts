import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Prezzi per modello (USD per MILIONE di token, stima dal listino Anthropic).
 * Servono solo per la DASHBOARD COSTI (AgentRun.costCents): se il listino cambia
 * si aggiornano qui senza toccare nient'altro. 1 cent = 0,01 $.
 */
const PRICING: Record<string, { inUsdPerMTok: number; outUsdPerMTok: number }> = {
  'claude-haiku-4-5': { inUsdPerMTok: 1, outUsdPerMTok: 5 },
  'claude-sonnet-5': { inUsdPerMTok: 3, outUsdPerMTok: 15 },
  'claude-opus-4-8': { inUsdPerMTok: 15, outUsdPerMTok: 75 },
};

function costCentsOf(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  const usd = (inputTokens * p.inUsdPerMTok + outputTokens * p.outUsdPerMTok) / 1_000_000;
  return usd > 0 ? Math.max(1, Math.ceil(usd * 100)) : 0;
}

export interface AgentRunResult {
  runId: string;
  status: 'done';
  output: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  humanInLoop: boolean;
  budget: { spentCents: number; limitCents: number };
}

/**
 * Runtime degli agenti (fase 2 della spec Metabole_Agenti_AI_Spec_Sviluppo.md):
 * esegue un agente sul suo motore Claude, conta token e costo su AgentRun,
 * rispetta il TETTO DI BUDGET mensile per agente (guardrail: oltre il tetto
 * l'esecuzione viene BLOCCATA, non eseguita) e scrive l'audit su AgentLog.
 * L'orchestratore (code/cron/Giudice in pipeline) arriverà nella fase 3.
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private async configString(key: string, fallback: string): Promise<string> {
    const row = (await this.prisma.configParam.findUnique({ where: { key } })) as { value: string } | null;
    return row?.value?.trim() || fallback;
  }

  /** Spesa del mese corrente per un agente (somma AgentRun.costCents). */
  async monthlySpentCents(agentId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const agg = await this.prisma.agentRun.aggregate({
      where: { agentId, startedAt: { gte: monthStart } },
      _sum: { costCents: true },
    });
    return agg._sum.costCents ?? 0;
  }

  private async log(agentRunId: string, level: string, message: string, payload?: Record<string, unknown>) {
    await this.prisma.agentLog
      .create({ data: { agentRunId, level, message, payload: (payload ?? undefined) as never } })
      .catch(() => undefined); // l'audit non deve mai far fallire l'esecuzione
  }

  /**
   * Esecuzione MANUALE di un agente (POST /agents/:id/run). Il chiamante è già
   * filtrato dal controller (responsabile marketing/admin). Ritorna output e costi.
   */
  async run(agentId: string, input: string, actorUserId: string): Promise<AgentRunResult> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.archivedAt) throw new NotFoundException('Agente non trovato.');
    if (!agent.enabled) throw new BadRequestException('Questo agente è disattivato: riattivalo prima di eseguirlo.');
    const text = (input ?? '').trim();
    if (!text) throw new BadRequestException('Scrivi un input per l\'agente.');

    // Motore: solo Claude è eseguibile da qui (ElevenLabs e deterministici hanno pipeline proprie).
    const engine = agent.engine?.startsWith('claude')
      ? agent.engine
      : agent.engine === 'none' || agent.engine === 'elevenlabs'
        ? null
        : await this.configString('agent_default_model', 'claude-haiku-4-5');
    if (!engine) {
      throw new BadRequestException(
        agent.engine === 'elevenlabs'
          ? 'La voce (ElevenLabs) ha una pipeline dedicata: non si esegue da qui.'
          : 'Questo agente è deterministico (nessun LLM): non si esegue da qui.',
      );
    }
    const model = agent.type === 'judge' ? await this.configString('agent_judge_model', engine) : engine;

    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey) throw new BadRequestException('AI non configurata sul server (AI_API_KEY mancante su Render).');

    // GUARDRAIL BUDGET: oltre il tetto mensile l'esecuzione è bloccata (spec §6).
    const limitCents = agent.monthlyBudgetCents ?? 0;
    const spentCents = limitCents > 0 ? await this.monthlySpentCents(agentId) : 0;
    if (limitCents > 0 && spentCents >= limitCents) {
      const blocked = await this.prisma.agentRun.create({
        data: { agentId, status: 'blocked', model, inputRef: text.slice(0, 2000), finishedAt: new Date(), error: 'budget mensile superato' },
      });
      await this.log(blocked.id, 'warn', `Esecuzione bloccata: budget mensile superato (${spentCents}/${limitCents} cent).`);
      throw new BadRequestException(
        `Budget mensile dell'agente superato (€ ${(spentCents / 100).toFixed(2)} su € ${(limitCents / 100).toFixed(2)}): alza il tetto o attendi il nuovo mese.`,
      );
    }

    // Prompt di sistema: quello versionato sull'agente, altrimenti composto da compito+regola.
    const system = agent.systemPrompt?.trim()
      || `Sei "${agent.name}", un agente del sistema Metabole (reparto ${agent.department}).\nCOMPITO: ${agent.task}\nREGOLA VINCOLANTE (non violarla mai): ${agent.rule || 'nessuna regola aggiuntiva'}\nRispondi in italiano, in modo concreto e utilizzabile.`;

    const run = await this.prisma.agentRun.create({
      data: { agentId, status: 'running', model, inputRef: text.slice(0, 2000) },
    });
    await this.log(run.id, 'info', 'Esecuzione avviata', { actorUserId, model });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: text }] }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const reason = res.status === 401 ? 'chiave API non valida' : res.status === 404 ? `modello non trovato (${model})` : res.status === 429 ? 'limite di richieste raggiunto' : `errore ${res.status}`;
        throw new Error(reason);
      }
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const output = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim();
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      const costCents = costCentsOf(model, inputTokens, outputTokens);

      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: { status: 'done', finishedAt: new Date(), outputRef: output.slice(0, 50_000), inputTokens, outputTokens, costCents },
      });
      await this.log(run.id, 'info', 'Esecuzione completata', { inputTokens, outputTokens, costCents });
      await this.audit.log({ action: 'agent.run', actorId: actorUserId, entityType: 'agent', entityId: agentId, metadata: { runId: run.id, model, costCents } });

      return {
        runId: run.id,
        status: 'done',
        output,
        model,
        inputTokens,
        outputTokens,
        costCents,
        humanInLoop: agent.humanInLoop,
        budget: { spentCents: spentCents + costCents, limitCents },
      };
    } catch (err) {
      const message = err instanceof Error ? (err.name === 'AbortError' ? 'timeout (90s)' : err.message) : String(err);
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: { status: 'error', finishedAt: new Date(), error: message.slice(0, 500) },
      });
      await this.log(run.id, 'error', `Esecuzione fallita: ${message}`);
      this.logger.warn(`Agente ${agent.key}: ${message}`);
      throw new BadRequestException(`Esecuzione non riuscita: ${message}.`);
    } finally {
      clearTimeout(timer);
    }
  }
}
