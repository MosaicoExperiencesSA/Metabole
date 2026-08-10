/**
 * LO STORICO DELLE ASSEGNAZIONI — i quattro buchi che il flag «mostra accettati» ha reso visibili.
 *
 * Simone, l'11/8: «mettere il flag "mostra accettati" con la cronologia, quindi tutti i dati vanno
 * archiviati». Il flag era la parte facile: la cronologia non c'era, perché ogni passaggio
 * sovrascriveva il precedente. Questi test fissano le quattro cose che prima si perdevano, e sono
 * scritti sull'ORDINE delle operazioni più che sul risultato: il difetto non era «non salva», era
 * «salva dopo aver cancellato il dato che doveva salvare».
 */
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeadAssignmentService } from './lead-assignment.service';

/** Costruisce il servizio registrando la SEQUENZA delle chiamate, non solo il fatto che ci siano. */
function make(prisma: Record<string, unknown>, opts: { days?: number } = {}) {
  const sequenza: string[] = [];
  const config = { getNumber: jest.fn(async (_k: string, def?: number) => opts.days ?? def) } as unknown as ConfigParamsService;
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
  const audit = { log: jest.fn(), logMany: jest.fn() } as unknown as AuditService;
  const svc = new LeadAssignmentService(prisma as unknown as PrismaService, notifications, audit, config);
  return { svc, audit, notifications, sequenza };
}

/** Prisma finto minimo: staff con un nome, e i due metodi dello storico. */
function prismaBase(over: Record<string, unknown> = {}) {
  return {
    staff: {
      findUnique: jest.fn().mockResolvedValue({ id: 'coach-1', displayName: 'Anna Coach' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'coach-1', displayName: 'Anna Coach', user: { id: 'u-coach' } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    leadAssignment: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }) },
    ...over,
  };
}

describe('rifiuto: chi ha rifiutato resta scritto', () => {
  it('chiude lo storico PRIMA di azzerare la coach sul lead, e conserva il motivo', async () => {
    const ordine: string[] = [];
    const prisma = prismaBase({
      crmRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r1', name: 'Giulia', email: null, assignmentStatus: 'pending',
          assignedCoachId: 'coach-1', assignedBy: { userId: 'mgr-1' },
        }),
        update: jest.fn().mockImplementation(async () => { ordine.push('azzera-lead'); return {}; }),
      },
    });
    (prisma.leadAssignment.updateMany as jest.Mock).mockImplementation(async () => { ordine.push('chiudi-storico'); return { count: 1 }; });

    const { svc } = make(prisma);
    await svc.reject('r1', 'u-coach', 'Non è del mio zona');

    // L'ordine è la sostanza: dopo `update` il lead non sa più chi era la coach.
    expect(ordine).toEqual(['chiudi-storico', 'azzera-lead']);
    expect(prisma.leadAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recordId: 'r1', status: 'pending' },
        data: expect.objectContaining({ status: 'rejected', reason: 'Non è del mio zona' }),
      }),
    );
  });
});

describe('scadenza automatica: il lead torna alla responsabile e si sa perché', () => {
  it('scrive l\'audit della scadenza (prima non esisteva) e chiude lo storico come «expired»', async () => {
    const prisma = prismaBase({
      crmRecord: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Anna', email: null, assignedBy: { userId: 'mgr-1' } }]),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const { svc, audit } = make(prisma, { days: 1 });
    const res = await svc.expireStale();

    expect(res).toEqual({ expired: 1 });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'crm.lead.assign_expired', entityId: 'r1', metadata: { days: 1 } }),
    );
    expect(prisma.leadAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recordId: 'r1', status: 'pending' }, data: expect.objectContaining({ status: 'expired' }) }),
    );
  });
});

describe('assegnazione in massa: la storia di tutti, non solo del primo', () => {
  it('una riga di audit e una di storico per OGNI lead', async () => {
    const prisma = prismaBase({
      crmRecord: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    });
    const { svc, audit } = make(prisma);
    const res = await svc.assignCoachMany(['r1', 'r2', 'r3'], 'coach-1', 'u-mgr');

    expect(res.assigned).toBe(3);
    // Prima: UNA riga con entityId = r1, e le schede di r2 e r3 dicevano «nessuno ti ha assegnato».
    const righe = (audit.logMany as jest.Mock).mock.calls[0][0] as { entityId: string; metadata: { count: number } }[];
    expect(righe.map((r) => r.entityId)).toEqual(['r1', 'r2', 'r3']);
    expect(righe.every((r) => r.metadata.count === 3)).toBe(true);
    expect((prisma.leadAssignment.create as jest.Mock).mock.calls.map((c) => c[0].data.recordId)).toEqual(['r1', 'r2', 'r3']);
    // Nate in massa: nello storico si distingue da un'assegnazione fatta una per una.
    expect((prisma.leadAssignment.create as jest.Mock).mock.calls[0][0].data.origin).toBe('bulk');
  });
});

describe('riassegnazione mentre è ancora in attesa', () => {
  it('la vecchia riga si chiude come «reassigned» invece di restare aperta', async () => {
    const prisma = prismaBase({
      crmRecord: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r1', name: 'Giulia', email: null, assignedCoachId: 'coach-0' }),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const { svc } = make(prisma);
    await svc.assignCoach('r1', 'coach-1', 'u-mgr');

    expect(prisma.leadAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recordId: 'r1', status: 'pending' }, data: expect.objectContaining({ status: 'reassigned' }) }),
    );
    const creata = (prisma.leadAssignment.create as jest.Mock).mock.calls[0][0].data;
    expect(creata.status).toBe('pending');
    // Il nome è COPIATO: se la scheda staff sparisce, lo storico continua a dire chi era.
    expect(creata.coachName).toBe('Anna Coach');
    expect(creata.resolvedAt).toBeNull();
  });

  it('il ref code entra nello storico già accettato, e marcato per come è nato', async () => {
    const prisma = prismaBase({
      crmRecord: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'cli-1' }), update: jest.fn().mockResolvedValue({}), upsert: jest.fn().mockResolvedValue({}) },
    });
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
      id: 'coach-1', displayName: 'Anna Coach', refCode: 'ANNA01', user: { id: 'u-coach', role: 'coach' },
    });
    const { svc } = make(prisma);
    const ok = await svc.autoAssignByRefCode('cli-1', 'ANNA01');

    expect(ok).toBe(true);
    const creata = (prisma.leadAssignment.create as jest.Mock).mock.calls[0][0].data;
    expect(creata.origin).toBe('ref_code');
    expect(creata.status).toBe('accepted');
    // Nasce e si chiude nello stesso istante: non c'è nessuna attesa da rappresentare.
    expect(creata.resolvedAt).not.toBeNull();
    expect(creata.assignedById).toBeNull();
  });
});
