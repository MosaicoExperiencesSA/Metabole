import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  const create = jest.fn();
  const createMany = jest.fn();

  beforeEach(async () => {
    create.mockReset();
    createMany.mockReset();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: { auditLog: { create, createMany } } },
      ],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('scrive la voce di audit', async () => {
    create.mockResolvedValue({});
    await service.log({ action: 'auth.login', actorId: 'u1', ipAddress: '1.2.3.4' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.login', actorId: 'u1' }),
      }),
    );
  });

  /**
   * ⚠️ L'ATTORE CHE NON ESISTE — 19/8, e la riga si perdeva in silenzio.
   *
   * `AuditLog.actorId` è una chiave esterna su `user`, ma chi chiama non sempre ha un utente per le
   * mani: il webhook di Stripe passa `'stripe-webhook'`, il form pubblico del sito `'public'`. L'INSERT
   * violava il vincolo, l'errore veniva assorbito qui — giusto, un pagamento non deve fallire per una
   * riga di registro — e di **tutti i pagamenti con carta** non restava un solo audit. Un registro che
   * non c'è si scopre il giorno in cui lo si va a leggere, cioè quando serve.
   */
  it('⚠️ se l\'attore non è un utente la riga si scrive lo stesso, senza attore e dicendo chi era', async () => {
    // Il codice di Prisma per la violazione di chiave esterna. Il finto lo dà come lo dà il vero.
    create.mockRejectedValueOnce({ code: 'P2003' });
    create.mockResolvedValueOnce({});
    await service.log({ action: 'commerce.payment.approve', actorId: 'stripe-webhook', entityId: 'pay-1' });

    expect(create).toHaveBeenCalledTimes(2);
    const secondo = create.mock.calls[1][0].data;
    expect(secondo.actorId).toBeNull();
    // ⚠️ Chi diceva di essere non si butta via: senza, la riga direbbe «non si sa chi».
    expect(secondo.metadata).toEqual(expect.objectContaining({ attoreNonUtente: 'stripe-webhook' }));
  });

  /** ⚠️ Ma senza attore non si riprova: il guasto è un altro, e riprovare uguale non serve. */
  it('⚠️ una riga già senza attore non si riprova due volte', async () => {
    create.mockRejectedValue(new Error('db down'));
    await service.log({ action: 'auth.login' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  /**
   * Lo stesso ripiego vale per le scritture di massa — ⚠️ **ma riga per riga**.
   *
   * `createMany` è una INSERT sola: rifarla senza attori vorrebbe dire che **un** attore inesistente
   * fa perdere l'attribuzione a tutte le altre righe, comprese quelle di una persona vera. Qui
   * l'assegnazione massiva di due lead è stata fatta da un'operatrice vera e da un webhook: la prima
   * riga tiene il suo attore, la seconda no.
   */
  it('⚠️ `logMany` ripiega riga per riga: chi ha un attore vero se lo tiene', async () => {
    createMany.mockRejectedValueOnce({ code: 'P2003' });
    create.mockImplementation(({ data }: { data: { actorId: string | null } }) =>
      data.actorId === 'stripe-webhook' ? Promise.reject({ code: 'P2003' }) : Promise.resolve({}),
    );
    await service.logMany([
      { action: 'crm.lead.assign', actorId: 'u-operatrice', entityId: 'l1' },
      { action: 'crm.lead.assign', actorId: 'stripe-webhook', entityId: 'l2' },
    ]);
    const scritte = create.mock.calls.map((c) => c[0].data);
    expect(scritte).toEqual([
      expect.objectContaining({ entityId: 'l1', actorId: 'u-operatrice' }),
      expect.objectContaining({ entityId: 'l2', actorId: 'stripe-webhook' }), // il tentativo che fallisce
      expect.objectContaining({ entityId: 'l2', actorId: null, metadata: expect.objectContaining({ attoreNonUtente: 'stripe-webhook' }) }),
    ]);
  });

  /**
   * ⚠️ E SU UN GUASTO VERO NON SI RIPROVA. Con un attore valido e il database in difficoltà (Neon
   * che chiude la connessione), un ritentativo cieco riuscirebbe e scriverebbe `actorId: null` su
   * un'azione fatta da una persona vera: una riga **sbagliata che sembra buona**, che su questa
   * tabella è peggio di una riga mancante. E raddoppierebbe le query mentre il database soffre.
   */
  it('⚠️ su un errore che NON è la chiave esterna non si riprova: l\'attore vero non si perde', async () => {
    create.mockRejectedValue(new Error('Connection terminated unexpectedly'));
    await service.log({ action: 'health_data.read', actorId: 'u-nutrizionista', entityId: 'c1' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('non propaga mai gli errori di scrittura (l\'operazione principale non fallisce)', async () => {
    create.mockRejectedValue(new Error('db down'));
    await expect(service.log({ action: 'auth.login' })).resolves.toBeUndefined();
  });
});
