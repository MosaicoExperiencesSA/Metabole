/**
 * §16.7 — IL PROMEMORIA POCO PRIMA DELLA VISITA.
 *
 * Simone (12/8): «notifica push ad entrambi 20 minuti prima». Il test che conta è il secondo: prima
 * la ricerca del duplicato non guardava il destinatario, quindi aggiungere la cliente avrebbe
 * silenziosamente **tolto** l'avviso al nutrizionista.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { VisitsService } from './visits.service';

const fraMinuti = (m: number) => new Date(Date.now() + m * 60_000);

async function creaServizio(visite: any[], gia: (dove: { userId: string; type: string }) => boolean = () => false) {
  const notify = jest.fn().mockResolvedValue(undefined);
  const prisma: any = {
    visit: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          visite.filter((v) => v.datetime >= where.datetime.gte && v.datetime <= where.datetime.lte),
        ),
      ),
    },
    notification: {
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(gia({ userId: where.userId, type: where.type }) ? { id: 'n-vecchia' } : null),
      ),
    },
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'Patrizia' }) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      VisitsService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      { provide: NotificationsService, useValue: { notify } },
    ],
  }).compile();
  return { service: moduleRef.get(VisitsService) as VisitsService, notify, prisma };
}

const VISITA = {
  id: 'v-1',
  datetime: fraMinuti(18),
  type: 'in_person',
  clientId: 'c-1',
  nutritionist: { userId: 'u-nutri', displayName: 'Dr.ssa Rossi' },
};

describe('promemoria 20 minuti prima', () => {
  it('avvisa la cliente E la nutrizionista', async () => {
    const { service, notify } = await creaServizio([VISITA]);
    const esito = await service.sendUpcomingReminders();
    expect(esito.sent).toBe(2);
    const destinatari = notify.mock.calls.map((c) => c[0].userId);
    expect(destinatari).toEqual(expect.arrayContaining(['u-nutri', 'c-1']));
  });

  it('⚠️ l\'avviso già mandato a UNA delle due non fa saltare quello dell\'altra', async () => {
    // Il dedup guarda il destinatario. Senza, la cliente resterebbe senza promemoria — o il
    // nutrizionista, a seconda dell'ordine — e nessun errore lo direbbe a nessuno.
    const { service, notify } = await creaServizio([VISITA], ({ userId }) => userId === 'u-nutri');
    const esito = await service.sendUpcomingReminders();
    expect(esito.sent).toBe(1);
    expect(notify.mock.calls[0][0].userId).toBe('c-1');
  });

  it('mandato due volte, la seconda non manda niente', async () => {
    const { service } = await creaServizio([VISITA], () => true);
    expect((await service.sendUpcomingReminders()).sent).toBe(0);
  });

  it('⚠️ la finestra copre 25 minuti: col cron ogni 10, «20 prima» non arriva mai in ritardo', async () => {
    const lontana = { ...VISITA, id: 'v-2', datetime: fraMinuti(40) };
    const { service } = await creaServizio([lontana]);
    expect((await service.sendUpcomingReminders()).sent).toBe(0);

    const vicina = { ...VISITA, id: 'v-3', datetime: fraMinuti(23) };
    const secondo = await creaServizio([vicina]);
    expect((await secondo.service.sendUpcomingReminders()).sent).toBe(2);
  });

  it('alla cliente si dice l\'ora e con chi, non «visita v-1»', async () => {
    const { service, notify } = await creaServizio([VISITA]);
    await service.sendUpcomingReminders();
    const alla = notify.mock.calls.find((c) => c[0].userId === 'c-1')![0];
    expect(alla.type).toBe('visit_imminent');
    expect(alla.body).toContain('Dr.ssa Rossi');
    expect(alla.body).toMatch(/\d{2}:\d{2}/);
    expect(alla.payload).toEqual({ visitId: 'v-1', clientId: 'c-1' });
  });

  it('la televisita si dice televisita, e dove si apre', async () => {
    const { service, notify } = await creaServizio([{ ...VISITA, type: 'televisit' }]);
    await service.sendUpcomingReminders();
    const alla = notify.mock.calls.find((c) => c[0].userId === 'c-1')![0];
    expect(alla.body).toContain('televisita');
    expect(alla.body).toContain('app');
  });

  it('una visita senza nutrizionista avvisa comunque la cliente', async () => {
    // Non dovrebbe succedere, ma se succede il silenzio lo pagherebbe lei.
    const { service, notify } = await creaServizio([{ ...VISITA, nutritionist: null }]);
    expect((await service.sendUpcomingReminders()).sent).toBe(1);
    expect(notify.mock.calls[0][0].userId).toBe('c-1');
  });
});
