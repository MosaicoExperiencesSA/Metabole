import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegistroVeraService } from './registro.service';

const makeAudit = () => ({ log: jest.fn().mockResolvedValue(undefined) }) as unknown as AuditService;
/** Dizionario finto: serve solo alle proposte di tipo «voce_dizionario». */
const makeDizionario = (over: Record<string, unknown> = {}) =>
  ({
    insegna: jest.fn().mockResolvedValue({ id: 'v1' }),
    promuovi: jest.fn().mockResolvedValue({ id: 'v1', comune: true }),
    ...over,
  }) as never;

/** Il catalogo finto: due metodi, gli stessi due che l'interfaccia dichiara. */
const makeRicette = (over: Record<string, unknown> = {}) =>
  ({
    createRecipe: jest.fn().mockResolvedValue({ id: 'r1' }),
    updateRecipe: jest.fn().mockResolvedValue({ id: 'r1' }),
    ...over,
  }) as never;

const make = (
  prisma: Record<string, unknown>,
  audit = makeAudit(),
  dizionario = makeDizionario(),
  ricette = makeRicette(),
) => new RegistroVeraService(prisma as unknown as PrismaService, audit, dizionario, ricette);

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

describe('RegistroVeraService.scrivi', () => {
  it('conserva la frase originale per intero: senza, non esiste collaudo', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a1' });
    const service = make({ azioneVera: { create } });
    await service.scrivi({
      nutrizionistaId: 'lucia',
      frase: 'a Simone Rossi niente formaggi molli, solo il grana',
      azione: 'restrizione_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: 'c1',
      soggettoNome: 'Simone Rossi',
    });
    expect(create.mock.calls[0][0].data.frase).toBe('a Simone Rossi niente formaggi molli, solo il grana');
  });

  it('un’azione a raggio largo nasce «in_approvazione», non «attiva»', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a1' });
    const service = make({ azioneVera: { create } });
    await service.scrivi({
      nutrizionistaId: 'lucia',
      frase: 'nella mediterranea niente tonno',
      azione: 'regola_dieta',
      ambito: 'dieta',
      soggettoTipo: 'diet',
      soggettoId: 'd1',
      inApprovazione: true,
    });
    expect(create.mock.calls[0][0].data.stato).toBe('in_approvazione');
  });

  it('scrive ANCHE l’audit: registro e audit non si sostituiscono', async () => {
    const audit = makeAudit();
    const service = make(
      { azioneVera: { create: jest.fn().mockResolvedValue({ id: 'a1' }) }, user: { findMany: jest.fn().mockResolvedValue([]) } },
      audit,
    );
    await service.scrivi({
      nutrizionistaId: 'lucia',
      frase: 'x',
      azione: 'restrizione_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: 'c1',
      conflittoSanitario: true,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'vera.restrizione_cliente', metadata: expect.objectContaining({ conflittoSanitario: true }) }),
    );
  });

  it('⚠️ una regola sopra un vincolo sanitario avvisa il capo SUBITO, non a fine mese', async () => {
    // Decisione di Simone del 12/8: la regola si scrive lo stesso — comanda lei — ma di quella riga
    // si accorge qualcun altro entro sera. A fine mese quella cliente ha già mangiato trenta giorni
    // di menu.
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = make({
      azioneVera: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'nocanty' }]),
        findUnique: jest.fn().mockResolvedValue({ firstName: 'Lucia', lastName: 'Verdi' }),
      },
      notification: { createMany },
    });
    await service.scrivi({
      nutrizionistaId: 'lucia',
      frase: 'a Mariastella dai comunque il pane',
      azione: 'restrizione_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: 'c1',
      soggettoNome: 'Mariastella',
      conflittoSanitario: true,
    });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0][0].data[0].userId).toBe('nocanty');
  });

  it('una regola normale non avvisa nessuno', async () => {
    const createMany = jest.fn();
    const service = make({
      azioneVera: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'nocanty' }]) },
      notification: { createMany },
    });
    await service.scrivi({
      nutrizionistaId: 'lucia',
      frase: 'a Giulia niente tonno',
      azione: 'restrizione_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: 'c1',
    });
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe('RegistroVeraService.menuDaRifare', () => {
  it('prende solo i giorni FUTURI che non sono stati visti', async () => {
    const findMany = jest.fn().mockResolvedValue([{ date: D('2026-08-14') }]);
    const service = make({ menuDay: { findMany } });
    const giorni = await service.menuDaRifare('c1');

    const where = findMany.mock.calls[0][0].where;
    expect(where.viewedAt).toBeNull();
    // ⚠️ `date: { gte: oggi }`: per i giorni erogati PRIMA che la colonna esistesse, `viewedAt`
    // null non vuol dire «non visto» — vuol dire «non lo so». Rifarli sarebbe cambiare sotto i
    // piedi un menu che la cliente può aver già letto e su cui ha fatto la spesa.
    expect(where.date.gte).toBeInstanceOf(Date);
    expect(giorni).toEqual(['2026-08-14']);
  });
});

