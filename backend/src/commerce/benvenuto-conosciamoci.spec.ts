import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { ReferralService } from '../referral/referral.service';
import { CommerceService } from './commerce.service';
import { CrmService } from './crm.service';
import { DiscountsService } from './discounts.service';
import { FinanceService } from './finance.service';
import { StripeService } from './stripe.service';
import { giornoLocale } from '../common/date-only';
import { MESI_MAX_DATA_INIZIO, isTrialPlan, validaDataInizio } from './piano-prova';
import { assicuraProvaIniziata, provaAttivata } from './prova-attivata';

/**
 * §16.1 — «CONOSCIAMOCI» SI ATTIVA DA SOLO A FINE QUESTIONARIO.
 *
 * I casi qui sotto non sono scelti per copertura: sono le otto conseguenze dell'analisi dell'11/8,
 * quella che elencava cosa si rompe togliendo il pagamento a €0. Il test serve a impedire che
 * tornino, una per una — a partire dalla prima, che è anche la peggiore: una Subscription `pending`
 * senza `Payment` è una cliente che non può comprare più niente, per sempre.
 */

const GIORNO = 86_400_000;
const oggiSolo = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
/**
 * ⚠️ IL GIORNO SI LEGGE NEL FUSO DELL'AZIENDA, NON IN UTC.
 *
 * Qui c'era `d.toISOString().slice(0, 10)`, applicato a date che il prodotto costruisce a
 * **mezzanotte locale** (`soloGiorno`). A Greenwich le due cose coincidono — ed è per questo che la
 * CI e Render sono sempre stati verdi — ma su un Mac a Roma (UTC+2) mezzanotte del 16 è le 22:00Z
 * del 15, e il test leggeva **il giorno prima**: tre rossi il 13/8, tutti su codice che funziona.
 *
 * `giornoLocale` è la stessa funzione che usa il prodotto per dire «che giorno è», e non dipende
 * dal fuso della macchina che esegue i test. Un test che è vero solo a Greenwich non è un test:
 * è una trappola per chi lo esegue da casa.
 */
const iso = giornoLocale;

describe('validaDataInizio (regola pura)', () => {
  const oggi = new Date('2026-08-11T15:30:00.000Z');

  it('accetta OGGI (chi vuole partire subito parte subito)', () => {
    const e = validaDataInizio('2026-08-11', oggi);
    expect(e.ok).toBe(true);
  });

  it('normalizza a GIORNO: l’ora non entra nella data di inizio', () => {
    const e = validaDataInizio('2026-09-01T22:45:00.000Z', oggi);
    expect(e.ok && e.data.getHours()).toBe(0);
    expect(e.ok && e.data.getMinutes()).toBe(0);
  });

  it('rifiuta una data nel PASSATO', () => {
    expect(validaDataInizio('2026-08-10', oggi)).toEqual({ ok: false, motivo: 'passato' });
  });

  it('rifiuta la data MANCANTE: senza data non si va avanti (richiesta di Simone)', () => {
    expect(validaDataInizio('', oggi)).toEqual({ ok: false, motivo: 'mancante' });
    expect(validaDataInizio(null, oggi)).toEqual({ ok: false, motivo: 'mancante' });
    expect(validaDataInizio(undefined, oggi)).toEqual({ ok: false, motivo: 'mancante' });
  });

  it('rifiuta una data illeggibile', () => {
    expect(validaDataInizio('domani', oggi)).toEqual({ ok: false, motivo: 'illeggibile' });
  });

  /**
   * LA DATA LONTANA È PERMESSA — l'ha chiesto Simone, e l'aiuto sotto al campo lo dice. Quindi il
   * cap dei 60 giorni di `finalizeApproval` NON si applica qui: undici mesi devono passare.
   */
  it('accetta una data LONTANA (undici mesi): non è il cap dei 60 giorni di finalizeApproval', () => {
    expect(validaDataInizio('2027-07-01', oggi).ok).toBe(true);
  });

  it(`accetta il limite esatto di ${MESI_MAX_DATA_INIZIO} mesi e rifiuta il giorno dopo`, () => {
    const limite = new Date(2026, 7, 11);
    limite.setMonth(limite.getMonth() + MESI_MAX_DATA_INIZIO);
    expect(validaDataInizio(iso(limite), oggi).ok).toBe(true);
    expect(validaDataInizio(iso(new Date(limite.getTime() + GIORNO)), oggi)).toEqual({
      ok: false,
      motivo: 'troppo_lontana',
    });
  });

  it('rifiuta il refuso dell’anno (2036): è il caso per cui il limite esiste', () => {
    expect(validaDataInizio('2036-09-01', oggi)).toEqual({ ok: false, motivo: 'troppo_lontana' });
  });
});

