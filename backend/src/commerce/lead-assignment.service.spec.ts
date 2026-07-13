import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeadAssignmentService } from './lead-assignment.service';

const make = (prisma: Record<string, unknown>, days = 2, notify = jest.fn()) => {
  const config = { getNumber: jest.fn(async (_k: string, def?: number) => days ?? def) } as unknown as ConfigParamsService;
  const notifications = { notify } as unknown as NotificationsService;
  const audit = { log: jest.fn() } as unknown as AuditService;
  return new LeadAssignmentService(prisma as unknown as PrismaService, notifications, audit, config);
};

describe('LeadAssignmentService.expireStale (finestra da config)', () => {
  it('fa scadere i lead oltre la finestra e avvisa la responsabile', async () => {
    const update = jest.fn().mockResolvedValue({});
    const notify = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      crmRecord: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', name: 'Anna', email: null, assignedBy: { userId: 'mgr-1' } },
        ]),
        update,
      },
    };
    const res = await make(prisma, 1, notify).expireStale();
    expect(res).toEqual({ expired: 1 });
    // la query filtra su assignedAt < cutoff (finestra di 1 giorno)
    const where = prisma.crmRecord.findMany.mock.calls[0][0].where;
    expect(where.assignmentStatus).toBe('pending');
    expect(where.assignedAt.lt).toBeInstanceOf(Date);
    // il record scaduto viene sganciato
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { assignmentStatus: null, assignedCoachId: null } }));
    // notifica alla responsabile con la soglia giusta (1 giorno)
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'lead_assignment_expired' }));
    expect(notify.mock.calls[0][0].body).toContain('1 giorno');
  });

  it('nessun lead scaduto → nessuna notifica', async () => {
    const notify = jest.fn();
    const prisma = { crmRecord: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() } };
    const res = await make(prisma, 3, notify).expireStale();
    expect(res).toEqual({ expired: 0 });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('LeadAssignmentService.myInvite', () => {
  it('riusa il ref code esistente e compone il link di registrazione', async () => {
    const prisma = {
      staff: { findFirst: jest.fn().mockResolvedValue({ id: 's1', refCode: 'ABC123' }), update: jest.fn() },
    };
    const res = await make(prisma).myInvite('coach-1');
    expect(res.refCode).toBe('ABC123');
    expect(res.url).toContain('/register?ref=ABC123');
    expect(prisma.staff.update).not.toHaveBeenCalled();
  });

  it('genera il ref code se manca', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      staff: {
        findFirst: jest.fn().mockResolvedValue({ id: 's1', refCode: null }),
        findUnique: jest.fn().mockResolvedValue(null),
        update,
      },
    };
    const res = await make(prisma).myInvite('coach-1');
    expect(res.refCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(update).toHaveBeenCalled();
  });

  it('solo per le coach', async () => {
    const prisma = { staff: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(make(prisma).myInvite('x')).rejects.toThrow('coach');
  });
});
