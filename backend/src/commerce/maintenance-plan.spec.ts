import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreatePlanDto, UpdatePlanDto } from './dto/shop-admin.dto';
import {
  CommerceService,
  isKnownPeriod,
  isMaintenancePlan,
  isMonitoringPlan,
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

  it('accetta «monitoring»: senza, il piano del monitoraggio era impossibile da salvare', () => {
    // Stessa trappola di «maintenance», ripetuta il 7/8 sul piano nuovo: nasceva dal seed con un
    // periodo che il DTO rifiutava, quindi dal Negozio non se ne poteva toccare né il prezzo né
    // le provvigioni.
    expect(periodErrors(CreatePlanDto, { ...base, period: 'monitoring' })).toHaveLength(0);
    expect(periodErrors(UpdatePlanDto, { period: 'monitoring' })).toHaveLength(0);
  });

  it.each(['mantenimento', '3 mesi', 'abc', '0m', '', '-2m'])('rifiuta «%s»', (period) => {
    expect(periodErrors(CreatePlanDto, { ...base, period }).length).toBeGreaterThan(0);
  });

  it('quello che il DTO accetta è esattamente quello che subscriptionEnd sa interpretare', () => {
    // Se le due regole divergono, un periodo "valido" farebbe scattare il fallback muto di 3 mesi.
    for (const period of ['8d', '2w', '3m', '12m', '1y', '3', 'maintenance', 'monitoring']) {
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

describe('isMonitoringPlan', () => {
  it('riconosce il piano a prescindere da spazi e maiuscole', () => {
    expect(isMonitoringPlan(' Monitoring ')).toBe(true);
    expect(isMonitoringPlan('MONITORING')).toBe(true);
  });

  it('non si confonde col mantenimento né con un mensile', () => {
    expect(isMonitoringPlan('maintenance')).toBe(false);
    expect(isMonitoringPlan('1m')).toBe(false);
    expect(isMaintenancePlan('monitoring')).toBe(false);
  });

  it('il monitoraggio dura UN MESE, non tre', () => {
    // Senza il ramo dedicato in `subscriptionEnd`, «monitoring» finiva nel fallback muto: ogni
    // mese pagato €19 sarebbe valso 3 mesi di servizio, e nessun errore da nessuna parte.
    expect(subscriptionEnd(new Date('2026-08-05T00:00:00.000Z'), 'monitoring').toISOString().slice(0, 10)).toBe('2026-09-05');
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
type StatoMantenimento = 'mai' | 'in_corso' | 'scaduto' | 'disdetto_fine_futura' | 'rinnovato' | 'scaduto_e_ricomprato';

function fakePrisma(opts: { reached: boolean; plans?: typeof PIANO_3M[]; mantenimento?: StatoMantenimento }) {
  const plans = opts.plans ?? [PIANO_3M, PIANO_MANT];
  const mant: StatoMantenimento = opts.mantenimento ?? 'mai';
  /**
   * `subscription.findFirst` risponde a TRE domande diverse, e il finto le distingue dal `where`:
   *
   *  1. «c'è un ordine in sospeso?» → nessun filtro sul piano;
   *  2. «esiste un mantenimento già CONCLUSO?» → `endDate: { lt: ... }`;
   *  3. «ce n'è uno ANCORA IN CORSO?» → `status: 'active'` + `OR` sulla fine.
   *
   * Distinguerle conta: con un mock unico che dice sì a tutte, la regola «scaduto e non rinnovato»
   * sembrerebbe funzionare qualunque cosa facesse il codice.
   */
  const subFindFirst = jest.fn(async (args?: { where?: Record<string, unknown> }) => {
    const w = (args?.where ?? {}) as { plan?: { period?: string }; status?: string; endDate?: unknown };
    if (w.plan?.period !== 'maintenance') return null;
    const chiedeInCorso = !!w.status;
    if (chiedeInCorso) {
      /**
       * In corso: la fine non è passata. Comprende il DISDETTO con fine nel futuro — il mese pagato
       * è suo — e il rinnovato, che sposta la fine in avanti.
       *
       * ⚠️ Il finto guarda QUALI stati vengono chiesti (19/8, voce 258) e non solo se c'è un filtro:
       * altrimenti un mantenimento IN CODA risulterebbe «in corso» qualunque cosa chiedesse il
       * codice, e il test non vedrebbe la differenza fra chiedere `queued` e non chiederlo.
       */
      const ammessi: string[] = (w.status as unknown as { in?: string[] })?.in ?? [w.status as unknown as string];
      const statoDellaRiga: Record<string, string | undefined> = {
        in_corso: 'active',
        rinnovato: 'active',
        disdetto_fine_futura: 'cancelled',
        scaduto_e_ricomprato: 'queued',
      };
      const riga = statoDellaRiga[mant];
      return riga && ammessi.includes(riga) ? { id: 'sub-mant-attivo' } : null;
    }
    // Concluso: esiste un mantenimento con la fine già passata.
    return ['scaduto', 'scaduto_e_ricomprato'].includes(mant) ? { id: 'sub-mant-scaduto' } : null;
  });
  return {
    plan: {
      findMany: jest.fn(async () => plans.filter((p) => p.active && !p.hidden)),
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) => plans.find((p) => p.id === where.id) ?? null),
    },
    objective: { findFirst: jest.fn(async () => ({ targetWeightKg: 70 })) },
    /**
     * ⚠️ `findMany` e non più `findFirst` (19/8): l'obiettivo raggiunto si giudica sulla **media
     * mobile**, non sulla pesata di stamattina — offrire il Mantenimento perché una mattina la
     * bilancia ha detto 69,8, con la tendenza ancora sopra, vuol dire venderlo un attimo prima che
     * il peso risalga. Tre pesate coerenti fra loro: la media dice la stessa cosa dell'ultima.
     */
    measurement: {
      findMany: jest.fn(async () => (opts.reached ? [{ weightKg: 68 }, { weightKg: 68 }, { weightKg: 68 }] : [{ weightKg: 80 }, { weightKg: 80 }, { weightKg: 80 }])),
      findFirst: jest.fn(async () => ({ weightKg: opts.reached ? 68 : 80 })),
    },
    payment: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'pay1', ...data })),
      update: jest.fn(async () => ({})),
    },
    subscription: {
      findMany: jest.fn(async () => []),
      findFirst: subFindFirst,
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'sub1', ...data })),
    },
    // `startWeightKg`: la partenza da cui si misura l'avanzamento (vedi `percentuale-obiettivo.ts`).
    clientProfile: { findUnique: jest.fn(async () => ({ consents: { healthDataConsent: { accepted: true } }, name: 'Giusy', user: { locale: 'it' }, startWeightKg: 80 })) },
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

  /**
   * ⚠️ L'OBIETTIVO RAGGIUNTO SI GIUDICA SULLA TENDENZA — 19/8, decisione di Simone.
   *
   * Una mattina la bilancia dice 69,8 e la media è ancora 70,6: offrirle il Mantenimento in quel
   * momento vuol dire vendere una cosa **un attimo prima che il peso risalga**, cioè nel momento in
   * cui è più contenta e con la settimana dopo che le dà torto. Sulla media arriva qualche giorno
   * più tardi, ma quando è vero.
   */
  it('⚠️ una sola pesata sotto il target non basta: conta la media', async () => {
    const prisma = fakePrisma({ reached: false });
    // ⚠️ Come le manda il database: dalla più RECENTE alla più vecchia. L'ultima pesata è 69,8 —
    // sotto il traguardo di 70 — ma le tre di fila fanno 70,6.
    prisma.measurement.findMany = jest.fn(async () => [{ weightKg: 69.8 }, { weightKg: 70.8 }, { weightKg: 71.2 }]);
    prisma.clientProfile.findUnique = jest.fn(async () => ({ consents: { healthDataConsent: { accepted: true } }, name: 'Giusy', user: { locale: 'it' }, startWeightKg: 80 }));
    prisma.objective.findFirst = jest.fn(async () => ({ targetWeightKg: 70 }));
    const svc = makeService(prisma);
    const ids = (await svc.listPlansForClient('c1')).map((p) => p.id);
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

// --------------------------------------------------------------------------------------------
// Il MONITORAGGIO a pagamento (€19/mese): stesso schema, un gradino più avanti.
// --------------------------------------------------------------------------------------------

const PIANO_MON = { id: 'pmon', name: 'Monitoraggio Metabole', priceCents: 1900, period: 'monitoring', active: true, hidden: false, repurchasable: true, listPriceCents: null, promoEndsAt: null };

describe('Il Monitoraggio a pagamento: vetrina e acquisto', () => {
  const conMonitoraggio = { plans: [PIANO_3M, PIANO_MANT, PIANO_MON] };

  it('la vetrina PUBBLICA non lo mostra: non è un piano d\'ingresso', async () => {
    const svc = makeService(fakePrisma({ reached: true, mantenimento: 'scaduto', ...conMonitoraggio }));
    expect((await svc.listPublicPlans()).map((p) => (p as { id: string }).id)).not.toContain('pmon');
  });

  it('la cliente che NON ha mai fatto il mantenimento non lo vede', async () => {
    const svc = makeService(fakePrisma({ reached: true, mantenimento: 'mai', ...conMonitoraggio }));
    const ids = (await svc.listPlansForClient('c1')).map((p) => p.id);
    expect(ids).toContain('p3');
    expect(ids).not.toContain('pmon');
  });

  it('la cliente col mantenimento SCADUTO e non rinnovato lo vede', async () => {
    const svc = makeService(fakePrisma({ reached: true, mantenimento: 'scaduto', ...conMonitoraggio }));
    expect((await svc.listPlansForClient('c1')).map((p) => p.id)).toContain('pmon');
  });

  it('checkout lo rifiuta a chi non ha fatto il mantenimento, anche conoscendo il planId', async () => {
    const svc = makeService(fakePrisma({ reached: true, mantenimento: 'mai', ...conMonitoraggio }));
    await expect(
      svc.checkout('c1', 'giusy@example.com', { planId: 'pmon', method: 'card' }),
    ).rejects.toThrow(/Monitoraggio viene dopo il Mantenimento/i);
  });
});

/**
 * IL MONITORAGGIO SOLO A MANTENIMENTO SCADUTO E NON RINNOVATO (decisione Simone, 12/8).
 *
 * Prima la condizione era «ha già fatto (o sta facendo) il mantenimento»: il monitoraggio compariva
 * dal **primo giorno**, e a una cliente che aveva appena pagato €49 offrivamo l'opzione da €19 dentro
 * il mese che aveva appena comprato. La regola nuova lo rende una **scelta di rientro**.
 */
describe('Il Monitoraggio: solo a mantenimento scaduto e non rinnovato', () => {
  const conMonitoraggio = { plans: [PIANO_3M, PIANO_MANT, PIANO_MON] };
  const vetrina = async (mantenimento: StatoMantenimento) =>
    (await makeService(fakePrisma({ reached: true, mantenimento, ...conMonitoraggio })).listPlansForClient('c1'))
      .map((p) => p.id);

  it('mantenimento IN CORSO → non si vede: non ci vendiamo contro noi stessi dentro il mese pagato', async () => {
    expect(await vetrina('in_corso')).not.toContain('pmon');
  });

  it('mantenimento RINNOVATO → non si vede: il rinnovo sposta la fine in avanti', async () => {
    expect(await vetrina('rinnovato')).not.toContain('pmon');
  });

  it('mantenimento DISDETTO ma con la fine nel futuro → non si vede ancora: il mese pagato è suo', async () => {
    expect(await vetrina('disdetto_fine_futura')).not.toContain('pmon');
  });

  it('mantenimento SCADUTO e non rinnovato → si vede', async () => {
    expect(await vetrina('scaduto')).toContain('pmon');
  });

  /**
   * ⚠️ IL MANTENIMENTO RICOMPRATO E CHE COMINCIA LUNEDÌ NASCONDE IL MONITORAGGIO (19/8, voce 258).
   *
   * È il caso che rimetteva in piedi il difetto: mantenimento finito, la cliente ne ricompra subito
   * un altro con partenza fra qualche giorno. Da quando la coda si scrive `queued`, chiedere i soli
   * `active` non la vedeva — quindi «concluso e nessuno in corso», e il Monitoraggio da €19 tornava
   * in vetrina **sopra** un Mantenimento già pagato.
   *
   * E non è solo una riga di troppo: `MonitoringService.start` legge `STATI_QUALCOSA_IN_BALLO`, che
   * la coda ce l'ha. La vetrina glielo offriva e l'acquisto lo rifiutava con «Hai già un piano
   * attivo» — due condizioni sulla stessa domanda che si contraddicono, cioè la schermata da cui una
   * cliente scrive alla coach.
   */
  it('⚠️ mantenimento scaduto ma già RICOMPRATO (in coda) → il Monitoraggio non torna in vetrina', async () => {
    expect(await vetrina('scaduto_e_ricomprato')).not.toContain('pmon');
  });

  it('il mantenimento resta comprabile in tutti questi casi: la regola riguarda solo il monitoraggio', async () => {
    for (const m of ['in_corso', 'rinnovato', 'disdetto_fine_futura', 'scaduto'] as StatoMantenimento[]) {
      expect(await vetrina(m)).toContain('pm');
    }
  });

  it('l\'ACQUISTO è rifiutato mentre il mantenimento è in corso, con la frase giusta', async () => {
    const svc = makeService(fakePrisma({ reached: true, mantenimento: 'in_corso', ...conMonitoraggio }));
    // «non ancora» e «non ti riguarda» sono due messaggi diversi: dirle quello sbagliato la manda a
    // chiedere alla coach una cosa che non serve.
    await expect(
      svc.checkout('c1', 'giusy@example.com', { planId: 'pmon', method: 'card' }),
    ).rejects.toThrow(/finché è in corso/i);
  });

  it('a mantenimento scaduto l\'acquisto passa', async () => {
    const prisma = fakePrisma({ reached: true, mantenimento: 'scaduto', ...conMonitoraggio });
    const svc = makeService(prisma);
    await expect(
      svc.checkout('c1', 'giusy@example.com', { planId: 'pmon', method: 'bank_transfer' }),
    ).resolves.toBeDefined();
    expect(prisma.subscription.create).toHaveBeenCalled();
  });

  it('vetrina e acquisto usano la STESSA condizione: nessuna porta aperta da una parte', async () => {
    // Il difetto storico di questa area è stato proteggere solo la vetrina.
    for (const m of ['mai', 'in_corso', 'rinnovato', 'disdetto_fine_futura'] as StatoMantenimento[]) {
      const svc = makeService(fakePrisma({ reached: true, mantenimento: m, ...conMonitoraggio }));
      expect((await svc.listPlansForClient('c1')).map((p) => p.id)).not.toContain('pmon');
      await expect(
        svc.checkout('c1', 'giusy@example.com', { planId: 'pmon', method: 'card' }),
      ).rejects.toThrow();
    }
  });
});
