import { Logger } from '@nestjs/common';
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
  /**
   * ⚠️ **Il finto risponde per CHIAVE.** Rispondendo 60 a tutto, dal 25/8 il limite settimanale sulle
   * ore diventava di sessanta giorni e i test dicevano «fra 58 giorni» — cioè il doppio non seguiva
   * più l'originale, ed è la stessa lezione già pagata su `audit.log` e su `cercaPerIngrediente`.
   */
  const configParams = {
    getString: jest.fn(async (_k: string, d?: string) => d),
    getNumber: jest.fn(async (chiave: string, predefinito?: number) =>
      chiave === 'digiuno_passo_graduale_min' ? 60 : (predefinito ?? 60)),
  };
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
    /**
     * ⚠️ **Si guarda il FATTO, non il canale** (aggiornato il 22/8). Prima questa riga spiava
     * `console.error`, perché l'errore risaliva fin qui e lo prendeva il `catch` di `segnalaDigiuno`.
     * Adesso lo cattura `apriAttivitaCoach` — che finalmente mantiene il «non lancia mai» che
     * prometteva — e lo scrive col logger di Nest.
     *
     * ⛔ Il comportamento che conta non è cambiato di una virgola: la scelta della cliente resta
     * salvata, e il guasto **non è silenzioso**. Un test legato al canale invece del fatto si accende
     * su una correzione, e insegna a spostare l'asserzione invece di leggere cosa è successo.
     */
    const avviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await service.impostaDigiuno('u1', { protocollo: '23:1', inizioMin: H(19) });
    expect(scritture).toHaveLength(1);
    // ⚠️ Ma non in silenzio: resta scritto nei log, o è un avviso che sparisce e nessuno lo sa.
    expect(avviso).toHaveBeenCalled();
    avviso.mockRestore();
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

/**
 * ⛔ **LE ORE DEL DIGIUNO SI CAMBIANO UNA VOLTA A SETTIMANA, E DALLA PORTA DELLA CLIENTE.**
 *
 * Richiesta della capo nutrizionista (23/8), decisa da Simone il 25/8. ⚠️ Qui si guarda il giro
 * **vero** — la lettura del profilo, la decisione, quello che finisce scritto — perché la regola
 * pura è già provata in `cambio-finestra.spec.ts` e quello che può ancora rompersi è il cablaggio:
 * il campo letto, il campo scritto, e il fatto che si scriva **solo quando serve**.
 */
