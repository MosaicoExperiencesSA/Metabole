/**
 * LA CLIENTE SPOSTA IL SUO OROLOGIO — i test della porta vera.
 *
 * I moduli puri sanno già decidere; qui si prova **quello che finisce scritto**, che è la parte in
 * cui un difetto non si vede da nessuna parte finché non lo dice lei. Due casi contano più degli
 * altri:
 *
 * ⛔ **Il piano graduale scrive l'inizio VECCHIO.** Se la finestra si derivasse dal bersaglio, una
 * cliente che ha chiesto le 08:00 fra quattro giorni si troverebbe **stasera** i pasti di quella
 * finestra lì — cioè il piano graduale che diventa un cambio di dieta immediato, l'opposto di
 * quello che serve.
 *
 * ⛔ **La prima scelta non è un cambio.** Il limite di uno al giorno non deve poter fermare chi sta
 * rispondendo per la prima volta a una domanda che non le era mai stata fatta.
 */
import { ProfileService } from './profile.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TIPO_DIGIUNO_ESTREMO, TIPO_FINESTRA_NON_TRADUCIBILE } from '../coach-tasks/verifica-digiuno';

const H = (ore: number, minuti = 0): number => ore * 60 + minuti;

/**
 * ⛔ **L'OROLOGIO SI FERMA, O QUESTI TEST DICONO COSE DIVERSE A ORE DIVERSE.**
 *
 * Il servizio legge `new Date()` e da lì `oraLocaleInMinuti`: se la finestra della cliente si è già
 * aperta, il cambio vale da domani e finisce nei campi bersaglio. Senza fermare l'orologio, lo
 * stesso test passa la mattina e fallisce dopo pranzo — ed è successo davvero mentre lo scrivevo.
 *
 * ⚠️ Le 09:00 di **Roma**, non di UTC: è l'ora che conta, ed è quella che `oraLocaleInMinuti`
 * traduce. Con la finestra che apre a mezzogiorno, alle 09:00 non si è ancora aperta.
 */
const MATTINA_ROMA = new Date('2026-08-21T09:00:00+02:00');
const POMERIGGIO_ROMA = new Date('2026-08-21T14:00:00+02:00');

beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(MATTINA_ROMA); });
afterEach(() => { jest.useRealTimers(); });

type Profilo = Record<string, unknown>;

function creaServizio(
  profilo: Profilo | null,
  opzioni: { taskEsistente?: boolean; scrittoDaAltri?: boolean } = {},
) {
  const scritture: Record<string, unknown>[] = [];
  const condizioni: Record<string, unknown>[] = [];
  const audit: Record<string, unknown>[] = [];
  const attivita: Record<string, unknown>[] = [];
  const tx = {
    clientProfile: {
      // ⚠️ `updateMany` e non `update`: il servizio scrive **a condizione** che nessuno abbia
      // toccato il profilo nel frattempo, e `count: 0` è il modo in cui quella condizione parla.
      updateMany: jest.fn(async (a: any) => {
        scritture.push(a.data);
        condizioni.push(a.where);
        return { count: opzioni.scrittoDaAltri ? 0 : 1 };
      }),
    },
    auditLog: { create: jest.fn(async (a: any) => { audit.push(a.data); return {}; }) },
  };
  const prisma: any = {
    clientProfile: { findUnique: jest.fn().mockResolvedValue(profilo) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    coachTask: {
      findUnique: jest.fn().mockResolvedValue(opzioni.taskEsistente ? { id: 't1' } : null),
      create: jest.fn(async (a: any) => { attivita.push(a.data); return { id: 'nuovo' }; }),
    },
    // `avvisaAttivitaNuova` legge la cliente e il suo staff per mandare la push: qui non c'è nessuno.
    user: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const configParams = { getNumber: jest.fn().mockResolvedValue(60) };
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const service = new ProfileService(
    prisma as unknown as PrismaService,
    configParams as never,
    {} as never,
    {} as never,
    push as never,
  );
  return { service, scritture, condizioni, audit, attivita, prisma };
}

const inDigiuno = (extra: Profilo = {}): Profilo => ({
  pathType: 'intermittent_fasting',
  name: 'Sonia',
  fastingWindow: null,
  fastingProtocol: null,
  fastingStartMin: null,
  fastingTargetStartMin: null,
  fastingChangedAt: null,
  fastingSceltoIl: null,
  ...extra,
});

describe('⛔ la prima scelta', () => {
  it('scrive protocollo, orario, finestra derivata e la data della scelta', async () => {
    const { service, scritture } = creaServizio(inDigiuno());
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) });
    expect(scritture).toHaveLength(1);
    expect(scritture[0]).toMatchObject({
      fastingProtocol: '16:8',
      fastingStartMin: H(12),
      fastingWindow: 'skip_breakfast',
      fastingTargetStartMin: null,
    });
    expect(scritture[0].fastingSceltoIl).toBeInstanceOf(Date);
  });

  /**
   * ⛔ Il limite di «uno al giorno» **non si applica alla prima volta**. Una cliente con
   * `fastingChangedAt` scritto da un'altra porta — o dal giro di ieri — non deve trovarsi la
   * domanda chiusa proprio mentre risponde per la prima volta.
   */
  it('⛔ non la ferma il limite di un cambio al giorno', async () => {
    const { service, scritture } = creaServizio(inDigiuno({ fastingChangedAt: new Date() }));
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) });
    expect(scritture).toHaveLength(1);
  });

  /**
   * ⚠️ E non le si racconta un digiuno che non c'è stato: senza una finestra precedente non esiste
   * un'ultima chiusura da cui contare. `null`, non un numero plausibile.
   */
  it('⚠️ non dice quante ore dura il digiuno di stanotte, perché non lo sa', async () => {
    const { service } = creaServizio(inDigiuno());
    const r = (await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) })) as any;
    expect(r.esito.minutiDigiunoStanotte).toBeNull();
    expect(r.esito.spiegazione).not.toMatch(/invece di/);
  });

  it('e risponde con la vista aggiornata, non con un «ok»', async () => {
    const { service } = creaServizio(inDigiuno());
    const r = (await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) })) as any;
    expect(r.attuale).toMatchObject({ apertura: '12:00', chiusura: '20:00' });
    expect(r.daChiedere).toBe(false);
  });
});

