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
import { ReferralService } from '../referral/referral.service';
import { MonitoringService } from '../monitoring/monitoring.service';
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
        // Attivato il piano, il monitoraggio rilegge il piano dall'abbonamento per decidere
        // se convertire un monitoraggio in corso o erogare i menu di rientro.
        findUnique: jest.fn().mockResolvedValue({ plan: { id: 'p1', name: 'Trimestrale', priceCents: 29700, period: '3m' }, createdAt: new Date('2026-07-01T00:00:00.000Z') }),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sub1', ...data })),
        update: jest.fn(),
      },
      payment: {
        // CLAIM ATOMICO. L'approvazione non legge-e-poi-scrive più: fa una updateMany che
        // tocca la riga SOLO se è ancora in attesa, e decide dal `count`. Due operatori che
        // cliccano insieme → una sola vince. Il finto Prisma deve comportarsi come il vero,
        // altrimenti i test dell'idempotenza (webhook Stripe riconsegnato, doppio click)
        // misurano un mondo che non esiste: qui il claim guarda lo stato corrente e, se
        // riesce, sposta il pagamento ad "approved" come farebbe il database.
        updateMany: jest.fn(async ({ where, data }: any) => {
          const attuale = await prisma.payment.findUnique({ where: { id: where.id } });
          const claimabili = ['pending', 'receipt_uploaded'];
          if (!attuale || !claimabili.includes(attuale.status)) return { count: 0 };
          prisma.payment.findUnique.mockResolvedValue({ ...attuale, ...data });
          return { count: 1 };
        }),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pay-12345678', ...data })),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pay-12345678', ...data })),
      },
      // Funnel: prova iniziata → convertita, e riconoscimento del rinnovo (esiste un
      // abbonamento a pagamento precedente?). Nessuno dei due qui: primo acquisto, niente prova.
      analyticsEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'ev1' }) },
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
        {
          provide: ReferralService,
          useValue: {
            onConvert: jest.fn().mockResolvedValue(undefined),
            // Riscossione delle ricompense "porta un'amica" rimaste in sospeso: parte alla
            // stessa attivazione, nell'altro verso (questa cliente come referrer).
            riscuotiSospese: jest.fn().mockResolvedValue(undefined),
          },
        },
        // Provider aggiunti al costruttore del servizio ma dimenticati qui: il test non
        // falliva su un'asserzione, non partiva proprio (Nest non risolve le dipendenze).
        { provide: MonitoringService, useValue: { onPlanActivated: jest.fn().mockResolvedValue(undefined) } },
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

    it('con una richiesta NON pagata (pending) in corso → bloccato', async () => {
      // Solo il pending blocca (per non aprire due ordini insieme). Un abbonamento
      // ATTIVO invece NON blocca: il nuovo acquisto è consentito e parte in coda.
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-x', status: 'pending' });
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

    it('anche senza contabile si può approvare (operatore ha visto il bonifico in banca)', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...paymentReady(), status: 'pending' });
      const res = (await service.approvePayment(operator, 'pay-1')) as unknown as { status: string };
      expect(res.status).toBe('approved');
      expect(finance.recordIncome).toHaveBeenCalled();
    });

    it('un pagamento già chiuso (approvato/annullato) NON si riapprova', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...paymentReady(), status: 'cancelled' });
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

/**
 * ATTIVAZIONE MANUALE: incasso o omaggio?
 *
 * Segnalazione di Simone dell'8/8: aveva attivato a mano dalla scheda cliente il percorso del
 * socio, e in contabilità comparivano €130 di ricavi mai incassati. Lo stesso endpoint però serve
 * anche alla pagina Acquisti per registrare una vendita VERA fatta fuori dal negozio (un bonifico
 * gestito a mano): escluderle tutte avrebbe fatto sparire incassi reali dai libri.
 *
 * La distinzione è l'origine, e questi test la tengono ferma nei due versi — perché sbagliarla non
 * produce nessun errore, solo un numero falso che nessuno va a cercare mesi dopo.
 */
