import { conOrologioFermo } from '../../test/orologio-fermo';
import { giornoItaliano, giornoLocale } from '../common/date-only';
import { ClientsService } from './clients.service';
import { pickMainSubscription } from '../commerce/commerce.service';

/**
 * Caso reale che ha generato questi test (5 agosto 2026, Giusy):
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
    // ⚠️ Le date ci sono anche dove non decidono niente (qui nessuno dei due è attivo): dal 17/8 il
    // tipo le richiede, perché un chiamante che se le dimentica tornerebbe in silenzio al difetto
    // di Lorena. Vederle scritte in ogni caso di prova è parte della guardia.
    const subs = [
      { id: 'annullato', status: 'cancelled', startDate: D('2026-07-20'), endDate: D('2026-10-20') },
      { id: 'prova', status: 'expired', startDate: D('2026-07-17'), endDate: D('2026-07-25') },
    ];
    expect(pickMainSubscription(subs)?.id).toBe('prova');
  });

  it('un abbonamento ATTIVO vince su tutto, anche se più vecchio', () => {
    const subs = [
      { id: 'annullato', status: 'cancelled', startDate: null, endDate: null },
      { id: 'in-attesa', status: 'pending', startDate: null, endDate: null },
      { id: 'attivo', status: 'active', startDate: null, endDate: null },
    ];
    expect(pickMainSubscription(subs)?.id).toBe('attivo');
  });

  it('uno stato non terminale (in pausa) viene prima di uno scaduto', () => {
    const subs = [
      { id: 'scaduto', status: 'expired', startDate: null, endDate: null },
      { id: 'in-pausa', status: 'paused', startDate: null, endDate: null },
    ];
    expect(pickMainSubscription(subs)?.id).toBe('in-pausa');
  });

  it('senza abbonamenti torna null', () => {
    expect(pickMainSubscription([])).toBeNull();
  });

  /**
   * ⚠️ IL CASO LORENA POLIDORO (16/8), ed è il difetto che questa funzione aveva in testa alla sua
   * catena: `find(s => s.status === 'active')` su una lista `createdAt desc` prende **la più
   * recente**, e la più recente era il piano IN CODA dal 25/08.
   *
   * Quindi la scheda scriveva «Inizio piano: 25/08» — la data del piano in coda — e la matita, che
   * usa la stessa funzione, spostava quella riga. Chi l'ha aperta ha corretto una data sbagliata: ha
   * fatto la cosa giusta con quello che le era stato mostrato. Da lì i due piani sovrapposti.
   */
  it('⚠️ due ATTIVI, uno in corso e uno in coda: vince quello IN CORSO (caso Lorena)', () => {
    const subs = [
      { id: 'in-coda', status: 'active', startDate: inDays(8), endDate: inDays(15) },
      { id: 'in-corso', status: 'active', startDate: inDays(-8), endDate: inDays(8) },
    ];
    expect(pickMainSubscription(subs)?.id).toBe('in-corso');
    // E non dipende dall'ordine della lista: era esattamente il difetto.
    expect(pickMainSubscription([...subs].reverse())?.id).toBe('in-corso');
  });

  it('l\'unico attivo è in coda: si mostra quello, non «nessun piano»', () => {
    // Decisione di Simone (17/8): un piano comprato conta anche se parte fra una settimana.
    const subs = [
      { id: 'in-coda', status: 'active', startDate: inDays(8), endDate: inDays(15) },
      { id: 'scaduto', status: 'expired', startDate: inDays(-30), endDate: inDays(-2) },
    ];
    expect(pickMainSubscription(subs)?.id).toBe('in-coda');
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
    service = new ClientsService(prisma, {} as never, audit, {} as never, menu, {} as never, {} as never, {} as never);
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

  /**
   * ⚠️ SPOSTARE L'INIZIO NEL FUTURO RIMETTE IL PIANO **IN CODA**, NON ATTIVO (19/8, voce 258).
   *
   * Fino al 18/8 qui si scriveva `active` con la partenza fra due giorni, che è la forma ambigua
   * che questa voce toglie di mezzo: la stessa parola diceva «sta erogando» e «comincia giovedì».
   * Un piano che comincia giovedì è in coda fino a giovedì, e ci pensa la promozione notturna a
   * farlo partire — che è anche il motivo per cui `reactivated` qui è **falso**: la scheda non deve
   * scrivere «riattivato» di un piano che oggi non eroga niente.
   */
  it('⚠️ con l\'inizio spostato AVANTI la prova scaduta torna IN CODA, non attiva', async () => {
    const r = await service.updatePlanStart('giusy', 'admin', iso(inDays(2)));

    expect(r.status).toBe('queued');
    expect(r.reactivated).toBe(false);
    expect(prisma.subscription.update.mock.calls[0][0].data.status).toBe('queued');
  });

  /** ⚠️ E spostato a OGGI riparte davvero, senza aspettare la passata notturna. */
  it('⚠️ con l\'inizio spostato a OGGI la prova scaduta torna ATTIVA', async () => {
    const r = await service.updatePlanStart('giusy', 'admin', iso(inDays(0)));

    expect(r.status).toBe('active');
    expect(r.reactivated).toBe(true);
    expect(prisma.subscription.update.mock.calls[0][0].data.status).toBe('active');
  });

  /**
   * ⚠️ UNA CODA ANTICIPATA A OGGI DEVE PARTIRE OGGI (19/8, voce 258).
   *
   * `queued` è uno stato nuovo, e l'elenco degli stati che la matita può riscrivere era stato
   * scritto quando non esisteva. Lasciandolo fuori, la matita salvava le date nuove e **lo stato
   * vecchio**: la cliente vedeva la data giusta sulla scheda e i menu le arrivavano il giorno dopo,
   * quando passava il lavoro notturno. È un difetto che si vede solo dal lato di chi aspetta.
   */
  it('⚠️ la coda anticipata a OGGI parte adesso, non alla passata notturna', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      { id: 'sub-coda', status: 'queued', startDate: inDays(10), endDate: inDays(100), plan: { name: '3 mesi', period: '3m' } },
    ]);
    const r = await service.updatePlanStart('lorena', 'admin', iso(inDays(0)), true);

    expect(r.status).toBe('active');
    expect(prisma.subscription.update.mock.calls[0][0].data.status).toBe('active');
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

    /**
     * ⛔ **ANCHE QUI LA DATA ERA SCRITTA A MANO** — trovato il 24/8 spingendo l'orologio finto avanti
     * di un anno, mentre si chiudeva la voce `test-che-scadono-il-2-settembre`.
     *
     * Diceva `2026-07-11`, fine attesa `19/07/2026`. Dal **12 luglio 2027** quella data è più vecchia
     * del massimo consentito — il controllo è a **366** giorni, non 365, e la prima ora rossa è
     * `2027-07-12T00:00:00.001Z`: `updatePlanStart` risponde «Data fuori intervallo (max un anno da oggi)»
     * — un controllo diverso, che scatta prima — e il test diventa rosso per sempre senza che
     * l'avviso della matita abbia niente che non va. ⚠️ Ed è il modo peggiore: il test avrebbe
     * segnalato un difetto **in un punto che non è quello rotto**.
     *
     * Adesso l'inizio si conta da adesso (30 giorni fa: dentro l'anno, e con la fine — 8 giorni di
     * prova — comunque nel passato, che è la condizione dell'avviso) e la fine attesa si calcola.
     */
    it('il messaggio dice la data di fine calcolata e cosa vedrà la cliente', async () => {
      const inizio = inDays(-30);
      const errore = await service.updatePlanStart('giusy', 'admin', iso(inizio)).catch((e: Error) => e);
      const testo = (errore as Error).message;
      // Inizio + 8 giorni: è il numero che fa capire all'operatore che ha sbagliato mese.
      expect(testo).toContain(giornoItaliano(iso(inDays(-22))));
      expect(testo).toContain('Nessun piano attivo');
      expect(testo).toContain('Prova Gratuita');
    });

    it('una data che lascia il piano in corso non chiede niente', async () => {
      await expect(service.updatePlanStart('giusy', 'admin', iso(inDays(-2)))).resolves.toBeDefined();
      expect(prisma.subscription.update).toHaveBeenCalled();
    });
  });

  /**
   * LA MATITA CHE AVVISA PRIMA DI SOVRAPPORRE (voce 259) — il collegamento, non il calcolo.
   *
   * Il giudizio e la frase stanno in `sovrapposizione-piani.ts` e hanno i loro test per tabella.
   * Qui si difende quello che quei test non possono vedere: che la matita li CHIAMI, che la frase
   * torni come 409 (una domanda, non un errore), che `conferma: true` la superi, e ⚠️ che chi
   * conferma finisca **nel registro** — senza quella riga, fra un mese la sovrapposizione di una
   * cliente si rilegge come un difetto del software invece che come una decisione presa.
   */
  describe('avviso di sovrapposizione (caso Lorena)', () => {
    /** Due `active`: uno eroga (finisce fra 8 giorni), uno in coda che parte quando l'altro finisce. */
    const scenarioLorena = () => [
      {
        id: 'sub-coda',
        status: 'active',
        startDate: inDays(8),
        endDate: inDays(98),
        plan: { name: '3 mesi', period: '3m' },
      },
      {
        id: 'sub-corso',
        status: 'active',
        startDate: inDays(-8),
        endDate: inDays(8),
        plan: { name: 'Conosciamoci', period: '15d' },
      },
    ];

    beforeEach(() => {
      prisma.subscription.findMany.mockResolvedValue(scenarioLorena());
    });

    it('⚠️ la matita sposta quello IN CORSO (`pickMainSubscription`): allungarlo dentro la coda chiede conferma', async () => {
      // Inizio fra 5 giorni + 15 giorni di durata → finisce fra 20, e la coda parte fra 8.
      const errore = await service.updatePlanStart('lorena', 'admin', iso(inDays(5))).catch((e: Error) => e);
      expect(errore).toBeInstanceOf(Error);
      expect((errore as { status?: number }).status).toBe(409);
      const testo = (errore as Error).message;
      expect(testo).toContain('«3 mesi» è in coda');
      expect(testo).toContain('due piani attivi insieme');
      expect(testo).toContain('Se è quello che vuoi, conferma');
      // ⚠️ E soprattutto: non ha scritto niente. Un avviso che scrive comunque non è un avviso.
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('con `conferma: true` esegue, e SCRIVE NEL REGISTRO chi ha superato l\'avviso e su cosa', async () => {
      await service.updatePlanStart('lorena', 'admin', iso(inDays(5)), true);
      expect(prisma.subscription.update).toHaveBeenCalledTimes(1);

      const voce = audit.log.mock.calls.map((c: unknown[]) => c[0]).find((v: { action: string }) => v.action === 'client.plan_start.change');
      expect(voce.actorId).toBe('admin');
      expect(voce.metadata.sovrapposizioneConfermata).toEqual([
        expect.objectContaining({ id: 'sub-coda', piano: '3 mesi', quando: 'in_coda' }),
      ]);
    });

    it('una data che NON fa sovrapporre niente non chiede niente e non scrive la riga nel registro', async () => {
      // Il piano in corso resta dov'è: finisce fra 8 giorni, quando la coda comincia — e il giorno
      // del passaggio di testimone è compreso, quindi si arretra di un giorno.
      await expect(service.updatePlanStart('lorena', 'admin', iso(inDays(-9)))).resolves.toBeDefined();
      const voce = audit.log.mock.calls.map((c: unknown[]) => c[0]).find((v: { action: string }) => v.action === 'client.plan_start.change');
      expect(voce.metadata.sovrapposizioneConfermata).toBeUndefined();
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
  /**
   * ⛔ **ALLE 00:30 «SPOSTA A OGGI» VUOL DIRE OGGI** — difetto trovato il 23/8 con `test:notte`.
   *
   * `d` qui è un **giorno** (`…T00:00:00.000Z`), che è come questo progetto scrive i giorni:
   * mezzanotte UTC del giorno di **Roma**. Ma mezzanotte UTC del 23 sono **le 02:00 italiane** del
   * 23. Confrontandola con «adesso» come se fosse un istante, fra la mezzanotte e le due la matita
   * scriveva `queued` su un piano spostato a **oggi**.
   *
   * ⚠️ Conseguenza per chi sta al telefono con la cliente: sposta la data, la scheda mostra la data
   * giusta, e i menu non arrivano — fino alla passata notturna della notte **dopo**. È esattamente il
   * difetto che la voce 258 dichiarava chiuso, sopravvissuto nelle due ore in cui i due giorni
   * divergono.
   */
  describe('⛔ alle 00:30 di Roma', () => {
    conOrologioFermo(new Date('2026-08-22T22:30:00.000Z')); // per UTC è ancora il 22

    /** Il giorno di **Roma**: quello che intende chi dice «oggi» al telefono. */
    const oggiARoma = () => giornoLocale(new Date());

    it('⛔ spostata a OGGI la prova scaduta torna ATTIVA, non in coda', async () => {
      await service.updatePlanStart('giusy', 'admin', oggiARoma());
      expect(prisma.subscription.update.mock.calls[0][0].data.status).toBe('active');
    });

    it('⚠️ mentre spostata a DOMANI, alla stessa ora, resta in coda', async () => {
      const domani = new Date(`${oggiARoma()}T00:00:00.000Z`);
      domani.setUTCDate(domani.getUTCDate() + 1);
      await service.updatePlanStart('giusy', 'admin', domani.toISOString().slice(0, 10));
      expect(prisma.subscription.update.mock.calls[0][0].data.status).toBe('queued');
    });
  });
});
