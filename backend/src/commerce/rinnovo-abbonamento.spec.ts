import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PdfService } from '../pdf/pdf.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralService } from '../referral/referral.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { CommerceService, metadatiAbbonamentoDaFattura } from './commerce.service';
import { CrmService } from './crm.service';
import { DiscountsService } from './discounts.service';
import { FinanceService } from './finance.service';
import { StripeService } from './stripe.service';

/**
 * Due difetti da soldi, tutti e due invisibili da fuori: il webhook rispondeva 200 e non
 * succedeva niente.
 *
 * 1. **ABBONAMENTO ORFANO.** `stripeSubscriptionId` lo scriveva solo
 *    `checkout.session.completed`. Se quel singolo webhook si perdeva — un deploy in corso, un
 *    500, l'endpoint disattivato per dieci minuti — la colonna restava `null` per sempre. Da
 *    lì in poi nessuna fattura ritrovava più la riga: la cliente pagava ogni mese, la scadenza
 *    non si spostava (quindi prima o poi restava senza menu *pur pagando*) e la disdetta
 *    dall'app rispondeva «Nessun abbonamento da disdire».
 *    Il rimedio esisteva già nei dati e nessuno lo leggeva: alla creazione del checkout i nostri
 *    id finiscono in `subscription_data.metadata`, e Stripe li rimanda su ogni fattura.
 *
 * 2. **PROVVIGIONE DEL RINNOVO CHE SPARISCE.** Il pagamento viene creato (e con lui il segno di
 *    idempotenza, `pspRef`) *prima* di `generateCommissions`. Se quella sollevava, l'eccezione
 *    risaliva alla webhook → 500 → Stripe riconsegna → la seconda volta il pagamento c'è già →
 *    «idempotent» → provvigioni, ricevuta e notifica alla coach non nascevano MAI.
 */

function harness() {
  const prisma: any = {
    subscription: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pay-rinnovo', ...data })),
    },
    clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    staff: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { create: jest.fn() },
  };
  const mail = { sendPaymentReceipt: jest.fn().mockResolvedValue(true) };
  // La ricevuta del rinnovo ora allega il PDF: il finto Prisma deve saper rispondere alle
  // letture che `generateReceiptPdf` fa sul pagamento.
  prisma.payment.findUnique = jest.fn().mockResolvedValue({
    id: 'pay-rinnovo', clientId: 'cli-1', amountCents: 4900, status: 'approved',
    description: 'Mantenimento — rinnovo mensile', createdAt: new Date('2026-08-08T00:00:00.000Z'),
    approvedAt: new Date('2026-08-08T00:00:00.000Z'), method: 'card',
    client: { email: 'giulia@test.it', locale: 'it', firstName: 'Giulia', lastName: 'Rossi', clientProfile: { name: 'Giulia Rossi' } },
    subscription: null, order: null,
  });
  const finance = { recordIncome: jest.fn().mockResolvedValue(undefined), generateCommissions: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { prisma, mail, finance, audit };
}

async function build(h: ReturnType<typeof harness>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CommerceService,
      { provide: PrismaService, useValue: h.prisma },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('chiave-file-test') } },
      { provide: ConfigParamsService, useValue: { getString: jest.fn(), getNumber: jest.fn(), getBool: jest.fn() } },
      { provide: MailService, useValue: h.mail },
      { provide: NotificationsService, useValue: { notifyOncePerDay: jest.fn() } },
      { provide: FinanceService, useValue: h.finance },
      { provide: CrmService, useValue: { autoAdvance: jest.fn() } },
      { provide: DiscountsService, useValue: { validate: jest.fn(), redeem: jest.fn() } },
      { provide: StripeService, useValue: { enabled: true } },
      { provide: AuditService, useValue: h.audit },
      { provide: PdfService, useValue: { renderTemplatePdf: jest.fn() } },
      { provide: ReferralService, useValue: { onConvert: jest.fn(), riscuotiSospese: jest.fn() } },
      { provide: MonitoringService, useValue: { onPlanActivated: jest.fn() } },
    ],
  }).compile();
  return moduleRef.get(CommerceService);
}

/** Fattura di rinnovo nella forma dell'API 2026, con i nostri metadati come li manda Stripe. */
const fattura = (over: Record<string, unknown> = {}) => ({
  id: 'in_RINNOVO_1',
  billing_reason: 'subscription_cycle',
  amount_paid: 4900,
  lines: { data: [{ period: { end: Math.floor(new Date('2026-09-08T00:00:00.000Z').getTime() / 1000) } }] },
  parent: {
    subscription_details: {
      subscription: 'sub_STRIPE_1',
      metadata: { subscriptionId: 'nostro-sub-1', clientId: 'cli-1' },
    },
  },
  ...over,
});

