/**
 * ⛔ **LA CARD CHE LA CLIENTE LEGGE, E IL CASO GIANLUCA DEL 23/8.**
 *
 * `menuStatus` è la funzione che decide la frase in cima all'app. Lo stato `awaiting_visit` produce
 * **«Menu dopo la visita — Il tuo è un percorso supervisionato: il menu sarà pronto dopo la visita
 * con il nutrizionista»** (`app/src/components/MenuStatusBanner.tsx`).
 *
 * ⛔ Il 23/8 quella frase era **davanti a una persona a cui la nutrizionista aveva già dato il via
 * libera**, e ci sarebbe rimasta per sempre: la card guardava `screeningFlag`, che lo mette il
 * questionario in registrazione e non lo riazzera nessuno, mentre il pulsante «Può proseguire»
 * scrive `idoneita`. Due campi, due schermate, due verità. Vedi `clients/via-libera-clinico.ts`.
 *
 * ⚠️ E questa card non aveva **nessun** test: il ramo `awaiting_visit` di `menuStatus` non era
 * toccato da niente. È il motivo per cui il difetto è arrivato a una persona vera invece che a una
 * suite rossa.
 */
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../calendar/events.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DietAgentService } from '../diet-agent/diet-agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { DayComboService } from './day-combo.service';
import { MenuService } from './menu.service';

const GIORNO = 86_400_000;

/** Un piano comprato che sta erogando: senza, `menuStatus` si ferma prima, su `expired`. */
const pianoInCorso = () => ({
  id: 'sub-1', status: 'active',
  startDate: new Date(Date.now() - 5 * GIORNO),
  endDate: new Date(Date.now() + 60 * GIORNO),
  plan: { period: '3m' },
});

function makeService(profilo: Record<string, unknown>, opzioni: { pianoScaduto?: boolean } = {}) {
  const piano = opzioni.pianoScaduto
    ? { ...pianoInCorso(), startDate: new Date(Date.now() - 100 * GIORNO), endDate: new Date(Date.now() - 10 * GIORNO) }
    : pianoInCorso();
  const prisma = {
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: new Date(Date.now() - 5 * GIORNO), planHeldAt: null, ...profilo }) },
    subscription: {
      findMany: jest.fn().mockResolvedValue([piano]),
      findFirst: jest.fn().mockResolvedValue(piano),
    },
    // ⚠️ Nessun menu già visibile: se ce ne fosse uno, `menuStatus` uscirebbe al passo 1 con
    // `available` e questo test non guarderebbe il ramo che gli interessa.
    menuDay: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    // ⚠️ I passi DOPO quello che interessa qui: senza, il servizio esplode prima di rispondere e il
    // test fallirebbe per un finto incompleto invece che per il ramo in prova.
    measurement: { findFirst: jest.fn().mockResolvedValue({ date: new Date(), weightKg: 70 }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(1) },
    dailyCheckin: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
    monitoringPeriod: { findFirst: jest.fn().mockResolvedValue(null) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const config = {
    getNumber: jest.fn((_k: string, def?: number) => Promise.resolve(def ?? 2)),
    getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
  };
  const service = new MenuService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigParamsService,
    { log: jest.fn() } as unknown as AuditService,
    { activePausePeriod: jest.fn().mockResolvedValue(null) } as unknown as EventsService,
    { stateFor: jest.fn().mockResolvedValue('normale') } as unknown as DietAgentService,
    new DayComboService(),
    { computeTargetKcal: jest.fn().mockResolvedValue(null) } as never,
    { sendToUser: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return Object.assign(service, { __finto: prisma });
}

/** Il giorno di Roma spostato di n, scritto come lo scrive il salvataggio: mezzanotte UTC. */
const giornoFra = (n: number) => {
  const oggi = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date()) + 'T00:00:00.000Z');
  return new Date(oggi.getTime() + n * GIORNO);
};

describe('⛔ «Menu dopo la visita»: chi la legge, e fino a quando', () => {
  it('⛔ screening e nessuna valutazione: la card c\'è, ed è giusto che ci sia', async () => {
    const stato = await makeService({ screeningFlag: true, idoneita: null }).menuStatus('cli-1');
    expect(stato.state).toBe('awaiting_visit');
  });

  /**
   * ⛔ **IL CASO GIANLUCA.** Stesso profilo di sopra, più il clic della nutrizionista: la card deve
   * sparire e il menu deve incamminarsi. ⚠️ `screeningFlag` resta `true` — è un fatto sanitario
   * dichiarato in registrazione, non uno stato da cancellare: quello che cambia è la risposta alla
   * domanda, non la storia clinica.
   */
  it('⛔ con «Può proseguire» la card sparisce, senza toccare `screeningFlag`', async () => {
    const stato = await makeService({ screeningFlag: true, idoneita: 'idonea' }).menuStatus('cli-1');
    expect(stato.state).not.toBe('awaiting_visit');
  });

  it('⛔ mentre «Serve una visita» la lascia: quella visita serve davvero', async () => {
    const stato = await makeService({ screeningFlag: true, idoneita: 'serve_visita' }).menuStatus('cli-1');
    expect(stato.state).toBe('awaiting_visit');
  });

  it('⚠️ e chi non è in percorso supervisionato non l\'ha mai vista', async () => {
    const stato = await makeService({ screeningFlag: false, idoneita: null }).menuStatus('cli-1');
    expect(stato.state).not.toBe('awaiting_visit');
  });
});


