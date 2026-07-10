import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface DiscountResult {
  codeId: string;
  code: string;
  discountCents: number;
  finalCents: number;
}

/**
 * Buoni sconto: percentuale o importo fisso, con tetto di utilizzi totali e per
 * cliente. La validate() calcola lo sconto; la redeem() registra l'utilizzo
 * (chiamata all'esito positivo del pagamento).
 */
@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  }

  async create(
    input: { code: string; type: 'percent' | 'fixed'; value: number; maxTotalUses?: number | null; maxPerClient?: number; expiresAt?: string | null },
    actorId: string,
  ) {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9._-]{3,32}$/.test(code)) {
      throw new BadRequestException('Codice non valido (3-32 caratteri: lettere, numeri, . _ -).');
    }
    if (input.type === 'percent' && (input.value <= 0 || input.value > 100)) {
      throw new BadRequestException('La percentuale deve essere tra 1 e 100.');
    }
    if (input.type === 'fixed' && input.value <= 0) {
      throw new BadRequestException("L'importo dello sconto deve essere maggiore di zero.");
    }
    const exists = await this.prisma.discountCode.findUnique({ where: { code } });
    if (exists) throw new BadRequestException('Esiste già un buono con questo codice.');

    const created = await this.prisma.discountCode.create({
      data: {
        code,
        type: input.type,
        value: input.value,
        maxTotalUses: input.maxTotalUses ?? null,
        maxPerClient: input.maxPerClient && input.maxPerClient > 0 ? input.maxPerClient : 1,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: actorId,
      },
    });
    await this.audit.log({ action: 'discount.create', actorId, entityType: 'discount_code', entityId: created.id });
    return created;
  }

  async setActive(id: string, active: boolean, actorId: string) {
    const c = await this.prisma.discountCode.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Buono non trovato.');
    const updated = await this.prisma.discountCode.update({ where: { id }, data: { active } });
    await this.audit.log({ action: active ? 'discount.activate' : 'discount.deactivate', actorId, entityType: 'discount_code', entityId: id });
    return updated;
  }

  async remove(id: string, actorId: string) {
    const c = await this.prisma.discountCode.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!c) throw new NotFoundException('Buono non trovato.');
    if ((c as unknown as { _count: { redemptions: number } })._count.redemptions > 0) {
      throw new BadRequestException('Buono già utilizzato: disattivalo invece di eliminarlo.');
    }
    await this.prisma.discountCode.delete({ where: { id } });
    await this.audit.log({ action: 'discount.delete', actorId, entityType: 'discount_code', entityId: id });
    return { removed: id };
  }

  /** Valida un codice per un cliente e un importo; ritorna lo sconto calcolato. */
  async validate(codeStr: string, clientId: string, amountCents: number): Promise<DiscountResult> {
    const code = (codeStr ?? '').trim().toUpperCase();
    const dc = await this.prisma.discountCode.findUnique({ where: { code } });
    if (!dc || !dc.active) throw new BadRequestException('Buono sconto non valido.');
    if (dc.expiresAt && dc.expiresAt.getTime() < Date.now()) throw new BadRequestException('Buono sconto scaduto.');
    if (dc.maxTotalUses != null && dc.usedCount >= dc.maxTotalUses) throw new BadRequestException('Buono sconto esaurito.');
    const usedByClient = await this.prisma.discountRedemption.count({ where: { codeId: dc.id, clientId } });
    if (usedByClient >= dc.maxPerClient) {
      throw new BadRequestException('Hai già usato questo buono il numero massimo di volte.');
    }
    let discountCents = dc.type === 'percent' ? Math.round((amountCents * dc.value) / 100) : dc.value;
    if (discountCents > amountCents) discountCents = amountCents; // mai sotto zero
    return { codeId: dc.id, code: dc.code, discountCents, finalCents: amountCents - discountCents };
  }

  /** Registra l'utilizzo del buono (all'esito positivo del pagamento). */
  async redeem(codeId: string, clientId: string, paymentId: string, discountCents: number) {
    await this.prisma.$transaction([
      this.prisma.discountCode.update({ where: { id: codeId }, data: { usedCount: { increment: 1 } } }),
      this.prisma.discountRedemption.create({ data: { codeId, clientId, paymentId, amountCents: discountCents } }),
    ]);
  }
}
