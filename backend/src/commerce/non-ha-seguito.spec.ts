/**
 * ⛔ **«NON HA SEGUITO»: la regola, e le due trappole che la rendevano inutile.**
 *
 * La prima è che al questionario il sistema scrive **da solo** una misura col peso dichiarato, e
 * quella riga è indistinguibile da una fatta a mano. Chiedere «ha almeno una misura?» avrebbe
 * risposto sì su quasi tutte.
 *
 * ⛔ La seconda l'ha trovata la revisione del 24/8, e la prima stesura di questo file **ci era
 * cascata dentro**: dire «tanto la misura del questionario è di prima che il piano cominci» è falso
 * nel caso più comune di tutti, perché chi finisce il questionario attiva «Conosciamoci» lo stesso
 * giorno. Con la finestra più larga su tutti i piani, quella misura copriva anche i mesi dopo: la
 * colonna sarebbe rimasta vuota per chiunque avesse cominciato subito. Un lavoro consegnato, verde, e
 * che non serve a niente. I primi due test di questo file sono quelli.
 */
import { nonHaMaiSeguito, STAGE_NON_SEGUITA, STAGE_PERCORSO_CONCLUSO } from './non-ha-seguito';

const G = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** `menu_visible_days_before_start`, il valore di default: la finestra comincia 2 giorni prima. */
const DUE_GIORNI = 2;

/**
 * ⚠️ Il finto **modella la semantica della query**, non la sua forma: legge `gte`/`gt`/`lte`/`lt` e
 * il `NOT` sulla data. Prima destrutturava `{ gte, lte }` e basta, e cambiando operatore esplodeva
 * con un `TypeError` invece di far vedere il confine spostato: i test diventavano rossi per la
 * ragione sbagliata, che è quasi come non averli.
 */
function finto(
  piani: { startDate: Date | null; endDate: Date | null }[],
  misure: string[],
  questionario?: string | null,
) {
  const measurement = {
    findFirst: jest.fn(async (args: any) => {
      const d = args.where.date ?? {};
      const escluso: Date | undefined = args.where.NOT?.date;
      const dentro = misure.find((m) => {
        const t = G(m).getTime();
        if (d.gte != null && t < d.gte.getTime()) return false;
        if (d.gt != null && t <= d.gt.getTime()) return false;
        if (d.lte != null && t > d.lte.getTime()) return false;
        if (d.lt != null && t >= d.lt.getTime()) return false;
        if (escluso && t === escluso.getTime()) return false;
        return true;
      });
      return dentro ? { id: `mis-${dentro}` } : null;
    }),
  };
  const subscription = { findMany: jest.fn(async (args: any) => piani.filter(() => args.where.status?.not !== '__mai__')) };
  const clientProfile = {
    findUnique: jest.fn(async () => ({ onboardingCompletedAt: questionario ? G(questionario) : null })),
  };
  return { prisma: { subscription, measurement, clientProfile } as never, measurement, subscription, clientProfile };
}

