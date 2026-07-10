import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineService } from './pipeline.service';

describe('PipelineService (stati pipeline + board)', () => {
  let service: PipelineService;
  let prisma: any;

  const stageRows = [
    { key: 'lead_in', label: 'Nuovo contatto', color: '#7c8c88', order: 0, isSystem: true },
    { key: 'worked', label: 'Lavorato', color: '#3a6ea5', order: 1, isSystem: false },
    { key: 'paid', label: 'Pagato', color: '#0e7c66', order: 2, isSystem: true },
  ];

  beforeEach(async () => {
    prisma = {
      pipelineStage: {
        findMany: jest.fn().mockResolvedValue(stageRows),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...stageRows[0], key: where.key, ...data })),
        delete: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { order: 2 } }),
      },
      crmRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'r1',
            stage: 'worked',
            name: null,
            email: 'a@b.it',
            valueCents: 29700,
            stageDates: { worked: { at: new Date(Date.now() - 3 * 86_400_000).toISOString() } },
            owner: { displayName: 'Marta' },
            client: { email: 'giulia@test.it', clientProfile: { name: 'Giulia', assignedCoach: { displayName: 'Marta Coach' } } },
          },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(PipelineService);
  });

  it('board: colonne per stato + schede con nome, coach e giorni nello stato', async () => {
    const board = await service.board();
    expect(board.stages).toHaveLength(3);
    expect(board.cards.worked).toHaveLength(1);
    expect(board.cards.lead_in).toEqual([]);
    const card = board.cards.worked[0];
    expect(card.name).toBe('Giulia');
    expect(card.coach).toBe('Marta Coach');
    expect(card.daysInStage).toBe(3);
  });

  it('createStage: genera la chiave dallo slug e la accoda in fondo', async () => {
    const created = await service.createStage({ label: 'In pausa' }, 'admin-1');
    expect(created.key).toBe('in_pausa');
    expect(created.order).toBe(3);
  });

  it('deleteStage: rifiuta uno stato di sistema', async () => {
    prisma.pipelineStage.findUnique.mockResolvedValue({ key: 'paid', isSystem: true });
    await expect(service.deleteStage('paid', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('deleteStage: rifiuta uno stato con clienti dentro', async () => {
    prisma.pipelineStage.findUnique.mockResolvedValue({ key: 'worked', isSystem: false });
    prisma.crmRecord.count.mockResolvedValue(4);
    await expect(service.deleteStage('worked', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('deleteStage: elimina uno stato vuoto e non di sistema', async () => {
    prisma.pipelineStage.findUnique.mockResolvedValue({ key: 'worked', isSystem: false });
    prisma.crmRecord.count.mockResolvedValue(0);
    const res = await service.deleteStage('worked', 'admin-1');
    expect(res.removed).toBe('worked');
    expect(prisma.pipelineStage.delete).toHaveBeenCalled();
  });
});
