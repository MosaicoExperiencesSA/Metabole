import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export const AGENT_TYPES = ['conversational', 'generative', 'judge', 'rag', 'planner', 'analyst', 'writer', 'orchestrator', 'tts', 'deterministic'] as const;
export const AGENT_DEPARTMENTS = ['app', 'marketing', 'communication', 'crm', 'system'] as const;
export const AGENT_ENGINES = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8', 'elevenlabs', 'none'] as const;

export interface AgentInput {
  key?: string;
  name?: string;
  type?: string;
  department?: string;
  task?: string;
  rule?: string;
  engine?: string;
  systemPrompt?: string | null;
  enabled?: boolean;
  humanInLoop?: boolean;
  monthlyBudgetCents?: number;
}

/**
 * Registro degli Agenti AI (Metabole_Agenti_AI_Spec_Sviluppo.md): la sezione
 * backoffice "Agenti" fa CRUD qui. Il runtime (orchestratore/esecuzioni) arriverà
 * in una fase successiva: AgentRun/AgentLog sono già pronti per i costi e l'audit.
 */
@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Slug dalla stringa (per la key di un nuovo agente). */
  private slug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }

  async list(includeArchived = false) {
    const rows = await this.prisma.agent.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });
    return rows;
  }

  async create(input: AgentInput, actorId: string) {
    const name = (input.name ?? '').trim();
    if (name.length < 2) throw new BadRequestException('Dai un nome all\'agente.');
    if (!AGENT_TYPES.includes((input.type ?? '') as never)) throw new BadRequestException('Tipo agente non valido.');
    if (!AGENT_DEPARTMENTS.includes((input.department ?? '') as never)) throw new BadRequestException('Reparto non valido.');
    if (!AGENT_ENGINES.includes((input.engine ?? '') as never)) throw new BadRequestException('Motore non valido.');
    if (!(input.task ?? '').trim()) throw new BadRequestException('Descrivi cosa fa l\'agente.');

    const key = (input.key ?? '').trim() || this.slug(name);
    if (!key) throw new BadRequestException('Chiave agente non valida.');
    const exists = await this.prisma.agent.findUnique({ where: { key }, select: { id: true } });
    if (exists) throw new BadRequestException('Esiste già un agente con questa chiave.');

    const created = await this.prisma.agent.create({
      data: {
        key,
        name,
        type: input.type as never,
        department: input.department as never,
        task: (input.task ?? '').trim(),
        rule: (input.rule ?? '').trim(),
        engine: input.engine as never,
        systemPrompt: input.systemPrompt ?? null,
        enabled: input.enabled ?? true,
        humanInLoop: input.humanInLoop ?? false,
        monthlyBudgetCents: Math.max(0, Math.round(input.monthlyBudgetCents ?? 0)),
        createdById: actorId,
      } as never,
    });
    await this.audit.log({ action: 'agent.create', actorId, entityType: 'agent', entityId: created.id, metadata: { key } });
    return created;
  }

  async update(id: string, input: AgentInput, actorId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Agente non trovato.');
    if (input.type !== undefined && !AGENT_TYPES.includes(input.type as never)) throw new BadRequestException('Tipo agente non valido.');
    if (input.department !== undefined && !AGENT_DEPARTMENTS.includes(input.department as never)) throw new BadRequestException('Reparto non valido.');
    if (input.engine !== undefined && !AGENT_ENGINES.includes(input.engine as never)) throw new BadRequestException('Motore non valido.');

    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.task !== undefined ? { task: input.task.trim() } : {}),
        ...(input.rule !== undefined ? { rule: input.rule.trim() } : {}),
        ...(input.engine !== undefined ? { engine: input.engine } : {}),
        ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt || null } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.humanInLoop !== undefined ? { humanInLoop: input.humanInLoop } : {}),
        ...(input.monthlyBudgetCents !== undefined ? { monthlyBudgetCents: Math.max(0, Math.round(input.monthlyBudgetCents)) } : {}),
      },
    });
    await this.audit.log({ action: 'agent.update', actorId, entityType: 'agent', entityId: id });
    return updated;
  }

  /** Soft delete: l'agente sparisce dalla lista ma resta per audit/storico costi. */
  async archive(id: string, actorId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
    if (!agent) throw new NotFoundException('Agente non trovato.');
    if (agent.archivedAt) throw new BadRequestException('Agente già archiviato.');
    await this.prisma.agent.update({ where: { id }, data: { archivedAt: new Date(), enabled: false } });
    await this.audit.log({ action: 'agent.archive', actorId, entityType: 'agent', entityId: id });
    return { archived: true };
  }

  /** Storico esecuzioni di un agente (costi/verdetti). Vuoto finché il runtime non è attivo. */
  async runs(id: string, limit = 50) {
    const agent = await this.prisma.agent.findUnique({ where: { id }, select: { id: true } });
    if (!agent) throw new NotFoundException('Agente non trovato.');
    return this.prisma.agentRun.findMany({
      where: { agentId: id },
      orderBy: { startedAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  /** Aggregato costi per agente/reparto (alimenta la dashboard costi). */
  async costs(from?: string, to?: string) {
    const gte = from && !Number.isNaN(Date.parse(from)) ? new Date(from) : new Date(Date.now() - 30 * 86_400_000);
    const lte = to && !Number.isNaN(Date.parse(to)) ? new Date(to) : new Date();
    const grouped = await this.prisma.agentRun.groupBy({
      by: ['agentId'],
      where: { startedAt: { gte, lte } },
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    });
    const agents = await this.prisma.agent.findMany({ select: { id: true, key: true, name: true, department: true, monthlyBudgetCents: true } });
    type Ag = { id: string; key: string; name: string; department: string; monthlyBudgetCents: number };
    type Row = { agentId: string; _sum: { costCents: number | null; inputTokens: number | null; outputTokens: number | null }; _count: { _all: number } };
    const byId = new Map((agents as Ag[]).map((a) => [a.id, a]));
    const items = (grouped as Row[]).map((g) => ({
      agentId: g.agentId,
      key: byId.get(g.agentId)?.key ?? null,
      name: byId.get(g.agentId)?.name ?? 'Agente rimosso',
      department: byId.get(g.agentId)?.department ?? null,
      monthlyBudgetCents: byId.get(g.agentId)?.monthlyBudgetCents ?? 0,
      runs: g._count._all,
      costCents: g._sum.costCents ?? 0,
      inputTokens: g._sum.inputTokens ?? 0,
      outputTokens: g._sum.outputTokens ?? 0,
    }));
    const totalCents = items.reduce((sum, i) => sum + i.costCents, 0);
    return { from: gte.toISOString(), to: lte.toISOString(), totalCents, items };
  }
}
