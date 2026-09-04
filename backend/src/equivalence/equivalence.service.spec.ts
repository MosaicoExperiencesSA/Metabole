import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquivalenceService } from './equivalence.service';

/**
 * «QUANDO SI CREANO … EQUIVALENZE NUOVE MANDIAMO UNA NOTIFICA AL NUTRIZIONISTA» (Simone, 11/8).
 *
 * Il motore usa SOLO i gruppi approvati. Quindi un gruppo nuovo in bozza è lavoro fatto che non
 * serve a niente finché il capo nutrizionista non lo guarda — e finora non c'era nessun modo di
 * saperlo, se non andando a cercare l'elenco. Sono anche i gruppi che decidono cosa Gaia può
 * proporre al posto di cosa: il caso della pasta integrale del 10/8 nasce lì.
 */
describe('EquivalenceService — avviso al capo nutrizionista', () => {
  let service: EquivalenceService;
  let prisma: any;
  let notifications: { notify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      equivalenceGroup: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'capo-user' }]) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EquivalenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(EquivalenceService);
  });

  it('un gruppo nuovo in bozza avvisa il capo, e il testo dice che il motore NON lo usa', async () => {
    await service.create('nutri-user', { name: 'Pesci bianchi', items: ['orata', 'branzino', 'merluzzo'] } as never);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const avviso = notifications.notify.mock.calls[0][0];
    expect(avviso.userId).toBe('capo-user');
    expect(avviso.type).toBe('equivalence_group_new');
    expect(avviso.body).toContain('Pesci bianchi');
    expect(avviso.body).toContain('3 alimenti');
    expect(avviso.body).toMatch(/non lo usa/);
    expect(avviso.payload.groupId).toBe('g1');
  });

  it('un gruppo creato già approvato lo dice: il motore lo userà dal prossimo menu', async () => {
    await service.create('nutri-user', { name: 'Latticini magri', items: ['skyr', 'yogurt greco 0%'], status: 'approved' } as never);
    const avviso = notifications.notify.mock.calls[0][0];
    expect(avviso.body).toContain('già approvato');
    expect(avviso.body).toContain('2 alimenti');
  });

  it('un solo alimento resta al singolare: i dettagli che fanno sembrare il testo scritto da noi', async () => {
    await service.create('nutri-user', { name: 'Solo riso', items: ['riso basmati'] } as never);
    expect(notifications.notify.mock.calls[0][0].body).toContain('1 alimento');
  });

  it('se il gruppo lo crea IL CAPO, non si avvisa lui di quello che ha appena fatto', async () => {
    await service.create('capo-user', { name: 'Pesci bianchi', items: ['orata', 'branzino'] } as never);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('l\'avviso non fa fallire la creazione: il gruppo si salva comunque', async () => {
    notifications.notify.mockRejectedValue(new Error('notifiche giù'));
    const creato = await service.create('nutri-user', { name: 'Pesci bianchi', items: ['orata', 'branzino'] } as never);
    expect(creato.id).toBe('g1');
  });
});

/**
 * ⛔ **ACCORPARE INVECE DI SCRIVERNE UN ALTRO** — richiesta di Simone, 4/9.
 *
 * ⚠️ Qui la prova che conta più di tutte non è che gli alimenti si aggiungano: è che **non si
 * perda quello che c'era già dentro `members`**. Lì vivono la nota di provenienza e i **pesi dei
 * grassi firmati dal capo nutrizionista**, e riscrivere quell'oggetto da capo è esattamente il modo
 * con cui il 25/8 quella tabella si stava per cancellare da sola.
 */