describe('⛔ il piano graduale scrive l\'inizio VECCHIO', () => {
  const giaScelto = inDigiuno({
    fastingWindow: 'skip_breakfast',
    fastingProtocol: '16:8',
    fastingStartMin: H(12),
    fastingSceltoIl: new Date('2026-08-01T10:00:00Z'),
    fastingChangedAt: new Date('2026-08-01T10:00:00Z'),
  });

  it('⛔ chiedere le 08:00 non sposta la finestra stasera: scrive il bersaglio', async () => {
    const { service, scritture } = creaServizio({ ...giaScelto });
    const r = (await service.impostaDigiuno('u1', { inizioMin: H(8) })) as any;
    expect(scritture[0]).toMatchObject({
      fastingStartMin: H(12),          // ⛔ NON le 08:00
      fastingTargetStartMin: H(8),
      fastingWindow: 'skip_breakfast', // ⛔ derivata dall'inizio in vigore, non dal bersaglio
    });
    expect(r.esito.metodo).toBe('graduale');
    expect(r.esito.giorniDelPiano).toBe(4);
    expect(r.piano).toMatchObject({ bersaglio: '08:00', giorniMancanti: 4 });
  });

  /**
   * ⛔ **E QUI VA DETTA UNA COSA CHE UN TEST NON PUÒ DIRE** (trovato in revisione, 21/8).
   *
   * Qui c'era un test che si chiamava «controprova» e non lo era: derivare la finestra dal
   * bersaglio invece che dall'orario in vigore **non cambia nessun valore osservabile**, perché la
   * finestra dipende solo dalla **durata** — è la Regola d'Oro del manuale, «la posizione non dice
   * niente». Un test che dichiara di proteggere una cosa che nessun caso può distinguere è peggio
   * di un test che non c'è: fa credere che ci sia una rete.
   *
   * Quello che si può verificare è l'altra metà, e conta quanto: **l'orario scritto**. Il resto è
   * scritto nel commento accanto alla riga in `profile.service.ts`, che dice a chiare lettere che
   * la scelta è di principio e oggi non è coperta.
   */
  it('l\'orario in vigore resta quello vecchio anche mandando protocollo e orario insieme', async () => {
    const { service, scritture } = creaServizio({ ...giaScelto, fastingChangedAt: null });
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(8) });
    expect(scritture[0].fastingStartMin).toBe(H(12));
    expect(scritture[0].fastingTargetStartMin).toBe(H(8));
  });

  it('lo spostamento in avanti invece si scrive subito', async () => {
    const { service, scritture } = creaServizio({ ...giaScelto, fastingChangedAt: null });
    const r = (await service.impostaDigiuno('u1', { inizioMin: H(16) })) as any;
    expect(scritture[0]).toMatchObject({ fastingStartMin: H(16), fastingTargetStartMin: null });
    expect(r.esito.metodo).toBe('reset');
    expect(r.esito.minutiDigiunoStanotte).toBe(20 * 60);
  });
});

