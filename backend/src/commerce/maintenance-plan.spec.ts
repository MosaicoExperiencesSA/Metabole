import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreatePlanDto, UpdatePlanDto } from './dto/shop-admin.dto';
import {
  CommerceService,
  isKnownPeriod,
  isMaintenancePlan,
  subscriptionEnd,
} from './commerce.service';

/**
 * Segnalazione di Simone (5 agosto 2026): «avevamo detto che il mantenimento si doveva vedere
 * solo a raggiungimento obiettivo, invece lo vedono tutti».
 *
 * Il filtro in `listPlansForClient` c'era ed era giusto. A cedere erano i tre lati intorno:
 *
 * 1. il DTO limitava `period` a 10 caratteri e `maintenance` ne ha 11, quindi il piano non era
 *    piu' salvabile dal Negozio: chi ne modificava il prezzo, per far passare il salvataggio,
 *    finiva per accorciare il Periodo — e a quel punto il piano non era piu' riconosciuto;
 * 2. `GET /plans` (pubblico, senza login) restituiva l'elenco intero, mantenimento compreso;
 * 3. l'acquisto (`subscribe` e `checkout`) non ricontrollava niente: bastava avere il `planId`.
 *
 * Questi test coprono tutti e tre i lati, perche' il difetto e' nato proprio dall'aver protetto
 * solo la vetrina.
 */

const errorsFor = (cls: typeof CreatePlanDto | typeof UpdatePlanDto, body: Record<string, unknown>) =>
  validateSync(plainToInstance(cls, body) as object, { whitelist: true, forbidNonWhitelisted: true });

const periodErrors = (cls: typeof CreatePlanDto | typeof UpdatePlanDto, body: Record<string, unknown>) =>
  errorsFor(cls, body).filter((e) => e.property === 'period');

describe('DTO del Negozio: il periodo di un piano', () => {
  const base = { name: 'Mantenimento Metabole', priceCents: 2900 };

  it('accetta «maintenance» in creazione (11 caratteri: prima era bloccato da MaxLength(10))', () => {
    expect(periodErrors(CreatePlanDto, { ...base, period: 'maintenance' })).toHaveLength(0);
  });

  it('accetta «maintenance» in modifica: \u00e8 il salvataggio che l\'operatrice non riusciva a fare', () => {
    expect(periodErrors(UpdatePlanDto, { period: 'maintenance' })).toHaveLength(0);
  });

  it.each(['8d', '2w', '3m', '12m', '1y', '3'])('accetta il formato normale «%s»', (period) => {
    expect(periodErrors(CreatePlanDto, { ...base, period })).toHaveLength(0);
  });

  it.each(['mantenimento', '3 mesi', 'abc', '0m', '', '-2m'])('rifiuta «%s»', (period) => {
    expect(periodErrors(CreatePlanDto, { ...base, period }).length).toBeGreaterThan(0);
  });

  it('quello che il DTO accetta è esattamente quello che subscriptionEnd sa interpretare', () => {
    // Se le due regole divergono, un periodo "valido" farebbe scattare il fallback muto di 3 mesi.
    for (const period of ['8d', '2w', '3m', '12m', '1y', '3', 'maintenance']) {
      expect(periodErrors(CreatePlanDto, { ...base, period })).toHaveLength(0);
      expect(isKnownPeriod(period)).toBe(true);
    }
    for (const period of ['mantenimento', '3 mesi', 'abc', '0m']) {
      expect(periodErrors(CreatePlanDto, { ...base, period }).length).toBeGreaterThan(0);
      expect(isKnownPeriod(period)).toBe(false);
    }
  });
});

describe('isMaintenancePlan', () => {
  it('riconosce il piano a prescindere da spazi e maiuscole', () => {
    expect(isMaintenancePlan('maintenance')).toBe(true);
    expect(isMaintenancePlan(' Maintenance ')).toBe(true);
    expect(isMaintenancePlan('MAINTENANCE')).toBe(true);
  });

  it('non scambia per mantenimento un piano mensile', () => {
    expect(isMaintenancePlan('1m')).toBe(false);
    expect(isMaintenancePlan(null)).toBe(false);
    expect(isMaintenancePlan(undefined)).toBe(false);
  });

  it('il mantenimento dura un mese (invariato)', () => {
    expect(subscriptionEnd(new Date('2026-08-05T00:00:00.000Z'), 'maintenance').toISOString().slice(0, 10)).toBe('2026-09-05');
  });
});

// --------------------------------------------------------------------------------------------
// Servizio: vetrina pubblica, vetrina della cliente, acquisto.
// --------------------------------------------------------------------------------------------

const PIANO_3M = { id: 'p3', name: 'Percorso 3 mesi', priceCents: 19900, period: '3m', active: true, hidden: false, repurchasable: true, listPriceCents: null, promoEndsAt: null };
const PIANO_MANT = { id: 'pm', name: 'Mantenimento Metabole', priceCents: 2900, period: 'maintenance', active: true, hidden: false, repurchasable: true, listPriceCents: null, promoEndsAt: null };

/**
 * Finto Prisma minimo: `reached` decide se la cliente ha raggiunto l'obiettivo (obiettivo 70 kg,
 * ultima misura 68 o 80). `consent` serve perche' `subscribe` controlla anche quello: lo teniamo
 * acceso, cosi' se un test fallisce sappiamo che e' per il mantenimento e non per il consenso.
 */
