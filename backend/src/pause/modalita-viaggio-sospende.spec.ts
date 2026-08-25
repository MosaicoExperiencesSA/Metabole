import { PauseService, ETICHETTA_VIAGGIO } from './pause.service';
import { PrismaService } from '../prisma/prisma.service';
import { aGiorno, giornoLocale } from '../common/date-only';

/**
 * ⛔ **LA MODALITÀ VIAGGIO SOSPENDE DAVVERO** — decisione di Simone, 23/8.
 *
 * Prima la card scriveva tre campi sul profilo e nient'altro: nessun menu fermato, nessuna
 * scadenza spostata — mentre l'app, a chi è in un `pause_period` creato da un'altra porta, scrive
 * «Sei in modalità viaggio». Due oggetti diversi con lo stesso nome.
 *
 * ## I due oggetti di questa consegna, e perché sono due
 *
 * L'**event** ferma i menu e si chiude quando la vacanza si chiude. La **pauseRequest** con
 * l'etichetta della card è il **registro dei giorni concessi**: le sue date non tornano mai
 * indietro, e sono la memoria che impedisce di regalare due volte gli stessi giorni. Due giri di
 * revisione hanno dimostrato che ogni scorciatoia su questa separazione (cancellare invece di
 * chiudere, riscrivere le date del registro, riusare l'evento per un altro periodo) riapre il
 * doppio regalo da un'altra parte.
 */

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/**
 * ⛔ **N GIORNI DI CALENDARIO, NON N×24 ORE** — 24/8.
 *
 * Questa riga faceva `Date.now() + n * 86_400_000`. Sembra la stessa cosa e non lo è: la notte del
 * **25 ottobre 2026** le lancette tornano indietro e il giorno dura **25 ore**, quindi alle 00:30
 * di Roma sommare ventiquattro ore **non arriva a domani** — resta lo stesso giorno.
 *
 * ⚠️ Il difetto era **qui, non nel prodotto**: misurato il 24/8 con `ORA_FINTA`, quella notte il
 * motore erogava i giorni giusti e il gate bloccava chi doveva. Erano queste fixture a dire una cosa
 * e a prepararne un'altra. Un test che mente sulla propria premessa manda a correggere codice che
 * funziona, ed è più caro di un test che manca.
 *
 * ⚠️ Il caso caduto qui: «una vacanza cominciata ieri congela solo i giorni da OGGI in poi». È
 * un conteggio di giorni di vacanza — qui di menu non ce n'è nessuno — e l'helper perdeva un
 * giorno solo per `n` positivo, cioè proprio sul rientro.
 *
 * Adesso si parte da una **mezzanotte UTC** (`aGiorno`, la stessa porta del prodotto) e si somma lì:
 * in UTC non ci sono cambi d'ora, quindi `+ n` giorni è esatto in tutte le stagioni e in tutti i
 * fusi del **processo** — provato su 526.080 istanti. ⚠️ Il giro completo torna al giorno giusto
 * finché il fuso dell'**azienda** (`APP_TIMEZONE`) è a est di Greenwich, come Roma: è una proprietà
 * di `aGiorno`, non di questa riga, ma vale saperlo perché quel fuso si cambia da Render.
 */