/**
 * ⛔ **LA SCADENZA FERMA L'EROGAZIONE, NON SOLO LA CARD** — il bloccante della seconda revisione.
 *
 * La prima stesura aveva messo il controllo solo in `menuStatus`: la card diceva «i menu sono in
 * pausa» ma `deliverIfEligible` non lo sapeva, e i giorni continuavano a generarsi — quindi il menu
 * restava visibile, lo stato restava `available` e **nemmeno la card compariva**. La frase scritta
 * nella nota clinica, in scheda, nell'attività e nell'app era falsa da cima a fondo. ⚠️ Due mutazioni
 * su due sopravvivevano a 4783 test: il pezzo presentato come il prodotto della consegna non era
 * provato da niente.
 */
describe('⛔ la scadenza della visita ferma l\'erogazione', () => {
  it('⛔ a visita SCADUTA `deliverIfEligible` non genera niente', async () => {
    const service = makeService({
      screeningFlag: true, idoneita: 'serve_visita', idoneitaVisitaEntro: giornoFra(-3),
    });
    expect(await service.deliverIfEligible('cli-1')).toEqual([]);
  });

  /**
   * ⚠️ Dentro la finestra invece si eroga: il finto qui è volutamente povero e il servizio si ferma
   * più avanti per altre ragioni — quello che si fissa è che NON si fermi **per la supervisione**.
   * Lo si vede dal fatto che la query dei piani parte: a visita scaduta non parte proprio.
   */
  it('⚠️ dentro la finestra l\'erogazione prosegue oltre il cancello della supervisione', async () => {
    const dentro = makeService({ screeningFlag: true, idoneita: 'serve_visita', idoneitaVisitaEntro: giornoFra(5) });
    await dentro.deliverIfEligible('cli-1').catch(() => undefined);
    expect(dentro.__finto.subscription.findMany).toHaveBeenCalled();

    const scaduta = makeService({ screeningFlag: true, idoneita: 'serve_visita', idoneitaVisitaEntro: giornoFra(-3) });
    await scaduta.deliverIfEligible('cli-1').catch(() => undefined);
    expect(scaduta.__finto.subscription.findMany).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **E `mai_valutata` NON si ferma qui — di proposito.** Questo cancello sull'erogazione non è
   * mai esistito: le clienti in screening senza decisione hanno sempre ricevuto i menu (il blocco
   * viveva solo nella card). Chiuderlo di rimbalzo fermerebbe oggi, in silenzio, persone che stanno
   * mangiando: se va chiuso lo decidono Simone e Lucia (voce `mai-valutata-eroga-lo-stesso`).
   */
  it('⚠️ una cliente in screening MAI valutata continua a ricevere come ha sempre fatto', async () => {
    const service = makeService({ screeningFlag: true, idoneita: null });
    await service.deliverIfEligible('cli-1').catch(() => undefined);
    expect(service.__finto.subscription.findMany).toHaveBeenCalled();
  });
});

/** ⛔ I due campi che l'app legge: il DA QUANDO del blocco, e il promemoria prima. */
describe('⛔ la card porta la data, e il promemoria arriva a chi mangia', () => {
  it('⛔ a visita scaduta lo stato dice DA QUANDO (`visitaEntro`)', async () => {
    const entro = giornoFra(-3);
    const stato = await makeService({
      screeningFlag: true, idoneita: 'serve_visita', idoneitaVisitaEntro: entro,
    }).menuStatus('cli-1');
    expect(stato.state).toBe('awaiting_visit');
    expect(stato.visitaEntro).toBe(entro.toISOString().slice(0, 10));
  });

  it('⛔ dentro la finestra il promemoria (`visitaDaFareEntro`) esce sugli stati in cui i menu scorrono', async () => {
    const entro = giornoFra(5);
    const stato = await makeService({
      screeningFlag: true, idoneita: 'serve_visita', idoneitaVisitaEntro: entro,
    }).menuStatus('cli-1', true); // menu visibile → `available`
    expect(stato.state).toBe('available');
    expect(stato.visitaDaFareEntro).toBe(entro.toISOString().slice(0, 10));
  });

  /**
   * ⚠️ **Ma non su un piano scaduto**: lì l'app mostrerebbe, una sopra l'altra, «fino a quel giorno i
   * menu arrivano normalmente» e «il tuo piano è terminato». Il promemoria dice una cosa vera solo
   * per chi i menu li riceve.
   */
  it('⚠️ su un piano scaduto il promemoria non esce: sarebbe una frase falsa con una data dentro', async () => {
    const service = makeService(
      { screeningFlag: true, idoneita: 'serve_visita', idoneitaVisitaEntro: giornoFra(5) },
      { pianoScaduto: true },
    );
    const stato = await service.menuStatus('cli-1');
    expect(stato.state).toBe('expired');
    expect(stato.visitaDaFareEntro).toBeUndefined();
  });
});