describe('RegistroVeraService.annulla', () => {
  it('segna la riga annullata e dice quali menu si possono rifare', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'a1', stato: 'annullata' });
    const service = make({
      azioneVera: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', stato: 'attiva', soggettoTipo: 'user', soggettoId: 'c1', frase: 'x' }),
        update,
      },
      menuDay: { findMany: jest.fn().mockResolvedValue([{ date: D('2026-08-14') }]) },
    });
    const esito = await service.annulla('lucia', 'a1');
    expect(update.mock.calls[0][0].data.stato).toBe('annullata');
    expect(update.mock.calls[0][0].data.annullataDaId).toBe('lucia');
    expect(esito.daRifare).toEqual(['2026-08-14']);
  });

  it('annullare due volte non ricalcola niente', async () => {
    const menuFindMany = jest.fn();
    const service = make({
      azioneVera: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', stato: 'annullata', soggettoTipo: 'user', soggettoId: 'c1', frase: 'x' }),
        update: jest.fn(),
      },
      menuDay: { findMany: menuFindMany },
    });
    const esito = await service.annulla('lucia', 'a1');
    expect(esito.daRifare).toEqual([]);
    expect(menuFindMany).not.toHaveBeenCalled();
  });

  it('per una regola che non riguarda una cliente non cerca menu da rifare', async () => {
    const menuFindMany = jest.fn();
    const service = make({
      azioneVera: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', stato: 'attiva', soggettoTipo: 'diet', soggettoId: 'd1', frase: 'x' }),
        update: jest.fn().mockResolvedValue({ id: 'a1' }),
      },
      menuDay: { findMany: menuFindMany },
    });
    await service.annulla('lucia', 'a1');
    expect(menuFindMany).not.toHaveBeenCalled();
  });
});

describe('RegistroVeraService — la coda del capo', () => {
  const inCoda = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    stato: 'in_approvazione',
    frase: 'a tutte niente tonno',
    nutrizionistaId: 'lucia',
    azione: 'restrizione_cliente',
    ambito: 'catalogo',
    soggettoId: 'c1',
    soggettoNome: 'Giulia',
    dettaglio: { termini: ['tonno'] },
    ...over,
  });

  const conCoda = (riga: Record<string, unknown> | null, over: Record<string, unknown> = {}) => ({
    azioneVera: { findUnique: jest.fn().mockResolvedValue(riga), update: jest.fn().mockResolvedValue({ id: 'a1' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'nutritionist' }) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-lucia' }) },
    clientProfile: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    ...over,
  });

  it('⚠️ una nutrizionista NON può approvare: è la riga che rende la coda una coda', async () => {
    // Senza questo controllo nel servizio, chi propone si approverebbe da solo e il passaggio dal
    // capo sarebbe un passaggio a vuoto.
    const service = make(conCoda(inCoda()));
    await expect(service.approva({ id: 'lucia', role: 'nutritionist' }, 'a1')).rejects.toThrow(ForbiddenException);
  });

  it('il capo approva, applica e la riga diventa attiva', async () => {
    const prisma = conCoda(inCoda());
    const service = make(prisma);
    const esito = await service.approva({ id: 'nocanty', role: 'head_nutritionist' }, 'a1');
    expect((prisma.azioneVera.update as jest.Mock).mock.calls[0][0].data.stato).toBe('attiva');
    expect(esito).toHaveProperty('riepilogo');
  });

  it('non si approva due volte', async () => {
    const service = make(conCoda(inCoda({ stato: 'attiva' })));
    await expect(service.approva({ id: 'nocanty', role: 'head_nutritionist' }, 'a1')).rejects.toThrow(BadRequestException);
  });

  it('respingere SENZA motivo non si può', async () => {
    // Un no senza spiegazione è la cosa che insegna a smettere di proporre.
    const service = make(conCoda(inCoda()));
    await expect(service.respingi({ id: 'nocanty', role: 'head_nutritionist' }, 'a1', '  ')).rejects.toThrow(
      /Serve un motivo/,
    );
  });

  it('il motivo del rifiuto resta scritto accanto alla proposta', async () => {
    const prisma = conCoda(inCoda());
    const service = make(prisma);
    await service.respingi({ id: 'nocanty', role: 'head_nutritionist' }, 'a1', 'il tonno serve per il ferro');
    const dati = (prisma.azioneVera.update as jest.Mock).mock.calls[0][0].data;
    expect(dati.stato).toBe('respinta');
    expect(dati.dettaglio.motivoRifiuto).toBe('il tonno serve per il ferro');
    // Il dettaglio originale non si perde: ci si aggiunge, non lo si sostituisce.
    expect(dati.dettaglio.termini).toEqual(['tonno']);
  });

  it('la coda esce in ordine di RISCHIO, non di data', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'vecchia', conflittoSanitario: false, ambito: 'cliente', createdAt: D('2026-08-01') },
      { id: 'sanitaria', conflittoSanitario: true, ambito: 'cliente', createdAt: D('2026-08-13') },
    ]);
    const service = make({ azioneVera: { findMany } });
    const coda = (await service.daApprovare()) as unknown as { id: string }[];
    expect(coda.map((r) => r.id)).toEqual(['sanitaria', 'vecchia']);
  });
});