describe('EquivalenceService — accorpa', () => {
  let service: EquivalenceService;
  let prisma: any;
  let notifications: { notify: jest.Mock };

  const gruppo = (o: Record<string, unknown>) => ({
    id: 'g1',
    name: 'Carni bianche',
    status: 'draft',
    members: { items: ['petto di pollo', 'tacchino'] },
    ...o,
  });

  async function creaCon(g: Record<string, unknown>) {
    prisma = {
      equivalenceGroup: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(gruppo(g)),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...gruppo(g), ...data })),
        delete: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'capo-user' }]) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EquivalenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(EquivalenceService);
  }

  it('aggiunge solo quello che manca, in coda', async () => {
    await creaCon({});
    const esito = await service.accorpa('nutri', 'g1', { items: ['coniglio', 'tacchino'] });
    expect(esito.aggiunti).toEqual(['coniglio']);
    const scritto = prisma.equivalenceGroup.update.mock.calls[0][0].data.members;
    expect(scritto.items).toEqual(['petto di pollo', 'tacchino', 'coniglio']);
  });

  /** ⚠️ «Pollo» e «petto di pollo» sono lo stesso alimento: non si scrive due volte la stessa cosa. */
  it('non riscrive un alimento che c\'è già con un nome più lungo', async () => {
    await creaCon({});
    const esito = await service.accorpa('nutri', 'g1', { items: ['pollo'] });
    expect(esito.aggiunti).toEqual([]);
    expect(prisma.equivalenceGroup.update).not.toHaveBeenCalled();
  });

  /** ⛔ La prova che morde: i pesi e la nota sopravvivono all'accorpamento. */
  it('⛔ non cancella i pesi dei grassi né la nota', async () => {
    await creaCon({
      members: {
        items: ['olio extravergine di oliva', 'burro'],
        note: 'Da una sostituzione concordata con Giulia.',
        fattori: { riferimento: 'olio extravergine di oliva', pesi: { burro: 120 }, fonte: 'CREA' },
      },
    });
    await service.accorpa('nutri', 'g1', { items: ['panna fresca'] });
    const scritto = prisma.equivalenceGroup.update.mock.calls[0][0].data.members;
    expect(scritto.fattori).toEqual({ riferimento: 'olio extravergine di oliva', pesi: { burro: 120 }, fonte: 'CREA' });
    expect(scritto.note).toBe('Da una sostituzione concordata con Giulia.');
    expect(scritto.items).toContain('panna fresca');
  });

  /**
   * ⛔ Accorpare dentro un **approvato** manda quegli alimenti nel motore dal menu della notte: si
   * fa, ma qualcuno lo deve sapere. E lo stato non si tocca — riportarlo in bozza spegnerebbe anche
   * quello che oggi funziona.
   */
  it('⛔ dentro un gruppo approvato avvisa il capo, e non lo riporta in bozza', async () => {
    await creaCon({ status: 'approved' });
    await service.accorpa('nutri', 'g1', { items: ['coniglio'] });
    /**
     * ⚠️ **Si guardano le CHIAVI scritte, non `data.status === undefined`** -- rilievo della
     * revisione del 4/9: quella asserzione era vera per costruzione (`accorpa` scrive solo
     * `members`) e sarebbe passata anche con una seconda `update` che cambiava lo stato.
     */
    expect(prisma.equivalenceGroup.update).toHaveBeenCalledTimes(1);
    expect(Object.keys(prisma.equivalenceGroup.update.mock.calls[0][0].data)).toEqual(['members']);
    const avviso = notifications.notify.mock.calls.at(-1)?.[0];
    expect(avviso.title).toContain('gruppo approvato');
    expect(avviso.body).toContain('dal prossimo menu');
  });

  it('⚠️ dentro una bozza non avvisa nessuno: non è successo niente che il motore veda', async () => {
    await creaCon({});
    await service.accorpa('nutri', 'g1', { items: ['coniglio'] });
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **QUELLO CHE L'ACCORPAMENTO NON HA SCRITTO** -- rilievo della revisione del 4/9.
 *
 * Il confronto e' per parola e nei due versi: un gruppo che ha «latte» fa scartare «latte di
 * mandorla». La prima stesura tornava solo `aggiunti`, e chi aveva premuto restava convinto di aver
 * salvato anche il resto. E' la stessa regola dei pesi scartati -- «niente troncamenti silenziosi:
 * il conto si scrive» -- che qui non era stata applicata agli alimenti.
 */
describe('EquivalenceService — accorpa dice anche cosa NON ha aggiunto', () => {
  it('⛔ riporta i nomi scartati e come stanno nel gruppo', async () => {
    const prisma: any = {
      equivalenceGroup: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'g1', name: 'Bevande', status: 'draft', members: { items: ['latte', 'yogurt'] } }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data })),
        delete: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EquivalenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: { notify: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    const service = moduleRef.get(EquivalenceService);

    const esito = await service.accorpa('nutri', 'g1', { items: ['latte di mandorla', 'kefir'] });
    expect(esito.aggiunti).toEqual(['kefir']);
    expect(esito.giaPresenti).toEqual([{ proposto: 'latte di mandorla', comeSta: 'latte' }]);
  });
});