describe('isTrialPlan', () => {
  it('è la prova solo a prezzo ZERO', () => {
    expect(isTrialPlan({ priceCents: 0 })).toBe(true);
    expect(isTrialPlan({ priceCents: 4900 })).toBe(false);
    // Prezzo assente ≠ gratuito: un piano senza prezzo non deve diventare «la prova» per sbaglio.
    expect(isTrialPlan({})).toBe(false);
    expect(isTrialPlan(null)).toBe(false);
  });
});

describe('provaAttivata (funnel + CRM + coach, al primo menu)', () => {
  let prisma: any;
  let push: any;

  beforeEach(() => {
    prisma = {
      analyticsEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'ev' }) },
      crmRecord: { findUnique: jest.fn().mockResolvedValue({ stage: 'questionnaire_done' }), update: jest.fn(), create: jest.fn() },
      pipelineStage: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve({ trial: { order: 3 }, questionnaire_done: { order: 2 }, paid: { order: 5 } }[where.key as string] ?? null),
        ),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'Giusy', assignedCoachId: 'staff-1' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ userId: 'coach-user' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-user', prefs: {} }) },
      notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  });

  it('emette trial_started, porta il CRM a «Prova» e avvisa la coach', async () => {
    const esito = await provaAttivata(prisma, push, { clientId: 'c1', subscriptionId: 'sub1' });
    expect(esito.registrata).toBe(true);
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'trial_started' }) }),
    );
    expect(prisma.crmRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stage: 'trial' }) }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'coach-user', type: 'client_trial_started' }) }),
    );
  });

  /**
   * `deliverIfEligible` gira a OGNI apertura dell'app. Senza questa guardia il conto delle prove
   * avviate diventerebbe il conto delle erogazioni, e il tasso di conversione crollerebbe senza che
   * niente sia cambiato nella realtà.
   */
  it('è idempotente: se trial_started esiste già non fa NIENTE', async () => {
    prisma.analyticsEvent.findFirst.mockResolvedValue({ id: 'ev-esistente' });
    const esito = await provaAttivata(prisma, push, { clientId: 'c1' });
    expect(esito.registrata).toBe(false);
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
    expect(prisma.crmRecord.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('non retrocede chi è già più avanti nella board (es. «Acquisito»)', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue({ stage: 'paid' });
    await provaAttivata(prisma, push, { clientId: 'c1' });
    expect(prisma.crmRecord.update).not.toHaveBeenCalled();
  });

  it('senza coach assegnata non avvisa nessun altro (e non fallisce)', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({ name: 'Giusy', assignedCoachId: null });
    const esito = await provaAttivata(prisma, push, { clientId: 'c1' });
    expect(esito.registrata).toBe(true);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  describe('assicuraProvaIniziata (la conversione di chi compra prima del primo menu)', () => {
    it('scrive trial_started A RITROSO se la prova c’è stata ma l’evento manca', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-prova', createdAt: new Date() });
      await expect(assicuraProvaIniziata(prisma, 'c1')).resolves.toBe(true);
      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'trial_started', data: expect.objectContaining({ recuperato: true }) }),
        }),
      );
    });

    it('non inventa una prova che non c’è stata', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);
      await expect(assicuraProvaIniziata(prisma, 'c1')).resolves.toBe(false);
      expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
    });
  });
});

