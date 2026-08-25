/**
 * ⛔ **IL PRIMO GIORNO UTILE, E LE SOSPENSIONI CHE NON SI SOVRAPPONGONO.**
 *
 * Richiesta di Simone del 25/8. Le due regole che questo file tiene ferme, perché sono diverse **di
 * proposito** e la differenza è una decisione di prodotto, non un dettaglio:
 *  · la **coach** può incatenarle — primo giorno utile = il giorno di rientro;
 *  · la **cliente** no — primo giorno utile = rientro + tregua, e la seconda ravvicinata si chiede
 *    alla coach.
 *
 * Se un giorno qualcuno le unifica «per semplicità», uno dei due gruppi qui sotto diventa rosso.
 */
import { giornoDiRientro } from './giorno-di-rientro';
import {
  fraseNonSiSovrappone,
  primoGiornoUtile,
  siSovrappone,
  sovrapposti,
  type PeriodoOccupato,
} from './primo-giorno-utile';

const g = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Una vacanza dal 10 al 20 agosto: l'ultimo giorno sospeso è il 20, si rientra il 21. */
const VACANZA: PeriodoOccupato = { startDate: g('2026-08-10'), endDate: g('2026-08-20'), label: 'Modalità viaggio' };

const OGGI = g('2026-08-15'); // in mezzo alla vacanza

describe('⛔ siSovrappone: gli estremi sono compresi', () => {
  it('due periodi lontani non si toccano', () => {
    expect(siSovrappone(VACANZA, { startDate: g('2026-09-01'), endDate: g('2026-09-05') })).toBe(false);
  });

  /**
   * ⛔ **Il caso che decide la regola.** Una che finisce il 20 e una che comincia il 20 condividono
   * **un giorno**, e quel giorno verrebbe contato due volte sulla scadenza del piano. Con `<`
   * invece di `<=` questo test diventa verde e il difetto torna.
   */
  it('⛔ un giorno in comune È una sovrapposizione', () => {
    expect(siSovrappone(VACANZA, { startDate: g('2026-08-20'), endDate: g('2026-08-25') })).toBe(true);
  });

  it('⛔ e il giorno DOPO no: il 21 è il rientro, ed è libero', () => {
    expect(siSovrappone(VACANZA, { startDate: g('2026-08-21'), endDate: g('2026-08-25') })).toBe(false);
  });

  it('una dentro l’altra si tocca, in tutti e due i versi', () => {
    const dentro = { startDate: g('2026-08-12'), endDate: g('2026-08-14') };
    expect(siSovrappone(VACANZA, dentro)).toBe(true);
    expect(siSovrappone(dentro, VACANZA)).toBe(true);
  });

  it('⚠️ e non dipende dall’ora dentro le date salvate', () => {
    const conOrario = { startDate: new Date('2026-08-21T18:30:00.000Z'), endDate: new Date('2026-08-25T09:00:00.000Z') };
    expect(siSovrappone(VACANZA, conOrario)).toBe(false);
  });

  it('`sovrapposti` li rende TUTTI, non il primo: con due c’è altro da fare che spostare la data', () => {
    const periodi = [VACANZA, { startDate: g('2026-08-18'), endDate: g('2026-08-22'), label: 'Pausa (vacanza)' }];
    expect(sovrapposti({ startDate: g('2026-08-19'), endDate: g('2026-08-19') }, periodi)).toHaveLength(2);
  });
});