describe('⛔ quello che vale da DOMANI non si scrive oggi', () => {
  const giaScelto = inDigiuno({
    fastingWindow: 'skip_breakfast',
    fastingProtocol: '16:8',
    fastingStartMin: H(12),
    fastingSceltoIl: new Date('2026-08-01T10:00:00Z'),
    fastingChangedAt: null,
  });

  /**
   * ⛔ **Il difetto trovato in revisione, e la ragione per cui i campi bersaglio esistono.**
   *
   * Sono le 14:00, la finestra si è aperta a mezzogiorno: ha già pranzato. Il sistema le diceva «da
   * domani apri alle 16:00» e **intanto scriveva le 16:00**, così l'orologio in home le disegnava la
   * giornata di oggi col primo pasto alle 16:15. Un pasto già fatto non si disfa: quello che vale da
   * domani va nei campi bersaglio, e lo applica il cron notturno.
   */
  it('⛔ a finestra già aperta, l\'orario nuovo finisce nel BERSAGLIO, non in quello in vigore', async () => {
    jest.setSystemTime(POMERIGGIO_ROMA);
    const { service, scritture } = creaServizio({ ...giaScelto });
    const r = (await service.impostaDigiuno('u1', { inizioMin: H(16) })) as any;
    expect(scritture[0]).toMatchObject({
      fastingStartMin: H(12),          // ⛔ oggi NON si muove
      fastingTargetStartMin: H(16),    // ⛔ ci si arriva stanotte
      fastingWindow: 'skip_breakfast',
    });
    expect(r.esito.daQuando).toBe('domani');
    // ⛔ E l'orologio che l'app ridisegna è ancora quello di oggi: apre a mezzogiorno.
    expect(r.attuale).toMatchObject({ apertura: '12:00' });
    expect(r.piano).toMatchObject({ bersaglio: '16:00', giorniMancanti: 1 });
  });

  /**
   * ⛔ Vale anche per il **protocollo**: passare al 23:1 alle 14:00 avrebbe scritto subito
   * `skip_all_but_dinner`, e da lì il motore avrebbe preso il catalogo a un pasto solo per le
   * giornate successive — una cliente che oggi ha mangiato tre volte.
   */
  it('⛔ e il protocollo rimandato finisce in `fastingTargetProtocol`', async () => {
    jest.setSystemTime(POMERIGGIO_ROMA);
    const { service, scritture } = creaServizio({ ...giaScelto });
    const r = (await service.impostaDigiuno('u1', { protocollo: '23:1', inizioMin: H(19) })) as any;
    expect(scritture[0]).toMatchObject({
      fastingProtocol: '16:8',              // ⛔ oggi resta il suo
      fastingWindow: 'skip_breakfast',      // ⛔ e i pasti di oggi pure
      fastingTargetProtocol: '23:1',
      fastingTargetStartMin: H(19),
    });
    expect(r.esito.spiegazione).toContain('Oggi resta com\'è');
  });

  /**
   * ⚠️ La controprova: **la mattina lo stesso identico cambio vale subito**. Se non ci fosse, il
   * test qui sopra passerebbe anche con un codice che rimanda sempre tutto — e rimandare sempre
   * vorrebbe dire che nessun cambio parte mai il giorno in cui lo chiedi.
   */
  it('⚠️ mentre la mattina lo stesso cambio vale subito', async () => {
    jest.setSystemTime(MATTINA_ROMA);
    const { service, scritture } = creaServizio({ ...giaScelto });
    const r = (await service.impostaDigiuno('u1', { protocollo: '23:1', inizioMin: H(19) })) as any;
    expect(scritture[0]).toMatchObject({
      fastingProtocol: '23:1',
      fastingTargetProtocol: null,
      fastingTargetStartMin: null,
      fastingWindow: 'skip_all_but_dinner',
    });
    expect(r.esito.daQuando).toBe('oggi');
  });
});