function fakePrisma(opts: { reached: boolean; plans?: typeof PIANO_3M[] }) {
  const plans = opts.plans ?? [PIANO_3M, PIANO_MANT];
  return {
    plan: {
      findMany: jest.fn(async () => plans.filter((p) => p.active && !p.hidden)),
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) => plans.find((p) => p.id === where.id) ?? null),
    },
    objective: { findFirst: jest.fn(async () => ({ targetWeightKg: 70 })) },
    measurement: { findFirst: jest.fn(async () => ({ weightKg: opts.reached ? 68 : 80 })) },
    payment: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'pay1', ...data })),
      update: jest.fn(async () => ({})),
    },
    subscription: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'sub1', ...data })),
    },
    clientProfile: { findUnique: jest.fn(async () => ({ consents: { healthDataConsent: { accepted: true } }, name: 'Giusy', user: { locale: 'it' } })) },
    order: { create: jest.fn(async () => ({ id: 'ord1' })) },
    user: { findUnique: jest.fn(async () => ({ locale: 'it' })) },
  };
}

function makeService(prisma: ReturnType<typeof fakePrisma>) {
  const configParams = {
    getBool: jest.fn(async () => true),
    getString: jest.fn(async () => 'IBAN IT00'),
    getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0),
  };
  const config = { get: jest.fn(() => 'chiave-di-test-per-le-ricevute') };
  const mail = { sendBankTransferInstructions: jest.fn(async () => undefined) };
  const audit = { log: jest.fn(async () => undefined) };
  return new CommerceService(
    prisma as never,
    config as never,
    configParams as never,
    mail as never,
    {} as never, // notifications
    {} as never, // finance
    {} as never, // crm
    {} as never, // stripe
    audit as never,
    {} as never, // discounts
    {} as never, // pdf
    {} as never, // referral
    {} as never, // monitoring
  );
}

describe('Il Mantenimento nella vetrina', () => {
  it('la vetrina PUBBLICA (senza login) non lo mostra mai', async () => {
    const svc = makeService(fakePrisma({ reached: true }));
    const ids = (await svc.listPublicPlans()).map((p) => (p as { id: string }).id);
    expect(ids).toContain('p3');
    expect(ids).not.toContain('pm');
  });

  it('la cliente che NON ha raggiunto l\'obiettivo non lo vede', async () => {
    const svc = makeService(fakePrisma({ reached: false }));
    const ids = (await svc.listPlansForClient('c1')).map((p) => p.id);
    expect(ids).toContain('p3');
    expect(ids).not.toContain('pm');
  });

  it('la cliente che HA raggiunto l\'obiettivo lo vede', async () => {
    const svc = makeService(fakePrisma({ reached: true }));
    const ids = (await svc.listPlansForClient('c1')).map((p) => p.id);
    expect(ids).toContain('pm');
  });

  it('un piano salvato per sbaglio con periodo «1m» NON è più il mantenimento: lo vedono tutte', async () => {
    // È esattamente ciò che succedeva in produzione dopo una modifica dal Negozio.
    const rotto = { ...PIANO_MANT, period: '1m' };
    const svc = makeService(fakePrisma({ reached: false, plans: [PIANO_3M, rotto] }));
    expect((await svc.listPlansForClient('c1')).map((p) => p.id)).toContain('pm');
    expect((await svc.listPublicPlans()).map((p) => (p as { id: string }).id)).toContain('pm');
  });
});

describe('Il Mantenimento all\'ACQUISTO (non basta nasconderlo)', () => {
  it('subscribe lo rifiuta a chi non ha raggiunto l\'obiettivo, anche conoscendo il planId', async () => {
    const svc = makeService(fakePrisma({ reached: false }));
    await expect(svc.subscribe('c1', 'pm', 'giusy@example.com')).rejects.toThrow(/Mantenimento si attiva/i);
  });

  it('subscribe lo consente a chi l\'obiettivo l\'ha raggiunto', async () => {
    const prisma = fakePrisma({ reached: true });
    const svc = makeService(prisma);
    await expect(svc.subscribe('c1', 'pm', 'giusy@example.com')).resolves.toBeDefined();
    expect(prisma.subscription.create).toHaveBeenCalled();
  });

  it('subscribe non tocca gli altri piani: il percorso da 3 mesi si compra comunque', async () => {
    const prisma = fakePrisma({ reached: false });
    const svc = makeService(prisma);
    await expect(svc.subscribe('c1', 'p3', 'giusy@example.com')).resolves.toBeDefined();
    expect(prisma.subscription.create).toHaveBeenCalled();
  });

  it('checkout lo rifiuta: e\' la strada del pulsante nel report', async () => {
    const svc = makeService(fakePrisma({ reached: false }));
    await expect(
      svc.checkout('c1', 'giusy@example.com', { planId: 'pm', method: 'bank_transfer' }),
    ).rejects.toThrow(/Mantenimento si attiva/i);
  });

  it('checkout lo consente a obiettivo raggiunto', async () => {
    const prisma = fakePrisma({ reached: true });
    const svc = makeService(prisma);
    await expect(
      svc.checkout('c1', 'giusy@example.com', { planId: 'pm', method: 'bank_transfer' }),
    ).resolves.toBeDefined();
    expect(prisma.subscription.create).toHaveBeenCalled();
  });

  it('senza obiettivo impostato non si compra il mantenimento', async () => {
    const prisma = fakePrisma({ reached: false });
    prisma.objective.findFirst = jest.fn(async () => ({ targetWeightKg: null })) as never;
    const svc = makeService(prisma);
    await expect(svc.subscribe('c1', 'pm', 'giusy@example.com')).rejects.toThrow(/Mantenimento si attiva/i);
  });
});
