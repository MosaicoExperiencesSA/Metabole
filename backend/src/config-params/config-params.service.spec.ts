import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigParamsService } from './config-params.service';

describe('ConfigParamsService', () => {
  let service: ConfigParamsService;
  let prisma: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      configParam: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConfigParamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(ConfigParamsService);
  });

  it('legge un numero dalla tabella', async () => {
    prisma.configParam.findUnique.mockResolvedValue({ key: 'min_daily_kcal', value: '1200' });
    expect(await service.getNumber('min_daily_kcal')).toBe(1200);
  });

  it('usa la cache alla seconda lettura', async () => {
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '5' });
    await service.getNumber('k');
    await service.getNumber('k');
    expect(prisma.configParam.findUnique).toHaveBeenCalledTimes(1);
  });

  it('parametro mancante senza fallback → errore esplicito', async () => {
    prisma.configParam.findUnique.mockResolvedValue(null);
    await expect(service.getNumber('sconosciuto')).rejects.toThrow(NotFoundException);
  });

  it('parametro mancante con fallback → fallback', async () => {
    prisma.configParam.findUnique.mockResolvedValue(null);
    expect(await service.getNumber('sconosciuto', 0.7)).toBe(0.7);
  });

  it('update invalida la cache e logga in audit', async () => {
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '5' });
    await service.getNumber('k'); // in cache
    prisma.configParam.update.mockResolvedValue({ key: 'k', value: '9' });
    await service.update('k', '9', 'admin-1');

    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '9' });
    expect(await service.getNumber('k')).toBe(9); // rilegge dal db
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.config.update' }),
    );
  });
});

/**
 * ⛔ **UNA CASELLA VUOTA NON È UNO ZERO — e lo zero, su questi parametri, è un interruttore.**
 *
 * `Number('')` fa **0**, non NaN: quindi il ripiego non scattava e una riga svuotata diventava in
 * silenzio uno zero credibilissimo. Su `menu_days_delivered` zero vuol dire che il ciclo è vuoto e
 * `deliverIfEligible` esce da `daySnapshots.length === 0` — un `return []` che non scrive niente da
 * nessuna parte, per tutte le clienti insieme.
 *
 * ⚠️ **Non è la spiegazione del giallo del 23/8**, come avevo scritto prima che me lo smontasse la
 * revisione: con `menu_visible_days_before_return` a zero si perde l'anticipo del rientro, non il
 * menu — il giorno del rientro la pausa non è più attiva e il ramo `pausaAppenaFinita` eroga lo
 * stesso. Il difetto qui sotto è vero e va chiuso; la diagnosi che gli avevo attaccato no.
 *
 * ⚠️ Questi test sono qui perché il difetto **non somiglia a un difetto**: nessuna eccezione, nessun
 * valore assurdo, solo un numero che nessuno ha scritto.
 */