const giorno = (n: number) => D(giornoLocale(new Date(aGiorno(new Date()).getTime() + n * 86_400_000)));
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('PauseService — sospensione da modalità viaggio', () => {
  const crea = (opzioni: {
    /** L'event della card che tocca il periodo nuovo (per la ricerca con date). */
    eventoDelPeriodo?: { id: string; startDate: Date; endDate: Date } | null;
    /** L'event della card ancora aperto (per la ricerca senza date e per il conflitto). */
    eventoAperto?: { id: string; startDate: Date; endDate: Date } | null;
    /** Il REGISTRO dei giorni concessi che tocca il periodo (pauseRequest, etichetta card). */
    registro?: { id: string; startDate: Date; endDate: Date; days: number } | null;
    /** Una pausa nata da un'altra porta che si accavalla. */
    altraPausa?: { id: string; startDate: Date; endDate: Date } | null;
    /** La vacanza precedente, per la tregua dei 15 giorni. */
    vacanzaPrecedente?: { startDate: Date; endDate: Date } | null;
    scadenzaPiano?: Date | null;
  } = {}) => {
    const eventi: Record<string, unknown>[] = [];
    const prisma = {
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
      event: {
        /**
         * ⛔ **`findMany` — tutti i periodi di sospensione, aggiunto il 25/8 con la regola delle
         * sovrapposizioni.**
         *
         * `periodiDiSospensione` legge le righe `pause_period` **tutte insieme**, ed è su quelle che
         * si contano la sovrapposizione e il primo giorno utile. ⚠️ Il finto le **compone dalle
         * fixture che già ci sono** invece di rendere una lista vuota: una lista vuota avrebbe
         * lasciato passare tutto, e i test sulle collisioni sarebbero diventati verdi senza provare
         * niente — che è il modo in cui un finto smette di essere una prova.
         */
        findMany: jest.fn(() => {
          const righe: { id: string; startDate: Date; endDate: Date; label: string | null }[] = [];
          const aggiungi = (
            r: { id?: string; startDate: Date; endDate: Date } | null | undefined,
            label: string | null,
            idFinto: string,
          ) => {
            if (!r) return;
            const id = r.id ?? idFinto;
            if (righe.some((x) => x.id === id)) return;
            righe.push({ id, startDate: r.startDate, endDate: r.endDate, label });
          };
          aggiungi(opzioni.eventoDelPeriodo, ETICHETTA_VIAGGIO, 'ev-periodo');
          aggiungi(opzioni.eventoAperto, ETICHETTA_VIAGGIO, 'ev-aperto');
          aggiungi(opzioni.altraPausa, 'Pausa (vacanza)', 'ev-altra');
          aggiungi(opzioni.vacanzaPrecedente, ETICHETTA_VIAGGIO, 'ev-precedente');
          return Promise.resolve(righe);
        }),
        /**
         * ⚠️ Il finto distingue le QUATTRO domande dalla `where`: la vacanza precedente per la
         * tregua (`endDate.lt`), la sospensione della card sul periodo (label + overlap), quella
         * ancora aperta (label + `endDate.gte`), e la pausa di un'altra porta (`NOT label`). Un
         * finto che rispondesse uguale renderebbe questi test ciechi proprio sui casi che contano.
         */
        findFirst: jest.fn(({ where }: any) => {
          if (where?.endDate?.lt) return Promise.resolve(opzioni.vacanzaPrecedente ?? null);
          if (where?.NOT?.label) return Promise.resolve(opzioni.altraPausa ?? null);
          if (where?.label === ETICHETTA_VIAGGIO) {
            const escluso: string | undefined = where?.id?.not;
            const scelto = where?.startDate?.lte ? (opzioni.eventoDelPeriodo ?? null) : (opzioni.eventoAperto ?? null);
            // ⚠️ Il finto onora `id: { not }` come il database: senza, la ricerca «un'ALTRA
            // modalità viaggio aperta» ritroverebbe la stessa riga e il test vedrebbe conflitti
            // che non esistono.
            if (scelto && escluso !== undefined && scelto.id === escluso) return Promise.resolve(null);
            return Promise.resolve(scelto);
          }
          return Promise.resolve(null);
        }),
        create: jest.fn(({ data }: any) => {
          eventi.push(data);
          return Promise.resolve({ id: 'ev-viaggio', ...data });
        }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      pauseRequest: {
        findFirst: jest.fn(({ where }: any) => {
          if (where?.staffNote === ETICHETTA_VIAGGIO) return Promise.resolve(opzioni.registro ?? null);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockResolvedValue({ id: 'req-viaggio' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      measurement: { findFirst: jest.fn().mockResolvedValue({ weightKg: 70 }) },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-1',
            status: 'active',
            startDate: giorno(-200),
            endDate: opzioni.scadenzaPiano === undefined ? giorno(100) : opzioni.scadenzaPiano,
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: null }) },
      // La scheda CRM e la board: servono al parcheggio in «In sospensione» (25/8). Di default una
      // cliente in «Acquisito», cioè il caso normale di chi va in vacanza.
      crmRecord: {
        findUnique: jest.fn().mockResolvedValue({ stage: 'paid', stageDates: {}, stagePrimaSospensione: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      pipelineStage: {
        findUnique: jest.fn(async ({ where }: any) => ({ order: where.key === 'paid' ? 4 : 5 })),
      },
      staff: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
      notification: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new PauseService(
      prisma as unknown as PrismaService,
      audit as never,
      { notify: jest.fn().mockResolvedValue(undefined) } as never,
      { getNumber: jest.fn(async (k: string, d?: number) => (k === 'pause_min_gap_days' ? 15 : (d ?? 0))) } as never,
      {} as never,
    );
    return { service, prisma, audit, eventi };
  };

  /** Una vacanza che comincia fra 5 giorni e dura 14: riprende il 19° giorno da oggi. */
  const VACANZA = { start: giorno(5), rientro: giorno(19) };

  it('«dal 5, riprende il 19» salva una sospensione che finisce il 18, col registro accanto', async () => {
    const { service, eventi, prisma } = crea();
    const esito = await service.sospendiPerViaggio('c1', 'staff1', VACANZA);
    expect(iso(eventi[0].startDate as Date)).toBe(iso(giorno(5)));
    expect(iso(eventi[0].endDate as Date)).toBe(iso(giorno(18)));
    expect(eventi[0].mode).toBe('pause_period');
    expect(esito.giorni).toBe(14);
    // Il registro nasce con i giorni CONCESSI scritti sopra.
    expect(prisma.pauseRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ days: 14, staffNote: ETICHETTA_VIAGGIO }) }),
    );
  });

  it('la scadenza del piano slitta dei giorni sospesi', async () => {
    const { service, prisma } = crea();
    const esito = await service.sospendiPerViaggio('c1', 'staff1', VACANZA);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1' } }),
    );
    expect(iso(esito.nuovaScadenza as Date)).toBe(iso(giorno(114))); // 100 + 14
    expect(esito.giorniCongelati).toBe(14);
  });

  describe('una vacanza già passata', () => {
    it('è rifiutata: non c\'è più niente da fermare', async () => {
      const { service, prisma } = crea();
      await expect(
        service.sospendiPerViaggio('c1', 'staff1', { start: giorno(-40), rientro: giorno(-20) }),
      ).rejects.toThrow(/già finita/);
      expect(prisma.event.create).not.toHaveBeenCalled();
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('e una cominciata ieri congela solo i giorni da OGGI in poi', async () => {
      const { service, prisma } = crea();
      const esito = await service.sospendiPerViaggio('c1', 'staff1', { start: giorno(-10), rientro: giorno(5) });
      expect(esito.giorni).toBe(15);
      expect(esito.giorniCongelati).toBe(5);
      const scritta = prisma.subscription.update.mock.calls[0][0].data.endDate as Date;
      expect(iso(scritta)).toBe(iso(giorno(105))); // 100 + 5, non + 15
    });
  });

  describe('il registro impedisce il doppio regalo', () => {
    const CON_TUTTO = {
      eventoDelPeriodo: { id: 'ev-viaggio', startDate: giorno(5), endDate: giorno(18) },
      eventoAperto: { id: 'ev-viaggio', startDate: giorno(5), endDate: giorno(18) },
      registro: { id: 'req-1', startDate: giorno(5), endDate: giorno(18), days: 14 },
    };

    it('risalvando le STESSE date non aggiunge un solo giorno', async () => {
      const { service, prisma } = crea(CON_TUTTO);
      const esito = await service.sospendiPerViaggio('c1', 'staff1', VACANZA);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(esito.nuovaScadenza).toBeNull();
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    /**
     * ⛔ Lo scenario che ha rotto le PRIME DUE stesure: togliere la modalità viaggio e rimetterla
     * uguale. L'evento è stato chiuso, ma il registro è rimasto con le sue date: la copertura si
     * legge da lì, e la differenza è zero.
     */
    it('tolta e rimessa uguale, i giorni NON si concedono una seconda volta', async () => {
      const { service, prisma } = crea({
        // L'evento del periodo esiste ancora (chiuso o no: la ricerca è per overlap) e il registro pure.
        eventoDelPeriodo: { id: 'ev-viaggio', startDate: giorno(5), endDate: giorno(18) },
        registro: { id: 'req-1', startDate: giorno(5), endDate: giorno(18), days: 14 },
      });
      const esito = await service.sospendiPerViaggio('c1', 'staff1', VACANZA);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(esito.nuovaScadenza).toBeNull();
    });

    it('allungando la vacanza aggiunge SOLO i giorni in più, e il registro avanza', async () => {
      const { service, prisma } = crea(CON_TUTTO);
      await service.sospendiPerViaggio('c1', 'staff1', { start: giorno(5), rientro: giorno(22) });
      const scritta = prisma.subscription.update.mock.calls[0][0].data.endDate as Date;
      expect(iso(scritta)).toBe(iso(giorno(103))); // 100 + 3, non + 17
      const registro = prisma.pauseRequest.update.mock.calls[0][0].data;
      expect(registro.days).toBe(17); // 14 già concessi + 3 nuovi
      expect(iso(registro.endDate as Date)).toBe(iso(giorno(21)));
    });

    /**
     * ⛔ Il caso che la SECONDA revisione ha trovato rotto: allungare una vacanza già in corso.
     * Con il conto vecchio (giorni-da-oggi meno totale-concesso) usciva «accorciata di 1» e zero
     * giorni: i giorni pagati in più si perdevano, con un avviso falso.
     */
    it('allungare una vacanza IN CORSO concede esattamente i giorni aggiunti', async () => {
      const { service, prisma } = crea({
        eventoDelPeriodo: { id: 'ev-viaggio', startDate: giorno(-3), endDate: giorno(3) },
        eventoAperto: { id: 'ev-viaggio', startDate: giorno(-3), endDate: giorno(3) },
        registro: { id: 'req-1', startDate: giorno(-3), endDate: giorno(3), days: 7 },
      });
      const esito = await service.sospendiPerViaggio('c1', 'staff1', { start: giorno(-3), rientro: giorno(6) });
      expect(esito.giorniCongelati).toBe(2); // solo il 4 e il 5
      expect(esito.avviso).toBeNull(); // e NESSUN falso «accorciata»
      const scritta = prisma.subscription.update.mock.calls[0][0].data.endDate as Date;
      expect(iso(scritta)).toBe(iso(giorno(102)));
    });

    it('accorciandola la scadenza NON torna indietro, e lo dice — e il registro non arretra', async () => {
      const { service, prisma } = crea(CON_TUTTO);
      const esito = await service.sospendiPerViaggio('c1', 'staff1', { start: giorno(5), rientro: giorno(15) });
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(esito.avviso).toContain('NON è stata riportata indietro');
      const registro = prisma.pauseRequest.update.mock.calls[0][0].data;
      expect(iso(registro.endDate as Date)).toBe(iso(giorno(18))); // resta «fin dove ho concesso»
      expect(registro.days).toBe(14);
    });
  });

  /**
   * ⛔ **RISCRITTI IL 25/8: QUELLO CHE SI FERMA È LA SOVRAPPOSIZIONE, NON L'ESISTENZA.**
   *
   * Il test di prima pretendeva che una modalità viaggio aperta su date **diverse** facesse
   * rifiutare la nuova, e citava il messaggio «riporta lo stato a "— nessuna —"». Era il
   * comportamento vero, e Simone lo ha cambiato il 25/8: *«il giorno di rientro in modo che la coach
   * (non la cliente) possa fare le sospensioni continue»*.
   *
   * ⚠️ La ragione scritta accanto al vecchio divieto — «la memoria dei giorni concessi è legata al
   * periodo» — giustificava il divieto di **riscrivere** un periodo esistente, non quello di
   * aggiungerne uno che non lo tocca. Quel pezzo resta coperto dai test del registro qui sopra.
   */

  /**
   * ⛔ **RIMESSI IL 25/8**: la revisione ha trovato che riscrivendo il gruppo delle sovrapposizioni
   * avevo cancellato, per collateralità, tre test che non c'entravano niente con quella regola —
   * il ripiego quando la scadenza non si muove, il tetto dei 20 giorni e il rientro non dopo la
   * partenza. Tre guardie di prodotto rimaste scoperte senza che nessuno lo decidesse.
   * ⚠️ Un test cancellato per sbaglio non lascia traccia: la suite resta verde, ed è la ragione per
   * cui questa nota resta scritta.
   */
  it('se la scadenza non si è mossa, lo dice invece di far credere il contrario', async () => {
    const { service } = crea({ scadenzaPiano: null });
    const esito = await service.sospendiPerViaggio('c1', 'staff1', VACANZA);
    expect(esito.nuovaScadenza).toBeNull();
    expect(esito.giorniCongelati).toBe(0); // non concessi = non scritti a registro
    expect(esito.avviso).toContain('NON è stata spostata');
  });

  describe('i tetti dell\'interfaccia', () => {
    it('oltre 20 giorni è rifiutato: serve l\'approvazione di una collega', async () => {
      const { service } = crea();
      await expect(
        service.sospendiPerViaggio('c1', 'staff1', { start: giorno(2), rientro: giorno(30) }),
      ).rejects.toThrow(/al massimo 20 giorni/);
    });

    it('un rientro che non è dopo la partenza è rifiutato', async () => {
      const { service } = crea();
      await expect(
        service.sospendiPerViaggio('c1', 'staff1', { start: giorno(5), rientro: giorno(5) }),
      ).rejects.toThrow(/almeno il giorno dopo/);
    });
  });

  describe('⛔ le sovrapposizioni si fermano, le consecutive no', () => {
    /**
     * ⛔ **SENZA `aggiungi` VALE LA REGOLA DI SEMPRE, e non è prudenza: è il difetto peggiore che
     * questa consegna ha aperto e richiuso** (revisione del 25/8).
     *
     * La card si precompila con le date della sospensione in corso, quindi **cambiare le date è il
     * gesto naturale per spostarla**. Se le consecutive fossero permesse senza chiederlo, quel gesto
     * creerebbe una SECONDA sospensione: riprodotto dalla revisione — vacanza 4→13 settembre
     * spostata a ottobre, esito **due eventi, due registri, +20 giorni** di scadenza per una vacanza
     * di dieci, e nessun avviso.
     */
    it('⛔ senza «aggiungi» una modalità viaggio già aperta ferma ancora: spostare non deve duplicare', async () => {
      const { service, prisma } = crea({
        eventoAperto: { id: 'ev-set', startDate: giorno(20), endDate: giorno(28) },
      });
      await expect(service.sospendiPerViaggio('c1', 'staff1', VACANZA)).rejects.toThrow(
        /Aggiungine un'altra/,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    /** ⚠️ E il messaggio dice tutte e due le strade, non solo che ce n'è già una. */
    it('⚠️ e la frase spiega come spostarla E come aggiungerne una seconda', async () => {
      const { service } = crea({
        eventoAperto: { id: 'ev-set', startDate: giorno(20), endDate: giorno(28) },
      });
      await expect(service.sospendiPerViaggio('c1', 'staff1', VACANZA)).rejects.toThrow(/SPOSTARLA/);
    });

    it('⛔ con «aggiungi» invece passa, se le date non si toccano', async () => {
      const { service, prisma } = crea({
        // La nuova va dal giorno 5 al 18; questa comincia il 20: fra le due c'è il 19, libero.
        eventoAperto: { id: 'ev-set', startDate: giorno(20), endDate: giorno(28) },
      });
      const esito = await service.sospendiPerViaggio('c1', 'staff1', { ...VACANZA, aggiungi: true });
      expect(esito.giorni).toBe(14);
      expect(prisma.event.create).toHaveBeenCalled();
    });

    /** ⛔ E attaccate davvero: la nuova finisce il 18, l'altra comincia il 19. Zero giorni in mezzo. */
    it('⛔ e attaccate davvero: comincia il giorno esatto del rientro', async () => {
      const { service, prisma } = crea({
        eventoAperto: { id: 'ev-set', startDate: giorno(19), endDate: giorno(28) },
      });
      await service.sospendiPerViaggio('c1', 'staff1', { ...VACANZA, aggiungi: true });
      expect(prisma.event.create).toHaveBeenCalled();
    });

    /** ⛔ Un giorno in comune invece ferma anche con «aggiungi»: allungherebbe la scadenza due volte. */
    it('⛔ un solo giorno in comune si rifiuta anche con «aggiungi», e dice da quando si può partire', async () => {
      const { service, prisma } = crea({
        eventoAperto: { id: 'ev-set', startDate: giorno(18), endDate: giorno(28) },
      });
      await expect(
        service.sospendiPerViaggio('c1', 'staff1', { ...VACANZA, aggiungi: true }),
      ).rejects.toThrow(/primo giorno da cui puoi far partire questa/);
      expect(prisma.event.create).not.toHaveBeenCalled();
      expect(prisma.event.update).not.toHaveBeenCalled();
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    /** ⚠️ E la data nella frase è quella giusta: il rientro dell'altra, cioè il giorno dopo la sua fine. */
    it('⚠️ la data proposta è il rientro dell’altra sospensione', async () => {
      const { service } = crea({
        eventoAperto: { id: 'ev-set', startDate: giorno(18), endDate: giorno(28) },
      });
      const atteso = giorno(29).toLocaleDateString('it-IT', { timeZone: 'UTC' });
      await expect(
        service.sospendiPerViaggio('c1', 'staff1', { ...VACANZA, aggiungi: true }),
      ).rejects.toThrow(atteso);
    });

    /**
     * ⚠️ **Vale anche per le pause nate dalle porte della CLIENTE**, ed è il punto per cui la
     * guardia adesso è una sola invece di due: il danno — gli stessi giorni contati due volte sulla
     * scadenza — non dipende da quale schermata ha creato l'altro periodo.
     */
    it('⚠️ una pausa nata da un’altra porta che si accavalla ferma lo stesso', async () => {
      const { service, prisma } = crea({
        altraPausa: { id: 'ev-altra', startDate: giorno(10), endDate: giorno(25) },
      });
      await expect(service.sospendiPerViaggio('c1', 'staff1', VACANZA)).rejects.toThrow(
        /si sovrappongono/,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    /** ⚠️ …e la frase la nomina, così si sa in quale schermata andarla a correggere. */
    it('⚠️ e la frase dice di quale sospensione si tratta', async () => {
      const { service } = crea({
        altraPausa: { id: 'ev-altra', startDate: giorno(10), endDate: giorno(25) },
      });
      await expect(service.sospendiPerViaggio('c1', 'staff1', VACANZA)).rejects.toThrow(
        /Pausa \(vacanza\)/,
      );
    });
  });

  describe('la tregua fra due vacanze', () => {
    it('dal back office non ferma, ma avvisa con la data del rientro precedente', async () => {
      const { service, prisma } = crea({
        vacanzaPrecedente: { startDate: giorno(-20), endDate: giorno(-2) },
      });
      const esito = await service.sospendiPerViaggio('c1', 'staff1', VACANZA);
      expect(prisma.event.create).toHaveBeenCalled();
      expect(esito.avviso).toContain('rientrata da un\'altra sospensione');
      expect(esito.avviso).toContain('15 giorni');
    });

    it('passata la tregua non avvisa più', async () => {
      const { service } = crea({
        vacanzaPrecedente: { startDate: giorno(-60), endDate: giorno(-40) },
      });
      const esito = await service.sospendiPerViaggio('c1', 'staff1', VACANZA);
      expect(esito.avviso).toBeNull();
    });
  });

  describe('togliere la sospensione', () => {
    it('una vacanza IN CORSO si tronca a ieri, e il registro si chiude senza arretrare', async () => {
      const { service, prisma } = crea({
        eventoAperto: { id: 'ev-viaggio', startDate: giorno(-3), endDate: giorno(10) },
      });
      const esito = await service.togliSospensioneDaViaggio('c1', 'staff1');
      expect(esito.tolta).toBe(true);
      expect(esito.eraInCorso).toBe(true);
      expect(prisma.event.delete).not.toHaveBeenCalled();
      const scritta = prisma.event.update.mock.calls[0][0].data.endDate as Date;
      expect(iso(scritta)).toBe(iso(giorno(-1)));
      // Il registro si CHIUDE: la sorveglianza smette, i giorni concessi restano scritti.
      expect(prisma.pauseRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'closed' } }),
      );
      expect(esito.avviso).toContain('pesata del rientro');
    });

    /**
     * ⛔ Trovato in seconda revisione: troncare a ieri una vacanza MAI COMINCIATA fabbricava una
     * pausa di un giorno mai esistita — che armava il cancello della pesata del rientro e faceva
     * scattare la tregua dei quindici giorni su una vacanza mai fatta. Si cancella l'evento; la
     * memoria resta nel registro.
     */
    it('una vacanza non ancora cominciata si CANCELLA, senza fabbricare pause fantasma', async () => {
      const { service, prisma } = crea({
        eventoAperto: { id: 'ev-viaggio', startDate: giorno(5), endDate: giorno(18) },
      });
      const esito = await service.togliSospensioneDaViaggio('c1', 'staff1');
      expect(esito.eraInCorso).toBe(false);
      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'ev-viaggio' } });
      expect(prisma.event.update).not.toHaveBeenCalled();
      expect(esito.avviso).toContain('prima che cominciasse');
    });

    it('senza sospensione della card non tocca niente', async () => {
      const { service, prisma } = crea();
      const esito = await service.togliSospensioneDaViaggio('c1', 'staff1');
      expect(esito.tolta).toBe(false);
      expect(prisma.event.update).not.toHaveBeenCalled();
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });
  });
  /**
   * ⛔ **IL MOTIVO FINISCE DAVVERO SULL'EVENTO** — richiesta di Simone del 24/8, «così ci resta
   * salvata».
   *
   * ⚠️ Questi test nascono da una revisione: la persistenza — cioè **il cuore della richiesta** — non
   * era coperta da niente. Togliendo del tutto la scrittura di `note`, o facendo cancellare il motivo
   * a un salvataggio col campo vuoto, la suite restava verde su 5114 test. Lo spec che c'era verificava
   * che il motivo *venisse passato* al servizio, non che arrivasse in banca dati.
   */
  describe('il motivo della sospensione, sull\'evento', () => {
    const VACANZA = { start: giorno(5), rientro: giorno(19) };

    const scritto = (prisma: any) =>
      (prisma.event.update.mock.calls as any[][]).map((c) => c[0]?.data ?? {});

    it('⛔ il motivo scritto arriva su `note`', async () => {
      const { service, prisma } = crea();
      await service.sospendiPerViaggio('c1', 'staff1', { ...VACANZA, motivo: 'ricovero programmato' });
      expect(scritto(prisma).some((d) => d.note === 'ricovero programmato')).toBe(true);
    });

    /**
     * ⛔ **Risalvare col campo vuoto NON cancella quello che c'era.** È la differenza fra «se non ce
     * l'ho non lo scrivo» e «azzeralo» — lo stesso difetto che il seed dei valori nutrizionali ha
     * pagato il 20/8, e che qui costerebbe la motivazione scritta tre settimane prima da un'altra
     * persona.
     */
    it.each([[''], ['   '], [undefined]])('⛔ col motivo «%s» la chiave `note` non si scrive', async (vuoto) => {
      const { service, prisma } = crea();
      await service.sospendiPerViaggio('c1', 'staff1', { ...VACANZA, motivo: vuoto as string | undefined });
      for (const d of scritto(prisma)) {
        expect(Object.prototype.hasOwnProperty.call(d, 'note')).toBe(false);
      }
    });

    it('⚠️ un motivo lunghissimo si tronca invece di far fallire la scrittura', async () => {
      const { service, prisma } = crea();
      await service.sospendiPerViaggio('c1', 'staff1', { ...VACANZA, motivo: 'x'.repeat(900) });
      const conNote = scritto(prisma).find((d) => typeof d.note === 'string');
      expect(conNote.note).toHaveLength(500);
    });
  });
});

/**
 * ⛔ **LA PIPELINE SI MUOVE SUBITO, NON DOMANI NOTTE** — Simone, 24/8: «un nuovo stato dove sostiamo
 * i clienti durante la sospensione». Chi salva sta guardando la scheda in quel momento: se la card
 * restasse dov'era fino al giro notturno, penserebbe che il salvataggio non ha funzionato.
 *
 * ⚠️ Questi test sono nati da un rilievo della revisione del 25/8: le due chiamate immediate si
 * potevano cancellare **tutte e due** e 283 test restavano verdi.
 */
describe('PauseService — la scheda si sposta insieme alla sospensione', () => {
  const crea2 = (opzioni: Parameters<typeof creaPerPipeline>[0] = {}) => creaPerPipeline(opzioni);

  it('una vacanza che comincia OGGI parcheggia subito la scheda', async () => {
    const { service, prisma } = crea2();
    await service.sospendiPerViaggio('c1', 'staff1', { start: giorno(0), rientro: giorno(10) });
    expect(prisma.crmRecord.update).toHaveBeenCalled();
    expect(prisma.crmRecord.update.mock.calls[0][0].data.stage).toBe('in_sospensione');
  });

  /**
   * ⚠️ **Una vacanza FUTURA no**: la cliente i menu li sta ancora ricevendo, e mostrarla ferma
   * sarebbe raccontare una cosa che non è ancora successa. Ci pensa il giro notturno del giorno
   * giusto.
   */
  it('⚠️ una vacanza che comincia fra cinque giorni NON sposta niente adesso', async () => {
    const { service, prisma } = crea2();
    await service.sospendiPerViaggio('c1', 'staff1', { start: giorno(5), rientro: giorno(19) });
    expect(prisma.crmRecord.update).not.toHaveBeenCalled();
  });

  it('e togliere la sospensione riporta subito la scheda dov\'era', async () => {
    const { service, prisma } = crea2({
      eventoAperto: { id: 'ev-1', startDate: giorno(-2), endDate: giorno(8) },
      schedaCrm: { stage: 'in_sospensione', stageDates: {}, stagePrimaSospensione: 'first_visit' },
    });
    await service.togliSospensioneDaViaggio('c1', 'staff1');
    const ultima = prisma.crmRecord.update.mock.calls.at(-1)[0];
    expect(ultima.data).toMatchObject({ stage: 'first_visit', stagePrimaSospensione: null });
  });

  /**
   * ⛔ **Ma non se è ferma per un'ALTRA sospensione**: annullando la vacanza di settembre, la scheda
   * usciva dalla sospensione di agosto ancora in corso — e rientrava da sola la notte dopo,
   * lasciando due passaggi finti nello storico.
   */
  it('⛔ annullando una vacanza futura, chi è ferma per un\'altra resta parcheggiata', async () => {
    const { service, prisma } = crea2({
      eventoAperto: { id: 'ev-futura', startDate: giorno(10), endDate: giorno(20) },
      altraInCorso: { id: 'ev-adesso' },
      schedaCrm: { stage: 'in_sospensione', stageDates: {}, stagePrimaSospensione: 'paid' },
    });
    await service.togliSospensioneDaViaggio('c1', 'staff1');
    expect(prisma.crmRecord.update).not.toHaveBeenCalled();
  });
});

/** Finto ridotto: qui interessano solo la scheda CRM e le due porte che la muovono. */
function creaPerPipeline(opzioni: {
  eventoAperto?: { id: string; startDate: Date; endDate: Date } | null;
  altraInCorso?: { id: string } | null;
  schedaCrm?: { stage: string; stageDates: unknown; stagePrimaSospensione: string | null };
} = {}) {
  const crmRecord = {
    findUnique: jest.fn().mockResolvedValue(opzioni.schedaCrm ?? { stage: 'paid', stageDates: {}, stagePrimaSospensione: null }),
    update: jest.fn().mockResolvedValue({}),
  };
  const prisma = {
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    event: {
      findMany: jest.fn(() => Promise.resolve(
        opzioni.eventoAperto
          ? [{ ...opzioni.eventoAperto, label: ETICHETTA_VIAGGIO }]
          : [],
      )),
      findFirst: jest.fn(({ where }: any) => {
        // La domanda «c'è un'ALTRA sospensione in corso adesso?» esclude l'evento che si sta togliendo.
        if (where?.NOT?.id) return Promise.resolve(opzioni.altraInCorso ?? null);
        if (where?.label === ETICHETTA_VIAGGIO) return Promise.resolve(opzioni.eventoAperto ?? null);
        return Promise.resolve(null);
      }),
      create: jest.fn(({ data }: any) => Promise.resolve({ id: 'ev-nuovo', ...data })),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    pauseRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'req' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    measurement: { findFirst: jest.fn().mockResolvedValue({ weightKg: 70 }) },
    subscription: {
      findMany: jest.fn().mockResolvedValue([{ id: 'sub-1', status: 'active', startDate: giorno(-200), endDate: giorno(100) }]),
      update: jest.fn().mockResolvedValue({}),
    },
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: null }) },
    staff: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    notification: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
    crmRecord,
    pipelineStage: { findUnique: jest.fn(async ({ where }: any) => ({ order: where.key === 'paid' ? 4 : 5 })) },
  };
  const service = new PauseService(
    prisma as unknown as PrismaService,
    { log: jest.fn().mockResolvedValue(undefined) } as never,
    { notify: jest.fn().mockResolvedValue(undefined) } as never,
    { getNumber: jest.fn(async (k: string, d?: number) => (k === 'pause_min_gap_days' ? 15 : (d ?? 0))) } as never,
    {} as never,
  );
  return { service, prisma };
}
