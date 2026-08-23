/**
 * ⛔ **LE SOSPENSIONI, LETTE UNA VOLTA SOLA — e «riprende il» è il primo giorno di dieta.**
 *
 * ## Perché questi test nascono adesso
 *
 * Il 23/8 una cliente vera è rimasta ferma per ore, e `npm run diag:cliente` diceva «idonea»: le
 * pause non le mostrava. Il cancello era una richiesta di pausa 17→23/8 auto-approvata. Per farle
 * comparire nella diagnostica la lettura è uscita dal servizio ed è diventata questa funzione, che
 * adesso usano **in due** — la scheda in back office e lo script.
 *
 * ⚠️ Due chiamanti su una funzione sola vuol dire che un errore qui si vede in due schermate; ma
 * vuol dire anche che **la stessa risposta arriva a tutti e due**, che è il punto: il 23/8 il tempo
 * se n'è andato confrontando una scheda che sapeva e uno script che non sapeva.
 *
 * ## La regola che non si può sbagliare
 *
 * In tabella `endDate` è **l'ultimo giorno sospeso**; quello che si scrive e si legge ovunque —
 * card, calendario, elenco in scheda, questa diagnostica — è il **primo giorno di dieta**. «Fino al
 * 23» si legge «riprende il 24». Uno scarto di uno qui vuol dire una cliente che resta un giorno
 * senza menu, o che ne riceve uno mentre è ancora in vacanza.
 */
import { sospensioniDiUnaCliente } from './sospensioni-di-una-cliente';

const G = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Un finto che risponde solo a quello che questa funzione chiede davvero. */
function fintoPrisma(over: {
  eventi?: unknown[];
  richieste?: unknown[];
  profilo?: Record<string, unknown> | null;
  audit?: unknown[];
} = {}) {
  return {
    event: { findMany: jest.fn().mockResolvedValue(over.eventi ?? []) },
    pauseRequest: { findMany: jest.fn().mockResolvedValue(over.richieste ?? []) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(
        over.profilo === null ? null : { consents: null, travelState: null, travelStart: null, travelEnd: null, ...(over.profilo ?? {}) },
      ),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue(over.audit ?? []) },
  } as never;
}

const periodo = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  startDate: G('2026-08-17'),
  endDate: G('2026-08-23'),
  label: null,
  createdAt: G('2026-08-16'),
  ...over,
});

describe('⛔ «riprende il» è il PRIMO GIORNO DI DIETA, non l\'ultimo sospeso', () => {
  it('⛔ sospensione fino al 23 → riprende il 24', async () => {
    const r = await sospensioniDiUnaCliente(fintoPrisma({ eventi: [periodo()] }), 'c1');
    expect(r.periodi[0].dal).toBe('2026-08-17');
    expect(r.periodi[0].riprendeIl).toBe('2026-08-24');
  });

  /** ⚠️ I giorni sospesi sono inclusivi, come li conta `pause.service`: dal 17 al 23 sono sette. */
  it('⚠️ e i giorni sospesi si contano inclusivi: dal 17 al 23 sono 7', async () => {
    const r = await sospensioniDiUnaCliente(fintoPrisma({ eventi: [periodo()] }), 'c1');
    expect(r.periodi[0].giorni).toBe(7);
  });

  /**
   * ⛔ **La stessa regola sulla card del profilo.** Lì c'era una somma di 86.400.000 scritta a mano —
   * la quarta copia della stessa conversione, in un file che due righe sopra spiega che la
   * conversione la fa una funzione sola. Dava lo stesso risultato, finché qualcuno non cambia la
   * regola in un posto solo.
   */
  it('⛔ anche la modalità viaggio sul profilo dice il primo giorno di dieta', async () => {
    const r = await sospensioniDiUnaCliente(
      fintoPrisma({ profilo: { travelState: 'suspended', travelStart: G('2026-09-01'), travelEnd: G('2026-09-10') } }),
      'c1',
    );
    expect(r.adesso).toEqual({ stato: 'suspended', dal: '2026-09-01', riprendeIl: '2026-09-11' });
  });
});

