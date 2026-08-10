import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquivalenceService } from './equivalence.service';

/**
 * «QUANDO SI CREANO … EQUIVALENZE NUOVE MANDIAMO UNA NOTIFICA AL NUTRIZIONISTA» (Simone, 11/8).
 *
 * Il motore usa SOLO i gruppi approvati. Quindi un gruppo nuovo in bozza è lavoro fatto che non
 * serve a niente finché il capo nutrizionista non lo guarda — e finora non c'era nessun modo di
 * saperlo, se non andando a cercare l'elenco. Sono anche i gruppi che decidono cosa Gaia può
 * proporre al posto di cosa: il caso della pasta integrale del 10/8 nasce lì.
 */
describe('EquivalenceService — avviso al capo nutrizionista', () => {
  let service: EquivalenceService;
  let prisma: any;
  let notifications: { notify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      equivalenceGroup: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'capo-user' }]) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EquivalenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(EquivalenceService);
  });

  it('un gruppo nuovo in bozza avvisa il capo, e il testo dice che il motore NON lo usa', async () => {
    await service.create('nutri-user', { name: 'Pesci bianchi', items: ['orata', 'branzino', 'merluzzo'] } as never);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const avviso = notifications.notify.mock.calls[0][0];
    expect(avviso.userId).toBe('capo-user');
    expect(avviso.type).toBe('equivalence_group_new');
    expect(avviso.body).toContain('Pesci bianchi');
    expect(avviso.body).toContain('3 alimenti');
    expect(avviso.body).toMatch(/non lo usa/);
    expect(avviso.payload.groupId).toBe('g1');
  });

  it('un gruppo creato già approvato lo dice: il motore lo userà dal prossimo menu', async () => {
    await service.create('nutri-user', { name: 'Latticini magri', items: ['skyr', 'yogurt greco 0%'], status: 'approved' } as never);
    const avviso = notifications.notify.mock.calls[0][0];
    expect(avviso.body).toContain('già approvato');
    expect(avviso.body).toContain('2 alimenti');
  });

  it('un solo alimento resta al singolare: i dettagli che fanno sembrare il testo scritto da noi', async () => {
    await service.create('nutri-user', { name: 'Solo riso', items: ['riso basmati'] } as never);
    expect(notifications.notify.mock.calls[0][0].body).toContain('1 alimento');
  });

  it('se il gruppo lo crea IL CAPO, non si avvisa lui di quello che ha appena fatto', async () => {
    await service.create('capo-user', { name: 'Pesci bianchi', items: ['orata', 'branzino'] } as never);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('l\'avviso non fa fallire la creazione: il gruppo si salva comunque', async () => {
    notifications.notify.mockRejectedValue(new Error('notifiche giù'));
    const creato = await service.create('nutri-user', { name: 'Pesci bianchi', items: ['orata', 'branzino'] } as never);
    expect(creato.id).toBe('g1');
  });
});
