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
  /** Il registro: la promozione delle code ci scrive una riga per piano. */
  let audit: any;

  beforeEach(async () => {
    prisma = {
      plan: { findFirst: jest.fn().mockResolvedValue({ id: 'plan1', name: '3 mesi', priceCents: 29700, period: '3m', active: true }), findMany: jest.fn() },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'pr1', name: 'Omega 3', priceCents: 1990 }]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Giulia',
          consents: { healthDataConsent: { accepted: true } },
        }),
        // Il piano in coda riallinea `planStartDate`: scheda, scadenza e menu devono dire la
        // stessa data (decisione del 10/8).
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        // La promozione notturna delle code (voce 258): legge i `queued` arrivati e li sposta.
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
    // ⚠️ `log` deve tornare una PROMESSA, non `undefined`: il ramo del piano in coda scrive l'audit
    // con `.catch(() => undefined)`, e un finto audit sincrono faceva esplodere il test su un
    // difetto che non esiste. Un doppio di comodo che si comporta diversamente dall'originale non
    // sta verificando il codice vero.
    audit = { log: jest.fn().mockResolvedValue(undefined), logMany: jest.fn().mockResolvedValue(undefined) };

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
            cancelAtPeriodEnd: jest.fn().mockResolvedValue(undefined),
            resumeSubscription: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AuditService, useValue: audit },
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

    /**
     * ⚠️ IL PIANO CHE PARTE PIÙ AVANTI NASCE `queued` (voce 258, seconda metà — 19/8). Fino a ieri
     * si scriveva `active` con la data nel futuro: le date lo tenevano fuori dall'erogazione, ma la
     * stessa parola diceva due cose («sta erogando» e «comincia fra tre settimane») e ognuno dei
     * novanta punti che leggono `status` doveva ricordarsi di guardare anche le date. Il caso
     * Lorena del 17/8 è nato lì.
     */
    it('⚠️ in coda a un piano attivo: nasce `queued`, non `active`', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentReady());
      // C'è già un piano attivo che finisce fra un mese: il nuovo parte alla sua scadenza.
      const fraUnMese = new Date(Date.now() + 30 * 86_400_000);
      prisma.subscription.findFirst.mockResolvedValue({ endDate: fraUnMese });
      await service.approvePayment(operator, 'pay-1');
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'queued', startDate: fraUnMese }) }),
      );
    });

    /**
     * ⚠️ LA CODA SI CALCOLA SU TUTTI I PIANI COMPRATI, NON SUI SOLI `active` (19/8).
     *
     * Da quando la coda si scrive `queued`, cercare «un altro piano attivo che finisce nel futuro»
     * non trovava più le code: una cliente che ne ha già una in fila e compra un terzo piano se lo
     * ritrovava sovrapposto per intero a quello già pagato — cioè il caso Lorena, riaperto dalla
     * scrittura nuova. Il finto Prisma non filtra, quindi qui si guarda la domanda che è stata
     * fatta al database: è l'unica cosa che il test può vedere.
     */
    it('⚠️ il piano nuovo si accoda anche a una coda, non solo a chi sta erogando', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentReady());
      prisma.subscription.findFirst.mockResolvedValue({ endDate: new Date(Date.now() + 60 * 86_400_000) });
      await service.approvePayment(operator, 'pay-1');
      const domanda = prisma.subscription.findFirst.mock.calls
        .map((c: any[]) => c[0])
        .find((w: any) => w?.where?.endDate?.gt);
      expect(domanda.where.status).toEqual({ in: expect.arrayContaining(['active', 'queued']) });
    });

    it('e la data scelta dalla cliente nel futuro fa lo stesso: è una coda anche quella', async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentReady());
      prisma.subscription.findFirst.mockResolvedValue(null);
      const fraDieciGiorni = new Date(Date.now() + 10 * 86_400_000);
      prisma.clientProfile.findUnique.mockResolvedValue({ planStartDate: fraDieciGiorni, consents: {} });
      await service.approvePayment(operator, 'pay-1');
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'queued' }) }),
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

  /**
   * LA PROMOZIONE DELLE CODE ARRIVATE — l'altra metà della voce 258 (19/8).
   *
   * Scrivere `queued` all'acquisto ha senso solo se qualcuno, il giorno giusto, dice «adesso».
   * ⚠️ Nessuna lettura promuove da sola: un `queued` non eroga nemmeno con la data già passata,
   * perché indovinare vorrebbe dire consegnare i menu di un piano che nessuno ha fatto partire.
   * Questo è quel qualcuno, e gira nel cron notturno **prima** del motore.
   */
  /**
   * L'ABBONAMENTO RICORRENTE CHE COMINCIA PIÙ AVANTI — voce 258, 19/8.
   *
   * ⚠️ Stripe addebita **da subito** un abbonamento comprato per cominciare fra due settimane.
   * Cercando i soli `active`, il profilo della cliente non mostrava nessun abbonamento e il
   * pulsante della disdetta rispondeva «Nessun abbonamento da disdire»: pagava e non poteva
   * uscire, se non bloccando la carta. Fare la disdetta self-service è una scelta di prodotto —
   * e una scelta che vale solo se il pulsante funziona.
   */
  describe('abbonamento Stripe in coda: si vede e si disdice', () => {
    const conCarta = {
      id: 'sub-stripe',
      endDate: new Date(Date.now() + 60 * 86_400_000),
      cancelAtPeriodEnd: false,
      lastPaymentFailedAt: null,
      stripeSubscriptionId: 'sub_ABC',
      plan: { name: 'Mensile', priceCents: 4900 },
    };

    it('⚠️ il profilo lo mostra anche se comincia più avanti', async () => {
      prisma.subscription.findFirst.mockResolvedValue(conCarta);
      expect(await service.myRecurring('client-1')).not.toBeNull();
      expect(prisma.subscription.findFirst.mock.calls[0][0].where.status).toEqual({
        in: expect.arrayContaining(['active', 'queued']),
      });
    });

    it('⚠️ e si può disdire: non si resta chiusi dentro un piano che non è ancora cominciato', async () => {
      prisma.subscription.findFirst.mockResolvedValue(conCarta);
      const esito = await service.cancelMyRecurring('client-1');
      expect(esito.disdetta).toBe(true);
      expect(prisma.subscription.findFirst.mock.calls[0][0].where.status).toEqual({
        in: expect.arrayContaining(['active', 'queued']),
      });
    });

    /**
     * ⚠️ E CI SI PUÒ RIPENSARE. Le tre porte sono una cosa sola: se la disdetta si può fare su un
     * piano in coda ma il ripensamento no, il pulsante «Riattiva» risponde «Nessuna disdetta da
     * annullare» a chi la disdetta l'ha appena fatta — e per restare cliente deve scrivere a
     * qualcuno. Una porta che si apre in un verso solo è peggio di una porta chiusa.
     */
    it('⚠️ e ci si può ripensare: il «Riattiva» funziona anche sul piano in coda', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ ...conCarta, cancelAtPeriodEnd: true });
      await service.resumeMyRecurring('client-1');
      expect(prisma.subscription.findFirst.mock.calls[0][0].where.status).toEqual({
        in: expect.arrayContaining(['active', 'queued']),
      });
    });
  });

  describe('promuoviCodeArrivate (il piano in coda che comincia stanotte)', () => {
    const inCoda = (over: Record<string, unknown> = {}) => ({
      id: 'sub-coda',
      clientId: 'client-1',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 86_400_000),
      ...over,
    });
    /** Il finto database che si comporta come quello vero: la scrittura è guardata dallo stato. */
    const scritturaRiuscita = () => prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    /**
     * Le **tre** letture del metodo sono domande diverse, e il finto le distingue dal `where` come
     * farebbe il database: le code **sane** da promuovere, quelle **già finite** (che si contano
     * soltanto) e gli **altri piani** delle stesse clienti, che servono a non promuovere una coda
     * addosso a un piano che eroga ancora. Con un finto unico che risponde uguale a tutte e tre,
     * «le scadute non si promuovono» e «le sovrapposte non si promuovono» sembrerebbero funzionare
     * qualunque cosa facesse il codice.
     *
     * ⚠️ La terza è arrivata il 19/8 sera, e il finto è stato allargato **insieme** al codice: un
     * test double che risponde a una domanda che non gli è stata fatta non verifica niente — è la
     * stessa trappola per cui questo commento esisteva già con «due».
     */
    const codeInDb = ({ sane = [], scadute = [], altre = [] }: { sane?: unknown[]; scadute?: unknown[]; altre?: unknown[] }) =>
      prisma.subscription.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(where?.endDate?.lt ? scadute : where?.clientId?.in ? altre : sane),
      );

    it('il piano in coda arrivato passa ad attivo, e lo dice il registro', async () => {
      codeInDb({ sane: [inCoda()] });
      scritturaRiuscita();
      const esito = await service.promuoviCodeArrivate();
      expect(esito).toEqual({ promossi: 1, giaScaduti: 0, sovrapposte: 0 });
      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'active' } }),
      );
      expect(audit.logMany).toHaveBeenCalledWith([
        expect.objectContaining({ action: 'commerce.plan.promoted', entityId: 'sub-coda' }),
      ]);
    });

    /**
     * ⚠️ IL REGISTRO NON PORTA UN `actorId` INVENTATO. `AuditLog.actorId` è una chiave esterna su
     * `user`: un `'system'` che non esiste fa fallire l'INSERT, e `AuditService` inghiotte
     * l'errore — quindi il registro di questo passo non esisterebbe **e nessuno lo saprebbe**. È
     * proprio il caso in cui il registro serve: qui non c'è nessuno che guarda.
     */
    it('⚠️ la riga di registro non ha un attore inventato: `actorId` è una chiave esterna', async () => {
      codeInDb({ sane: [inCoda()] });
      scritturaRiuscita();
      await service.promuoviCodeArrivate();
      expect(audit.logMany.mock.calls[0][0][0].actorId).toBeUndefined();
    });

    /**
     * ⚠️ IL CONFRONTO È PER GIORNO, E IL GIORNO È QUELLO DELL'AZIENDA. `startDate` è una data: il
     * piano che parte «oggi» è scritto a mezzanotte e il cron gira alle 05:00 UTC. Su Render il
     * processo è in UTC, quindi una «fine di oggi» calcolata col fuso del processo sarebbe stata
     * l'01:59 di domani a Roma — un piano comprato dopo mezzanotte sarebbe partito un giorno di
     * calendario in anticipo. Il fuso in questo progetto ha una risposta sola (`date-only.ts`).
     */
    it('⚠️ prende tutti quelli che cominciano OGGI, e «oggi» è il giorno dell\'azienda', async () => {
      codeInDb({});
      // Un istante che a Roma è già il 20 agosto e in UTC è ancora il 19.
      await service.promuoviCodeArrivate(new Date('2026-08-19T23:30:00.000Z'));
      const soglia: Date = prisma.subscription.findMany.mock.calls[0][0].where.startDate.lte;
      expect(prisma.subscription.findMany.mock.calls[0][0].where.status).toBe('queued');
      // La fine del 20 agosto, non del 19: la cliente che parte il 20 parte stanotte.
      expect(soglia.toISOString()).toBe('2026-08-20T23:59:59.999Z');
      expect(new Date('2026-08-20T00:00:00.000Z').getTime()).toBeLessThanOrEqual(soglia.getTime());
      expect(new Date('2026-08-21T00:00:00.000Z').getTime()).toBeGreaterThan(soglia.getTime());
    });

    it('nessuna coda arrivata: non scrive niente', async () => {
      codeInDb({});
      expect(await service.promuoviCodeArrivate()).toEqual({ promossi: 0, giaScaduti: 0, sovrapposte: 0 });
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
      expect(audit.logMany).not.toHaveBeenCalled();
    });

    /**
     * ⚠️ LA SCRITTURA È GUARDATA DA `status: 'queued'`, E NON È UN DOPPIONE DELLA LETTURA.
     *
     * Fra la lettura delle code e la scrittura passa del tempo, e in mezzo può esserci
     * un'operatrice che rimborsa quel contratto (`refundPayment` lo porta a `cancelled`) o una
     * seconda passata del cron. Senza la guardia riaccenderemmo un piano che non c'è più: la
     * cliente si ritroverebbe i menu di un abbonamento rimborsato.
     */
    it('⚠️ scrive solo su chi è ANCORA in coda, e con la partenza ancora arrivata', async () => {
      codeInDb({ sane: [inCoda()] });
      scritturaRiuscita();
      await service.promuoviCodeArrivate();
      const where = prisma.subscription.updateMany.mock.calls[0][0].where;
      expect(where.id).toBe('sub-coda');
      expect(where.status).toBe('queued');
      // ⚠️ E la data: fra la lettura e la scrittura la matita può aver spostato l'inizio in avanti.
      expect(where.startDate.lte).toBeInstanceOf(Date);
    });

    /**
     * ⚠️ «PROMOSSI» È QUANTI NE HA CAMBIATI IL DATABASE, NON QUANTI NE AVEVO LETTI.
     *
     * I due numeri coincidono quasi sempre, ed è per questo che è facile scambiarli: il giorno in
     * cui non coincidono è esattamente il giorno in cui è successo qualcosa. Se `promossi`
     * contasse le righe lette, il cron direbbe «2 piani partiti» mentre ne è partito uno — e il
     * rapporto che dovrebbe farci accorgere del problema sarebbe quello che lo nasconde. E la
     * riga di registro nascerebbe anche per il piano che non è partito.
     */
    it('⚠️ chi non è stato toccato non conta e non finisce nel registro', async () => {
      // ⚠️ Clienti DIVERSE: due code della stessa cliente con le stesse date si sovrappongono
      // davvero, e dal 19/8 sera non si promuovono — che qui sarebbe un altro test.
      codeInDb({ sane: [inCoda({ id: 'sub-a' }), inCoda({ id: 'sub-b', clientId: 'client-2' })] });
      // `sub-b` è stato rimborsato fra la lettura e la scrittura: la guardia lo salta.
      prisma.subscription.updateMany.mockImplementation(({ where }: any) =>
        Promise.resolve({ count: where.id === 'sub-a' ? 1 : 0 }),
      );
      expect(await service.promuoviCodeArrivate()).toEqual({ promossi: 1, giaScaduti: 0, sovrapposte: 0 });
      expect(audit.logMany).toHaveBeenCalledWith([expect.objectContaining({ entityId: 'sub-a' })]);
    });

    /**
     * ⚠️ UNA CODA ARRIVATA A SCADENZA SENZA MAI PARTIRE **NON** SI PROMUOVE, E SI GRIDA.
     *
     * Promuoverla sembrava il gesto onesto: lo stato vero invece di uno `queued` che nessuno
     * guarda. Ma da attiva-e-finita quella riga entra, nella stessa notte, nella scadenza
     * automatica delle prove (che a +7 giorni **cancella** pesi dei menu, valutazioni, base
     * personale e certificato), nel report di fine percorso consegnato in app e nella chiusura CRM.
     * Una cliente che ha pagato e non ha mai ricevuto un piatto si prenderebbe i complimenti per il
     * percorso e la cancellazione della personalizzazione — e nessuna delle due si torna indietro.
     * Cosa farne è una decisione di Simone; questo cron non la prende, la **dice**.
     */
    it('⚠️ una coda arrivata a scadenza senza mai partire resta in coda, e finisce nei log', async () => {
      const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      codeInDb({ scadute: [inCoda({ id: 'sub-vecchia', endDate: new Date(Date.now() - 2 * 86_400_000) })] });
      scritturaRiuscita();
      const esito = await service.promuoviCodeArrivate();
      expect(esito).toEqual({ promossi: 0, giaScaduti: 1, sovrapposte: 0 });
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('client-1'));
    });

    /** ⚠️ E le altre code della stessa notte partono lo stesso: una ferma non ferma le altre. */
    it('⚠️ una coda scaduta non blocca quelle sane della stessa passata', async () => {
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      codeInDb({
        sane: [inCoda({ id: 'sub-sana' })],
        scadute: [inCoda({ id: 'sub-vecchia', endDate: new Date(Date.now() - 2 * 86_400_000) })],
      });
      scritturaRiuscita();
      expect(await service.promuoviCodeArrivate()).toEqual({ promossi: 1, giaScaduti: 1, sovrapposte: 0 });
      expect(audit.logMany).toHaveBeenCalledWith([expect.objectContaining({ entityId: 'sub-sana' })]);
    });

    /**
     * ⚠️ IL REGISTRO SI SCRIVE ANCHE SE IL GIRO SI ROMPE A METÀ. Le righe già promosse sono già
     * attive sul database: senza il `finally`, il giro andato storto — l'unico in cui il registro
     * serve — sarebbe anche l'unico a non lasciarne traccia.
     */
    it('⚠️ se la scrittura esplode a metà, chi è già partito è comunque nel registro', async () => {
      // ⚠️ Clienti DIVERSE: due code della stessa cliente con le stesse date si sovrappongono
      // davvero, e dal 19/8 sera non si promuovono — che qui sarebbe un altro test.
      codeInDb({ sane: [inCoda({ id: 'sub-a' }), inCoda({ id: 'sub-b', clientId: 'client-2' })] });
      prisma.subscription.updateMany.mockImplementation(({ where }: any) =>
        where.id === 'sub-a' ? Promise.resolve({ count: 1 }) : Promise.reject(new Error('Neon ha chiuso')),
      );
      await expect(service.promuoviCodeArrivate()).rejects.toThrow('Neon ha chiuso');
      expect(audit.logMany).toHaveBeenCalledWith([expect.objectContaining({ entityId: 'sub-a' })]);
    });

    /** ⚠️ L'ultimo giorno del piano è un giorno di piano: chi finisce OGGI non è scaduto. */
    it('⚠️ il piano che finisce oggi non è «già scaduto»', async () => {
      codeInDb({ sane: [inCoda({ endDate: new Date('2026-08-19T00:00:00.000Z') })] });
      scritturaRiuscita();
      const esito = await service.promuoviCodeArrivate(new Date('2026-08-19T18:00:00.000Z'));
      expect(esito).toEqual({ promossi: 1, giaScaduti: 0, sovrapposte: 0 });
    });

    /**
     * ⚠️ UNA CODA NON SI PROMUOVE ADDOSSO A UN PIANO CHE EROGA ANCORA (19/8 sera).
     *
     * Il gemello della coda scaduta, e nasce dalla stessa indagine: questo cron guardava `id`,
     * `status` e `startDate` — **non le altre righe della cliente**. Basta che il piano precedente
     * si sia allungato dopo che la coda è stata messa in fila (una pausa concessa, un rinnovo
     * Stripe) e la promozione della notte crea **due piani attivi insieme**: il caso Lorena, scritto
     * da un automatismo invece che da una persona.
     *
     * ⛔ E la cliente ci perde davvero: `attivoInCorso` ne sceglie uno solo, e i giorni dell'altro
     * scorrono senza che riceva niente. Paga e non riceve.
     */
    it('⚠️ una coda che finirebbe ADDOSSO a un piano ancora in corso non si promuove', async () => {
      const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      codeInDb({
        sane: [inCoda({ id: 'sub-coda', startDate: new Date('2026-08-19T00:00:00.000Z') })],
        // Il piano di prima, allungato da una pausa: finisce fra dieci giorni, non ieri.
        altre: [{ id: 'sub-prima', clientId: 'client-1', startDate: new Date('2026-06-01T00:00:00.000Z'), endDate: new Date('2026-08-29T00:00:00.000Z') }],
      });
      scritturaRiuscita();
      const esito = await service.promuoviCodeArrivate(new Date('2026-08-19T05:00:00.000Z'));
      expect(esito).toEqual({ promossi: 0, giaScaduti: 0, sovrapposte: 1 });
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('client-1'));
    });

    /**
     * ⚠️ **TOCCARSI NON È SOVRAPPORSI**, ed è il caso più frequente di tutti: la coda che
     * `finalizeApproval` costruisce parte **esattamente** il giorno in cui finisce il piano prima.
     * Se questo test non ci fosse, il controllo nuovo bloccherebbe **ogni rinnovo** — cioè
     * spegnerebbe la promozione notturna per tutti, e in silenzio.
     */
    it('⚠️ il passaggio di testimone normale (finisce il 19, parte il 19) si promuove', async () => {
      codeInDb({
        sane: [inCoda({ id: 'sub-coda', startDate: new Date('2026-08-19T00:00:00.000Z') })],
        altre: [{ id: 'sub-prima', clientId: 'client-1', startDate: new Date('2026-06-01T00:00:00.000Z'), endDate: new Date('2026-08-19T00:00:00.000Z') }],
      });
      scritturaRiuscita();
      expect(await service.promuoviCodeArrivate(new Date('2026-08-19T05:00:00.000Z'))).toEqual({
        promossi: 1, giaScaduti: 0, sovrapposte: 0,
      });
    });

    /** ⚠️ Il piano di un'ALTRA cliente non c'entra niente: il controllo è per persona. */
    it('⚠️ il piano di un\'altra cliente non blocca la promozione', async () => {
      codeInDb({
        sane: [inCoda({ id: 'sub-coda', startDate: new Date('2026-08-19T00:00:00.000Z') })],
        altre: [{ id: 'sub-altrui', clientId: 'client-9', startDate: new Date('2026-06-01T00:00:00.000Z'), endDate: new Date('2026-08-29T00:00:00.000Z') }],
      });
      scritturaRiuscita();
      expect(await service.promuoviCodeArrivate(new Date('2026-08-19T05:00:00.000Z'))).toEqual({
        promossi: 1, giaScaduti: 0, sovrapposte: 0,
      });
    });

    /**
     * ⚠️ DUE CODE DELLA STESSA CLIENTE CHE ARRIVANO LA STESSA NOTTE e si sovrappongono fra loro:
     * restano ferme **tutte e due**. Promuoverne una e poi l'altra non basterebbe — il secondo giro
     * non vedrebbe la prima, perché le righe si leggono tutte prima di cominciare a scrivere.
     */
    it('⚠️ due code della stessa cliente che si accavallano restano ferme tutte e due', async () => {
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      codeInDb({
        sane: [
          inCoda({ id: 'sub-a', startDate: new Date('2026-08-19T00:00:00.000Z'), endDate: new Date('2026-11-19T00:00:00.000Z') }),
          inCoda({ id: 'sub-b', startDate: new Date('2026-08-19T00:00:00.000Z'), endDate: new Date('2026-11-19T00:00:00.000Z') }),
        ],
      });
      scritturaRiuscita();
      expect(await service.promuoviCodeArrivate(new Date('2026-08-19T05:00:00.000Z'))).toEqual({
        promossi: 0, giaScaduti: 0, sovrapposte: 2,
      });
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });

    /** ⚠️ E una coda ferma non ferma quelle sane: come per le scadute, il giro continua. */
    it('⚠️ una coda sovrapposta non blocca quelle sane della stessa passata', async () => {
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      codeInDb({
        sane: [
          inCoda({ id: 'sub-bloccata', startDate: new Date('2026-08-19T00:00:00.000Z') }),
          inCoda({ id: 'sub-sana', clientId: 'client-2', startDate: new Date('2026-08-19T00:00:00.000Z') }),
        ],
        altre: [{ id: 'sub-prima', clientId: 'client-1', startDate: new Date('2026-06-01T00:00:00.000Z'), endDate: new Date('2026-08-29T00:00:00.000Z') }],
      });
      scritturaRiuscita();
      expect(await service.promuoviCodeArrivate(new Date('2026-08-19T05:00:00.000Z'))).toEqual({
        promossi: 1, giaScaduti: 0, sovrapposte: 1,
      });
      expect(audit.logMany).toHaveBeenCalledWith([expect.objectContaining({ entityId: 'sub-sana' })]);
    });

    /** ⚠️ Il registro che non scrive non deve far saltare la promozione: i menu contano di più. */
    it('⚠️ un registro che esplode non impedisce al piano di partire', async () => {
      codeInDb({ sane: [inCoda()] });
      scritturaRiuscita();
      audit.logMany.mockRejectedValue(new Error('registro giù'));
      await expect(service.promuoviCodeArrivate()).resolves.toEqual({ promossi: 1, giaScaduti: 0, sovrapposte: 0 });
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
