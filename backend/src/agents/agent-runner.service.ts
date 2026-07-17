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

/** Marcatore delle esecuzioni accodate dal cron giornaliero (per l'idempotenza). */
export const CRON_INPUT_PREFIX = '[cron] ';

type AgentRow = {
  id: string; key: string; name: string; type: string; department: string;
  task: string; rule: string; engine: string; systemPrompt: string | null;
  enabled: boolean; humanInLoop: boolean; monthlyBudgetCents: number; archivedAt: Date | null;
};

export interface AgentRunResult {
  runId: string;
  status: 'done';
  output: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  humanInLoop: boolean;
  verdict: string | null;
  verdictReason: string | null;
  budget: { spentCents: number; limitCents: number };
}

/**
 * Runtime degli agenti (spec Metabole_Agenti_AI_Spec_Sviluppo.md §3):
 * esegue un agente sul suo motore Claude, conta token e costo su AgentRun,
 * rispetta il TETTO DI BUDGET mensile (oltre → esecuzione BLOCCATA), scrive
 * l'audit su AgentLog e — per i CONTENUTI (generativi/redattori dei reparti
 * marketing/comunicazione) — passa l'output dal GIUDICE, che emette un verdetto
 * (approva/rivedi/blocca) salvato sull'esecuzione. L'orchestratore (coda+cron)
 * vive in AgentOrchestratorService.
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

  /** Chiamata al modello Claude: ritorna testo e token (o lancia con motivo chiaro). */
  private async callClaude(model: string, system: string, user: string): Promise<{ output: string; inputTokens: number; outputTokens: number }> {
    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey) throw new Error('AI non configurata sul server (AI_API_KEY mancante su Render)');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: user }] }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'chiave API non valida' : res.status === 404 ? `modello non trovato (${model})` : res.status === 429 ? 'limite di richieste raggiunto' : `errore ${res.status}`);
      }
      const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
      return {
        output: (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim(),
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw new Error('timeout (90s)');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Motore effettivo dell'agente (null = non eseguibile da qui). */
  private async resolveModel(agent: AgentRow): Promise<string | null> {
    if (agent.engine === 'none' || agent.engine === 'elevenlabs') return null;
    const engine = agent.engine?.startsWith('claude') ? agent.engine : await this.configString('agent_default_model', 'claude-haiku-4-5');
    return agent.type === 'judge' ? await this.configString('agent_judge_model', engine) : engine;
  }

  private systemPromptOf(agent: AgentRow): string {
    return agent.systemPrompt?.trim()
      || `Sei "${agent.name}", un agente del sistema Metabole (reparto ${agent.department}).\nCOMPITO: ${agent.task}\nREGOLA VINCOLANTE (non violarla mai): ${agent.rule || 'nessuna regola aggiuntiva'}\nRispondi in italiano, in modo concreto e utilizzabile.`;
  }

  /**
   * PIPELINE GIUDICE (spec §2.2): i contenuti prodotti dagli agenti generativi/
   * redattori dei reparti marketing/comunicazione vengono valutati dal Giudice
   * PRIMA di qualsiasi uso: verdetto approva/rivedi/blocca + motivo, salvato
   * sull'esecuzione originale e loggato (audit difendibile). Il giro del Giudice
   * è a sua volta un AgentRun (costi tracciati). Best effort: se il Giudice non
   * è disponibile il contenuto resta SENZA verdetto (mai auto-approvato).
   */
  private async maybeJudge(agent: AgentRow, runId: string, output: string): Promise<{ verdict: string; reason: string } | null> {
    if (agent.type === 'judge') return null; // il Giudice non giudica sé stesso
    if (!['marketing', 'communication'].includes(agent.department)) return null;
    if (!['generative', 'writer'].includes(agent.type)) return null;
    if (!output.trim()) return null;

    const giudice = (await this.prisma.agent.findUnique({ where: { key: 'giudice' } })) as AgentRow | null;
    if (!giudice || giudice.archivedAt || !giudice.enabled) {
      await this.log(runId, 'warn', 'Giudice non disponibile: contenuto SENZA verdetto (non usare senza revisione umana).');
      return null;
    }
    // Budget del Giudice: se sforato, niente verdetto automatico (mai auto-approvare).
    const limit = giudice.monthlyBudgetCents ?? 0;
    if (limit > 0 && (await this.monthlySpentCents(giudice.id)) >= limit) {
      await this.log(runId, 'warn', 'Budget del Giudice superato: contenuto SENZA verdetto.');
      return null;
    }

    const model = (await this.resolveModel(giudice)) ?? 'claude-sonnet-5';
    const judgeRun = await this.prisma.agentRun.create({
      data: { agentId: giudice.id, status: 'running', model, inputRef: `giudizio su run ${runId} (${agent.key})` },
    });
    try {
      const system = this.systemPromptOf(giudice);
      const user =
`Valuta questo contenuto prodotto dall'agente "${agent.name}" (${agent.department}) PRIMA della pubblicazione.
Checklist: policy social (Meta/TikTok/Google: niente prima/dopo, niente seconda persona su attributi fisici, niente promesse a tempo), rischio ban, veridicità dei claim (claim di salute → va escalato al nutrizionista capo), coerenza brand Metabole ("persone vere + AI", "senza fame", trasparenza, 18+).
Rispondi SOLO con JSON minificato: {"verdetto":"approva"|"rivedi"|"blocca","motivo":"max 300 caratteri, concreto"}.

CONTENUTO DA VALUTARE:
${output.slice(0, 12_000)}`;
      const res = await this.callClaude(model, system, user);
      const cost = costCentsOf(model, res.inputTokens, res.outputTokens);
      // Parse tollerante del verdetto.
      let verdict = 'rivedi';
      let reason = 'verdetto non leggibile: rivedere a mano';
      const m = res.output.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const j = JSON.parse(m[0]) as { verdetto?: string; motivo?: string };
          if (j.verdetto && ['approva', 'rivedi', 'blocca'].includes(j.verdetto)) verdict = j.verdetto;
          if (j.motivo) reason = String(j.motivo).slice(0, 300);
        } catch { /* resta rivedi */ }
      }
      await this.prisma.agentRun.update({
        where: { id: judgeRun.id },
        data: { status: 'done', finishedAt: new Date(), outputRef: res.output.slice(0, 5_000), inputTokens: res.inputTokens, outputTokens: res.outputTokens, costCents: cost, verdict },
      });
      await this.prisma.agentRun.update({ where: { id: runId }, data: { verdict } });
      await this.log(runId, 'decision', `Giudice: ${verdict.toUpperCase()} — ${reason}`, { judgeRunId: judgeRun.id, verdict });
      await this.log(judgeRun.id, 'decision', `Verdetto su run ${runId}: ${verdict} — ${reason}`);
      return { verdict, reason };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.agentRun.update({ where: { id: judgeRun.id }, data: { status: 'error', finishedAt: new Date(), error: message.slice(0, 500) } });
      await this.log(runId, 'warn', `Giudice non riuscito (${message}): contenuto SENZA verdetto.`);
      return null;
    }
  }

  /** Guardie comuni: agente eseguibile? budget ok? Ritorna modello o lancia/marca. */
  private async guardAndModel(agent: AgentRow, runId: string | null, inputForBlockedRun: string): Promise<{ model: string; spentCents: number; limitCents: number }> {
    const model = await this.resolveModel(agent);
    if (!model) {
      throw new BadRequestException(
        agent.engine === 'elevenlabs'
          ? 'La voce (ElevenLabs) ha una pipeline dedicata: non si esegue da qui.'
          : 'Questo agente è deterministico (nessun LLM): non si esegue da qui.',
      );
    }
    const limitCents = agent.monthlyBudgetCents ?? 0;
    const spentCents = limitCents > 0 ? await this.monthlySpentCents(agent.id) : 0;
    if (limitCents > 0 && spentCents >= limitCents) {
      const blocked = runId
        ? await this.prisma.agentRun.update({ where: { id: runId }, data: { status: 'blocked', finishedAt: new Date(), error: 'budget mensile superato' } })
        : await this.prisma.agentRun.create({ data: { agentId: agent.id, status: 'blocked', model, inputRef: inputForBlockedRun.slice(0, 2000), finishedAt: new Date(), error: 'budget mensile superato' } });
      await this.log(blocked.id, 'warn', `Esecuzione bloccata: budget mensile superato (${spentCents}/${limitCents} cent).`);
      throw new BadRequestException(
        `Budget mensile dell'agente superato (€ ${(spentCents / 100).toFixed(2)} su € ${(limitCents / 100).toFixed(2)}): alza il tetto o attendi il nuovo mese.`,
      );
    }
    return { model, spentCents, limitCents };
  }

  /** Cuore dell'esecuzione: run già in stato running → chiamata, costi, giudizio. */
  private async execute(agent: AgentRow, runId: string, model: string, input: string, spentCents: number, limitCents: number, actorUserId: string | null): Promise<AgentRunResult> {
    await this.log(runId, 'info', 'Esecuzione avviata', { actorUserId, model });
    try {
      const res = await this.callClaude(model, this.systemPromptOf(agent), input);
      const costCents = costCentsOf(model, res.inputTokens, res.outputTokens);
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: 'done', finishedAt: new Date(), outputRef: res.output.slice(0, 50_000), inputTokens: res.inputTokens, outputTokens: res.outputTokens, costCents },
      });
      await this.log(runId, 'info', 'Esecuzione completata', { inputTokens: res.inputTokens, outputTokens: res.outputTokens, costCents });
      if (actorUserId) {
        await this.audit.log({ action: 'agent.run', actorId: actorUserId, entityType: 'agent', entityId: agent.id, metadata: { runId, model, costCents } });
      }
      const judged = await this.maybeJudge(agent, runId, res.output);
      return {
        runId,
        status: 'done',
        output: res.output,
        model,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        costCents,
        humanInLoop: agent.humanInLoop,
        verdict: judged?.verdict ?? null,
        verdictReason: judged?.reason ?? null,
        budget: { spentCents: spentCents + costCents, limitCents },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.agentRun.update({ where: { id: runId }, data: { status: 'error', finishedAt: new Date(), error: message.slice(0, 500) } });
      await this.log(runId, 'error', `Esecuzione fallita: ${message}`);
      this.logger.warn(`Agente ${agent.key}: ${message}`);
      throw new BadRequestException(`Esecuzione non riuscita: ${message}.`);
    }
  }

  /** Esecuzione MANUALE sincrona (POST /agents/:id/run, responsabile marketing/admin). */
  async run(agentId: string, input: string, actorUserId: string): Promise<AgentRunResult> {
    const agent = (await this.prisma.agent.findUnique({ where: { id: agentId } })) as AgentRow | null;
    if (!agent || agent.archivedAt) throw new NotFoundException('Agente non trovato.');
    if (!agent.enabled) throw new BadRequestException('Questo agente è disattivato: riattivalo prima di eseguirlo.');
    const text = (input ?? '').trim();
    if (!text) throw new BadRequestException('Scrivi un input per l\'agente.');

    const { model, spentCents, limitCents } = await this.guardAndModel(agent, null, text);
    const run = await this.prisma.agentRun.create({ data: { agentId, status: 'running', model, inputRef: text.slice(0, 2000) } });
    return this.execute(agent, run.id, model, text, spentCents, limitCents, actorUserId);
  }

  /**
   * Esecuzione di una run GIÀ RECLAMATA dalla coda (l'orchestratore ha portato
   * queued → running). Non lancia mai: gli errori restano marcati sulla run.
   */
  async executeClaimedRun(runId: string): Promise<void> {
    const run = await this.prisma.agentRun.findUnique({ where: { id: runId } });
    if (!run || run.status !== 'running') return;
    const agent = (await this.prisma.agent.findUnique({ where: { id: run.agentId } })) as AgentRow | null;
    if (!agent || agent.archivedAt || !agent.enabled) {
      await this.prisma.agentRun.update({ where: { id: runId }, data: { status: 'error', finishedAt: new Date(), error: 'agente non disponibile' } });
      return;
    }
    const input = (run.inputRef ?? '').replace(CRON_INPUT_PREFIX, '').trim();
    if (!input) {
      await this.prisma.agentRun.update({ where: { id: runId }, data: { status: 'error', finishedAt: new Date(), error: 'input vuoto' } });
      return;
    }
    try {
      const { model, spentCents, limitCents } = await this.guardAndModel(agent, runId, input);
      await this.prisma.agentRun.update({ where: { id: runId }, data: { model } });
      await this.execute(agent, runId, model, input, spentCents, limitCents, null);
    } catch {
      // guardAndModel/execute hanno già marcato la run (blocked/error) e loggato.
    }
  }
}
