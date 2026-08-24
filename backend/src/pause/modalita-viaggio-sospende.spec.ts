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
   * ⛔ Il buco peggiore della seconda revisione: una modalità viaggio aperta su ALTRE date veniva
   * riusata e riscritta, azzerando la memoria. Ora si rifiuta e si spiega la strada.
   */
  it('con un\'altra modalità viaggio aperta su date diverse si ferma e spiega come fare', async () => {
    const { service, prisma } = crea({
      eventoAperto: { id: 'ev-set', startDate: giorno(20), endDate: giorno(28) },
    });
    await expect(service.sospendiPerViaggio('c1', 'staff1', VACANZA)).rejects.toThrow(
      /riporta lo stato a «— nessuna —»/,
    );
    expect(prisma.event.create).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

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

  it('non si sovrappone a una pausa nata da un\'altra porta', async () => {
    const { service, prisma } = crea({
      altraPausa: { id: 'ev-altra', startDate: giorno(10), endDate: giorno(25) },
    });
    await expect(service.sospendiPerViaggio('c1', 'staff1', VACANZA)).rejects.toThrow(
      /messa da un'altra strada/s,
    );
    expect(prisma.event.create).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
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
