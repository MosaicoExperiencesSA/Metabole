import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  let service: TrackingService;
  let prisma: { analyticsEvent: { upsert: jest.Mock } };
  let jwt: { verifyAsync: jest.Mock };

  beforeEach(() => {
    prisma = { analyticsEvent: { upsert: jest.fn().mockResolvedValue({ id: 'row-1' }) } };
    jwt = { verifyAsync: jest.fn() };
    service = new TrackingService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  it('registra un evento anonimo e genera un eventId se assente', async () => {
    const res = await service.ingest({ event: 'ui_click', session: 'sess_1' });
    expect(res).toEqual({ ok: true, id: 'row-1' });
    const arg = prisma.analyticsEvent.upsert.mock.calls[0][0];
    expect(arg.where.eventId).toBeTruthy(); // generato server-side
    expect(arg.create.name).toBe('ui_click');
    expect(arg.create.userId).toBeNull();
    expect(arg.create.session).toBe('sess_1');
  });

  it('è idempotente sull eventId fornito dal client', async () => {
    await service.ingest({ event: 'view', eventId: 'evt-abc' });
    const arg = prisma.analyticsEvent.upsert.mock.calls[0][0];
    expect(arg.where.eventId).toBe('evt-abc');
    expect(arg.update).toEqual({}); // nessuna modifica sui retry
  });

  it('lega l evento all utente quando il token è valido', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-9' });
    await service.ingest({ event: 'ui_click' }, 'Bearer good-token');
    const arg = prisma.analyticsEvent.upsert.mock.calls[0][0];
    expect(arg.create.userId).toBe('user-9');
  });

  it('ignora i token con scope widget (resta anonimo)', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-9', scope: 'widget' });
    await service.ingest({ event: 'ui_click' }, 'Bearer widget-token');
    const arg = prisma.analyticsEvent.upsert.mock.calls[0][0];
    expect(arg.create.userId).toBeNull();
  });

  it('resta anonimo se il token non è valido', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
    await service.ingest({ event: 'ui_click' }, 'Bearer bad');
    const arg = prisma.analyticsEvent.upsert.mock.calls[0][0];
    expect(arg.create.userId).toBeNull();
  });

  it('converte ts client in BigInt', async () => {
    await service.ingest({ event: 'view', ts: 1720700000000 });
    const arg = prisma.analyticsEvent.upsert.mock.calls[0][0];
    expect(arg.create.clientTs).toBe(BigInt(1720700000000));
  });

  it('scarta payload data troppo grande', async () => {
    const big = { blob: 'x'.repeat(20_000) };
    await service.ingest({ event: 'ui_click', data: big });
    const arg = prisma.analyticsEvent.upsert.mock.calls[0][0];
    expect(arg.create.data).toBeUndefined();
  });
});