describe('metadatiAbbonamentoDaFattura', () => {
  it('forma NUOVA (API 2026): parent.subscription_details.metadata', () => {
    expect(metadatiAbbonamentoDaFattura(fattura())).toEqual({ subscriptionId: 'nostro-sub-1', clientId: 'cli-1' });
  });

  it('forma VECCHIA (API ≤ 2025): subscription_details.metadata', () => {
    const inv = { id: 'in_1', subscription_details: { metadata: { subscriptionId: 's1', clientId: 'c1' } } };
    expect(metadatiAbbonamentoDaFattura(inv)).toEqual({ subscriptionId: 's1', clientId: 'c1' });
  });

  it('senza metadati non inventa niente, e non esplode su input assurdi', () => {
    expect(metadatiAbbonamentoDaFattura({ id: 'in_1' })).toEqual({ subscriptionId: undefined, clientId: undefined });
    expect(metadatiAbbonamentoDaFattura(null)).toEqual({ subscriptionId: undefined, clientId: undefined });
    expect(metadatiAbbonamentoDaFattura({ parent: null })).toEqual({ subscriptionId: undefined, clientId: undefined });
  });
});

describe('handleInvoicePaid — abbonamento orfano', () => {
  it('se `stripeSubscriptionId` è nullo lo RIAGGANCIA dai metadati della fattura, e il rinnovo va a buon fine', async () => {
    const h = harness();
    const service = await build(h);
    // Prima ricerca (per stripeSubscriptionId): niente — è l'orfano.
    // Seconda (per il nostro id, dai metadati): la riga c'è, ma senza id di Stripe.
    // Terza (dopo il riaggancio): la riga completa che serve al rinnovo.
    h.prisma.subscription.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'nostro-sub-1', clientId: 'cli-1', stripeSubscriptionId: null })
      .mockResolvedValueOnce({
        id: 'nostro-sub-1', clientId: 'cli-1', endDate: new Date('2026-08-08T00:00:00.000Z'),
        plan: { name: 'Mantenimento' }, client: { email: 'giulia@test.it', locale: 'it' },
      });

    const res: any = await service.handleInvoicePaid({ type: 'invoice.paid', data: { object: fattura() } });

    expect(res).toEqual({ handled: true, renewed: true });
    // L'aggancio è stato riscritto: dal prossimo mese si passa dalla strada normale.
    expect(h.prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'nostro-sub-1' }, data: { stripeSubscriptionId: 'sub_STRIPE_1' } }),
    );
    expect(h.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'commerce.subscription.riagganciato' }));
    // E il rinnovo ha fatto il suo: pagamento, provvigioni, scadenza spostata.
    expect(h.prisma.payment.create).toHaveBeenCalled();
    expect(h.finance.generateCommissions).toHaveBeenCalled();
  });

  it('NON sovrascrive un abbonamento che punta già a un altro id Stripe: quello lo guarda una persona', async () => {
    const h = harness();
    const service = await build(h);
    h.prisma.subscription.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'nostro-sub-1', clientId: 'cli-1', stripeSubscriptionId: 'sub_ALTRO' })
      .mockResolvedValueOnce({
        id: 'nostro-sub-1', clientId: 'cli-1', endDate: null,
        plan: { name: 'Mantenimento' }, client: { email: 'g@t.it', locale: 'it' },
      });

    await service.handleInvoicePaid({ type: 'invoice.paid', data: { object: fattura() } });

    expect(h.prisma.subscription.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripeSubscriptionId: 'sub_STRIPE_1' } }),
    );
    expect(h.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'commerce.subscription.riaggancio_rifiutato' }));
  });

  it('senza metadati e senza aggancio resta «abbonamento sconosciuto» (non si indovina di chi sono i soldi)', async () => {
    const h = harness();
    const service = await build(h);
    h.prisma.subscription.findUnique.mockResolvedValue(null);
    const res: any = await service.handleInvoicePaid({
      type: 'invoice.paid',
      data: { object: fattura({ parent: { subscription_details: { subscription: 'sub_X' } } }) },
    });
    expect(res.handled).toBe(false);
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe('handleInvoicePaid — la provvigione non può sparire', () => {
  it('se `generateCommissions` fallisce la catena PROSEGUE e resta la traccia per recuperare', async () => {
    const h = harness();
    h.finance.generateCommissions.mockRejectedValue(new Error('database occupato'));
    const service = await build(h);
    h.prisma.subscription.findUnique
      .mockResolvedValueOnce({ id: 'nostro-sub-1' })
      .mockResolvedValueOnce({
        id: 'nostro-sub-1', clientId: 'cli-1', endDate: new Date('2026-08-08T00:00:00.000Z'),
        plan: { name: 'Mantenimento' }, client: { email: 'giulia@test.it', locale: 'it' },
      });

    // Prima: qui il webhook rispondeva 500, Stripe riconsegnava, e al secondo giro il
    // pagamento risultava già fatto → provvigioni perse per sempre, in silenzio.
    const res: any = await service.handleInvoicePaid({ type: 'invoice.paid', data: { object: fattura() } });

    expect(res).toEqual({ handled: true, renewed: true });
    // La ricevuta parte lo stesso: sta DOPO le provvigioni, e prima saltava insieme a loro.
    expect(h.mail.sendPaymentReceipt).toHaveBeenCalled();
    // …e con l'allegato: dal secondo mese in poi la ricevuta arrivava senza ricevuta dentro.
    expect(h.mail.sendPaymentReceipt.mock.calls[0][3]).toEqual([
      expect.objectContaining({ name: expect.stringContaining('.pdf') }),
    ]);
    // E il guasto è scritto, con dentro come si rimedia.
    expect(h.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'commerce.commission.failed',
        entityId: 'pay-rinnovo',
        metadata: expect.objectContaining({ errore: 'database occupato' }),
      }),
    );
  });
});