describe('⛔ le ore del digiuno: una volta a settimana (dalla porta della cliente)', () => {
  const GIORNI = 86_400_000;
  const giorniFa = (n: number) => new Date(MATTINA_ROMA.getTime() - n * GIORNI);

  const conOre = (extra: Profilo = {}): Profilo =>
    inDigiuno({
      fastingProtocol: '16:8',
      fastingStartMin: H(12),
      fastingWindow: '12-20',
      fastingSceltoIl: giorniFa(30),
      ...extra,
    });

  it('⛔ cambiare le ore due giorni dopo si rifiuta, e la frase dice quando e a chi chiedere', async () => {
    const { service, scritture } = creaServizio(conOre({ fastingProtocolChangedAt: giorniFa(2) }));
    await expect(service.impostaDigiuno('u1', { protocollo: '18:6' })).rejects.toThrow(/5 giorni/);
    await expect(service.impostaDigiuno('u1', { protocollo: '18:6' })).rejects.toThrow(/nutrizionista/);
    // ⛔ E non si scrive niente: un rifiuto che scrive è peggio di un rifiuto.
    expect(scritture).toEqual([]);
  });

  it('⛔ dopo sette giorni si può, e la data delle ore si aggiorna', async () => {
    const { service, scritture } = creaServizio(conOre({ fastingProtocolChangedAt: giorniFa(8) }));
    await service.impostaDigiuno('u1', { protocollo: '18:6' });
    expect(scritture[0].fastingProtocol).toBe('18:6');
    expect(scritture[0].fastingProtocolChangedAt).toEqual(MATTINA_ROMA);
  });

  it('⛔ e la PRIMA volta che le cambia è libera', async () => {
    const { service, scritture } = creaServizio(conOre({ fastingProtocolChangedAt: null }));
    await service.impostaDigiuno('u1', { protocollo: '18:6' });
    expect(scritture[0].fastingProtocol).toBe('18:6');
  });

  /**
   * ⛔ **IL BUCO PEGGIORE DELLA PRIMA STESURA** (trovato in revisione, 25/8).
   *
   * Quando la finestra di oggi si è **già aperta**, il protocollo nuovo va in `bersaglioProtocollo` e
   * lo applica il cron: `scrivi.protocollo` resta quello vecchio. La condizione guardava solo
   * quello, quindi la data **non si scriveva mai** — e una cliente che toccava l'app **dentro la sua
   * finestra di alimentazione** poteva cambiare protocollo tutti i giorni, per sempre. Per una 16:8
   * sono otto ore al giorno, proprio quelle in cui una persona pensa al cibo e apre l'app.
   */
  it('⛔ il cambio rimandato a domani consuma comunque il credito settimanale', async () => {
    jest.setSystemTime(POMERIGGIO_ROMA); // la finestra apre a mezzogiorno: adesso è aperta
    const { service, scritture } = creaServizio(conOre({ fastingProtocolChangedAt: null }));
    await service.impostaDigiuno('u1', { protocollo: '18:6' });
    // Le ore di oggi restano quelle di prima — un pasto già fatto non si disfa…
    expect(scritture[0].fastingProtocol).toBe('16:8');
    expect(scritture[0].fastingTargetProtocol).toBe('18:6');
    // …ma la DECISIONE è di oggi, e il credito settimanale si consuma adesso.
    expect(scritture[0].fastingProtocolChangedAt).toEqual(POMERIGGIO_ROMA);
  });

  it('⛔ e infatti il giorno dopo non le può cambiare di nuovo', async () => {
    jest.setSystemTime(POMERIGGIO_ROMA);
    const { service } = creaServizio(conOre({ fastingProtocolChangedAt: new Date(POMERIGGIO_ROMA.getTime() - 86_400_000) }));
    await expect(service.impostaDigiuno('u1', { protocollo: '20:4' })).rejects.toThrow(/6 giorni/);
  });

  /**
   * ⛔ **La PRIMA scelta non consuma il credito.** Migrazione e schema dicono tutti e due «NULL =
   * non l'ha mai cambiato»; senza questa riga la cliente sceglieva in onboarding la finestra che le
   * compariva e si trovava il muro per sette giorni — proprio mentre rispondeva a una domanda che
   * non le era mai stata fatta.
   */
  it('⛔ la prima scelta NON scrive la data delle ore', async () => {
    const { service, scritture } = creaServizio(inDigiuno());
    await service.impostaDigiuno('u1', { protocollo: '16:8', inizioMin: H(12) });
    expect(scritture[0].fastingProtocol).toBe('16:8');
    expect(scritture[0].fastingProtocolChangedAt).toBeUndefined();
  });

  /**
   * ⛔ **LA CONTROPROVA, ed è quella che conta.** Spostare la lancetta non è cambiare le ore: se
   * questo test fosse rosso, chi sposta la finestra di mezz'ora si vedrebbe bloccare il protocollo
   * per una settimana — un limite che scatta su un gesto che non c'entra è un limite che nessuno
   * capisce, ed è il motivo per cui la colonna nel database è una sua.
   */
  it('⛔ spostare la LANCETTA resta libero, e NON scrive la data delle ore', async () => {
    const { service, scritture } = creaServizio(conOre({ fastingProtocolChangedAt: giorniFa(1) }));
    await service.impostaDigiuno('u1', { inizioMin: H(13) });
    expect(scritture[0].fastingStartMin).toBe(H(13));
    expect(scritture[0].fastingProtocol).toBe('16:8');
    expect(scritture[0].fastingProtocolChangedAt).toBeUndefined();
  });
});

/**
 * ⛔ **LA PORTA DELLA NUTRIZIONISTA** — quella che la frase della cliente promette.
 *
 * «Se ti serve prima, scrivilo alla tua nutrizionista: lo cambia lei.» ⛔ Fino al 25/8 quella porta
 * non esisteva: dal 21/8 la tendina della finestra è fuori dalla scheda staff. Un limite senza la
 * sua porta è un cancello chiuso, con in più una frase che fa credere il contrario.
 */
