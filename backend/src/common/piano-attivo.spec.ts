/**
 * «QUESTA CLIENTE RICEVE I MENU?» — una domanda, una risposta.
 *
 * Questo file nasce per uccidere i falsi allarmi (il caso Rosaria, in testa a `piano-attivo.ts`), e
 * conteneva **due definizioni che non coincidevano**: il filtro escludeva il Monitoraggio,
 * `pianiDiClienti` lo dava per «attivo e riceve menu». L'autorità vera è `deliverIfEligible`, che a
 * quelle persone non manda niente.
 *
 * Decisione di Simone (12/8): una regola sola, quella dell'erogazione.
 */
import { pianiDiClienti } from './piano-attivo';
import type { PrismaService } from '../prisma/prisma.service';

const OGGI = new Date('2026-08-12T10:00:00Z');
const fra = (g: number) => new Date(OGGI.getTime() + g * 86_400_000);

function prismaFinto(over: Record<string, unknown> = {}) {
  return {
    subscription: {
      findMany: jest.fn().mockResolvedValue([
        { clientId: 'c-1', status: 'active', endDate: fra(30), plan: { name: 'Percorso 3 mesi', period: '3m' } },
      ]),
    },
    event: { findMany: jest.fn().mockResolvedValue([]) },
    clientProfile: { findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  } as unknown as PrismaService;
}

describe('riceveMenu', () => {
  it('un percorso attivo riceve i menu', async () => {
    const out = await pianiDiClienti(prismaFinto(), ['c-1'], OGGI);
    expect(out.get('c-1')).toMatchObject({ stato: 'attivo', riceveMenu: true });
  });

  it('⚠️ il MONITORAGGIO è attivo ma NON riceve menu', async () => {
    // È il falso allarme del caso Rosaria: la diagnostica la contava fra le «attive» e stampava un
    // avviso su una dieta incompleta che a lei non sarebbe mai arrivata.
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'active', endDate: fra(30), plan: { name: 'Monitoraggio', period: 'monitoring' } },
        ]),
      },
    });
    const out = await pianiDiClienti(p, ['c-1'], OGGI);
    expect(out.get('c-1')).toMatchObject({ stato: 'attivo', riceveMenu: false });
  });

  it('⚠️ «Monitoring» con la maiuscola è la stessa cosa', async () => {
    // Il Negozio salva `period` verbatim e accetta le maiuscole: un confronto sensibile alle
    // maiuscole farebbe rientrare la cliente per una lettera.
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'active', endDate: null, plan: { name: 'Monitoraggio', period: 'Monitoring' } },
        ]),
      },
    });
    expect((await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1')?.riceveMenu).toBe(false);
  });

  it('⚠️ in PAUSA vacanza non riceve menu: o ricevi menu, o sei in pausa', async () => {
    const p = prismaFinto({ event: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c-1' }]) } });
    const out = await pianiDiClienti(p, ['c-1'], OGGI);
    // Il piano resta «attivo» — lo è — ma i menu non arrivano: sono due cose diverse.
    expect(out.get('c-1')).toMatchObject({ stato: 'attivo', riceveMenu: false });
  });

  it('⚠️ col piano FERMATO dal nutrizionista non riceve menu', async () => {
    const p = prismaFinto({ clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'c-1' }]) } });
    expect((await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1')?.riceveMenu).toBe(false);
  });

  it('un piano scaduto ma ancora «active» non riceve niente', async () => {
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'active', endDate: fra(-3), plan: { name: 'Percorso', period: '3m' } },
        ]),
      },
    });
    const out = await pianiDiClienti(p, ['c-1'], OGGI);
    expect(out.get('c-1')).toMatchObject({ stato: 'scaduto_da_chiudere', riceveMenu: false });
  });

  it('⚠️ se le due letture in più falliscono, l\'elenco esce lo stesso', async () => {
    // Una diagnostica che non parte perché un controllo accessorio è andato storto non serve a
    // nessuno: nel dubbio si risponde come prima.
    const p = prismaFinto({
      event: { findMany: jest.fn().mockRejectedValue(new Error('db giù')) },
      clientProfile: { findMany: jest.fn().mockRejectedValue(new Error('db giù')) },
    });
    expect((await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1')?.riceveMenu).toBe(true);
  });

  it('nessun cliente: nessuna query', async () => {
    const p = prismaFinto();
    expect((await pianiDiClienti(p, [], OGGI)).size).toBe(0);
    expect((p as unknown as { subscription: { findMany: jest.Mock } }).subscription.findMany).not.toHaveBeenCalled();
  });
});