describe('⛔ primoGiornoUtile — la coach può incatenarle', () => {
  it('senza nessuna sospensione si comincia oggi', () => {
    const e = primoGiornoUtile(OGGI, [], 0);
    expect(iso(e.giorno)).toBe('2026-08-15');
    expect(e.bloccante).toBeNull();
  });

  /**
   * ⛔ È la richiesta, alla lettera: *«il giorno di rientro in modo che la coach (non la cliente)
   * possa fare le sospensioni continue»*. Il 21 è il primo giorno di dieta dopo la vacanza, e da lì
   * ne può partire un'altra.
   */
  it('⛔ con una vacanza in corso fino al 20, il primo utile è il 21 (il rientro)', () => {
    const e = primoGiornoUtile(OGGI, [VACANZA], 0);
    expect(iso(e.giorno)).toBe('2026-08-21');
    expect(iso(giornoDiRientro(VACANZA))).toBe('2026-08-21');
    expect(e.bloccante).toBe(VACANZA);
    expect(e.perTregua).toBe(false);
  });

  it('⛔ vale anche per una PROGRAMMATA che non è ancora cominciata', () => {
    const futura: PeriodoOccupato = { startDate: g('2026-09-10'), endDate: g('2026-09-20') };
    const e = primoGiornoUtile(OGGI, [futura], 0);
    expect(iso(e.giorno)).toBe('2026-09-21');
  });

  /**
   * ⚠️ **Una vacanza già finita non sposta niente.** È la differenza fra «non ti sovrapporre» e
   * «aspetta»: per la coach la prima regola è l'unica, e su un periodo passato non c'è niente da
   * non sovrapporre.
   */
  it('⚠️ una già finita non sposta la data: si può cominciare oggi', () => {
    const passata: PeriodoOccupato = { startDate: g('2026-07-01'), endDate: g('2026-07-10') };
    const e = primoGiornoUtile(OGGI, [passata], 0);
    expect(iso(e.giorno)).toBe('2026-08-15');
    expect(e.bloccante).toBeNull();
  });

  it('⚠️ con più sospensioni vince quella che finisce PIÙ TARDI', () => {
    const altra: PeriodoOccupato = { startDate: g('2026-08-25'), endDate: g('2026-08-31') };
    const e = primoGiornoUtile(OGGI, [VACANZA, altra], 0);
    expect(iso(e.giorno)).toBe('2026-09-01');
    expect(e.bloccante).toBe(altra);
  });

  it('⚠️ e l’ordine in cui arrivano non cambia la risposta', () => {
    const altra: PeriodoOccupato = { startDate: g('2026-08-25'), endDate: g('2026-08-31') };
    expect(iso(primoGiornoUtile(OGGI, [altra, VACANZA], 0).giorno))
      .toBe(iso(primoGiornoUtile(OGGI, [VACANZA, altra], 0).giorno));
  });

  /**
   * ⛔ **La prova che la catena regge**: presa la risposta, una sospensione che comincia lì non si
   * sovrappone a niente. È la proprietà che lega le due funzioni di questo file — se divergessero,
   * la card proporrebbe una data che poi rifiuta da sola.
   */
  it('⛔ una sospensione che comincia nel primo giorno utile NON si sovrappone', () => {
    const periodi = [VACANZA, { startDate: g('2026-08-25'), endDate: g('2026-08-31') }];
    const e = primoGiornoUtile(OGGI, periodi, 0);
    const nuova = { startDate: e.giorno, endDate: new Date(e.giorno.getTime() + 5 * 86_400_000) };
    expect(sovrapposti(nuova, periodi)).toEqual([]);
  });

  it('⛔ e il giorno PRIMA si sovrappone: la data proposta è la prima buona, non una a caso', () => {
    const e = primoGiornoUtile(OGGI, [VACANZA], 0);
    const unGiornoPrima = { startDate: new Date(e.giorno.getTime() - 86_400_000), endDate: g('2026-08-25') };
    expect(sovrapposti(unGiornoPrima, [VACANZA])).toHaveLength(1);
  });
});