describe('⛔ i periodi si distinguono per stato e per origine', () => {
  /** ⚠️ La data «adesso» decide lo stato: si fissa, o il test cambia risposta col passare dei giorni. */
  const conOggi = (iso: string) => {
    jest.useFakeTimers({ now: new Date(`${iso}T10:00:00.000Z`), doNotFake: ['nextTick', 'setImmediate'] });
  };
  afterEach(() => jest.useRealTimers());

  it('⛔ in corso: oggi cade dentro il periodo', async () => {
    conOggi('2026-08-20');
    const r = await sospensioniDiUnaCliente(fintoPrisma({ eventi: [periodo()] }), 'c1');
    expect(r.periodi[0].stato).toBe('in_corso');
  });

  /**
   * ⛔ **L'ULTIMO GIORNO SOSPESO È ANCORA «IN CORSO».** È il giorno in cui si apre la finestra di
   * rientro, e chiamarlo «passata» qui vorrebbe dire far credere a chi legge la diagnostica che
   * l'erogazione sia già ripartita — mentre `activePausePeriod` la tiene ancora ferma.
   */
  it('⛔ il 23, ultimo giorno sospeso, è ancora in corso', async () => {
    conOggi('2026-08-23');
    const r = await sospensioniDiUnaCliente(fintoPrisma({ eventi: [periodo()] }), 'c1');
    expect(r.periodi[0].stato).toBe('in_corso');
  });

  it('⛔ e il 24, primo giorno di dieta, è passata', async () => {
    conOggi('2026-08-24');
    const r = await sospensioniDiUnaCliente(fintoPrisma({ eventi: [periodo()] }), 'c1');
    expect(r.periodi[0].stato).toBe('passata');
  });

  it('futura: comincia domani', async () => {
    conOggi('2026-08-10');
    const r = await sospensioniDiUnaCliente(fintoPrisma({ eventi: [periodo()] }), 'c1');
    expect(r.periodi[0].stato).toBe('futura');
  });

  /**
   * ⚠️ **Le tre porte non valgono uguale in €**: la richiesta di pausa e la modalità viaggio
   * allungano la scadenza del piano, il Calendario in app **no** (difetto aperto). Chi legge deve
   * poterle distinguere, e il modo è l'etichetta dell'evento più la richiesta collegata.
   */
  it('⚠️ l\'origine distingue le tre porte', async () => {
    conOggi('2026-08-20');
    const r = await sospensioniDiUnaCliente(
      fintoPrisma({
        eventi: [periodo({ id: 'ev-viaggio', label: 'Modalità viaggio' }), periodo({ id: 'ev-calendario' })],
      }),
      'c1',
    );
    const per = new Map(r.periodi.map((p) => [p.id, p.origine]));
    expect(per.get('ev-viaggio')).toBe('Modalità viaggio');
    expect(per.get('ev-calendario')).toBe('Calendario in app');
  });

  it('⚠️ e con una richiesta collegata l\'origine è la richiesta di pausa', async () => {
    conOggi('2026-08-20');
    const r = await sospensioniDiUnaCliente(
      fintoPrisma({
        eventi: [periodo({ id: 'ev-1' })],
        richieste: [{
          id: 'req-1', startDate: G('2026-08-17'), endDate: G('2026-08-23'), days: 7, status: 'approved',
          eventId: 'ev-1', decidedByStaffId: null, decidedAt: null, staffNote: null, createdAt: G('2026-08-16'),
        }],
      }),
      'c1',
    );
    expect(r.periodi[0].origine).toBe('Richiesta di pausa');
  });
});

/**
 * ⚠️ **I periodi DICHIARATI nel questionario non fermano niente**, e non l'hanno mai fatto: stanno
 * in elenco solo per capire se quello che sta succedendo era previsto. Tenerli separati dai periodi
 * veri è metà del valore di questa lettura — confonderli farebbe cercare un cancello dove non c'è.
 */