/**
 * IL PIANO IN CODA NELLE DIAGNOSTICHE — voce 258, 19/8.
 *
 * ⚠️ Prima esistevano quattro stati e nessuno era «in coda»: un piano comprato che comincia il 31/08
 * cadeva nel ramo `else` e usciva scritto **«concluso il 31/11»** — concluso a una data che deve
 * ancora arrivare. È esattamente la riga falsa che questo file esiste per impedire, e il costo non è
 * il minuto perso a controllarla: è che dopo due o tre nessuno guarda più la lista.
 */
describe('il piano in coda', () => {
  it('⚠️ non è «concluso»: si vede che è in coda, e da quando', async () => {
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'queued', startDate: fra(12), endDate: fra(102), plan: { name: 'Percorso 3 mesi', period: '3m' } },
        ]),
      },
    });
    const riga = (await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1');
    // ⚠️ `riceveMenu: true`: nella finestra di anteprima l'erogazione compone già i giorni del
    // piano che deve cominciare. Dire di no farebbe scrivere alla diagnostica delle diete monche
    // «non sta danneggiando nessuno» su una cliente che quei menu li ha in mano.
    expect(riga).toMatchObject({ stato: 'in_coda', riceveMenu: true });
    expect(riga?.etichetta).toContain('in coda dal 24/08');
  });

  /** ⚠️ E la stessa cosa nella forma VECCHIA: `active` con la partenza nel futuro. */
  it('⚠️ anche la coda scritta com\'era prima del 18/8 si riconosce', async () => {
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'active', startDate: fra(12), endDate: fra(102), plan: { name: 'Percorso 3 mesi', period: '3m' } },
        ]),
      },
    });
    expect((await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1')).toMatchObject({ stato: 'in_coda', riceveMenu: true });
  });

  /**
   * ⚠️ UNA CODA MAI PARTITA E GIÀ SCADUTA NON È «IN CODA»: è una riga da sistemare.
   *
   * Vuol dire che la promozione notturna non ha girato per giorni e che una cliente ha pagato un
   * piano che non è mai partito. Scriverla «in coda dal 24/08» con la fine già passata sarebbe una
   * riga falsa — e per giunta batterebbe il piano concluso della stessa cliente, cioè coprirebbe
   * l'unica riga vera che c'è.
   */
  it('⚠️ la coda arrivata a scadenza senza mai partire si vede come riga da sistemare', async () => {
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'queued', startDate: fra(-60), endDate: fra(-2), plan: { name: 'Percorso 3 mesi', period: '3m' } },
        ]),
      },
    });
    const riga = (await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1');
    expect(riga).toMatchObject({ stato: 'scaduto_da_chiudere', riceveMenu: false });
    expect(riga?.etichetta).toContain('da chiudere');
  });

  /**
   * ⚠️ Fra un piano concluso e una coda vince la coda: «concluso il 22/07» su una cliente che ha
   * ricomprato è la riga che la fa richiamare per rivenderle quello che ha già comprato. E fra una
   * coda e un piano che sta erogando vince chi eroga: è quello che decide cosa vede oggi.
   */
  it('⚠️ la coda batte il piano concluso, e perde contro quello che sta erogando', async () => {
    const conclusoEcoda = [
      { clientId: 'c-1', status: 'expired', startDate: fra(-120), endDate: fra(-21), plan: { name: 'Percorso 3 mesi', period: '3m' } },
      { clientId: 'c-1', status: 'queued', startDate: fra(12), endDate: fra(102), plan: { name: 'Percorso 6 mesi', period: '6m' } },
    ];
    const p = prismaFinto({ subscription: { findMany: jest.fn().mockResolvedValue(conclusoEcoda) } });
    expect((await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1')).toMatchObject({ stato: 'in_coda' });

    const conAttivo = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          ...conclusoEcoda,
          { clientId: 'c-1', status: 'active', startDate: fra(-10), endDate: fra(12), plan: { name: 'Percorso 3 mesi', period: '3m' } },
        ]),
      },
    });
    expect((await pianiDiClienti(conAttivo, ['c-1'], OGGI)).get('c-1')).toMatchObject({ stato: 'attivo', riceveMenu: true });
  });
});