describe('i rifiuti, e cosa NON scrivono', () => {
  /**
   * ⛔ **Un tocco a vuoto non è uno spostamento** (revisione, 21/8). `PATCH {}` lo mandano il doppio
   * tocco e il retry dell'app: prima scriveva `fastingChangedAt: adesso`, e lo spostamento vero
   * dieci minuti dopo si prendeva «puoi rifarlo fra 20 ore». Il limite si accendeva su un cambio che
   * non c'era stato, e l'audit registrava uno spostamento mai avvenuto.
   */
  it('⛔ un PATCH che non cambia niente non scrive e non consuma il cambio del giorno', async () => {
    const profilo = inDigiuno({
      fastingWindow: 'skip_breakfast', fastingProtocol: '16:8', fastingStartMin: H(12),
      fastingSceltoIl: new Date('2026-08-01T10:00:00Z'), fastingChangedAt: null,
    });
    const { service, scritture, audit } = creaServizio(profilo);
    const r = (await service.impostaDigiuno('u1', {})) as any;
    expect(scritture).toHaveLength(0);
    expect(audit).toHaveLength(0);
    expect(r.esito.metodo).toBe('nessuno');
    // ⚠️ E non è un errore: le si risponde con la sua vista, che è la verità.
    expect(r.attuale).toMatchObject({ apertura: '12:00' });
  });

  it('lo stesso vale se rimanda gli stessi identici valori', async () => {
    const { service, scritture } = creaServizio(inDigiuno({
      fastingWindow: 'skip_breakfast', fastingProtocol: '16:8', fastingStartMin: H(12),
      fastingSceltoIl: new Date('2026-08-01T10:00:00Z'),
    }));
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) });
    expect(scritture).toHaveLength(0);
  });

  /**
   * ⛔ **Due tocchi insieme.** Il profilo si legge fuori dalla transazione, quindi due richieste
   * ravvicinate leggono lo stesso stato e passerebbero tutte e due il limite di uno al giorno. La
   * scrittura è condizionata a `fastingChangedAt`: la seconda non trova più quello stato, non scrive
   * niente, e riceve una frase che dice cosa fare.
   */
  it('⛔ chi arriva secondo non sovrascrive in silenzio', async () => {
    const { service, condizioni } = creaServizio(inDigiuno(), { scrittoDaAltri: true });
    await expect(service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) }))
      .rejects.toThrow(/Riapri la pagina/);
    // ⚠️ E la condizione guarda proprio il campo che cambia a ogni scrittura.
    expect(condizioni[0]).toMatchObject({ userId: 'u1', fastingChangedAt: null });
  });

  it('chi non digiuna riceve una frase che dice cosa fare, e niente viene scritto', async () => {
    const { service, scritture } = creaServizio(inDigiuno({ pathType: 'five' }));
    await expect(service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) })).rejects.toThrow(/nutrizionista/);
    expect(scritture).toHaveLength(0);
  });

  it('un profilo che non esiste è un 404, non un 500', async () => {
    const { service } = creaServizio(null);
    await expect(service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) })).rejects.toThrow(/Profilo/);
  });

  it('⛔ il secondo spostamento nello stesso giorno si rifiuta, e non scrive niente', async () => {
    const { service, scritture, audit } = creaServizio(inDigiuno({
      fastingProtocol: '16:8',
      fastingStartMin: H(12),
      fastingWindow: 'skip_breakfast',
      fastingSceltoIl: new Date('2026-08-01T10:00:00Z'),
      fastingChangedAt: new Date(),
    }));
    await expect(service.impostaDigiuno('u1', { inizioMin: H(16) })).rejects.toThrow(/fra \d+ ore?/);
    expect(scritture).toHaveLength(0);
    expect(audit).toHaveLength(0);
  });
});