describe('⛔ ConfigParamsService — il parametro vuoto', () => {
  const fai = () => {
    const prisma = { configParam: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() } } as any;
    const audit = { log: jest.fn() };
    const service = new ConfigParamsService(prisma, audit as never);
    return { service, prisma, audit };
  };

  it('⛔ valore VUOTO: ripiega sul default, NON su zero', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'menu_visible_days_before_return', value: '' });
    expect(await service.getNumber('menu_visible_days_before_return', 1)).toBe(1);
  });

  it('⛔ e lo stesso per una casella di soli spazi', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '   ' });
    expect(await service.getNumber('k', 7)).toBe(7);
  });

  /**
   * ⚠️ **E lo DICE**: un ripiego silenzioso su un parametro che decide se una cliente domani mangia è
   * la metà peggiore del difetto. Chi legge i log deve trovare la chiave da sistemare.
   */
  it('⚠️ e lo scrive nei log, con il nome della chiave', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'menu_visible_days_before_return', value: '' });
    const warn = jest.spyOn((service as never as { logger: { warn: jest.Mock } }).logger, 'warn').mockImplementation(() => undefined);
    await service.getNumber('menu_visible_days_before_return', 1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('menu_visible_days_before_return'));
    expect(warn.mock.calls[0][0]).toMatch(/VUOTO/);
  });

  /** ⚠️ Senza ripiego non si indovina: si solleva, come già faceva per un valore non numerico. */
  it('⚠️ vuoto e senza ripiego: solleva invece di rispondere 0', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '' });
    await expect(service.getNumber('k')).rejects.toThrow(/vuoto/);
  });

  /** ⛔ Uno ZERO scritto apposta resta uno zero: è una decisione, e si rispetta. */
  it('⛔ «0» scritto davvero vale 0, non il ripiego', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '0' });
    expect(await service.getNumber('k', 5)).toBe(0);
  });

  it('⚠️ e i valori normali non cambiano comportamento', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '2' });
    expect(await service.getNumber('k', 5)).toBe(2);
  });

  /**
   * ⛔ **E LA CASELLA NON SI PUÒ PIÙ SVUOTARE.** ⚠️ Misurato in revisione: dal back office il DTO ha
   * già `@MinLength(1)`, quindi la stringa vuota era **già** rifiutata. Quello che passava sono i
   * **soli spazi** — `'   '` supera `@MinLength(1)` e `Number('   ')` fa zero. La guardia sta dove si
   * scrive, non solo dove si legge.
   */
  it('⛔ salvare un parametro vuoto dal back office viene rifiutato, dicendo cosa scrivere', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '1' });
    await expect(service.update('k', '   ', 'admin')).rejects.toThrow(/soli spazi/);
    expect(prisma.configParam.update).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **E LO STESSO SILENZIO SUI SÌ/NO — dove costava di più.**
 *
 * `raw === 'true' || raw === '1'` vuol dire che tutto il resto è `false`, senza una riga da nessuna
 * parte. Su un parametro il cui ripiego è `true` è un interruttore che si spegne da solo:
 * `payment_method_card_enabled` a caselle vuote toglie un metodo di pagamento dal carrello, e chi
 * non riesce a pagare non scrive — se ne va.
 */
describe('⛔ ConfigParamsService — i sì/no', () => {
  const fai = () => {
    const prisma = { configParam: { findUnique: jest.fn() } } as any;
    const service = new ConfigParamsService(prisma, { log: jest.fn() } as never);
    jest.spyOn((service as never as { logger: { warn: jest.Mock } }).logger, 'warn').mockImplementation(() => undefined);
    return { service, prisma };
  };

  it.each(['true', 'TRUE', 'True', ' true ', '1', 'si', 'sì', 'yes', 'on'])('⚠️ «%s» vale sì', async (v) => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: v });
    expect(await service.getBool('k', false)).toBe(true);
  });

  it.each(['false', 'FALSE', '0', 'no', 'off'])('⚠️ «%s» vale no', async (v) => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: v });
    expect(await service.getBool('k', true)).toBe(false);
  });

  /**
   * ⛔ Il caso che costa: la casella è vuota e il ripiego è **acceso**. Prima si spegneva; adesso
   * resta acceso e la riga finisce nei log.
   */
  it('⛔ vuoto con ripiego ACCESO: resta acceso, e lo scrive', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'payment_method_card_enabled', value: '' });
    expect(await service.getBool('payment_method_card_enabled', true)).toBe(true);
    const warn = (service as never as { logger: { warn: jest.Mock } }).logger.warn;
    expect(warn.mock.calls[0][0]).toContain('payment_method_card_enabled');
  });

  it('⚠️ e una parola che non vuol dire né sì né no ripiega, invece di valere no', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: 'forse' });
    expect(await service.getBool('k', true)).toBe(true);
  });

  it('⚠️ senza ripiego non si indovina: solleva', async () => {
    const { service, prisma } = fai();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '' });
    await expect(service.getBool('k')).rejects.toThrow(/vuoto/);
  });
});
