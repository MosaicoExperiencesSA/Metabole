import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { avvisaCapiNutrizionisti } from '../common/avvisa-nutrizionista';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEquivalenceGroupDto,
  UpdateEquivalenceGroupDto,
} from './dto/equivalence.dto';

/**
 * Gruppi di equivalenza (R4/R8): materia prima delle sostituzioni, di proprietà del
 * nutrizionista (workflow draft→approved, versionato). Safety-critical: la logica del
 * motore (E1) userà SOLO i gruppi `approved`. Qui è solo gestione dal backoffice.
 */
@Injectable()
export class EquivalenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Membri salvati come { items, note? } sul campo Json `members`. */
  private membersFrom(items?: string[], note?: string, prev?: { items?: string[]; note?: string }) {
    const nextItems = items ?? prev?.items ?? [];
    const nextNote = note !== undefined ? note : prev?.note;
    return { items: nextItems, ...(nextNote ? { note: nextNote } : {}) };
  }

  list(filter: { status?: string; productId?: string }) {
    return this.prisma.equivalenceGroup.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.productId ? { productId: filter.productId } : {}),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async get(id: string) {
    const g = await this.prisma.equivalenceGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Gruppo di equivalenza non trovato');
    return g;
  }

  async create(userId: string, dto: CreateEquivalenceGroupDto) {
    const created = await this.prisma.equivalenceGroup.create({
      data: {
        name: dto.name,
        productId: dto.productId ?? null,
        members: this.membersFrom(dto.items, dto.note) as never,
        status: dto.status ?? 'draft',
        version: 1,
      },
    });
    await this.audit.log({ action: 'equivalence.create', actorId: userId, entityType: 'equivalence_group', entityId: created.id });
    /**
     * L'AVVISO AL CAPO NUTRIZIONISTA (richiesta di Simone dell'11/8: «quando si creano sostituzioni
     * nuove o equivalenze nuove mandiamo una notifica al nutrizionista»).
     *
     * Un gruppo nuovo nasce in bozza e il motore **non lo usa** finché non è approvato: quindi
     * finché nessuno lo guarda, il lavoro di chi l'ha scritto non serve a niente e nessuno lo sa.
     * L'avviso non va a chi l'ha appena creato: dire a qualcuno quello che ha fatto lui trenta
     * secondi prima è il modo più rapido per insegnargli a ignorare le notifiche.
     */
    const items = ((created.members as unknown as { items?: string[] } | null)?.items ?? []).length;
    await avvisaCapiNutrizionisti(
      this.prisma,
      this.notifications,
      {
        type: 'equivalence_group_new',
        title: created.status === 'approved' ? 'Nuovo gruppo di equivalenza' : 'Gruppo di equivalenza da approvare',
        body:
          `«${created.name}» (${items} aliment${items === 1 ? 'o' : 'i'})` +
          (created.status === 'approved'
            ? ' è stato creato già approvato: il motore lo userà dal prossimo menu.'
            : ' è in bozza: il motore non lo usa finché non lo approvi.'),
        payload: { kind: 'equivalence_group_new', groupId: created.id, status: created.status },
      },
      userId,
    );
    return created;
  }

  async update(userId: string, id: string, dto: UpdateEquivalenceGroupDto) {
    const existing = await this.get(id);
    const prev = (existing.members as unknown as { items?: string[]; note?: string } | null) ?? {};
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.productId !== undefined) data.productId = dto.productId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.items !== undefined || dto.note !== undefined) {
      data.members = this.membersFrom(dto.items, dto.note, prev);
    }
    const updated = await this.prisma.equivalenceGroup.update({ where: { id }, data: data as never });
    await this.audit.log({ action: 'equivalence.update', actorId: userId, entityType: 'equivalence_group', entityId: id });
    return updated;
  }

  /** Approvazione: il gruppo diventa utilizzabile dal motore. Bump di versione. */
  async approve(userId: string, id: string) {
    const existing = await this.get(id);
    const updated = await this.prisma.equivalenceGroup.update({
      where: { id },
      data: { status: 'approved', version: (existing.version ?? 1) + 1 } as never,
    });
    await this.audit.log({ action: 'equivalence.approve', actorId: userId, entityType: 'equivalence_group', entityId: id });
    return updated;
  }

  /** Riporta in bozza (es. per revisione). */
  async unapprove(userId: string, id: string) {
    await this.get(id);
    const updated = await this.prisma.equivalenceGroup.update({ where: { id }, data: { status: 'draft' } as never });
    await this.audit.log({ action: 'equivalence.unapprove', actorId: userId, entityType: 'equivalence_group', entityId: id });
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.get(id);
    await this.prisma.equivalenceGroup.delete({ where: { id } });
    await this.audit.log({ action: 'equivalence.delete', actorId: userId, entityType: 'equivalence_group', entityId: id });
    return { ok: true };
  }
}
