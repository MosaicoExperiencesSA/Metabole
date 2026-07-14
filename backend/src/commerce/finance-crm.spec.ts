import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { CrmService } from './crm.service';
import { PipelineService } from './pipeline.service';
import { FinanceService } from './finance.service';

describe('FinanceService (eventi economici automatici)', () => {
  let service: FinanceService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      ledgerEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn(),
      },
      staffCompensation: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      pendingCommission: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      staff: {
        findUnique: jest.fn().mockResolvedValue({ managerId: 'staff-hn' }),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          assignedCoachId: 'staff-c',
          assignedNutritionistId: 'staff-n',
          assignedCoach: { managerId: 'staff-mc' },
          assignedNutritionist: { managerId: 'staff-hn' },
        }),
      },
      // Le provvigioni ora sono importi in € sul PIANO dell'abbonamento (non %).
      // Piano da 297€ con quote: coach 29,70 · mgr 8,91 · nutri 44,55 · capo 14,85.
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          subscription: {
            plan: {
              priceCents: 29700,
              commissionCoachCents: 2970,
              commissionManagerCoachCents: 891,
              commissionNutritionistCents: 4455,
              commissionHeadNutritionistCents: 1485,
            },
          },
          order: null,
        }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigParamsService,
          useValue: {
            getNumber: jest.fn((key: string) =>
              Promise.resolve(({ visit_compensation_amount_cents: 4000 } as Record<string, number>)[key]),
            ),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(FinanceService);
  });

  it('provvigioni a catena dagli importi € del piano: coach 29,70 + mgr 8,91 + nutri 44,55 + capo 14,85, expense a ledger', async () => {
    await service.generateCommissions({ id: 'pay-1', clientId: 'c1', amountCents: 29700 });
    const upserts = prisma.staffCompensation.upsert.mock.calls.map((c: any) => c[0].create);
    expect(upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ staffId: 'staff-c', amountCents: 2970 }),
        expect.objectContaining({ staffId: 'staff-mc', amountCents: 891 }),
        expect.objectContaining({ staffId: 'staff-n', amountCents: 4455 }),
        expect.objectContaining({ staffId: 'staff-hn', amountCents: 1485 }),
      ]),
    );
    const ledger = prisma.ledgerEntry.create.mock.calls.map((c: any) => c[0].data);
    expect(ledger.every((l: any) => l.type === 'expense' && l.category === 'sales_commission')).toBe(true);
  });

  it('provvigioni: senza responsabile paga solo coach e nutrizionista', async () => {
    prisma.clientProfile.findUnique.mockResolvedValueOnce({
      assignedCoachId: 'staff-c',
      assignedNutritionistId: 'staff-n',
      assignedCoach: { managerId: null },
      assignedNutritionist: { managerId: null },
    });
    prisma.payment.findUnique.mockResolvedValueOnce({
      subscription: { plan: { priceCents: 10000, commissionCoachCents: 1000, commissionManagerCoachCents: 300, commissionNutritionistCents: 1500, commissionHeadNutritionistCents: 500 } },
      order: null,
    });
    await service.generateCommissions({ id: 'pay-2', clientId: 'c1', amountCents: 10000 });
    const staffIds = prisma.staffCompensation.upsert.mock.calls.map((c: any) => c[0].create.staffId);
    expect(staffIds).toEqual(expect.arrayContaining(['staff-c', 'staff-n']));
    expect(staffIds).not.toContain('staff-mc');
    expect(staffIds).not.toContain('staff-hn');
  });

  it('accantona: nutrizionista non assegnato → provvigioni in sospeso, non pagate subito', async () => {
    prisma.clientProfile.findUnique.mockResolvedValueOnce({
      assignedCoachId: 'staff-c',
      assignedNutritionistId: null,
      assignedCoach: { managerId: 'staff-mc' },
      assignedNutritionist: null,
    });
    prisma.payment.findUnique.mockResolvedValueOnce({
      subscription: { plan: { priceCents: 10000, commissionCoachCents: 1000, commissionManagerCoachCents: 300, commissionNutritionistCents: 1500, commissionHeadNutritionistCents: 500 } },
      order: null,
    });
    await service.generateCommissions({ id: 'pay-3', clientId: 'c1', amountCents: 10000 });
    // coach + manager pagati subito
    const staffIds = prisma.staffCompensation.upsert.mock.calls.map((c: any) => c[0].create.staffId);
    expect(staffIds).toEqual(expect.arrayContaining(['staff-c', 'staff-mc']));
    // nutrizionista + capo accantonati (importi € del piano)
    const pendings = prisma.pendingCommission.create.mock.calls.map((c: any) => c[0].data);
    expect(pendings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'nutritionist', amountCents: 1500, clientId: 'c1', paymentId: 'pay-3' }),
        expect.objectContaining({ role: 'head_nutritionist', amountCents: 500 }),
      ]),
    );
  });

  it('risolve: all\'assegnazione del nutrizionista paga gli accantonamenti', async () => {
    prisma.pendingCommission.findMany.mockResolvedValueOnce([
      { id: 'pc1', role: 'nutritionist', amountCents: 1500, paymentId: 'pay-3' },
      { id: 'pc2', role: 'head_nutritionist', amountCents: 500, paymentId: 'pay-3' },
    ]);
    prisma.staff.findUnique.mockResolvedValueOnce({ managerId: 'staff-hn' });
    await service.resolvePendingForAssignment('c1', 'nutritionist', 'staff-n');
    const staffIds = prisma.staffCompensation.upsert.mock.calls.map((c: any) => c[0].create.staffId);
    expect(staffIds).toEqual(expect.arrayContaining(['staff-n', 'staff-hn']));
    const paid = prisma.pendingCommission.update.mock.calls.map((c: any) => c[0].data.status);
    expect(paid.every((s: string) => s === 'paid')).toBe(true);
  });

  it('compenso visita: 40€ alla nutrizionista con expense a ledger', async () => {
    await service.creditVisitCompensation({ id: 'v1', clientId: 'c1', nutritionistId: 'staff-n' });
    expect(prisma.staffCompensation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ amountCents: 4000 }) }),
    );
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'visit_compensation' }) }),
    );
  });

  it('periodo esistente: incrementa senza duplicare', async () => {
    prisma.staffCompensation.findUnique.mockResolvedValue({ amountCents: 1000, items: [] });
    await service.creditStaff({ staffId: 'staff-n', amountCents: 500, kind: 'visit_compensation', ref: 'v2' });
    expect(prisma.staffCompensation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ amountCents: { increment: 500 } }) }),
    );
  });
});