describe('RegistroVeraService — una parola nuova nel dizionario di tutte', () => {
  const proposta = {
    id: 'a1',
    stato: 'in_approvazione',
    frase: 'il favismo vuol dire niente fave e legumi',
    nutrizionistaId: 'lucia',
    azione: 'voce_dizionario',
    ambito: 'catalogo',
    soggettoId: null,
    soggettoNome: null,
    dettaglio: { famiglia: 'favismo', membri: ['fave', 'legumi'] },
  };

  it('si insegna a nome di CHI l’ha proposta, e poi si promuove', async () => {
    // ⚠️ Non si scrive la riga a mano: `insegna` sa la chiave larga (singolare/plurale) e il riuso
    // della voce gemella, `promuovi` sa chi può renderla comune. Riscriverle qui sarebbe una
    // seconda idea di cosa sia una voce di dizionario.
    const dizionario = makeDizionario();
    const service = make(
      { azioneVera: { findUnique: jest.fn().mockResolvedValue(proposta), update: jest.fn().mockResolvedValue({}) } },
      makeAudit(),
      dizionario,
    );
    const esito = await service.approva({ id: 'nocanty', role: 'head_nutritionist' }, 'a1');
    expect((dizionario as unknown as { insegna: jest.Mock }).insegna.mock.calls[0][0]).toBe('lucia');
    expect((dizionario as unknown as { promuovi: jest.Mock }).promuovi.mock.calls[0][0].id).toBe('nocanty');
    expect(esito.riepilogo).toContain('«favismo»');
  });

  it('una proposta senza alimenti non scrive niente', async () => {
    const dizionario = makeDizionario();
    const service = make(
      {
        azioneVera: {
          findUnique: jest.fn().mockResolvedValue({ ...proposta, dettaglio: { famiglia: 'favismo', membri: [] } }),
          update: jest.fn().mockResolvedValue({}),
        },
      },
      makeAudit(),
      dizionario,
    );
    const esito = await service.approva({ id: 'nocanty', role: 'head_nutritionist' }, 'a1');
    expect((dizionario as unknown as { insegna: jest.Mock }).insegna).not.toHaveBeenCalled();
    expect(esito.riepilogo).toContain('non ho scritto niente');
  });
});

