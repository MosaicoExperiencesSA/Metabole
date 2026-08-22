/**
 * ⛔ **CHI VEDE QUALI ATTIVITÀ — la parte che decide, e che non aveva un test.**
 *
 * Il 22/8 la pagina delle attività è stata aperta alla nutrizionista (prima le arrivava la push e
 * la pagina rispondeva 403). Aprire una porta è la parte facile; la parte che si sbaglia è **cosa
 * si vede una volta dentro**, e la prima stesura l'ha sbagliata in due modi:
 *
 *  - ⛔ **nessun filtro sui tipi** sarebbe stato il difetto ovvio: `coachTeamScope` per un ruolo che
 *    non è coach-like torna `null`, cioè nessun limite. Si sarebbe trovata davanti le chiamate della
 *    prova, i rinnovi e i solleciti misure di tutta l'azienda;
 *  - ⛔ **nessun filtro sulle clienti** era il difetto meno ovvio, e più grave: filtrando solo per
 *    tipo le finivano in elenco le clienti di **un'altra** nutrizionista, con nome e frase clinica
 *    («riceve il 68% del suo fabbisogno»), e cliccando il nome prendeva 403 perché
 *    `perimetroClienti` la ferma lì. Dati non suoi da leggere, e un link che non porta da nessuna
 *    parte. La prima stesura scriveva pure, nel docstring, che filtrare per cliente era sbagliato.
 *
 * ⚠️ Questi test guardano **il `where` che parte davvero verso Prisma**, non un valore di ritorno:
 * è l'unico punto in cui si vede se un filtro c'è o non c'è.
 */
import { ForbiddenException } from '@nestjs/common';
import { CoachTasksService } from './coach-tasks.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TIPI_DELLA_NUTRIZIONISTA } from './avvisi-attivita';
import { TIPO_KCAL_CORTE } from './kcal-restano-corte';

const NESSUNO = '00000000-0000-0000-0000-000000000000';

/**
 * @param ruoloInBanca quello che `user.findUnique` risponde: `coachTeamScope` e `perimetroClienti`
 *   lo leggono da lì, e nel prodotto vero è lo stesso valore che sta nel token.
 */
function crea(ruoloInBanca: string, opzioni?: { staffId?: string | null; task?: Record<string, unknown> | null }) {
  const prisma = {
    coachTask: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(opzioni?.task ?? null),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 't1', ...data })),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: 'staff-altra' }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ role: ruoloInBanca }) },
    staff: { findUnique: jest.fn().mockResolvedValue(opzioni?.staffId === null ? null : { id: opzioni?.staffId ?? 'staff-lei' }) },
    subscription: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
  };
  return {
    prisma,
    service: new CoachTasksService(
      prisma as unknown as PrismaService,
      { log: jest.fn() } as never,
      { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } as never,
      { sendToUser: jest.fn() } as never,
    ),
  };
}

/** Il `where` con cui `list` ha davvero interrogato Prisma. */
const whereDiList = (prisma: { coachTask: { findMany: jest.Mock } }) =>
  prisma.coachTask.findMany.mock.calls[0][0].where as Record<string, unknown>;

/**
 * I filtri dentro `AND`, appiattiti in un oggetto solo per leggerli comodi.
 *
 * ⚠️ Il `where` compone i due perimetri con `AND` e non con due spread, perché tutti e due
 * producono la chiave `client` e il secondo cancellerebbe il primo in silenzio. Il test guarda il
 * `where` vero, quindi segue quella forma invece di fingere che sia piatta.
 */
const filtriDiList = (prisma: { coachTask: { findMany: jest.Mock } }): Record<string, unknown> => {
  const w = whereDiList(prisma);
  const dentro = (w.AND as Record<string, unknown>[] | undefined) ?? [];
  return Object.assign({}, ...dentro.map((x) => x)) as Record<string, unknown>;
};