describe('⚠️ quello che NON ferma i menu resta separato', () => {
  it('⚠️ i periodi del questionario stanno in un campo loro', async () => {
    const r = await sospensioniDiUnaCliente(
      fintoPrisma({ profilo: { consents: { pausePeriods: [{ start: '2026-12-20', end: '2027-01-06' }] } } }),
      'c1',
    );
    expect(r.periodi).toEqual([]);
    expect(r.dichiarati).toEqual([{ dal: '2026-12-20', al: '2027-01-06' }]);
  });

  it('un profilo che non c\'è non fa esplodere niente', async () => {
    const r = await sospensioniDiUnaCliente(fintoPrisma({ profilo: null }), 'c1');
    expect(r.adesso).toBeNull();
    expect(r.dichiarati).toEqual([]);
  });
});

/**
 * ⛔ **I DUE PEZZI PIÙ FRAGILI DELL'ESTRAZIONE — e sono gli unici senza rete.**
 *
 * Spostando questa lettura fuori dal servizio, ~130 righe sono state re-indentate e `this.prisma` è
 * diventato `prisma`. Un diff meccanico protegge il momento del trasloco, non i mesi dopo: e i due
 * blocchi che nessun test toccava erano proprio quelli con dentro una mappatura a mano — lo storico
 * della card e i nomi di chi ha deciso una richiesta. Un campo perso lì sarebbe passato verde.
 */
describe('⛔ chi ha deciso, e lo storico della card', () => {
  it('⛔ il nome di chi ha deciso la richiesta arriva in elenco', async () => {
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      pauseRequest: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'req-1', startDate: G('2026-08-17'), endDate: G('2026-08-23'), days: 7, status: 'approved',
          eventId: null, decidedByStaffId: 'u-lucia', decidedAt: G('2026-08-16'), staffNote: 'Vacanza',
          createdAt: G('2026-08-15'),
        }]),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u-lucia', email: 'l@x.it', firstName: 'Lucia', lastName: 'Bianchi' }]) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    const r = await sospensioniDiUnaCliente(prisma, 'c1');
    expect(r.richieste[0]).toMatchObject({
      dal: '2026-08-17', riprendeIl: '2026-08-24', giorni: 7, stato: 'approved',
      decisaDa: 'Lucia Bianchi', nota: 'Vacanza',
    });
  });

  /** ⚠️ Senza nome e cognome si ripiega sull'email: meglio un indirizzo che «—». */
  it('⚠️ senza nome si mostra l\'email', async () => {
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      pauseRequest: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'r', startDate: G('2026-08-17'), endDate: G('2026-08-23'), days: 7, status: 'approved',
          eventId: null, decidedByStaffId: 'u1', decidedAt: null, staffNote: null, createdAt: G('2026-08-15'),
        }]),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', email: 'staff@x.it', firstName: null, lastName: null }]) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    const r = await sospensioniDiUnaCliente(prisma, 'c1');
    expect(r.richieste[0].decisaDa).toBe('staff@x.it');
  });

  /**
   * ⚠️ **Le voci del registro scritte PRIMA del 23/8 hanno solo lo stato**: da quel giorno ci finiscono
   * anche le date. Le vecchie restano con le date a `null` — che è la verità, e si vede — invece di
   * essere riempite indovinando.
   */
  it('⚠️ lo storico della card: le voci vecchie restano senza date, non se le inventa', async () => {
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      pauseRequest: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a1', action: 'client.travel.suspend', createdAt: G('2026-08-23'), metadata: { state: 'suspended', dal: '2026-08-17', riprendeIl: '2026-08-24', giorniSospesi: 7 }, actor: { email: 'l@x.it', firstName: 'Lucia', lastName: null } },
          { id: 'a0', action: 'client.travel.update', createdAt: G('2026-07-02'), metadata: { state: 'planned' }, actor: null },
        ]),
      },
    } as never;
    const r = await sospensioniDiUnaCliente(prisma, 'c1');
    expect(r.viaggio[0]).toMatchObject({ stato: 'suspended', dal: '2026-08-17', riprendeIl: '2026-08-24', giorni: 7, chi: 'Lucia' });
    expect(r.viaggio[1]).toMatchObject({ stato: 'planned', dal: null, riprendeIl: null, giorni: null, chi: null });
  });
});