describe('RegistroVeraService — approvare una ricetta', () => {
  const proposta = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    stato: 'in_approvazione',
    azione: 'ricetta_nuova',
    ambito: 'catalogo',
    frase: 'Tonno alle olive…',
    nutrizionistaId: 'lucia',
    soggettoTipo: 'recipe',
    soggettoId: 'r1',
    dettaglio: null,
    ...over,
  });

  const makeConProposta = (p: Record<string, unknown>, ricette = makeRicette()) => ({
    service: make(
      { azioneVera: { findUnique: jest.fn().mockResolvedValue(p), update: jest.fn().mockResolvedValue({ id: 'a1' }) } },
      makeAudit(),
      makeDizionario(),
      ricette,
    ),
    ricette,
  });

  const CAPO = { id: 'nocanty', role: 'head_nutritionist' };

  it('approvare una ricetta nuova la ACCENDE', async () => {
    const ricette = makeRicette();
    const { service } = makeConProposta(proposta(), ricette);
    const esito = await service.approva(CAPO, 'a1');
    expect((ricette as unknown as { updateRecipe: jest.Mock }).updateRecipe)
      .toHaveBeenCalledWith('nocanty', 'r1', { active: true });
    // ⚠️ Approvare non conferma gli allergeni: sono due responsabilità diverse, e chi approva deve
    // saperlo dalla risposta invece di scoprirlo dal fatto che la ricetta non compare da nessuna parte.
    expect((esito as { riepilogo: string }).riepilogo).toContain('allergeni');
  });

  it('⚠️ approvare una MODIFICA non spegne la ricetta viva', async () => {
    // `active: false` arriva da come la proposta è stata costruita: riscriverlo su una ricetta in
    // uso la farebbe sparire dai menu senza che nessuno l'abbia chiesto, e senza nessun errore.
    const ricette = makeRicette();
    const { service } = makeConProposta(
      proposta({
        azione: 'ricetta_modificata',
        dettaglio: { campi: { name: 'Tonno alle olive', kcal: 210, active: false, regime: 'omnivore' } },
      }),
      ricette,
    );
    await service.approva(CAPO, 'a1');
    const scritti = (ricette as unknown as { updateRecipe: jest.Mock }).updateRecipe.mock.calls[0][2];
    expect(scritti).not.toHaveProperty('active');
    expect(scritti.kcal).toBe(210);
  });

  it('una proposta di modifica senza i campi non tocca niente', async () => {
    const ricette = makeRicette();
    const { service } = makeConProposta(proposta({ azione: 'ricetta_modificata', dettaglio: {} }), ricette);
    const esito = await service.approva(CAPO, 'a1');
    expect((ricette as unknown as { updateRecipe: jest.Mock }).updateRecipe).not.toHaveBeenCalled();
    expect((esito as { toccate: number }).toccate).toBe(0);
  });

  it('una nutrizionista non può approvarsi la ricetta da sola', async () => {
    const { service } = makeConProposta(proposta());
    await expect(service.approva({ id: 'lucia', role: 'nutritionist' }, 'a1')).rejects.toThrow(ForbiddenException);
  });
});