describe('⛔ primoGiornoUtile — la cliente aspetta la tregua', () => {
  /**
   * ⛔ La tregua (`pause_min_gap_days`, 15 giorni) esiste dal 23/8: due sospensioni attaccate sono un
   * percorso che non comincia mai. Rientro il 21 + 15 = 5 settembre.
   */
  it('⛔ rientro il 21 più quindici giorni: il primo utile è il 5 settembre', () => {
    const e = primoGiornoUtile(OGGI, [VACANZA], 15);
    expect(iso(e.giorno)).toBe('2026-09-05');
    expect(e.perTregua).toBe(true);
  });

  /**
   * ⛔ **E qui la tregua guarda anche le vacanze GIÀ FINITE**, che per la coach non contavano. È il
   * buco che la tregua vecchia aveva al contrario: lei guardava solo le finite e non vedeva quelle
   * programmate. Adesso si guardano tutte, e vince il vincolo più avanti.
   */
  it('⛔ una vacanza già finita da poco sposta comunque la cliente', () => {
    const finitaIeri: PeriodoOccupato = { startDate: g('2026-08-05'), endDate: g('2026-08-14') };
    const e = primoGiornoUtile(OGGI, [finitaIeri], 15);
    expect(iso(e.giorno)).toBe('2026-08-30'); // rientro il 15, più 15
    expect(e.perTregua).toBe(true);
  });

  it('⚠️ ma una finita da un pezzo no: la tregua è passata', () => {
    const vecchia: PeriodoOccupato = { startDate: g('2026-06-01'), endDate: g('2026-06-10') };
    const e = primoGiornoUtile(OGGI, [vecchia], 15);
    expect(iso(e.giorno)).toBe('2026-08-15');
    expect(e.bloccante).toBeNull();
  });

  /**
   * ⛔ **La differenza fra le due porte, scritta come test.** Stessa cliente, stesso giorno, stessi
   * periodi: la coach parte il 21, la cliente il 5 settembre. Se un giorno diventassero uguali,
   * questo cade.
   */
  it('⛔ sulla stessa situazione coach e cliente NON hanno la stessa risposta', () => {
    expect(iso(primoGiornoUtile(OGGI, [VACANZA], 0).giorno)).toBe('2026-08-21');
    expect(iso(primoGiornoUtile(OGGI, [VACANZA], 15).giorno)).toBe('2026-09-05');
  });

  it('⚠️ una tregua a zero o negativa non sposta niente (parametro spento dai Parametri)', () => {
    expect(iso(primoGiornoUtile(OGGI, [VACANZA], 0).giorno)).toBe('2026-08-21');
    expect(iso(primoGiornoUtile(OGGI, [VACANZA], -5).giorno)).toBe('2026-08-21');
  });
});

describe('⛔ la frase dice QUALE data mettere', () => {
  const eCoach = primoGiornoUtile(OGGI, [VACANZA], 0);
  const eCliente = primoGiornoUtile(OGGI, [VACANZA], 15);

  /**
   * ⛔ Richiesta di Simone, 25/8: *«Rifiuta e dice il primo giorno utile»*. Il messaggio vecchio
   * diceva solo che una sospensione c'era già — vero, e inutile per chi deve scriverne un'altra.
   */
  it('⛔ alla coach: c’è la data da cui può partire, non solo quella occupata', () => {
    const f = fraseNonSiSovrappone(eCoach, 'coach');
    expect(f).toContain('21/08/2026');
    expect(f).toContain('10/08/2026');
    expect(f).toContain('consecutive');
  });

  it('⚠️ e nomina la sospensione che sta in mezzo, così si sa dove andarla a cercare', () => {
    expect(fraseNonSiSovrappone(eCoach, 'coach')).toContain('Modalità viaggio');
  });

  it('⛔ alla cliente, quando la sposta la TREGUA, si dice che si può chiedere alla coach', () => {
    const f = fraseNonSiSovrappone(eCliente, 'cliente');
    expect(f).toContain('05/09/2026');
    expect(f).toContain('coach');
  });

  /** ⚠️ Alla cliente non si parla di «sospensioni consecutive»: da lei non si possono fare. */
  it('⚠️ alla cliente non si promette quello che la coach può fare e lei no', () => {
    expect(fraseNonSiSovrappone(eCliente, 'cliente')).not.toContain('consecutive');
  });

  /**
   * ⛔ **E QUANDO LA COLLISIONE È CON UN PERIODO PASSATO, le date si scrivono lo stesso.**
   *
   * `bloccante` è `null` su un periodo già finito — giustamente: non sposta la data. Ma una
   * sovrapposizione con quel periodo **esiste**, e la prima stesura scriveva «Hai già una pausa dal
   * **null** e riprendi il **null**». Riprodotto dalla revisione del 25/8 chiedendo una pausa
   * retroattiva. ⚠️ Da allora le porte della cliente rifiutano le date passate — quindi in
   * produzione non ci si arriva più — ma la frase resta difesa: una funzione che scrive `null` a una
   * persona è rotta a prescindere da chi la chiama.
   */
  it('⛔ con una collisione nel passato la frase NON scrive «null»', () => {
    const passata: PeriodoOccupato = { startDate: g('2026-07-01'), endDate: g('2026-07-10'), label: 'Pausa (vacanza)' };
    const senzaBloccante = primoGiornoUtile(OGGI, [passata], 0);
    expect(senzaBloccante.bloccante).toBeNull(); // la premessa del caso
    const f = fraseNonSiSovrappone(senzaBloccante, 'cliente', passata);
    expect(f).not.toContain('null');
    expect(f).toContain('01/07/2026');
    expect(f).toContain('11/07/2026');
  });

  /** ⚠️ E senza nessun periodo da nominare non si inventano date: si dice quello che si sa. */
  it('⚠️ e se non c’è nessun periodo da nominare, nessuna data inventata', () => {
    const f = fraseNonSiSovrappone({ giorno: g('2026-08-21'), bloccante: null, perTregua: false }, 'cliente');
    expect(f).not.toContain('null');
    expect(f).toContain('21/08/2026');
  });

  /** ⚠️ Niente markdown: queste frasi finiscono in un avviso e in una bolla di chat, non in una pagina. */
  it('⚠️ nessun asterisco: nessuno le disegna', () => {
    expect(fraseNonSiSovrappone(eCoach, 'coach')).not.toContain('*');
    expect(fraseNonSiSovrappone(eCliente, 'cliente')).not.toContain('*');
  });
});

