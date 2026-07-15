import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService (flusso approvazione diete)', () => {
  let service: CatalogService;
  let prisma: any;
  let config: any;

  beforeEach(async () => {
    prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-head' }) },
      diet: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'd1', status: 'draft' }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'd1', ...data })),
      },
      dietDayTemplate: { deleteMany: jest.fn(), createMany: jest.fn() },
      recipe: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      clientProfile: { count: jest.fn().mockResolvedValue(5) },
      subscription: { count: jest.fn().mockResolvedValue(2) },
      crmRecord: { count: jest.fn().mockResolvedValue(12) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    config = { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: ConfigParamsService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
  });

  const diet = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    status: 'in_review',
    authorId: 'staff-author',
    dayTemplates: [{ id: 't1' }],
    ...over,
  });

  it('publicStats: methods = diete APPROVATE nel catalogo (una per dieta, senza dedup per stile)', async () => {
    prisma.diet.findMany.mockResolvedValue([
      { id: 'd1', style: 'keto', name: 'Keto', status: 'approved' },
      { id: 'd2', style: 'mediterranean', name: 'Med', status: 'approved' },
      { id: 'd3', style: 'keto', name: 'Keto (bis)', status: 'approved' },
    ]);
    const s = await service.publicStats();
    expect(s.methods).toBe(3); // ogni dieta approvata conta: 3 diete → 3 percorsi
    expect(prisma.diet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'approved' } }),
    );
    expect(s.clients).toBe(2); // base 0 + abbonamenti attivati (subscription.count)
    expect(s.reached).toBe(12); // base 0 + lead nel CRM (crmRecord.count)
    expect(s.years).toBeUndefined(); // config 0 → campo omesso
    // i clienti si contano sugli abbonamenti ATTIVATI (startDate valorizzata)
    expect(prisma.subscription.count).toHaveBeenCalledWith({
      where: { startDate: { not: null } },
    });
  });

  it('publicStats: la base storica (config_param) si SOMMA ai conteggi reali', async () => {
    const bases: Record<string, number> = {
      stats_clients_base: 18979,
      stats_reached_base: 85218,
      site_stats_years: 20,
    };
    config.getNumber.mockImplementation(async (k: string, d?: number) => bases[k] ?? d ?? 0);
    prisma.diet.findMany.mockResolvedValue([
      { id: 'd1', style: 'keto', name: 'Keto', status: 'approved' },
    ]);
    const s = await service.publicStats();
    expect(s.clients).toBe(18979 + 2); // base + abbonamenti attivati
    expect(s.reached).toBe(85218 + 12); // base + lead CRM
    expect(s.years).toBe(20);
    expect(s.methods).toBe(1);
  });

  it('il capo approva una dieta in revisione di un altro autore', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet());
    const result = await service.approveDiet('head-user', 'd1');
    expect(result.status).toBe('approved');
    expect(prisma.diet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvedById: 'staff-head' }),
      }),
    );
  });

  it('il capo NON può approvare una propria dieta', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ authorId: 'staff-head' }));
    await expect(service.approveDiet('head-user', 'd1')).rejects.toThrow(ForbiddenException);
  });

  it('non si approva una dieta che non è in revisione', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'draft' }));
    await expect(service.approveDiet('head-user', 'd1')).rejects.toThrow(BadRequestException);
  });

  it('submit richiede almeno un template giornata', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'draft', dayTemplates: [] }));
    await expect(service.submitForReview('u1', 'd1')).rejects.toThrow(BadRequestException);
  });

  it('una dieta approvata non si modifica', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'approved' }));
    await expect(service.updateDiet('u1', 'd1', { name: 'Nuovo nome' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('ogni modifica riporta la dieta in bozza e azzera l\'approvazione', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'rejected' }));
    await service.updateDiet('u1', 'd1', { name: 'V2' });
    expect(prisma.diet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft', approvedById: null }),
      }),
    );
  });

  it('i template rifiutano ricette inesistenti', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'draft' }));
    prisma.recipe.count.mockResolvedValue(0);
    await expect(
      service.setDayTemplates('u1', 'd1', {
        days: [{ level: 1, dayIndex: 1, meals: [{ slot: 'lunch', recipeId: 'ghost' }] }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