describe('⛔ la nutrizionista: i suoi tipi, e solo le sue clienti', () => {
  it('⛔ l\'elenco è filtrato ai quattro tipi della nutrizionista', async () => {
    const { prisma, service } = crea('nutritionist');
    await service.list('u-nutri', 'nutritionist');
    expect(filtriDiList(prisma).kind).toEqual({ in: [...TIPI_DELLA_NUTRIZIONISTA] });
  });

  /**
   * ⛔ **Il filtro che mancava.** `staff-lei` è la sua scheda: l'elenco deve chiedere le clienti
   * assegnate **a lei**, non tutte quelle con un'attività del tipo giusto.
   */
  it('⛔ ed è filtrato alle SUE clienti, per assegnazione della nutrizionista', async () => {
    const { prisma, service } = crea('nutritionist', { staffId: 'staff-lei' });
    await service.list('u-nutri', 'nutritionist');
    expect(filtriDiList(prisma).client).toEqual({
      clientProfile: { assignedNutritionistId: { in: ['staff-lei'] } },
    });
  });

  /**
   * ⚠️ **Senza scheda staff non diventa «tutte»**: diventa un id che non esiste, cioè zero clienti.
   * È la regola di `perimetroClienti`, e qui si verifica che questa pagina la eredita invece di
   * cavarsela da sola.
   */
  it('⚠️ senza scheda staff vede zero clienti, non tutte', async () => {
    const { prisma, service } = crea('nutritionist', { staffId: null });
    await service.list('u-nutri', 'nutritionist');
    expect(filtriDiList(prisma).client).toEqual({
      clientProfile: { assignedNutritionistId: { in: [NESSUNO] } },
    });
  });

  /**
   * ⚠️ **Il capo nutrizionista vede tutte le clienti** (è in `RUOLI_CHE_VEDONO_TUTTE`), ma sempre e
   * solo i suoi quattro tipi. Ed è la ragione per cui il filtro per cliente non nasconde niente di
   * cui qualcuno sia stato avvisato: la push delle clienti senza nutrizionista assegnata va a lui.
   */
  it('⚠️ il capo: tutti i clienti, ma sempre i quattro tipi', async () => {
    const { prisma, service } = crea('head_nutritionist');
    await service.list('u-capo', 'head_nutritionist');
    const filtri = filtriDiList(prisma);
    expect(filtri.kind).toEqual({ in: [...TIPI_DELLA_NUTRIZIONISTA] });
    expect(filtri.client).toBeUndefined();
  });

  /** ⚠️ E per la coach non cambia niente: nessun filtro sui tipi, il suo perimetro come prima. */
  it('⚠️ alla coach non è stato tolto né aggiunto niente', async () => {
    const { prisma, service } = crea('coach');
    await service.list('u-coach', 'coach');
    expect(filtriDiList(prisma).kind).toBeUndefined();
  });

  it('⚠️ e all\'admin nemmeno', async () => {
    const { prisma, service } = crea('admin');
    await service.list('u-admin', 'admin');
    const filtri = filtriDiList(prisma);
    expect(filtri.kind).toBeUndefined();
    expect(filtri.client).toBeUndefined();
    // ⚠️ E il `where` non porta filtri fantasma: `AND` vuoto, non un oggetto con chiavi indefinite.
    expect(whereDiList(prisma).AND).toEqual([]);
  });
});

