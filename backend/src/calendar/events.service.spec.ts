import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

const iso = (daysFromToday: number) =>
  new Date(Date.now() + daysFromToday * 86_400_000).toISOString().slice(0, 10);

describe('EventsService (segnale Agenda)', () => {
  let service: EventsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      event: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'e1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn(),
      },
      measurement: {
        findFirst: jest.fn().mockResolvedValue({ weightKg: 66.6 }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(EventsService);
  });

  it('crea un evento singolo di un giorno', async () => {
    const event = await service.create('u1', {
      type: 'wedding',
      startDate: iso(5),
      mode: 'single_event',
    });
    expect(event.planPhaseState).toBe('before');
  });

  it('evento singolo su più giorni → rifiutato', async () => {
    await expect(
      service.create('u1', { type: 'dinner', startDate: iso(5), endDate: iso(7), mode: 'single_event' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('la pausa fotografa il peso di partenza (per il mini-piano)', async () => {
    const event = await service.create('u1', {
      type: 'vacation',
      startDate: iso(1),
      endDate: iso(10),
      mode: 'pause_period',
    });
    expect(event.startWeightKg).toBe(66.6);
  });

  it('pausa oltre 30 giorni → rifiutata', async () => {
    await expect(
      service.create('u1', { type: 'vacation', startDate: iso(1), endDate: iso(40), mode: 'pause_period' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('fine prima dell\'inizio → rifiutata', async () => {
    await expect(
      service.create('u1', { type: 'vacation', startDate: iso(5), endDate: iso(2), mode: 'pause_period' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('hasUpcomingEvent guarda solo gli eventi singoli nella finestra', async () => {
    prisma.event.count.mockResolvedValue(1);
    expect(await service.hasUpcomingEvent('u1', 7)).toBe(true);
    const where = prisma.event.count.mock.calls[0][0].where;
    expect(where.mode).toBe('single_event');
  });

  it('il piano racconta le tre fasi (anticipare, non punire)', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'e1',
      mode: 'pause_period',
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
      planPhaseState: 'before',
    });
    const plan = await service.plan('u1', 'e1');
    expect(plan.currentPhase).toBe('during');
    expect(plan.phases.during).toContain('mini-piano');
    expect(plan.phases.after).not.toContain('punizione'.toUpperCase());
  });
});
