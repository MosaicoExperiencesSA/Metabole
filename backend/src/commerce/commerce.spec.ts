import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PdfService } from '../pdf/pdf.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceService } from './commerce.service';
import { CrmService } from './crm.service';
import { DiscountsService } from './discounts.service';
import { FinanceService } from './finance.service';
import { StripeService } from './stripe.service';

const operator: AuthUser = { sub: 'op-user', email: 'op@m.eu', role: 'sales' };
const pdf = Buffer.from('%PDF-1.4 contabile bonifico finta').toString('base64');

describe('CommerceService (flusso bonifico)', () => {
  let service: CommerceService;
  let prisma: any;
  let mail: any;
  let finance: any;
  let crm: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      plan: { findFirst: jest.fn().mockResolvedValue({ id: 'plan1', name: '3 mesi', priceCents: 29700, period: '3m', active: true }), findMany: jest.fn() },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'pr1', name: 'Omega 3', priceCents: 1990 }]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Giulia',
          consents: { healthDataConsent: { accepted: true } },
        }),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sub1', ...data })),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pay-12345678', ...data })),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pay-12345678', ...data })),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'ord1', ...data })),
        update: jest.fn(),
      },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-op' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ locale: 'it' }) },
    };
    mail = {
      sendBankTransferInstructions: jest.fn().mockResolvedValue(true),
      sendPaymentReceipt: jest.fn().mockResolvedValue(true),
    };
    finance = { recordIncome: jest.fn(), generateCommissions: jest.fn() };
    crm = { autoAdvance: jest.fn() };
    notifications = { notifyOncePerDay: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommerceService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('chiave-file-test') } },
        { provide: ConfigParamsService, useValue: { getString: jest.fn().mockResolvedValue('IBAN IT00 TEST'), getNumber: jest.fn(), getBool: jest.fn().mockResolvedValue(true) } },
        { provide: MailService, useValue: mail },
        { provide: NotificationsService, useValue: notifications },
        { provide: FinanceService, useValue: finance },
        { provide: CrmService, useValue: crm },
        { provide: DiscountsService, useValue: { validate: jest.fn(), redeem: jest.fn() } },
        {
          provide: StripeService,
          useValue: {
            enabled: true,
            createCheckoutSession: jest.fn().mockResolvedValue({ sessionId: 'cs_test_1', url: 'https://checkout.stripe.com/cs_test_1' }),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PdfService, useValue: { renderTemplatePdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) } },
      ],
    }).compile();
    service = moduleRef.get(CommerceService);
  });

  describe('subscribe', () => {
    it('crea abbonamento pending + pagamento pending e invia gli ESTREMI via email', async () => {
      const result = await service.subscribe('client-1', 'plan1', 'giulia@test.it');
      expect(result.subscription.status).toBe('pending');
      expect((result.payment as any).status).toBe('pending');
      expect(mail.sendBankTransferInstructions).toHaveBeenCalledWith(
        'giulia@test.it',
        expect.objectContaining({ amountCents: 29700, bankDetails: 'IBAN IT00 TEST' }),
        undefined, // locale non presente nel mock del profilo → default it
      );
      // niente attivazioni premature
      expect(finance.recordIncome).not.toHaveBeenCalled();
      expect(finance.generateCommissions).not.toHaveBeenCalled();
    });

    it('con method=card crea la sessione Stripe e restituisce il checkoutUrl (niente email estremi)', async () => {
      const result: any = await service.subscribe('client-1', 'plan1', 'giulia@test.it', 'card');
      expect(result.checkoutUrl).toContain('checkout.stripe.com');
      expect(mail.sendBankTransferInstructions).not.toHaveBeenCalled();
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { pspRef: 'cs_test_1' } }),
      );
    });

    it('GATING: senza consenso dati sanitari niente acquisto', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue({ consents: {} });
      await expect(service.subscribe('client-1', 'plan1', 'g@t.it')).rejects.toThrow(BadRequestException);
    });

    it('con richiesta già in corso o abbonamento attivo → bloccato', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-x', status: 'active' });
      await expect(service.subscribe('client-1', 'plan1', 'g@t.it')).rejects.toThrow(BadRequestException);
    });
  });

  describe('contabile', () => {
    it('upload valido → stato receipt_uploaded, contenuto cifrato', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', clientId: 'client-1', status: 'pending' });
      const result: any = await service.uploadReceipt('client-1', 'pay-1', {
        fileName: 'contabile.pdf', mimeType: 'application/pdf', contentBase64: pdf,
      });
      expect(result.status).toBe('receipt_uploaded');
      const stored = prisma.payment.update.mock.calls[0][0].data.receiptData;
      expect(Buffer.from(stored).includes(Buffer.from('%PDF'))).toBe(false); // mai in chiaro
      expect(result.receiptData).toBeUndefined(); // mai esposta nelle risposte
    });

    it('dopo un rifiuto si può ricaricare', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', clientId: 'client-1', status: 'rejected' });
      await expect(
        service.uploadReceipt('client-1', 'pay-1', { fileName: 'c.pdf', mimeType: 'application/pdf', contentBase64: pdf }),
      ).resolves.toBeDefined();
    });

    it('su un pagamento approvato non si carica più nulla', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', clientId: 'client-1', status: 'approved' });
      await expect(
        service.uploadReceipt('client-1', 'pay-1', { fileName: 'c.pdf', mimeType: 'application/pdf', contentBase64: pdf }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approvazione operatore (il cuore del flusso)', () => {
    const paymentReady = () => ({
      id: 'pay-1',
      clientId: 'client-1',
      subscriptionId: 'sub1',
      orderId: null,
      amountCents: 29700,
      description: 'Abbonamento 3 mesi',
      status: 'receipt_uploaded',
      subscription: { id: 'sub1', plan: { period: '3m' } },
      client: { email: 'giulia@test.it' },
    });

    it('attiva abbonamento, scrive income, genera provvigioni, CRM→paid, RICEVUTA via email', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentReady());
      await service.approvePayment(operator, 'pay-1');

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'active' }) }),
      );
      expect(finance.recordIncome).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 29700, category: 'subscription' }),
      );
      expect(finance.generateCommissions).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 29700 }),
      );
      expect(crm.autoAdvance).toHaveBeenCalledWith('client-1', 'paid', 'op-user', 29700);
      expect(mail.sendPaymentReceipt).toHaveBeenCalled();
      const receiptCall = (mail.sendPaymentReceipt as jest.Mock).mock.calls[0];
      expect(receiptCall[0]).toBe('giulia@test.it');
      expect(receiptCall[1]).toEqual(expect.objectContaining({ amountCents: 29700 }));
      expect(notifications.notifyOncePerDay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'payment_approved' }),
      );
    });

    it('senza contabile caricata NON si approva', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...paymentReady(), status: 'pending' });
      await expect(service.approvePayment(operator, 'pay-1')).rejects.toThrow(BadRequestException);
      expect(finance.recordIncome).not.toHaveBeenCalled();
    });

    it('WEBHOOK Stripe: checkout completato → stessa catena (attivazione, income, provvigioni, ricevuta)', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...paymentReady(), status: 'pending', method: 'card' });
      const result = await service.handleStripeEvent({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_1', payment_intent: 'pi_123', metadata: { paymentId: 'pay-1' } } },
      });
      expect(result.handled).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'active' }) }),
      );
      expect(finance.recordIncome).toHaveBeenCalled();
      expect(finance.generateCommissions).toHaveBeenCalled();
      expect(mail.sendPaymentReceipt).toHaveBeenCalled();
    });

    it('WEBHOOK idempotente: pagamento già approvato → nessun doppio evento', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...paymentReady(), status: 'approved' });
      const result = await service.handleStripeEvent({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_1', metadata: { paymentId: 'pay-1' } } },
      });
      expect(result).toEqual({ handled: true, idempotent: true });
      expect(finance.recordIncome).not.toHaveBeenCalled();
      expect(mail.sendPaymentReceipt).not.toHaveBeenCalled();
    });

    it('WEBHOOK: eventi non gestiti o senza paymentId → ignorati senza errori', async () => {
      const other = await service.handleStripeEvent({ type: 'invoice.created', data: { object: {} } });
      expect(other.handled).toBe(false);
      const noMeta = await service.handleStripeEvent({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_x', metadata: {} } },
      });
      expect(noMeta.handled).toBe(false);
    });

    it('rifiuto: motivazione salvata, cliente avvisata, nessun evento economico', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentReady());
      const rejected: any = await service.rejectPayment(operator, 'pay-1', 'Importo non corrispondente');
      expect(rejected.status).toBe('rejected');
      expect(notifications.notifyOncePerDay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'payment_rejected' }),
      );
      expect(finance.recordIncome).not.toHaveBeenCalled();
      expect(mail.sendPaymentReceipt).not.toHaveBeenCalled();
    });
  });
});