describe('CommerceService.createManualPurchase — cosa entra in contabilità', () => {
  let service: CommerceService;
  let finance: any;
  let audit: any;
  let prismaSpia: any;
  let crm: any;

  beforeEach(async () => {
    const prisma: any = {
      plan: { findFirst: jest.fn().mockResolvedValue({ id: 'plan1', name: 'Percorso 1 mese', priceCents: 13000, period: '1m', active: true }) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1', email: 'c@test.it', locale: 'it' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
      subscription: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sub1', ...data })),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ plan: { id: 'plan1', name: 'Percorso 1 mese', priceCents: 13000, period: '1m' } }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      payment: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pay-1', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pay-1', ...data })),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'Giulia' }), update: jest.fn() },
      analyticsEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      order: { update: jest.fn() },
      crmRecord: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      ledgerEntry: { create: jest.fn() },
    };
    finance = { recordIncome: jest.fn().mockResolvedValue(undefined), generateCommissions: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    crm = {
      onPaid: jest.fn().mockResolvedValue(undefined),
      avanzaStato: jest.fn().mockResolvedValue(undefined),
      autoAdvance: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommerceService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('chiave-file-test') } },
        { provide: ConfigParamsService, useValue: { getString: jest.fn().mockResolvedValue(''), getNumber: jest.fn(), getBool: jest.fn().mockResolvedValue(false) } },
        { provide: MailService, useValue: { sendPaymentReceipt: jest.fn().mockResolvedValue(true), sendBankTransferInstructions: jest.fn() } },
        { provide: NotificationsService, useValue: { notify: jest.fn().mockResolvedValue(undefined), notifyOncePerDay: jest.fn().mockResolvedValue(true) } },
        { provide: FinanceService, useValue: finance },
        { provide: CrmService, useValue: crm },
        { provide: DiscountsService, useValue: { validate: jest.fn(), redeem: jest.fn().mockResolvedValue(undefined) } },
        { provide: StripeService, useValue: { enabled: false } },
        { provide: AuditService, useValue: audit },
        { provide: PdfService, useValue: { renderTemplatePdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) } },
        {
          provide: ReferralService,
          // ⚠️ devono restituire una PROMESSA: il servizio ci mette `.catch()` sopra, e un mock
          // che torna undefined non fallisce un'asserzione — fa esplodere il metodo.
          useValue: { onConvert: jest.fn().mockResolvedValue(undefined), riscuotiSospese: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: MonitoringService, useValue: { onPlanActivated: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = moduleRef.get(CommerceService);
    prismaSpia = prisma;
  });

  const attiva = (origine?: string, generateCommissions = false) =>
    service.createManualPurchase(operator, { clientId: 'client-1', planId: 'plan1', generateCommissions, origine });

  /** L'ultimo `payment.create` visto dal finto Prisma: è lì che si legge l'importo registrato. */
  const pagamentoScritto = () => (prismaSpia.payment.create.mock.calls.at(-1)?.[0] as any).data;

  it('dalla SCHEDA CLIENTE: il piano si attiva ma NON scrive ricavi', async () => {
    await attiva('scheda_cliente');
    expect(finance.recordIncome).not.toHaveBeenCalled();
  });

  it('da ACQUISTI: è una vendita vera e va in contabilità', async () => {
    await attiva('acquisti');
    expect(finance.recordIncome).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 13000, category: 'subscription' }),
    );
  });

  it('senza `origine` contabilizza: un chiamante vecchio non fa sparire un incasso vero', async () => {
    await attiva(undefined);
    expect(finance.recordIncome).toHaveBeenCalled();
  });

  it('l\'audit dice se doveva entrare nei conti, e da dove arrivava', async () => {
    await attiva('scheda_cliente');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'commerce.purchase.manual',
        metadata: expect.objectContaining({ origine: 'scheda_cliente', contabilizzato: false }),
      }),
    );
  });

  /**
   * SECONDO RICHIAMO DI SIMONE, la sera dell'8/8: «il prodotto attivato dalla scheda cliente
   * impatta sui grafici… va registrato a costo 0 lo avevo già detto».
   *
   * Aveva ragione e la prima correzione era incompleta: teneva il ledger pulito, ma **i grafici del
   * fatturato non leggono il ledger** — sommano `payment.amountCents` di tutti i pagamenti
   * approvati (`analytics.service.ts`, e la dashboard fa lo stesso). Con l'importo pieno lì,
   * «Fatturato / mese» e «Fatturato cumulato» mostravano €698 mai incassati.
   *
   * Da qui in avanti l'importo registrato è la verità unica: 0. Il listino resta nella descrizione
   * e nell'audit, dove serve a ricostruire cosa è stato attivato senza inquinare nessuna somma.
   */
  it('dalla SCHEDA CLIENTE il pagamento è registrato a ZERO: è quello che i grafici sommano', async () => {
    await attiva('scheda_cliente');
    expect(pagamentoScritto().amountCents).toBe(0);
  });

  it('il listino non si perde: resta nella descrizione e nell\'audit', async () => {
    await attiva('scheda_cliente');
    expect(pagamentoScritto().description).toContain('130,00');
    expect(pagamentoScritto().description).toContain('senza incasso');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ amountCents: 0, prezzoListinoCents: 13000 }),
      }),
    );
  });

  it('da ACQUISTI l\'importo registrato è quello vero: i grafici devono vederlo', async () => {
    await attiva('acquisti');
    expect(pagamentoScritto().amountCents).toBe(13000);
    expect(pagamentoScritto().description).toBe('Abbonamento Percorso 1 mese');
  });

  it('senza incasso non nascono provvigioni, nemmeno se la richiesta le chiede', async () => {
    await attiva('scheda_cliente', true);
    expect(finance.generateCommissions).not.toHaveBeenCalled();
  });

  it('da ACQUISTI le provvigioni restano una scelta di chi registra', async () => {
    await attiva('acquisti', true);
    expect(finance.generateCommissions).toHaveBeenCalled();
  });

  /**
   * Registrare 0 aveva tre effetti collaterali, tutti a valle dello stesso `if (amountCents === 0)`:
   * l'attivazione sarebbe passata per una PROVA. Questi tre test tengono chiusa quella porta.
   */
  it('non finisce nel funnel come prova: non è né una prova né una conversione', async () => {
    await attiva('scheda_cliente');
    expect(prismaSpia.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('non tocca lo stato CRM della cliente', async () => {
    await attiva('scheda_cliente');
    expect(crm.autoAdvance).not.toHaveBeenCalled();
  });

  it('la durata resta quella del piano: 0 registrato non vuol dire piano gratuito', async () => {
    await attiva('scheda_cliente');
    const attivazione = prismaSpia.subscription.update.mock.calls.at(-1)[0];
    const giorni = Math.round(
      (attivazione.data.endDate.getTime() - attivazione.data.startDate.getTime()) / 86_400_000,
    );
    // Un mese, non gli 8 giorni della rete di sicurezza sui piani gratuiti.
    expect(giorni).toBeGreaterThan(20);
  });
});