describe('CrmService (data + responsabile su ogni transizione)', () => {
  let service: CrmService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      crmRecord: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'lead1', stageDates: { lead_in: { at: 'x', byUserId: null } } }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'lead1', ...data })),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'lead1', ...data })),
        findMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([
          { stage: 'lead_in', _count: { _all: 6 } },
          { stage: 'paid', _count: { _all: 3 } },
          { stage: 'first_visit', _count: { _all: 1 } },
        ]),
      },
      ledgerEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 89100 } }) },
      crmList: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'L1', name: 'Storici 2024', color: null, _count: { members: 3 } },
          { id: 'L2', name: 'Keto', color: '#33B190', _count: { members: 0 } },
        ]),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'Lnew', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'L1', ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      crmListMember: { deleteMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const pipeline = {
      stageKeys: jest.fn().mockResolvedValue(new Set(['lead_in', 'worked', 'paid', 'coach_assigned', 'coach_call', 'nutritionist_assigned', 'first_visit', 'follow_up'])),
      listStages: jest.fn().mockResolvedValue([
        { key: 'lead_in', order: 0 },
        { key: 'worked', order: 1 },
        { key: 'paid', order: 2 },
        { key: 'first_visit', order: 6 },
      ]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CrmService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PipelineService, useValue: pipeline },
      ],
    }).compile();
    service = moduleRef.get(CrmService);
  });

  it('advance registra stage con data e responsabile, preservando la storia', async () => {
    const updated: any = await service.advance('sales-user', 'lead1', { stage: 'worked' });
    expect(updated.stage).toBe('worked');
    expect(updated.stageDates.lead_in).toBeDefined(); // storia preservata
    expect(updated.stageDates.worked.byUserId).toBe('sales-user');
    expect(updated.stageDates.worked.at).toBeDefined();
  });

  it('updateInfo aggiorna nome/email/valore e stringa vuota → null', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue({ id: 'lead1', name: 'Vecchio', email: 'old@x.it', valueCents: null });
    const updated: any = await service.updateInfo('sales-user', 'lead1', { name: 'Anna', email: '', valueCents: 29000 });
    expect(prisma.crmRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Anna', email: null, valueCents: 29000 } }),
    );
    expect(updated.valueCents).toBe(29000);
  });

  it('detail solleva NotFound se il lead non esiste', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue(null);
    await expect(service.detail('sconosciuto')).rejects.toThrow('Lead non trovato');
  });

  it('ensureLead non solleva mai (il CRM non blocca la registrazione)', async () => {
    prisma.crmRecord.upsert.mockRejectedValue(new Error('db down'));
    await expect(service.ensureLead('u1', 'a@b.it')).resolves.toBeUndefined();
  });

  it('dashboard sales: conversione paid+ / totale e incasso mese', async () => {
    const dash = await service.salesDashboard();
    expect(dash.totalLeads).toBe(10);
    expect(dash.conversionToPaidPercent).toBe(40); // (3 paid + 1 first_visit) / 10
    expect(dash.monthIncomeCents).toBe(89100);
  });

  it('listLists espone il numero di membri per lista', async () => {
    const lists: any = await service.listLists();
    expect(lists).toEqual([
      expect.objectContaining({ id: 'L1', name: 'Storici 2024', memberCount: 3 }),
      expect.objectContaining({ id: 'L2', name: 'Keto', memberCount: 0 }),
    ]);
    expect(lists[0]._count).toBeUndefined(); // _count non deve trapelare
  });

  it('setLeadLists rimpiazza le appartenenze (upsert per lista + deleteMany fuori insieme)', async () => {
    prisma.crmRecord.findUnique.mockImplementation(({ select }: any) =>
      select
        ? Promise.resolve({ id: 'lead1' })
        : Promise.resolve({ id: 'lead1', reminders: [], listMemberships: [{ list: { id: 'L1', name: 'Storici 2024', color: null } }] }),
    );
    const res: any = await service.setLeadLists('sales-user', 'lead1', ['L1', 'L1', 'L2']); // dedup
    expect(prisma.crmListMember.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.crmListMember.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recordId: 'lead1', listId: { notIn: ['L1', 'L2'] } } }),
    );
    expect(res.lists).toEqual([{ id: 'L1', name: 'Storici 2024', color: null }]); // detail appiattisce
  });

  it('setLeadLists solleva NotFound se il lead non esiste', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue(null);
    await expect(service.setLeadLists('u', 'x', ['L1'])).rejects.toThrow('Lead non trovato');
  });

  it('detail appiattisce listMemberships in lists e non espone il grezzo', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue({
      id: 'lead1', reminders: [], listMemberships: [{ list: { id: 'L2', name: 'Keto', color: '#33B190' } }],
    });
    const d: any = await service.detail('lead1');
    expect(d.lists).toEqual([{ id: 'L2', name: 'Keto', color: '#33B190' }]);
    expect(d.listMemberships).toBeUndefined();
  });
});
