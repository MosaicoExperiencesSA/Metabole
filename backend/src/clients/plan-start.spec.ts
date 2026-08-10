import { ClientsService } from './clients.service';
import { pickMainSubscription } from '../commerce/commerce.service';

/**
 * Caso reale che ha generato questi test (5 agosto 2026, `giusy.vita01@gmail.com`):
 * l'operatore corregge la data di inizio dalla scheda, il messaggio dice "spostato", ma nella
 * scheda la FINE resta quella vecchia e il piano non torna attivo.
 *
 * La causa era che la scheda e la matita sceglievano DUE abbonamenti diversi: la scheda mostrava
 * la prova scaduta, la matita si fermava a "attivo > in attesa > il più recente" e finiva su un
 * checkout ANNULLATO creato dopo. Spostava le date di quello, che nessuno guarda.
 */

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const inDays = (n: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

describe('pickMainSubscription', () => {
  it('con un ANNULLATO più recente e una prova SCADUTA sceglie la scaduta (caso Giusy)', () => {
    // La lista arriva ordinata per createdAt desc: l'annullato è il primo.
    const subs = [
      { id: 'annullato', status: 'cancelled' },
      { id: 'prova', status: 'expired' },
    ];
    expect(pickMainSubscription(subs)?.id).toBe('prova');
  });

  it('un abbonamento ATTIVO vince su tutto, anche se più vecchio', () => {
    const subs = [
      { id: 'annullato', status: 'cancelled' },
      { id: 'in-attesa', status: 'pending' },
      { id: 'attivo', status: 'active' },
    ];
    expect(pickMainSubscription(subs)?.id).toBe('attivo');
  });

  it('uno stato non terminale (in pausa) viene prima di uno scaduto', () => {
    const subs = [
      { id: 'scaduto', status: 'expired' },
      { id: 'in-pausa', status: 'paused' },
    ];
    expect(pickMainSubscription(subs)?.id).toBe('in-pausa');
  });

  it('senza abbonamenti torna null', () => {
    expect(pickMainSubscription([])).toBeNull();
  });
});

describe('ClientsService.updatePlanStart', () => {
  let prisma: any;
  let service: ClientsService;
  let audit: any;
  let menu: any;

  /**
   * Situazione di Giusy: prova gratuita 8 giorni attivata il 17/07 e già scaduta, PIÙ un
   * checkout annullato creato dopo (quindi primo nell'ordinamento per createdAt desc).
   */
  const scenarioGiusy = () => [
    {
      id: 'sub-annullato',
      status: 'cancelled',
      startDate: D('2026-07-20'),
      endDate: D('2026-10-20'),
      plan: { name: '3 mesi', period: '3m' },
    },
    {
      id: 'sub-prova',
      status: 'expired',
      startDate: D('2026-07-17'),
      endDate: D('2026-07-25'),
      plan: { name: 'Prova Gratuita', period: '8d' },
    },
  ];

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }) },
      subscription: { findMany: jest.fn().mockResolvedValue(scenarioGiusy()), update: jest.fn() },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: D('2026-08-06') }), upsert: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    menu = { restartFromPlanStart: jest.fn().mockResolvedValue({ removed: 3, delivered: [] }) };
    service = new ClientsService(prisma, {} as never, audit, {} as never, menu);
  });

  it('sposta la PROVA SCADUTA, non il checkout annullato più recente', async () => {
    const nuova = iso(inDays(2));
    await service.updatePlanStart('giusy', 'admin', nuova);

    // La transazione contiene l'update dell'abbonamento: deve puntare alla prova.
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1);
    const arg = prisma.subscription.update.mock.calls[0][0];
    expect(arg.where.id).toBe('sub-prova');
  });

  it('ricalcola la fine dalla durata del piano SPOSTATO (8 giorni, non 3 mesi)', async () => {
    const nuova = iso(inDays(2));
    const r = await service.updatePlanStart('giusy', 'admin', nuova);

    expect(r.startDate).toBe(nuova);
    expect(r.endDate).toBe(iso(inDays(10))); // +8 giorni dalla nuova partenza
    expect(r.plan).toBe('Prova Gratuita');
  });

  it('con la nuova fine nel futuro riporta la prova scaduta ad ATTIVO', async () => {
    const r = await service.updatePlanStart('giusy', 'admin', iso(inDays(2)));

    expect(r.reactivated).toBe(true);
    expect(r.status).toBe('active');
    const data = prisma.subscription.update.mock.calls[0][0].data;
    expect(data.status).toBe('active');
  });

  it('se la nuova fine resta nel PASSATO non riattiva niente (confermando l\'avviso)', async () => {
    // `conferma: true` perché da qui in avanti una data che manda il piano nel passato viene
    // fermata e rimandata all'operatore: vedi il gruppo di test qui sotto.
    const r = await service.updatePlanStart('giusy', 'admin', iso(inDays(-30)), true);

    expect(r.reactivated).toBe(false);
    expect(prisma.subscription.update.mock.calls[0][0].data.status).toBeUndefined();
  });

  /**
   * L'AVVISO SULLA MATITA (11/8).
   *
   * Il 10/8 Simone segnala che un piano appena attivato non compare in dashboard. La causa era una
   * data di inizio con il mese sbagliato: sommata la durata, il piano risultava finito da giorni,
   * quindi «Nessun piano attivo» e nessun menu. La conclusione fu «errore mio» — ed era vero — ma
   * il sistema aveva eseguito senza dire niente un comando che cancellava il percorso della
   * cliente, e da fuori era indistinguibile da un difetto.
   *
   * Quindi: non un divieto (spostare all'indietro un piano finito per davvero è legittimo), una
   * domanda. Il conto lo fa il server, che è l'unico posto dove la durata del piano è conosciuta.
   */
  describe('avviso «con questa data il piano risulta già finito»', () => {
    it('si ferma con 409 e spiega la conseguenza, senza scrivere niente', async () => {
      await expect(service.updatePlanStart('giusy', 'admin', iso(inDays(-30)))).rejects.toMatchObject({ status: 409 });

      // La parte che conta: nessuna scrittura. Un avviso che arriva DOPO l'update non è un avviso.
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
      expect(menu.restartFromPlanStart).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('il messaggio dice la data di fine calcolata e cosa vedrà la cliente', async () => {
      const errore = await service.updatePlanStart('giusy', 'admin', '2026-07-11').catch((e: Error) => e);
      const testo = (errore as Error).message;
      // 11/07 + 8 giorni = 19/07: è il numero che fa capire all'operatore che ha sbagliato mese.
      expect(testo).toContain('19/07/2026');
      expect(testo).toContain('Nessun piano attivo');
      expect(testo).toContain('Prova Gratuita');
    });

    it('una data che lascia il piano in corso non chiede niente', async () => {
      await expect(service.updatePlanStart('giusy', 'admin', iso(inDays(-2)))).resolves.toBeDefined();
      expect(prisma.subscription.update).toHaveBeenCalled();
    });
  });

  it('non riattiva un abbonamento IN ATTESA (pagamento non approvato)', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      { id: 'sub-attesa', status: 'pending', startDate: D('2026-07-17'), endDate: D('2026-07-25'), plan: { name: '3 mesi', period: '3m' } },
    ]);
    const r = await service.updatePlanStart('giusy', 'admin', iso(inDays(2)));

    expect(r.reactivated).toBe(false);
    expect(prisma.subscription.update.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('riallinea anche la base dei menu (planStartDate) e li fa ripartire', async () => {
    const nuova = iso(inDays(2));
    await service.updatePlanStart('giusy', 'admin', nuova);

    const up = prisma.clientProfile.upsert.mock.calls[0][0];
    expect(iso(up.update.planStartDate)).toBe(nuova);
    expect(menu.restartFromPlanStart).toHaveBeenCalledWith('giusy');
  });
});