describe('RegistroVeraService.spedisciReportMensile — il 1° del mese, da solo (13/8 sera)', () => {
  const prismaBase = (over: Record<string, unknown> = {}) => ({
    azioneVera: { findMany: jest.fn().mockResolvedValue([]) },
    messaggioVera: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'capo-1', email: 'capo@metabole.eu' }]) },
    notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    ...over,
  });
  const conMail = (prisma: Record<string, unknown>, mail: unknown) =>
    new RegistroVeraService(prisma as unknown as PrismaService, makeAudit(), makeDizionario(), makeRicette(), mail as never);

  it('il 1° del mese: il report del mese PRIMA, notifica in app + email a ogni capo', async () => {
    const prisma = prismaBase();
    const mail = { send: jest.fn().mockResolvedValue(true) };
    const esito = await conMail(prisma, mail).spedisciReportMensile(D('2026-09-01'));
    expect(esito.inviato).toBe(true);
    expect((prisma.notification as { create: jest.Mock }).create).toHaveBeenCalled();
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].subject.toLowerCase()).toContain('agosto');
  });

  it('gli altri giorni non parte niente', async () => {
    const prisma = prismaBase();
    const mail = { send: jest.fn() };
    const esito = await conMail(prisma, mail).spedisciReportMensile(D('2026-09-15'));
    expect(esito.inviato).toBe(false);
    expect((prisma.notification as { create: jest.Mock }).create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('già spedito questo mese (il cron può rigirare): non si duplica', async () => {
    const prisma = prismaBase({ notification: { findFirst: jest.fn().mockResolvedValue({ id: 'gia' }), create: jest.fn() } });
    const mail = { send: jest.fn() };
    const esito = await conMail(prisma, mail).spedisciReportMensile(D('2026-09-01'));
    expect(esito.inviato).toBe(false);
    expect((prisma.notification as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it('senza postino la notifica in app parte comunque', async () => {
    const prisma = prismaBase();
    const esito = await conMail(prisma, null).spedisciReportMensile(D('2026-09-01'));
    expect(esito.inviato).toBe(true);
    expect((prisma.notification as { create: jest.Mock }).create).toHaveBeenCalled();
  });
});

describe('RegistroVeraService.scrivi — l\'avviso al capo sulla proposta nuova (Simone, 14/8)', () => {
  const PROPOSTA = {
    nutrizionistaId: 'lucia',
    frase: 'nella mediterranea niente tonno',
    azione: 'regola_dieta' as const,
    ambito: 'dieta' as const,
    soggettoTipo: 'diet' as const,
    soggettoId: 'd1',
    soggettoNome: 'Mediterranea',
  };
  const prismaConCapi = (createMany: jest.Mock) => ({
    azioneVera: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'capo1' }, { id: 'lucia' }]),
      findUnique: jest.fn().mockResolvedValue({ firstName: 'Lucia', lastName: 'Verdi' }),
    },
    notification: { createMany },
  });

  it('una proposta in coda fa suonare la campanella del capo — non quella di chi ha proposto', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = make(prismaConCapi(createMany));
    await service.scrivi({ ...PROPOSTA, inApprovazione: true });
    expect(createMany).toHaveBeenCalledTimes(1);
    const dati = createMany.mock.calls[0][0].data;
    expect(dati.map((d: { userId: string }) => d.userId)).toEqual(['capo1']);
    expect(dati[0].type).toBe('vera_proposta_in_coda');
  });

  it('un\'azione che NON va in approvazione non avvisa nessuno', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = make(prismaConCapi(createMany));
    await service.scrivi({ ...PROPOSTA, azione: 'restrizione_cliente', ambito: 'cliente', soggettoTipo: 'user' });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('⚠️ conflitto sanitario E in approvazione: UNA campanella (quella di conflitto), non due', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = make(prismaConCapi(createMany));
    await service.scrivi({ ...PROPOSTA, inApprovazione: true, conflittoSanitario: true });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0][0].data[0].type).toBe('vera_conflitto_sanitario');
  });
});

describe('RegistroVeraService.approva — l\'elenco delle scoperte resta scritto sulla riga', () => {
  it('⚠️ le scoperte finiscono nel dettaglio: la chat scorre, il registro resta', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'a1' });
    const service = make({
      azioneVera: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'a1', stato: 'in_approvazione', frase: 'nella mediterranea niente tonno',
          nutrizionistaId: 'lucia', azione: 'regola_dieta', ambito: 'dieta',
          soggettoId: 'd1', soggettoNome: 'Mediterranea', dettaglio: { termini: ['tonno'] },
        }),
        update,
      },
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r-tonno', name: 'Insalata di tonno', ingredients: [] }]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ meals: [{ slot: 'dinner', recipeId: 'r-tonno' }] }]) },
      menuDay: {
        findMany: jest.fn().mockImplementation((args: { distinct?: string[] }) =>
          Promise.resolve(args?.distinct ? [{ clientId: 'c1' }] : [])),
        deleteMany: jest.fn(),
      },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'c1', name: 'Giulia Rossi', allergies: [], intolerances: [], dislikedFoods: [] },
        ]),
      },
    });
    const esito = await service.approva({ id: 'nocanty', role: 'head_nutritionist' }, 'a1');
    expect(esito.riepilogo).toContain('Giulia Rossi');
    const dati = update.mock.calls[0][0].data;
    expect(dati.stato).toBe('attiva');
    expect(dati.dettaglio.scoperte).toHaveLength(1);
    expect(dati.dettaglio.scoperte[0].nome).toBe('Giulia Rossi');
    // Il dettaglio originale non si perde: ci si aggiunge, non lo si sostituisce.
    expect(dati.dettaglio.termini).toEqual(['tonno']);
  });
});
