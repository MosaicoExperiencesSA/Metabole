import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { VisitsService } from './visits.service';

/**
 * Note cliniche: SOLO nutrizionista assegnato e capo (spec sez. 4).
 * Mai coach, mai commerciale, mai admin. Ogni lettura è tracciata.
 */
@Injectable()
export class ClinicalNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  async list(user: AuthUser, clientId: string) {
    await this.visits.assertPatientAccess(user, clientId);
    await this.audit.log({
      action: 'health.notes.read',
      actorId: user.sub,
      entityType: 'clinical_note',
      metadata: { clientId },
    });
    return this.prisma.clinicalNote.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      include: { nutritionist: { select: { displayName: true } } },
    });
  }

  async create(user: AuthUser, clientId: string, text: string) {
    const staff = await this.visits.assertPatientAccess(user, clientId);
    const note = await this.prisma.clinicalNote.create({
      data: { clientId, nutritionistId: staff.id, text },
    });
    await this.audit.log({
      action: 'health.notes.create',
      actorId: user.sub,
      entityType: 'clinical_note',
      entityId: note.id,
      metadata: { clientId },
    });
    return note;
  }
}
