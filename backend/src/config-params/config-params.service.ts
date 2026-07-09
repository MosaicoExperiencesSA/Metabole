import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Accesso alle soglie del motore (tabella config_param).
 * Cache in memoria con TTL breve: i valori cambiano di rado ma non devono
 * mai essere hardcodati (specifica, sez. 0 e Appendice A).
 */
@Injectable()
export class ConfigParamsService {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly ttlMs = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getString(key: string, fallback?: string): Promise<string> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const row = await this.prisma.configParam.findUnique({ where: { key } });
    if (!row) {
      if (fallback !== undefined) return fallback;
      throw new NotFoundException(`Parametro di configurazione mancante: ${key}`);
    }
    this.cache.set(key, { value: row.value, expiresAt: Date.now() + this.ttlMs });
    return row.value;
  }

  async getNumber(key: string, fallback?: number): Promise<number> {
    const raw = await this.getString(key, fallback?.toString());
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      if (fallback !== undefined) return fallback;
      throw new NotFoundException(`Parametro ${key} non numerico: ${raw}`);
    }
    return parsed;
  }

  async list() {
    return this.prisma.configParam.findMany({ orderBy: { key: 'asc' } });
  }

  async update(key: string, value: string, actorId: string) {
    const existing = await this.prisma.configParam.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException(`Parametro inesistente: ${key}`);
    const updated = await this.prisma.configParam.update({
      where: { key },
      data: { value, updatedById: actorId },
    });
    this.cache.delete(key);
    await this.audit.log({
      action: 'admin.config.update',
      actorId,
      entityType: 'config_param',
      entityId: key,
      metadata: { from: existing.value, to: value },
    });
    return updated;
  }
}