/**
 * ⛔ **LE DUE PORTE DELLA CLIENTE, dove la sovrapposizione non si controllava affatto.**
 *
 * `requestPause` (il pulsante «Metti in pausa il piano») guardava solo se c'era una richiesta
 * `pending`; `events.create` (il «Periodo (più giorni)» del Calendario) solo la tregua. E la tregua,
 * per costruzione, cerca le vacanze **finite prima** della nuova: una sospensione **in corso** o
 * **già programmata** era invisibile a tutte e due. La cliente poteva sovrapporne una, e il piano le
 * si allungava **due volte per la stessa vacanza**.
 */
import { Test } from '@nestjs/testing';
import { conOrologioFermo } from '../../test/orologio-fermo';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../calendar/events.service';

describe('⛔ dall’app una pausa non si sovrappone più a quelle che ci sono', () => {
  /** Una vacanza già programmata: comincia fra dieci giorni e dura fino al ventesimo. */
  const PROGRAMMATA = {
    startDate: g('2026-08-25'),
    endDate: g('2026-09-04'),
    label: 'Modalità viaggio',
  };

  const creaEventi = (periodi: PeriodoOccupato[]) => {
    const prisma = {
      event: {
        findMany: jest.fn().mockResolvedValue(periodi),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'ev-nuovo' }),
      },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return { prisma };
  };

  const servizioEventi = async (periodi: PeriodoOccupato[]) => {
    const { prisma } = creaEventi(periodi);
    const modulo = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: ConfigParamsService,
          useValue: { getNumber: jest.fn(async (_k: string, d: number) => d) },
        },
      ],
    }).compile();
    return { service: modulo.get(EventsService), prisma };
  };

  const periodo = (dal: string, al: string) => ({
    type: 'vacation',
    label: 'Vacanza',
    startDate: dal,
    endDate: al,
    mode: 'pause_period' as const,
  });

  it('⛔ un periodo che si accavalla a una sospensione programmata si rifiuta', async () => {
    const { service, prisma } = await servizioEventi([PROGRAMMATA]);
    await expect(service.create('c1', periodo('2026-09-01', '2026-09-08'))).rejects.toThrow(
      /Hai già una pausa/,
    );
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **LA DATA PROMESSA DEV'ESSERE QUELLA CHE POI SI ACCETTA** — corretto in revisione, 25/8.
   *
   * La prima stesura proponeva con la tregua della **coach** (zero) e rifiutava con quella della
   * cliente (quindici): il sistema diceva «puoi cominciare dal 05/09», lei chiedeva il 05/09, e si
   * sentiva rispondere «ne mancano 15». Un vicolo cieco costruito da noi, riprodotto dalla revisione.
   *
   * La vacanza finisce il 4/9 → rientro il 5 → più i 15 giorni di tregua = **20 settembre**.
   */
  it('⛔ e la data che promette è quella VERA, tregua compresa', async () => {
    const { service } = await servizioEventi([PROGRAMMATA]);
    await expect(service.create('c1', periodo('2026-09-01', '2026-09-08'))).rejects.toThrow(
      /20\/09\/2026/,
    );
  });

  /** ⚠️ E lo dice come una regola, non come un errore: la seconda ravvicinata si chiede alla coach. */
  it('⚠️ e quando a spostarla è la tregua, dice a chi rivolgersi', async () => {
    const { service } = await servizioEventi([PROGRAMMATA]);
    await expect(service.create('c1', periodo('2026-09-01', '2026-09-08'))).rejects.toThrow(/coach/);
  });

  /**
   * ⚠️ **La controprova, ed è quella che conta**: senza questo test il rifiuto potrebbe valere
   * sempre, e il difetto nuovo sarebbe «non si può più mettere una pausa».
   *
   * ⚠️ La data è **dopo la tregua** (20/9), non il giorno dopo il rientro: se fosse il 5/9 questo
   * test passerebbe solo perché il finto di `treguaFraVacanze` non trova il periodo precedente —
   * cioè proverebbe il contrario di quello che il prodotto fa. Trovato in revisione.
   */
  it('⚠️ un periodo che NON si tocca e rispetta la tregua passa', async () => {
    const { service, prisma } = await servizioEventi([PROGRAMMATA]);
    await service.create('c1', periodo('2026-09-20', '2026-09-25'));
    expect(prisma.event.create).toHaveBeenCalled();
  });

  it('⚠️ e senza nessuna sospensione passa, come sempre', async () => {
    const { service, prisma } = await servizioEventi([]);
    await service.create('c1', periodo('2026-09-01', '2026-09-08'));
    expect(prisma.event.create).toHaveBeenCalled();
  });

  /**
   * ⛔ **Nemmeno dal Calendario si segna un periodo passato** (25/8, revisione): non ferma niente —
   * quei menu sono già arrivati — e riempie l'agenda della cliente di roba che non ha effetto.
   * ⚠️ Qui l'orologio è quello vero, quindi la data è scelta ben dietro: un test che scade è un test
   * che un giorno diventa rosso senza che nessuno abbia rotto niente.
   */
  it('⛔ un periodo che comincia nel PASSATO si rifiuta', async () => {
    const { service, prisma } = await servizioEventi([]);
    await expect(service.create('c1', periodo('2020-01-10', '2020-01-15'))).rejects.toThrow(
      /già passato/,
    );
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  /** ⚠️ Un evento di un giorno solo non è una sospensione e non passa da questa guardia. */
  it('⚠️ un evento singolo non viene toccato dalla regola delle sospensioni', async () => {
    const { service, prisma } = await servizioEventi([PROGRAMMATA]);
    await service.create('c1', {
      type: 'dinner', label: 'Cena fuori',
      startDate: '2026-09-01', endDate: '2026-09-01', mode: 'single_event',
    });
    expect(prisma.event.create).toHaveBeenCalled();
  });
});

/**
 * ⛔ **`requestPause` — la porta della cliente che la revisione ha trovato SENZA NESSUN TEST.**
 *
 * Il commento del prodotto dichiarava di aver chiuso il buco, e nessuno lo provava: una guardia
 * dichiarata e non provata è una guardia che il prossimo toglie senza vedere rosso.
 */
describe('⛔ «Metti in pausa il piano»: la sovrapposizione e la tregua nei due versi', () => {
  /**
   * ⚠️ **L'orologio si ferma**, se no questi test scadono: dal 25/8 una pausa nel passato si rifiuta,
   * e le date scritte qui sotto diventerebbero passate col calendario vero. Un test il cui esito
   * dipende da che giorno è deve dire che giorno è (`test/orologio-fermo.ts`).
   */
  conOrologioFermo(new Date('2026-08-10T09:00:00.000Z'));

  const creaPause = async (periodi: (PeriodoOccupato & { id?: string })[]) => {
    const prisma = {
      event: {
        findMany: jest.fn().mockResolvedValue(periodi),
        findFirst: jest.fn(({ where }: any) => {
          // La vacanza PRECEDENTE (tregua all'indietro) e la SUCCESSIVA (tregua in avanti).
          if (where?.endDate?.lt) {
            const fine = where.endDate.lt.getTime();
            const prima = periodi.filter((p) => p.endDate.getTime() < fine)
              .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0];
            return Promise.resolve(prima ?? null);
          }
          if (where?.startDate?.gte) {
            const da = where.startDate.gte.getTime();
            const dopo = periodi.filter((p) => p.startDate.getTime() >= da)
              .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
            return Promise.resolve(dopo ?? null);
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockResolvedValue({ id: 'ev-nuovo' }),
      },
      pauseRequest: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'req' }) },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const { PauseService } = await import('./pause.service');
    const service = new PauseService(
      prisma as never,
      { log: jest.fn() } as never,
      { notify: jest.fn() } as never,
      { getNumber: jest.fn(async (_k: string, d: number) => d) } as never,
      { registraSegnalazione: jest.fn() } as never,
    );
    return { service, prisma };
  };

  const iso10 = (d: Date) => d.toISOString().slice(0, 10);
  /** Una pausa già programmata: 25 agosto → 4 settembre (si rientra il 5). */
  const PROG: PeriodoOccupato = { startDate: g('2026-08-25'), endDate: g('2026-09-04'), label: 'Pausa (vacanza)' };

  it('⛔ una pausa che si accavalla a quella programmata si rifiuta', async () => {
    const { service, prisma } = await creaPause([PROG]);
    await expect(
      service.requestPause('c1', { startDate: '2026-09-01', endDate: '2026-09-06' }),
    ).rejects.toThrow(/Hai già una pausa/);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **La tregua nei DUE versi.** Guardando solo indietro si aggirava mettendo la nuova **prima**
   * di quella programmata: qui la nuova finisce il 20/8 e l'altra parte il 25 — cinque giorni, non
   * quindici. Prima passava.
   */
  it('⛔ una pausa che finisce troppo a ridosso della PROSSIMA si rifiuta', async () => {
    const { service, prisma } = await creaPause([PROG]);
    await expect(
      service.requestPause('c1', { startDate: '2026-08-14', endDate: '2026-08-19' }),
    ).rejects.toThrow(/troppo a ridosso della prossima/);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it('⚠️ e la frase dice quando comincia quella che c’è già', async () => {
    const { service } = await creaPause([PROG]);
    await expect(
      service.requestPause('c1', { startDate: '2026-08-14', endDate: '2026-08-19' }),
    ).rejects.toThrow(/25\/08\/2026/);
  });

  /** ⚠️ La controprova: con quindici giorni liberi da tutte e due le parti, passa. */
  it('⚠️ lontana da tutte e due passa, e la pausa si crea', async () => {
    const { service, prisma } = await creaPause([PROG]);
    const esito = await service.requestPause('c1', { startDate: '2026-09-20', endDate: '2026-09-24' });
    expect(esito.status).toBe('auto_approved');
    expect(prisma.event.create).toHaveBeenCalled();
    expect(iso10(prisma.event.create.mock.calls[0][0].data.startDate)).toBe('2026-09-20');
  });

  it('⚠️ e senza nessuna pausa passa, come sempre', async () => {
    const { service, prisma } = await creaPause([]);
    await service.requestPause('c1', { startDate: '2026-09-01', endDate: '2026-09-05' });
    expect(prisma.event.create).toHaveBeenCalled();
  });

  /**
   * ⛔ **UNA PAUSA NON SI CHIEDE ALL'INDIETRO** — trovato in revisione, 25/8. I campi data del
   * Calendario in app non hanno `min` e qui non c'era nessun controllo: una pausa per la settimana
   * scorsa non ferma nessun menu — quei giorni sono già stati mangiati — e allunga la scadenza del
   * piano di giorni che la cliente non ha saltato.
   */
  it('⛔ una pausa che comincia IERI si rifiuta', async () => {
    const { service, prisma } = await creaPause([]);
    await expect(
      service.requestPause('c1', { startDate: '2026-08-05', endDate: '2026-08-08' }),
    ).rejects.toThrow(/già passato/);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  /** ⚠️ Ma OGGI sì: «mi fermo da oggi» è una richiesta legittima, e il confine è quello. */
  it('⚠️ una che comincia OGGI passa: il confine è ieri, non oggi', async () => {
    const { service, prisma } = await creaPause([]);
    await service.requestPause('c1', { startDate: '2026-08-10', endDate: '2026-08-14' });
    expect(prisma.event.create).toHaveBeenCalled();
  });
});

/**
 * ⛔ **LA QUARTA PORTA: l'approvazione di una collega** — trovata dalla revisione del 25/8, e non
 * aveva nessuna guardia.
 *
 * Fra la richiesta e l'approvazione passano dei giorni. Una richiesta `pending` non ha ancora un
 * `event`, quindi la card della coach non la vede e può mettere una modalità viaggio sopra: poi la
 * collega approva, e l'evento nasce **sovrapposto**. Riprodotto: +36 giorni di scadenza per 25
 * giorni di vacanza, due periodi sovrapposti e due «bentornata».
 */
describe('⛔ approvare una richiesta non deve creare una sovrapposizione', () => {
  const creaDecide = async (periodi: PeriodoOccupato[], richiesta: { startDate: Date; endDate: Date; days: number }) => {
    const prisma = {
      pauseRequest: {
        findUnique: jest.fn().mockResolvedValue({ id: 'req-1', clientId: 'c1', status: 'pending', ...richiesta }),
        update: jest.fn().mockResolvedValue({ id: 'req-1' }),
      },
      event: {
        findMany: jest.fn().mockResolvedValue(periodi),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'ev-nuovo' }),
      },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 's1' }) },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
    };
    const { PauseService } = await import('./pause.service');
    const service = new PauseService(
      prisma as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      // ⚠️ `notify` deve rendere una promessa: il servizio ci attacca un `.catch`, e un finto che
      // rende `undefined` fa fallire il test per una ragione che non è quella che si sta provando.
      { notify: jest.fn().mockResolvedValue(undefined) } as never,
      { getNumber: jest.fn(async (_k: string, d: number) => d) } as never,
      { registraSegnalazione: jest.fn().mockResolvedValue(undefined) } as never,
    );
    // ⚠️ Il controllo dei permessi non è quello che questo gruppo prova: si neutralizza in modo
    // dichiarato invece di costruire mezzo mondo attorno.
    (service as unknown as { assertCanDecide: () => Promise<void> }).assertCanDecide = async () => {};
    return { service, prisma };
  };

  const RICHIESTA = { startDate: g('2026-09-01'), endDate: g('2026-09-25'), days: 25 };

  it('⛔ se nel frattempo è nata una sospensione che si accavalla, l’approvazione si rifiuta', async () => {
    const { service, prisma } = await creaDecide(
      [{ startDate: g('2026-09-05'), endDate: g('2026-09-15'), label: 'Modalità viaggio' }],
      RICHIESTA,
    );
    await expect(service.decide('u-staff', 'req-1', true)).rejects.toThrow(/si sovrappone/);
    expect(prisma.event.create).not.toHaveBeenCalled();
    expect(prisma.pauseRequest.update).not.toHaveBeenCalled();
  });

  it('⚠️ e la frase dice quale, così si può guardare e decidere', async () => {
    const { service } = await creaDecide(
      [{ startDate: g('2026-09-05'), endDate: g('2026-09-15'), label: 'Modalità viaggio' }],
      RICHIESTA,
    );
    await expect(service.decide('u-staff', 'req-1', true)).rejects.toThrow(/05\/09\/2026/);
  });

  /** ⚠️ La controprova: senza collisione l'approvazione fa quello che ha sempre fatto. */
  it('⚠️ senza collisione approva e crea il periodo', async () => {
    const { service, prisma } = await creaDecide([], RICHIESTA);
    await service.decide('u-staff', 'req-1', true);
    expect(prisma.event.create).toHaveBeenCalled();
    expect(prisma.pauseRequest.update).toHaveBeenCalled();
  });

  /** ⚠️ E il RIFIUTO non passa dalla guardia: non crea niente, quindi non può sovrapporre niente. */
  it('⚠️ rifiutare una richiesta non è toccato dalla regola', async () => {
    const { service, prisma } = await creaDecide(
      [{ startDate: g('2026-09-05'), endDate: g('2026-09-15') }],
      RICHIESTA,
    );
    await service.decide('u-staff', 'req-1', false);
    expect(prisma.pauseRequest.update).toHaveBeenCalled();
    expect(prisma.event.create).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **CON DUE SOSPENSIONI APERTE, LA CARD E «TOGLI» DEVONO PARLARE DELLA STESSA.**
 *
 * Da quando le consecutive sono permesse, `travelStart/travelEnd` — che ne contiene **una sola** —
 * e il pulsante «togli» possono trovarsene davanti due. La risposta giusta è **quella che sta
 * fermando i menu adesso**, cioè la più vecchia ancora viva: se lo specchio dicesse una e «togli»
 * ne rimuovesse un'altra, la coach guarderebbe una vacanza e ne cancellerebbe un'altra.
 *
 * ⚠️ La revisione del 25/8 l'ha riprodotto: con `desc` «togli» troncava quella **in corso** mentre
 * la card mostrava la futura.
 */
describe('⛔ due sospensioni aperte: la card, lo specchio e «togli» dicono la stessa', () => {
  const IN_CORSO = { id: 'ev-A', startDate: g('2026-08-08'), endDate: g('2026-08-14') };
  const PROGRAMMATA_B = { id: 'ev-B', startDate: g('2026-08-15'), endDate: g('2026-08-24') };

  const creaDue = async () => {
    const eventi = [IN_CORSO, PROGRAMMATA_B];
    const prisma = {
      event: {
        /** ⚠️ Il finto **onora `orderBy`**: senza, la correzione `desc → asc` non sarebbe provabile. */
        findFirst: jest.fn(({ where, orderBy }: any) => {
          if (where?.NOT?.id) return Promise.resolve(null);
          let righe = eventi.filter((e) => !where?.endDate?.gte || e.endDate >= where.endDate.gte);
          righe = [...righe].sort((a, b) =>
            orderBy?.startDate === 'desc'
              ? b.startDate.getTime() - a.startDate.getTime()
              : a.startDate.getTime() - b.startDate.getTime(),
          );
          return Promise.resolve(righe[0] ?? null);
        }),
        findMany: jest.fn().mockResolvedValue(eventi),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      pauseRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findFirst: jest.fn().mockResolvedValue(null) },
      crmRecord: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const { PauseService } = await import('./pause.service');
    const service = new PauseService(
      prisma as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      { notify: jest.fn().mockResolvedValue(undefined) } as never,
      { getNumber: jest.fn(async (_k: string, d: number) => d) } as never,
      { registraSegnalazione: jest.fn().mockResolvedValue(undefined) } as never,
    );
    return { service, prisma };
  };

  conOrologioFermo(new Date('2026-08-10T09:00:00.000Z')); // in mezzo alla prima

  it('⛔ lo specchio del profilo punta a quella IN CORSO, non alla programmata', async () => {
    const { service } = await creaDue();
    const specchio = await service.sospensioneDaRispecchiare('c1');
    expect(specchio?.startDate.toISOString()).toBe(IN_CORSO.startDate.toISOString());
    expect(specchio?.stato).toBe('in_vacanza');
  });

  it('⛔ e «togli» tocca quella stessa: si tronca a ieri, la programmata resta', async () => {
    const { service, prisma } = await creaDue();
    const esito = await service.togliSospensioneDaViaggio('c1', 'staff1');
    expect(esito.tolta).toBe(true);
    expect(esito.eraInCorso).toBe(true);
    expect(prisma.event.update.mock.calls[0][0].where.id).toBe('ev-A');
    expect(prisma.event.delete).not.toHaveBeenCalled();
  });

  /** ⚠️ E lo stato si ricava dalle date: una che comincia domani è «in partenza», non «in vacanza». */
  it('⚠️ con solo una FUTURA, lo specchio dice «in partenza»', async () => {
    const { service, prisma } = await creaDue();
    prisma.event.findFirst = jest.fn().mockResolvedValue(PROGRAMMATA_B) as never;
    const specchio = await service.sospensioneDaRispecchiare('c1');
    expect(specchio?.stato).toBe('in_partenza');
  });
});