describe('⛔ impostaPerStaff: la nutrizionista cambia le ore', () => {
  const giorniFa = (n: number) => new Date(MATTINA_ROMA.getTime() - n * 86_400_000);

  const conOre = (extra: Profilo = {}): Profilo =>
    inDigiuno({
      fastingProtocol: '16:8',
      fastingStartMin: H(12),
      fastingWindow: '12-20',
      fastingSceltoIl: giorniFa(30),
      ...extra,
    });

  /**
   * ⛔ **E il limite della LANCETTA resta della cliente.** `scriviLOrologio` scriveva
   * `fastingChangedAt` anche dalla porta staff: se Lucia correggeva le ore alle 13:00, alle 20:00
   * Giulia che voleva spostare la finestra di un'ora leggeva «l'hai già spostata da poco, puoi
   * rifarlo fra 19 ore». Non l'aveva spostata lei — è il gesto di una persona che blocca quello di
   * un'altra, con una frase falsa in mezzo.
   */
  it('⛔ quello che scrive la nutrizionista non blocca la lancetta della cliente', async () => {
    const { service, scritture } = creaServizio(conOre({ fastingChangedAt: null }));
    await service.impostaPerStaff('u1', { protocollo: '18:6' }, 'lucia');
    expect(scritture[0].fastingChangedAt).toBeUndefined();
    // ⚠️ Ma le ore sì: il credito settimanale della cliente si consuma, ed è giusto — le ore sono
    // cambiate davvero, e riaprirle domani sarebbe un altro cambio.
    expect(scritture[0].fastingProtocolChangedAt).toEqual(MATTINA_ROMA);
  });

  it('⛔ i limiti della cliente non valgono per lei', async () => {
    const { service, scritture } = creaServizio(
      // Ore cambiate ieri E lancetta spostata un'ora fa: per la cliente sarebbero due «no».
      conOre({ fastingProtocolChangedAt: giorniFa(1), fastingChangedAt: new Date(MATTINA_ROMA.getTime() - 3_600_000) }),
    );
    const esito = await service.impostaPerStaff('u1', { protocollo: '18:6' }, 'lucia');
    expect(esito.ok).toBe(true);
    expect(scritture[0].fastingProtocol).toBe('18:6');
    // ⚠️ E i pasti si riderivano: le ore nuove senza la finestra nuova sarebbero uno stato mezzo scritto.
    expect(scritture[0].fastingWindow).not.toBe('12-20');
  });

  /**
   * ⛔ **Nel registro c'è chi ha agito**, non chi ha subito. Senza, l'audit avrebbe detto che la
   * cliente ha cambiato le sue ore da sola proprio nel caso in cui non poteva farlo — cioè avrebbe
   * raccontato il contrario di quello che è successo.
   */
  it('⛔ l’audit dice che è stata la nutrizionista', async () => {
    const { service, audit } = creaServizio(conOre());
    await service.impostaPerStaff('u1', { protocollo: '18:6' }, 'lucia');
    expect(audit[0].actorId).toBe('lucia');
    expect((audit[0].metadata as Record<string, unknown>).daStaff).toBe(true);
    expect((audit[0].metadata as Record<string, unknown>).daApp).toBe(false);
  });

  /**
   * ⛔ **Non lancia mai**: chi chiama è una chat, e a una nutrizionista che ha appena detto «mettila
   * a 16:8» si deve poter rispondere *perché* non si è potuto, non un errore rosso.
   */
  it('⛔ su chi non è in digiuno risponde di no, senza esplodere e senza scrivere', async () => {
    const { service, scritture } = creaServizio(inDigiuno({ pathType: 'standard' }));
    const esito = await service.impostaPerStaff('u1', { protocollo: '18:6' }, 'lucia');
    expect(esito.ok).toBe(false);
    expect(esito.perche).toContain('digiuno intermittente');
    expect(scritture).toEqual([]);
  });

  /**
   * ⛔ **A CHI NON HA MAI SCELTO LA SUA FINESTRA NON SI SCRIVE DA QUI**, e i danni erano tre insieme:
   * `decidiCambio` ripiegava su `inizioMin: 0` e le scriveva una finestra **00:00 – 06:00** (mangia
   * dalla mezzanotte alle sei, perché nessuno le ha mai chiesto a che ora mangia); `fastingSceltoIl`
   * veniva scritto e la pagina dell'orologio **non le si apriva più**; e l'attività «finestra mai
   * chiesta» per la nutrizionista non sarebbe mai nata. Tutto su una persona che non è nella stanza.
   */
  it('⛔ su chi non ha mai scelto la sua finestra non si scrive: le ore da sole non bastano', async () => {
    const { service, scritture } = creaServizio(
      inDigiuno({ fastingProtocol: null, fastingStartMin: null, fastingSceltoIl: null }),
    );
    const esito = await service.impostaPerStaff('u1', { protocollo: '18:6' }, 'lucia');
    expect(esito.ok).toBe(false);
    expect(esito.perche).toContain('non ha ancora scelto');
    expect(scritture).toEqual([]);
  });

  /**
   * ⚠️ **«Non c'era niente da cambiare» non è «fatto».** Qui si rendeva `ok: true` senza scrivere una
   * riga, e chi chiama scriveva comunque il registro e diceva «Fatto». Serve una corsa fra anteprima
   * e conferma, ma è lo stesso schema di difetto già pagato sulle proteine il 24/8.
   */
  it('⚠️ mettere le ore che ha già non è un successo', async () => {
    const { service, scritture } = creaServizio(conOre());
    const esito = await service.impostaPerStaff('u1', { protocollo: '16:8' }, 'lucia');
    expect(esito.ok).toBe(false);
    expect(esito.perche).toContain('già a quelle ore');
    expect(scritture).toEqual([]);
  });

  it('⚠️ e su un profilo che non esiste nemmeno', async () => {
    const { service } = creaServizio(null);
    expect((await service.impostaPerStaff('u1', { protocollo: '18:6' }, 'lucia')).ok).toBe(false);
  });
});
