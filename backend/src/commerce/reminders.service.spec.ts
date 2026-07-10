import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from './reminders.service';

describe('RemindersService (calendario CRM)', () => {
  let service: RemindersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      crmReminder: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rem1',
            title: 'Richiamare',
            dueAt: new Date('2026-07-15T09:00:00Z'),
            note: null,
            done: false,
            crmRecordId: 'lead1',
            crmRecord: { name: null, email: null, client: { email: 'g@t.it', clientProfile: { name: 'Giulia' } } },
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({ id: 'rem1', done: false }),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rem1', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rem1', ...data })),
        delete: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(RemindersService);
  });

  it('list: risolve il nome del lead collegato e di default esclude i completati', async () => {
    const res = await service.list({});
    expect(res[0].linkedName).toBe('Giulia');
    expect(prisma.crmReminder.findMany.mock.calls[0][0].where.done).toBe(false);
  });

  it('list con includeDone: non filtra su done', async () => {
    await service.list({ includeDone: true });
    expect(prisma.crmReminder.findMany.mock.calls[0][0].where.done).toBeUndefined();
  });

  it('create: normalizza note vuote a null e converte la data', async () => {
    const r: any = await service.create({ title: '  Richiamo  ', dueAt: '2026-07-20T10:00:00Z', note: '   ' }, 'staff-1');
    expect(r.title).toBe('Richiamo');
    expect(r.note).toBeNull();
    expect(r.dueAt).toBeInstanceOf(Date);
  });

  it('update done: segna completato', async () => {
    const r: any = await service.update('rem1', { done: true }, 'staff-1');
    expect(r.done).toBe(true);
  });

  it('remove: 404 se il promemoria non esiste', async () => {
    prisma.crmReminder.findUnique.mockResolvedValue(null);
    await expect(service.remove('x', 'staff-1')).rejects.toThrow(NotFoundException);
  });
});