describe('⛔ cambiare stato: filtrare l\'elenco non basta', () => {
  const task = (kind: string) => ({ id: 't1', clientId: 'c1', kind });

  /**
   * ⛔ **L'id di una riga fuori elenco si può sempre scrivere a mano nella chiamata.** Senza questa
   * guardia la nutrizionista poteva chiudere «chiama la cliente al giorno 4» — che non è suo, e che
   * la coach non ritroverebbe più.
   */
  it('⛔ un tipo che non è suo: rifiutato', async () => {
    const { service } = crea('nutritionist', { task: task('trial_g1_welcome') });
    await expect(service.setStatus('u-nutri', 't1', 'done', 'nutritionist'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  /** ⛔ Tipo giusto ma cliente di un'altra: rifiutato lo stesso. Sono due controlli, non uno. */
  it('⛔ tipo suo ma cliente di un\'altra: rifiutato', async () => {
    const { service } = crea('nutritionist', { task: task(TIPO_KCAL_CORTE), staffId: 'staff-lei' });
    // Il finto risponde `assignedNutritionistId: 'staff-altra'`.
    await expect(service.setStatus('u-nutri', 't1', 'done', 'nutritionist'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('✅ tipo suo e cliente sua: passa', async () => {
    const { prisma, service } = crea('nutritionist', { task: task(TIPO_KCAL_CORTE), staffId: 'staff-lei' });
    prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: 'staff-lei' });
    await expect(service.setStatus('u-nutri', 't1', 'done', 'nutritionist')).resolves.toBeTruthy();
  });

  /**
   * ⛔ **E la COACH non le chiude** (aggiunto in revisione, 22/8). L'elenco si intitola «le attività
   * che SOLO la nutrizionista può chiudere» dal 21/8, e la guardia esisteva in un verso solo: la
   * coach quelle attività le vede sulle sue clienti, col pulsante «Fatto» accanto, e premendolo in
   * buona fede le toglieva dalla colonna di chi non le aveva ancora lette.
   *
   * ⚠️ La prima stesura di questo file aveva pure un test («alla coach non è stato tolto né
   * aggiunto niente») che fissava quel comportamento come voluto: guardava solo il filtro di
   * lettura, e da lì si deduceva che andasse tutto bene.
   */
  it('⛔ la coach NON può chiudere un\'attività della nutrizionista', async () => {
    const { prisma, service } = crea('coach', { task: task(TIPO_KCAL_CORTE), staffId: 'staff-coach' });
    /**
     * ⚠️ **La cliente è SUA, di proposito.** La prima stesura di questo test lasciava la cliente non
     * assegnata: passava, ma per il motivo sbagliato — a rifiutare era la guardia di perimetro, non
     * quella sul tipo. Togliendo la guardia sul tipo il test restava verde (provato con la
     * mutazione). Un test che passa per il motivo sbagliato è un test che non c'è.
     */
    prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 'staff-coach', assignedNutritionistId: null });
    await expect(service.setStatus('u-coach', 't1', 'done', 'coach'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  /** ⚠️ Le sue invece sì, come sempre: questa consegna non le toglie niente di suo. */
  it('⚠️ ma le sue sì', async () => {
    const { prisma, service } = crea('coach', { task: task('trial_g1_welcome'), staffId: 'staff-coach' });
    prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 'staff-coach', assignedNutritionistId: null });
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff-coach' });
    await expect(service.setStatus('u-coach', 't1', 'done', 'coach')).resolves.toBeTruthy();
  });

  /** ⚠️ L'admin resta il superutente: un'attività bloccata perché lei è in ferie è peggio. */
  it('⚠️ l\'admin passa comunque', async () => {
    const { service } = crea('admin', { task: task(TIPO_KCAL_CORTE) });
    await expect(service.setStatus('u-admin', 't1', 'done', 'admin')).resolves.toBeTruthy();
  });

  /** ⚠️ Il capo chiude quelle dei suoi tipi su chiunque: non ha perimetro. */
  it('⚠️ il capo chiude i suoi tipi su qualunque cliente', async () => {
    const { service } = crea('head_nutritionist', { task: task(TIPO_KCAL_CORTE) });
    await expect(service.setStatus('u-capo', 't1', 'done', 'head_nutritionist')).resolves.toBeTruthy();
  });

  /** ⛔ …ma non quelle della coach: il tipo conta anche per lui. */
  it('⛔ e nemmeno il capo tocca un\'attività della coach', async () => {
    const { service } = crea('head_nutritionist', { task: task('measures_missing') });
    await expect(service.setStatus('u-capo', 't1', 'done', 'head_nutritionist'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('⛔ il riepilogo: i numeri della coach non le si mandano', () => {
  /**
   * ⛔ **Non si nascondono: non si calcolano e non si spediscono** (corretto in revisione, 22/8).
   * La prima stesura li calcolava tutti e li metteva nella risposta con accanto
   * `mostraCommerciale:false`, lasciando alla pagina il compito di non disegnarli — cioè i dati
   * commerciali **di tutta l'azienda** uscivano lo stesso nel JSON. *Un dato che agisce e non si
   * vede.*
   */
  it('⛔ per la nutrizionista i campi commerciali NON sono nella risposta', async () => {
    const { service } = crea('nutritionist');
    const r = await service.summary('u-nutri', 'nutritionist') as Record<string, unknown>;
    expect(r.mostraCommerciale).toBe(false);
    for (const campo of ['trialsActive', 'expiringToday', 'expiringTomorrow', 'notConverted']) {
      expect(r).not.toHaveProperty(campo);
    }
    expect(r).toHaveProperty('openTasks');
  });

  /** ⚠️ E le query commerciali non partono nemmeno: erano quattro conteggi e un N+1, per niente. */
  it('⚠️ e le query sugli abbonamenti non partono proprio', async () => {
    const { prisma, service } = crea('nutritionist');
    await service.summary('u-nutri', 'nutritionist');
    expect(prisma.subscription.count).not.toHaveBeenCalled();
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });

  /** ⚠️ Alla coach arrivano come prima: questa consegna non le toglie niente. */
  it('⚠️ alla coach il riepilogo resta intero', async () => {
    const { service } = crea('coach');
    const r = await service.summary('u-coach', 'coach') as Record<string, unknown>;
    expect(r.mostraCommerciale).toBe(true);
    expect(r).toHaveProperty('trialsActive');
  });
});

/**
 * ⛔ **«NON RIUSCITA» NON È «C'ERA GIÀ» — il terzo esito, che nessuno guardava.**
 *
 * Il 21/8 `apriAttivitaCoach` ha smesso di lanciare e ha cominciato a tornare `'non-riuscita'`:
 * giusto, un avviso che non parte non deve far fallire il menu di una cliente. Ma `apriAttivita`
 * passava per `ensureTask`, che schiaccia tutto su `1 | 0`, e traduceva **guasto** in
 * `'gia-presente'`.
 *
 * ⚠️ Chi lo leggeva era una persona: la nutrizionista salva «serve la visita», il database ha un
 * intoppo, e la scheda le scrive «l'attività alla coach c'era già: l'ho aggiornata». L'attività non
 * esiste, e la visita non la fissa nessuno. *Se degradi, dillo.*
 */
describe('⛔ il terzo esito arriva fino a chi deve leggerlo', () => {
  it('⛔ se la porta degrada, «apriAttivita» dice «non-riuscita», non «gia-presente»', async () => {
    const { prisma, service } = crea('admin');
    // La porta degrada quando la scrittura non riesce: `apriAttivitaCoach` lo assorbe e lo dichiara.
    prisma.coachTask.findUnique.mockRejectedValue(new Error('db giù'));
    const esito = await service.apriAttivita({
      clientId: 'c1', kind: 'visita_da_fissare', refId: 'n1',
      title: 'Fissa la visita', description: 'Serve la visita',
    });
    expect(esito).toBe('non-riuscita');
  });

  it('⚠️ e quando va bene resta «creata»', async () => {
    const { prisma, service } = crea('admin');
    prisma.coachTask.findUnique.mockResolvedValue(null);
    (prisma.coachTask as unknown as { create: jest.Mock }).create = jest.fn().mockResolvedValue({ id: 't1' });
    (prisma.coachTask as unknown as { updateMany: jest.Mock }).updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const esito = await service.apriAttivita({
      clientId: 'c1', kind: 'visita_da_fissare', refId: 'n1',
      title: 'Fissa la visita', description: 'Serve la visita',
    });
    expect(esito).toBe('creata');
  });
});
