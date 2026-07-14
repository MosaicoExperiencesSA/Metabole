import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { BASE_RULES, ENGINE_RULES, ENGINE_RULE_BY_CODE, RULE_CATEGORIES } from './engine-rules.catalog';

/**
 * Gestione delle regole del motore per il CAPO NUTRIZIONISTA:
 * - regole GLOBALI (config_param) — attive subito sul motore;
 * - regole SUGGERITE per tipo di nutrizione (rule_preset, flag `suggested`) — modificabili/aggiungibili;
 * - applicazione di un preset a una DIETA (→ ProductRule, override per prodotto);
 * - PROPOSTE di regole nuove (rule_proposal) che poi implementiamo noi.
 */
@Injectable()
export class EngineRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  private coerce(code: string, raw: unknown): { value: number | boolean; asString: string } {
    const rule = ENGINE_RULE_BY_CODE.get(code);
    if (!rule) throw new BadRequestException(`Regola sconosciuta: ${code}`);
    if (rule.kind === 'boolean') {
      const value = raw === true || raw === 'true' || raw === 1 || raw === '1';
      return { value, asString: value ? 'true' : 'false' };
    }
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) throw new BadRequestException(`Valore non numerico per ${code}`);
    if (rule.min != null && n < rule.min) throw new BadRequestException(`${code}: minimo ${rule.min}`);
    if (rule.max != null && n > rule.max) throw new BadRequestException(`${code}: massimo ${rule.max}`);
    return { value: n, asString: String(n) };
  }

  /** Catalogo completo: metadati regole + valore globale attuale + categorie. */
  async catalog() {
    const params = (await this.prisma.configParam.findMany({
      where: { key: { in: ENGINE_RULES.map((r) => r.code) } },
      select: { key: true, value: true },
    })) as { key: string; value: string }[];
    const byKey = new Map(params.map((p) => [p.key, p.value]));
    const rules = ENGINE_RULES.map((r) => {
      const raw = byKey.get(r.code);
      let global: number | boolean = r.default;
      if (raw != null) global = r.kind === 'boolean' ? raw === 'true' : Number(raw);
      return { ...r, global, isSet: raw != null };
    });
    return { categories: RULE_CATEGORIES, rules, baseRules: BASE_RULES };
  }

  /** Imposta il valore GLOBALE di una regola (config_param). Attivo subito sul motore.
   *  Se il parametro non è ancora a DB (es. soglie agente coi soli default nel codice) lo crea. */
  async setGlobal(code: string, raw: unknown, actorId: string) {
    const rule = ENGINE_RULE_BY_CODE.get(code)!;
    const { value, asString } = this.coerce(code, raw);
    const exists = await this.prisma.configParam.findUnique({ where: { key: code }, select: { key: true } });
    if (exists) {
      await this.configParams.update(code, asString, actorId); // invalida anche la cache
    } else {
      await this.prisma.configParam.create({
        data: { key: code, value: asString, type: rule.kind === 'boolean' ? 'boolean' : 'number', description: rule.label, updatedById: actorId } as never,
      });
    }
    await this.audit.log({ action: 'engine_rule.global.set', actorId, entityType: 'engine_rule', entityId: code, metadata: { value } });
    return { code, value };
  }

  // ---------- Preset suggeriti per tipo di nutrizione ----------

  listPresets() {
    return this.prisma.rulePreset.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
  }

  private cleanRules(rules: Record<string, unknown> | undefined): Record<string, number | boolean> {
    const out: Record<string, number | boolean> = {};
    for (const [code, v] of Object.entries(rules ?? {})) {
      if (!ENGINE_RULE_BY_CODE.has(code)) continue; // ignora codici non nel catalogo
      out[code] = this.coerce(code, v).value;
    }
    return out;
  }

  async createPreset(
    input: { style: string; label: string; description?: string; regime?: string | null; objective?: string | null; rules?: Record<string, unknown>; clinicalNotes?: string; source?: string; suggested?: boolean },
    actorId: string,
  ) {
    if (!input.style?.trim() || !input.label?.trim()) throw new BadRequestException('Stile ed etichetta obbligatori.');
    const created = await this.prisma.rulePreset.create({
      data: {
        style: input.style.trim(),
        label: input.label.trim(),
        description: input.description ?? null,
        regime: input.regime ?? null,
        objective: input.objective ?? null,
        rules: this.cleanRules(input.rules) as never,
        clinicalNotes: input.clinicalNotes ?? null,
        source: input.source ?? null,
        suggested: input.suggested ?? false, // creata a mano = adottata, non "suggerita da noi"
      } as never,
    });
    await this.audit.log({ action: 'engine_rule.preset.create', actorId, entityType: 'rule_preset', entityId: created.id });
    return created;
  }

  async updatePreset(
    id: string,
    input: { label?: string; description?: string; regime?: string | null; objective?: string | null; rules?: Record<string, unknown>; clinicalNotes?: string; source?: string; suggested?: boolean },
    actorId: string,
  ) {
    const existing = await this.prisma.rulePreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Preset non trovato.');
    const updated = await this.prisma.rulePreset.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.regime !== undefined ? { regime: input.regime || null } : {}),
        ...(input.objective !== undefined ? { objective: input.objective || null } : {}),
        ...(input.rules !== undefined ? { rules: this.cleanRules(input.rules) as never } : {}),
        ...(input.clinicalNotes !== undefined ? { clinicalNotes: input.clinicalNotes || null } : {}),
        ...(input.source !== undefined ? { source: input.source || null } : {}),
        // modificare una suggerita la marca come adottata (non più "suggerita da noi")
        suggested: input.suggested ?? false,
      },
    });
    await this.audit.log({ action: 'engine_rule.preset.update', actorId, entityType: 'rule_preset', entityId: id });
    return updated;
  }

  async deletePreset(id: string, actorId: string) {
    const existing = await this.prisma.rulePreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Preset non trovato.');
    await this.prisma.rulePreset.delete({ where: { id } });
    await this.audit.log({ action: 'engine_rule.preset.delete', actorId, entityType: 'rule_preset', entityId: id });
    return { ok: true };
  }

  /** Applica un preset a una dieta: scrive gli override per prodotto (ProductRule). */
  async applyPresetToDiet(presetId: string, dietId: string, actorId: string) {
    const preset = await this.prisma.rulePreset.findUnique({ where: { id: presetId } });
    if (!preset) throw new NotFoundException('Preset non trovato.');
    const diet = await this.prisma.diet.findUnique({ where: { id: dietId }, select: { id: true } });
    if (!diet) throw new NotFoundException('Dieta non trovata.');
    const rules = (preset.rules ?? {}) as Record<string, number | boolean>;
    let applied = 0;
    for (const [code, value] of Object.entries(rules)) {
      const rule = ENGINE_RULE_BY_CODE.get(code);
      if (!rule) continue;
      const enabled = rule.kind === 'boolean' ? Boolean(value) : true;
      await this.prisma.productRule.upsert({
        where: { dietId_ruleCode: { dietId, ruleCode: code } },
        create: { dietId, ruleCode: code, enabled, params: { value } as never },
        update: { enabled, params: { value } as never },
      });
      applied++;
    }
    await this.audit.log({ action: 'engine_rule.preset.apply', actorId, entityType: 'diet', entityId: dietId, metadata: { presetId, applied } });
    return { applied };
  }

  // ---------- Proposte di regole nuove ----------

  listProposals() {
    return this.prisma.ruleProposal.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async createProposal(input: { title?: string; text: string; dietId?: string | null }, actorId: string) {
    if (!input.text?.trim()) throw new BadRequestException('Descrivi la regola che vuoi proporre.');
    const created = await this.prisma.ruleProposal.create({
      data: { title: input.title?.trim() || null, text: input.text.trim(), dietId: input.dietId ?? null, proposedBy: actorId, status: 'pending' } as never,
    });
    await this.audit.log({ action: 'engine_rule.proposal.create', actorId, entityType: 'rule_proposal', entityId: created.id });
    return created;
  }

  async setProposalStatus(id: string, status: 'pending' | 'approved' | 'rejected', actorId: string) {
    const existing = await this.prisma.ruleProposal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proposta non trovata.');
    const updated = await this.prisma.ruleProposal.update({ where: { id }, data: { status } });
    await this.audit.log({ action: 'engine_rule.proposal.status', actorId, entityType: 'rule_proposal', entityId: id, metadata: { status } });
    return updated;
  }
}