describe('nonHaMaiSeguito — chi ha comprato e non si è mai pesata', () => {
  it('⛔ la misura scritta dal QUESTIONARIO non salva nessuno, nemmeno quando il piano parte quel giorno stesso', async () => {
    // È il caso normale del prodotto: finisce il questionario e «Conosciamoci» parte oggi. Prima
    // della revisione questo test sarebbe stato rosso, e la colonna in produzione vuota.
    const { prisma } = finto([{ startDate: G('2026-07-01'), endDate: G('2026-07-09') }], ['2026-07-01'], '2026-07-01');
    await expect(nonHaMaiSeguito(prisma, 'c1', DUE_GIORNI)).resolves.toBe(true);
  });

  it('⛔ e non la salva nemmeno sui piani DOPO: la finestra larga la portava avanti per sempre', async () => {
    const due = [
      { startDate: G('2026-07-01'), endDate: G('2026-07-09') },  // Conosciamoci
      { startDate: G('2026-07-10'), endDate: G('2026-10-10') },  // tre mesi pagati, zero pesate
    ];
    await expect(nonHaMaiSeguito(finto(due, ['2026-07-01'], '2026-07-01').prisma, 'c1', DUE_GIORNI)).resolves.toBe(true);
  });

  it('una pesata DENTRO il piano vuol dire che ha seguito', async () => {
    const { prisma } = finto([{ startDate: G('2026-07-10'), endDate: G('2026-08-10') }], ['2026-07-22'], '2026-07-01');
    await expect(nonHaMaiSeguito(prisma, 'c1', DUE_GIORNI)).resolves.toBe(false);
  });

  /**
   * ⚠️ **LA PESATA CHE LE ABBIAMO CHIESTO NOI.** `menu/misura-di-partenza.ts` trattiene il menu
   * finché non arriva la misura di partenza, e la chiede a partire da quando il menu diventa
   * visibile — `menu_visible_days_before_start` giorni **prima** dell'inizio. Contare la finestra dal
   * giorno dell'inizio voleva dire accusare di non aver seguito proprio chi aveva fatto, il giorno
   * che gliel'abbiamo chiesto, l'unica pesata che il sistema le ha imposto. Trovato in revisione.
   */
  it('⛔ la misura di partenza, presa 2 giorni prima dell\'inizio, CONTA', async () => {
    const piano = [{ startDate: G('2026-07-10'), endDate: G('2026-10-10') }];
    await expect(nonHaMaiSeguito(finto(piano, ['2026-07-08']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(false);
    // Tre giorni prima no: la finestra è quella del menu, non «un po' prima».
    await expect(nonHaMaiSeguito(finto(piano, ['2026-07-07']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(true);
  });

  it('⚠️ gli ESTREMI sono compresi: la fine del piano conta', async () => {
    const piano = [{ startDate: G('2026-07-10'), endDate: G('2026-08-10') }];
    await expect(nonHaMaiSeguito(finto(piano, ['2026-08-10']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(false);
    await expect(nonHaMaiSeguito(finto(piano, ['2026-08-11']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(true);
  });

  /**
   * ⛔ **IL DIFETTO DI FUSO CHE QUESTA FUNZIONE STA EVITANDO.**
   *
   * `Subscription.startDate` può contenere un ISTANTE vero, non una mezzanotte: un piano in coda
   * eredita l'ora di scadenza di quello prima. `Measurement.date` è una colonna `DATE`, cioè sempre
   * mezzanotte UTC. Senza portare gli estremi al giorno, una pesata fatta **il giorno stesso** in cui
   * il piano finisce risulterebbe *dopo* la fine — e la cliente sarebbe accusata di non aver seguito
   * per una misura che ha davvero inserito.
   */
  it('⛔ un piano che finisce alle 10:00 non taglia fuori la pesata di quello stesso giorno', async () => {
    const conOra = [{ startDate: new Date('2026-07-10T10:00:00.000Z'), endDate: new Date('2026-08-10T10:00:00.000Z') }];
    await expect(nonHaMaiSeguito(finto(conOra, ['2026-08-10']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(false);
    await expect(nonHaMaiSeguito(finto(conOra, ['2026-07-10']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(false);
  });

  it('⚠️ con PIÙ piani la finestra è la più larga: si guarda dal primo inizio all\'ultima fine', async () => {
    const due = [
      { startDate: G('2026-03-01'), endDate: G('2026-04-01') },
      { startDate: G('2026-07-10'), endDate: G('2026-08-10') },
    ];
    await expect(nonHaMaiSeguito(finto(due, ['2026-03-15']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(false);
    // ⚠️ E anche una pesata nel BUCO fra i due conta: la finestra è unica, di proposito. Sbagliare
    // qui vorrebbe dire accusare qualcuno, e quell'errore costa più di una scheda lasciata dov'era.
    await expect(nonHaMaiSeguito(finto(due, ['2026-05-20']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(false);
    await expect(nonHaMaiSeguito(finto(due, ['2026-02-01']).prisma, 'c1', DUE_GIORNI)).resolves.toBe(true);
  });

  it('⚠️ senza piani con date leggibili risponde «non lo so» (`null`), non «non ha seguito»', async () => {
    await expect(nonHaMaiSeguito(finto([], []).prisma, 'c1', DUE_GIORNI)).resolves.toBeNull();
    await expect(nonHaMaiSeguito(finto([{ startDate: null, endDate: null }], []).prisma, 'c1', DUE_GIORNI)).resolves.toBeNull();
    await expect(nonHaMaiSeguito(finto([{ startDate: G('2026-07-10'), endDate: null }], []).prisma, 'c1', DUE_GIORNI)).resolves.toBeNull();
  });

  it('⚠️ non si va nemmeno a guardare le misure se non c\'è una finestra: «non lo so» costa meno', async () => {
    const f = finto([], ['2026-07-22']);
    await expect(nonHaMaiSeguito(f.prisma, 'c1', DUE_GIORNI)).resolves.toBeNull();
    expect(f.measurement.findFirst).not.toHaveBeenCalled();
  });

  it('⚠️ senza data di questionario non si esclude NIENTE: nel dubbio non si accusa', async () => {
    // `onboardingCompletedAt` vuoto (import storico, profilo incompleto): la misura vale.
    const piano = [{ startDate: G('2026-07-10'), endDate: G('2026-08-10') }];
    await expect(nonHaMaiSeguito(finto(piano, ['2026-07-10'], null).prisma, 'c1', DUE_GIORNI)).resolves.toBe(false);
  });

  it('⛔ gli ordini mai pagati (`pending`) restano FUORI dalla finestra', async () => {
    // Un ordine `pending` non ha fatto correre niente. Il finto risponde a vuoto se la query NON
    // porta quel filtro: così il test misura il comportamento, non la forma della chiamata.
    const f = finto([{ startDate: G('2026-07-10'), endDate: G('2026-08-10') }], []);
    f.subscription.findMany.mockImplementation(async (args: any) =>
      args.where?.status?.not === 'pending' ? [{ startDate: G('2026-07-10'), endDate: G('2026-08-10') }] : [],
    );
    await expect(nonHaMaiSeguito(f.prisma, 'c1', DUE_GIORNI)).resolves.toBe(true);
  });

  it('le due chiavi di colonna sono quelle scritte nel seed', () => {
    expect(STAGE_NON_SEGUITA).toBe('non_seguita');
    expect(STAGE_PERCORSO_CONCLUSO).toBe('path_ended');
  });
});
