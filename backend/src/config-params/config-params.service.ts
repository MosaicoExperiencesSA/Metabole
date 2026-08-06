import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async getBool(key: string, fallback?: boolean): Promise<boolean> {
    const raw = await this.getString(key, fallback === undefined ? undefined : String(fallback));
    return raw === 'true' || raw === '1';
  }

  async list() {
    return this.prisma.configParam.findMany({ orderBy: { key: 'asc' } });
  }

  /**
   * CREA un parametro nuovo. Serviva: finora esistevano solo lettura e aggiornamento di righe
   * che dovevano già esistere, quindi la promessa «configurabile dal backoffice» era vera solo
   * se qualcuno si ricordava di aggiungere la chiave al seed. Quando se ne dimenticava, il
   * sistema usava un default scritto nel codice e non lo diceva a nessuno: è successo due volte
   * (parametri del fabbisogno kcal, modello email delle credenziali).
   */
  async create(
    input: { key: string; value: string; type?: string; description?: string },
    actorId: string,
  ) {
    const key = (input.key ?? '').trim();
    if (!/^[a-z][a-z0-9_]{2,59}$/.test(key)) {
      throw new BadRequestException('Chiave non valida: minuscole, numeri e underscore, da 3 a 60 caratteri (es. menu_days_delivered).');
    }
    if ((input.value ?? '').trim() === '') throw new BadRequestException('Il valore non può essere vuoto.');
    const exists = await this.prisma.configParam.findUnique({ where: { key }, select: { key: true } });
    if (exists) throw new ConflictException(`Il parametro "${key}" esiste già: modificalo dall'elenco.`);
    const type = ['number', 'string', 'boolean', 'json'].includes(input.type ?? '') ? (input.type as string) : 'string';
    const created = await this.prisma.configParam.create({
      data: { key, value: input.value, type: type as never, description: input.description?.trim() || null, updatedById: actorId } as never,
    });
    this.cache.delete(key);
    await this.audit.log({
      action: 'config_param.create',
      actorId,
      entityType: 'config_param',
      entityId: key,
      metadata: { value: input.value, type },
    });
    return created;
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
