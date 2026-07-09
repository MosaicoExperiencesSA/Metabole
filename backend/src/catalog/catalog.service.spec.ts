import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService (flusso approvazione diete)', () => {
  let service: CatalogService;
  let prisma: any;

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
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
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
