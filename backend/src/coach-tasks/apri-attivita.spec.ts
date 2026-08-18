import { Test } from '@nestjs/testing';
import { CoachTasksService } from './coach-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';

/**
 * `apriAttivita` È IL PUNTO UNICO da cui nasce un'attività fuori dal giro notturno — ed è anche
 * quello da cui parte la push alla coach. Non aveva **nessun** test (trovato dalla revisione del
 * 18/8 sera): né la scadenza predefinita, né il contratto «true = l'ho creata adesso».
 */
describe('CoachTasksService.apriAttivita', () => {
  let service: CoachTasksService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      coachTask: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 't1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'Sonia', assignedCoach: null }) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CoachTasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: PushService, useValue: { sendToUser: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } },
      ],
    }).compile();
    service = moduleRef.get(CoachTasksService);
  });

  const apri = () =>
    service.apriAttivita({ clientId: 'c1', kind: 'visita_da_fissare', refId: 'serve_visita:2026-08-18', title: 'T', description: 'D' });

  it('la crea e dice di averla creata', async () => {
    await expect(apri()).resolves.toBe('creata');
    expect(prisma.coachTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: 'c1', kind: 'visita_da_fissare', refId: 'serve_visita:2026-08-18' }) }),
    );
  });

  /**
   * ⚠️ Il contratto su cui si appoggia chi chiama: «c'era già» è un SUCCESSO, non un errore. Con un
   * booleano il backoffice traduceva `false` in «l'attività NON risulta aperta» e lo diceva a chi
   * aveva appena deciso — su un secondo salvataggio, che dal 18/8 è il caso normale.
   */
  it('⚠️ se c\'è già non ne crea una seconda, e lo dice con le parole giuste', async () => {
    prisma.coachTask.findUnique.mockResolvedValue({ id: 'gia' });
    await expect(apri()).resolves.toBe('gia-presente');
    expect(prisma.coachTask.create).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ E il testo si aggiorna: la descrizione è la fotografia del momento in cui l'attività è nata
   * («questa cliente non ha una coach»), e chi la legge la legge DOPO — magari quando la coach è
   * stata assegnata proprio perché quel testo lo chiedeva.
   */
  it('⚠️ se c\'era già ma il testo è cambiato, lo riscrive', async () => {
    prisma.coachTask.findUnique.mockResolvedValue({ id: 'gia' });
    await apri();
    expect(prisma.coachTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: 'D' }) }),
    );
  });

  /** La scadenza predefinita è DOMANI: chi apre un'attività a mano ha di solito fretta. */
  it('senza scadenza la mette a domani, a mezzanotte', async () => {
    await apri();
    const { dueDate } = prisma.coachTask.create.mock.calls[0][0].data;
    const domani = new Date();
    domani.setHours(0, 0, 0, 0);
    domani.setDate(domani.getDate() + 1);
    expect(dueDate.getTime()).toBe(domani.getTime());
  });

  it('e se gliela si passa, vince quella', async () => {
    const quando = new Date('2026-09-01T00:00:00.000Z');
    await service.apriAttivita({ clientId: 'c1', kind: 'k', refId: 'r', title: 'T', description: 'D', dueDate: quando });
    expect(prisma.coachTask.create.mock.calls[0][0].data.dueDate).toBe(quando);
  });
});
