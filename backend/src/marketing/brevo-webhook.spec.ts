import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingService } from './marketing.service';

/**
 * Il webhook di Brevo che scrive `marketing_opt_out` — da cui l'invito a Gaia e le campagne tolgono
 * gli indirizzi. La prova guarda la SCRITTURA (cosa arriva a `upsert`), non il conteggio restituito:
 * un webhook che risponde «ok» e non scrive niente è proprio il guasto che si cerca.
 */
describe('MarketingService.handleBrevoWebhook', () => {
  const SEGRETO = 'segreto-di-prova';

  const monta = async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: PrismaService, useValue: { marketingOptOut: { upsert } } },
        { provide: MailService, useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn((k: string) => (k === 'BREVO_WEBHOOK_SECRET' ? SEGRETO : '')) } },
        { provide: ConfigParamsService, useValue: {} },
      ],
    }).compile();
    return { service: moduleRef.get(MarketingService), upsert };
  };

  it('invalid_email dal webhook transazionale esclude l indirizzo', async () => {
    const { service, upsert } = await monta();
    await service.handleBrevoWebhook(SEGRETO, { event: 'invalid_email', email: ' Mario.Rossi@Example.COM ' });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { email: 'mario.rossi@example.com' },
      create: { email: 'mario.rossi@example.com', reason: 'invalid_email', source: 'brevo' },
      update: { reason: 'invalid_email' },
    });
  });

  it('il nome scritto all altro modo (hardBounce) scrive il motivo canonico', async () => {
    const { service, upsert } = await monta();
    await service.handleBrevoWebhook(SEGRETO, { event: 'hardBounce', email: 'a@example.com' });
    expect(upsert.mock.calls[0][0].create.reason).toBe('hard_bounce');
  });

  it('un elenco di eventi: scrive solo quelli che escludono', async () => {
    const { service, upsert } = await monta();
    const r = await service.handleBrevoWebhook(SEGRETO, [
      { event: 'soft_bounce', email: 'piena@example.com' },
      { event: 'delivered', email: 'ok@example.com' },
      { event: 'hard_bounce', email: 'morta@example.com' },
      { event: 'spam', email: '' },
    ]);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].where.email).toBe('morta@example.com');
    expect(r).toEqual({ ok: true, processed: 4, optedOut: 1 });
  });

  it('token sbagliato: rifiuta e non scrive', async () => {
    const { service, upsert } = await monta();
    await expect(service.handleBrevoWebhook('altro', { event: 'hard_bounce', email: 'x@y.it' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(upsert).not.toHaveBeenCalled();
  });
});