describe('CommerceService.attivaBenvenuto', () => {
  let service: CommerceService;
  let prisma: any;
  let audit: any;
  let referral: any;
  let monitoring: any;
  let crm: any;

  beforeEach(async () => {
    prisma = {
      plan: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'plan-prova', name: 'Auto Apprendimento Gaia', priceCents: 0, period: '8d' },
        ]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sub-nuova', ...data })),
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      clientProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue({ planStartDate: null }) },
      payment: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      order: { create: jest.fn() },
      analyticsEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      crmRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ locale: 'it' }) },
      staff: { findUnique: jest.fn() },
      notification: { create: jest.fn() },
    };
    // `mockResolvedValue` e non `jest.fn()` nudo: il codice fa `audit.log(...).catch(...)` sui log
    // che non devono far fallire l'operazione, e un finto che torna `undefined` esploderebbe lì —
    // simulando un difetto che nel servizio vero non esiste (`AuditService.log` è async).
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    referral = { onConvert: jest.fn().mockResolvedValue(undefined), riscuotiSospese: jest.fn().mockResolvedValue(undefined) };
    monitoring = { onPlanActivated: jest.fn().mockResolvedValue(undefined) };
    crm = { autoAdvance: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommerceService,
        { provide: PrismaService, useValue: prisma },
        // `FILE_ENCRYPTION_KEY` serve al costruttore (chiave delle ricevute): senza, il servizio
        // non si costruisce nemmeno e il test fallisce prima di arrivare all'asserzione.
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('chiave-file-test') } },
        { provide: ConfigParamsService, useValue: { getString: jest.fn().mockResolvedValue(''), getNumber: jest.fn(), getBool: jest.fn().mockResolvedValue(true) } },
        { provide: MailService, useValue: { sendPaymentReceipt: jest.fn() } },
        { provide: NotificationsService, useValue: { notifyOncePerDay: jest.fn(), notify: jest.fn() } },
        { provide: FinanceService, useValue: { recordIncome: jest.fn(), generateCommissions: jest.fn() } },
        { provide: CrmService, useValue: crm },
        { provide: DiscountsService, useValue: { validate: jest.fn(), redeem: jest.fn() } },
        { provide: StripeService, useValue: { enabled: false } },
        { provide: AuditService, useValue: audit },
        { provide: PdfService, useValue: { renderTemplatePdf: jest.fn() } },
        { provide: ReferralService, useValue: referral },
        { provide: MonitoringService, useValue: monitoring },
      ],
    }).compile();
    service = moduleRef.get(CommerceService);
  });

  const fra = (giorni: number) => iso(new Date(oggiSolo().getTime() + giorni * GIORNO));

  it('attiva senza Payment e senza Order: «ora mi intasa la tabella acquisti e basta»', async () => {
    const out = await service.attivaBenvenuto('c1', fra(3));
    expect(out.attivata).toBe(true);
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  /** Conseguenza n.1 dell'analisi, la peggiore: una `pending` senza pagamento è senza uscita. */
  it('la Subscription nasce ACTIVE, con startDate ed endDate già scritte', async () => {
    await service.attivaBenvenuto('c1', fra(5));
    const dati = prisma.subscription.create.mock.calls[0][0].data;
    expect(dati.status).toBe('active');
    expect(dati.startDate).toBeInstanceOf(Date);
    expect(dati.endDate).toBeInstanceOf(Date);
    // 8 giorni di prova: la fine non è «tre mesi» per un fallback muto.
    const durata = Math.round((dati.endDate.getTime() - dati.startDate.getTime()) / GIORNO);
    expect(durata).toBe(8);
  });

  /** Conseguenza n.7: senza `planStartDate` `deliverIfEligible` non parte nemmeno. */
  it('scrive planStartDate: è il campo che nel percorso gratuito restava null', async () => {
    const quando = fra(4);
    await service.attivaBenvenuto('c1', quando);
    expect(prisma.clientProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { planStartDate: expect.any(Date) } }),
    );
    const scritta: Date = prisma.clientProfile.updateMany.mock.calls[0][0].data.planStartDate;
    expect(iso(scritta)).toBe(quando);
  });

  it('la data lontana è permessa: parte fra otto mesi senza cap a 60 giorni', async () => {
    const out = await service.attivaBenvenuto('c1', fra(240));
    expect(out.attivata).toBe(true);
    expect(iso(prisma.subscription.create.mock.calls[0][0].data.startDate)).toBe(fra(240));
  });

  it('chiama referral e monitoraggio come l’attivazione a pagamento', async () => {
    await service.attivaBenvenuto('c1', fra(1));
    expect(referral.onConvert).toHaveBeenCalledWith('c1');
    expect(referral.riscuotiSospese).toHaveBeenCalledWith('c1');
    expect(monitoring.onPlanActivated).toHaveBeenCalled();
  });

  /** Conseguenza n.8: sparendo il pagamento sparirebbe l'unica traccia dell'attivazione. */
  it('lascia un audit dell’attivazione, con dentro la data scelta', async () => {
    await service.attivaBenvenuto('c1', fra(2));
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'commerce.benvenuto.attivata', entityId: 'sub-nuova' }),
    );
  });

  /**
   * NON avanza il CRM e NON avvisa la coach: quelli scattano al primo menu (`provaAttivata`), che
   * con una data scelta dalla cliente può arrivare settimane dopo.
   */
  it('non tocca il CRM all’attivazione: «Prova» la mette il primo menu', async () => {
    await service.attivaBenvenuto('c1', fra(30));
    expect(crm.autoAdvance).not.toHaveBeenCalled();
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('è idempotente: il questionario si può rifare, l’abbonamento non si duplica', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-esistente' });
    const out = await service.attivaBenvenuto('c1', fra(3));
    expect(out.attivata).toBe(false);
    expect(out.giaAttiva).toBe(true);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('rifiuta una data nel passato e una oltre i 12 mesi, con un messaggio leggibile', async () => {
    await expect(service.attivaBenvenuto('c1', fra(-1))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.attivaBenvenuto('c1', fra(400))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('senza data non attiva niente', async () => {
    await expect(service.attivaBenvenuto('c1', '')).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * Se in produzione ci fossero DUE piani a €0 non si indovina: attivare quello sbagliato vuol dire
   * una durata sbagliata, quindi menu che finiscono quando non devono, e nessuno lo collegherebbe
   * mai a questa riga.
   */
  it('con più piani a €0 si ferma e chiede quale è la prova', async () => {
    prisma.plan.findMany.mockResolvedValue([
      { id: 'p0a', name: 'Conosciamoci', priceCents: 0, period: '8d' },
      { id: 'p0b', name: 'Omaggio interno', priceCents: 0, period: '1m' },
    ]);
    await expect(service.attivaBenvenuto('c1', fra(3))).rejects.toThrow(/trial_plan_id/);
  });

  it('rispetta trial_plan_id dai Parametri quando è impostato', async () => {
    const cfg = moduleConfig(service);
    cfg.getString.mockResolvedValue('plan-scelto');
    prisma.plan.findUnique.mockResolvedValue({ id: 'plan-scelto', name: 'Conosciamoci', priceCents: 0, period: '8d' });
    await service.attivaBenvenuto('c1', fra(3));
    expect(prisma.subscription.create.mock.calls[0][0].data.planId).toBe('plan-scelto');
    expect(prisma.plan.findMany).not.toHaveBeenCalled();
  });

  it('il piano della prova NON è comprabile: l’acquisto viene rifiutato anche con l’id in mano', async () => {
    prisma.plan.findFirst.mockResolvedValue({ id: 'plan-prova', name: 'Conosciamoci', priceCents: 0, period: '8d', active: true });
    await expect(service.subscribe('c1', 'plan-prova', 'giusy@test.it')).rejects.toThrow(/si attiva da solo/);
  });
});

/** Il `ConfigParamsService` finto, per il caso `trial_plan_id`. */
function moduleConfig(service: CommerceService): any {
  return (service as unknown as { configParams: any }).configParams;
}