describe('⛔ la segnalazione alla nutrizionista', () => {
  it('una scelta estrema apre l\'attività, con dentro le ragioni', async () => {
    const { service, attivita } = creaServizio(inDigiuno());
    await service.impostaDigiuno('u1', { protocollo: '23:1', inizioMin: H(19) });
    expect(attivita).toHaveLength(1);
    expect(attivita[0]).toMatchObject({ kind: TIPO_DIGIUNO_ESTREMO, clientId: 'u1' });
    expect(String(attivita[0].description)).toContain('23:1');
    expect(String(attivita[0].description)).toMatch(/già partita/);
    /**
     * ⛔ Il riferimento è **protocollo + finestra**, e non contiene l'orario: durante un
     * adattamento graduale la finestra si sposta di un'ora ogni notte, e un riferimento che
     * cambiasse a ogni passo riaprirebbe la stessa verifica tutte le mattine.
     */
    expect(attivita[0].refId).toBe('23:1|skip_all_but_dinner');
  });

  it('una scelta normale non apre niente', async () => {
    const { service, attivita } = creaServizio(inDigiuno());
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) });
    expect(attivita).toHaveLength(0);
  });

  /**
   * ⛔ **Il caso di Sonia.** La sua finestra storica l'orologio non la sa riprodurre: qualunque cosa
   * scelga, i pasti cambiano. Parte una segnalazione, e il riferimento è **la finestra di
   * partenza**, così non si ripete a ogni ripensamento.
   */
  it('⛔ chi veniva da una finestra non traducibile fa partire la seconda segnalazione', async () => {
    const { service, attivita } = creaServizio(inDigiuno({ fastingWindow: 'skip_dinner' }));
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(8) });
    const seconda = attivita.find((a) => a.kind === TIPO_FINESTRA_NON_TRADUCIBILE);
    expect(seconda).toBeDefined();
    expect(seconda!.refId).toBe('da:skip_dinner');
    expect(String(seconda!.description)).not.toMatch(/skip_/);
  });

  /**
   * ⚠️ Chi veniva da una finestra che l'orologio **sa** riprodurre non è una segnalazione: le
   * cinque su «salta la colazione» confermano quello che già ricevono, e non è successo niente.
   */
  it('⚠️ e chi veniva da «salta la colazione» non segnala niente', async () => {
    const { service, attivita } = creaServizio(inDigiuno({ fastingWindow: 'skip_breakfast' }));
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) });
    expect(attivita).toHaveLength(0);
  });

  /**
   * ⛔ **E nemmeno se cambia i pasti**, purché la finestra di partenza fosse riproducibile. La
   * segnalazione del §15 racconta un fatto preciso — «la sua vecchia finestra l'orologio non la
   * sapeva fare, quindi le si è aperta la pagina vuota» — e non «ha cambiato idea». Senza questa
   * distinzione l'attività arriverebbe a ogni cliente che passa da tre pasti a due, cioè sempre.
   */
  it('⛔ né chi veniva da una finestra riproducibile e sceglie pasti diversi', async () => {
    const { service, attivita, scritture } = creaServizio(inDigiuno({ fastingWindow: 'skip_breakfast' }));
    await service.impostaDigiuno('u1', { protocollo: '18:6', inizioMin: H(14) });
    // I pasti cambiano davvero: da tre a due.
    expect(scritture[0].fastingWindow).toBe('skip_breakfast_and_snacks');
    expect(attivita.filter((a) => a.kind === TIPO_FINESTRA_NON_TRADUCIBILE)).toHaveLength(0);
  });

  /**
   * ⛔ **Se la segnalazione non parte, la scelta resta salvata lo stesso.** La cliente ha appena
   * deciso una cosa sua: farle vedere un errore perché una push interna è andata storta sarebbe
   * farle pagare un problema nostro.
   */
  it('⛔ un\'attività che fallisce non fa fallire il salvataggio', async () => {
    const { service, scritture, prisma } = creaServizio(inDigiuno());
    prisma.coachTask.findUnique.mockRejectedValue(new Error('database via'));
    const errore = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await service.impostaDigiuno('u1', { protocollo: '23:1', inizioMin: H(19) });
    expect(scritture).toHaveLength(1);
    // ⚠️ Ma non in silenzio: resta scritto nei log, o è un avviso che sparisce e nessuno lo sa.
    expect(errore).toHaveBeenCalled();
    errore.mockRestore();
  });
});

describe('quello che resta scritto nell\'audit', () => {
  it('dice il metodo, la finestra prima e dopo, e il passo davvero usato', async () => {
    const { service, audit } = creaServizio(inDigiuno({
      fastingProtocol: '16:8',
      fastingStartMin: H(12),
      fastingWindow: 'skip_breakfast',
      fastingSceltoIl: new Date('2026-08-01T10:00:00Z'),
    }));
    await service.impostaDigiuno('u1', { protocollo: '20:4', inizioMin: H(13) });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('digiuno.finestra_spostata');
    expect(audit[0].metadata).toMatchObject({
      metodo: 'reset',
      protocollo: '20:4',
      finestraPrima: 'skip_breakfast',
      passoUsatoMin: 60,
    });
  });

  it('e la prima scelta si distingue da uno spostamento', async () => {
    const { service, audit } = creaServizio(inDigiuno());
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) });
    expect(audit[0].action).toBe('digiuno.prima_scelta');
  });
});

describe('getDigiuno', () => {
  it('a chi non ha scelto dice di chiedere, e non inventa un orologio', async () => {
    const { service } = creaServizio(inDigiuno({ fastingWindow: 'skip_breakfast' }));
    const v = (await service.getDigiuno('u1')) as any;
    expect(v.daChiedere).toBe(true);
    expect(v.proposta).toMatchObject({ protocollo: '16:8', ora: '12:00' });
    expect(v.attuale).toBeUndefined();
  });

  it('un profilo che non esiste è un 404', async () => {
    const { service } = creaServizio(null);
    await expect(service.getDigiuno('u1')).rejects.toThrow(/Profilo/);
  });
});
