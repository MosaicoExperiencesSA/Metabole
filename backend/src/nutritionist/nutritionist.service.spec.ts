/**
 * ⚠️ **«OGGI» SI CHIEDE, ANCHE NEI TEST — corretto il 20/8 alle 00:02.**
 *
 * Qui il giorno si ricavava da `new Date().toISOString().slice(0, 10)`, cioè il giorno **UTC**,
 * mentre il codice risponde col giorno di **Roma**. Fra mezzanotte e le 02:00 italiane le due
 * risposte differiscono di un giorno e questi test diventavano rossi.
 *
 * ⛔ Cioè la suite era **verde 22 ore su 24 e rossa 2**, e nessuno l'avrebbe scoperto se non
 * lanciandola all'una di notte — che è quello che è successo. Un test che si ricalcola da sé la
 * cosa che sta verificando non la verifica: la ripete, e quando il codice cambia fuso il test resta
 * indietro **senza dirlo**.
 */
import { PrismaService } from '../prisma/prisma.service';
import { aGiorno } from '../common/date-only';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EngineService } from '../engine/engine.service';
import { NutritionistService } from './nutritionist.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const user = { sub: 'u-nut', role: 'nutritionist' } as AuthUser;
const head = { sub: 'u-head', role: 'head_nutritionist' } as AuthUser;

const makeEngine = (over: Partial<EngineService> = {}) => ({ reviewDecision: jest.fn().mockResolvedValue({ id: 'd1' }), ...over }) as unknown as EngineService;
/** Base personalizzata finta: serve allo SBLOCCO del piano, non ai test di questo file. */
const makePersonalBase = (over: Record<string, unknown> = {}) =>
  ({ buildPersonalBase: jest.fn().mockResolvedValue({ status: 'ready', message: 'ok' }), ...over }) as never;
/** Audit finto: le azioni sul piano ci scrivono sempre, e senza il servizio non parte niente. */
const makeAudit = (over: Record<string, unknown> = {}) =>
  ({ log: jest.fn().mockResolvedValue(undefined), ...over }) as never;
/**
 * Fabbisogno finto (§15.5). Il default restituisce sempre `null`: i test che non parlano di calorie
 * non devono sapere che esiste: quello che conta, per loro, è che il costruttore sia completo.
 * Chi ha bisogno di numeri veri passa il suo.
 */
const makeKcalNeed = (over: Record<string, unknown> = {}) =>
  ({ estimate: jest.fn().mockResolvedValue(null), computeTargetKcal: jest.fn().mockResolvedValue(null), ...over }) as never;
/** Menu finto: serve alla rigenerazione dei giorni futuri dopo un cambio di calorie. */
const makeMenu = (over: Record<string, unknown> = {}) =>
  ({ redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [], ripristinati: 0 }), ...over }) as never;
const make = (
  prisma: Record<string, unknown>,
  engine: EngineService = makeEngine(),
  personalBase = makePersonalBase(),
  audit = makeAudit(),
  kcalNeed = makeKcalNeed(),
  menu = makeMenu(),
) => new NutritionistService(prisma as unknown as PrismaService, engine, personalBase, audit, kcalNeed, menu);

describe('NutritionistService.patients', () => {
  it('elenca i pazienti con riepilogo e ordina per attenzione', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'p1', name: 'Anna' },
          { userId: 'p2', name: 'Bea' },
        ]),
      },
      measurement: { findMany: jest.fn().mockResolvedValue([{ clientId: 'p1', date: D('2026-07-10') }]) },
      escalation: { findMany: jest.fn().mockResolvedValue([{ clientId: 'p2' }]) },
      document: { findMany: jest.fn().mockResolvedValue([{ clientId: 'p2' }, { clientId: 'p2' }]) },
      visit: { findMany: jest.fn().mockResolvedValue([{ clientId: 'p1', datetime: D('2026-07-20'), type: 'televisit' }]) },
      // La lista pazienti porta anche email e telefono, che stanno su User.
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'p1', email: 'anna@t.it', phone: null }, { id: 'p2', email: 'bea@t.it', phone: null }]) },
    };
    const res = (await make(prisma).patients(user)) as { patients: { clientId: string; pendingDocuments: number; nextVisit: unknown }[] };
    expect(res.patients).toHaveLength(2);
    expect(res.patients[0].clientId).toBe('p2'); // 1 escalation + 2 documenti → in cima
    expect(res.patients.find((p) => p.clientId === 'p1')!.nextVisit).not.toBeNull();
  });

  it('nessuno staff → lista vuota', async () => {
    const prisma = { staff: { findUnique: jest.fn().mockResolvedValue(null) } };
    expect(await make(prisma).patients(user)).toEqual({ patients: [] });
  });
});

describe('NutritionistService.dashboard', () => {
  it('compone conteggi clinici e guadagni', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'p1', name: 'Anna' }, { userId: 'p2', name: 'Bea' }]) },
      document: { count: jest.fn().mockResolvedValue(3) },
      escalation: { count: jest.fn().mockResolvedValue(1) },
      engineDecision: { count: jest.fn().mockResolvedValue(2) },
      visit: { count: jest.fn().mockResolvedValue(4) },
      ledgerEntry: {
        aggregate: jest.fn().mockResolvedValueOnce({ _sum: { amountCents: 2000 } }).mockResolvedValueOnce({ _sum: { amountCents: 9000 } }),
      },
    };
    const res = (await make(prisma).dashboard(user)) as Record<string, number | boolean>;
    expect(res.isNutritionist).toBe(true);
    expect(res.patientsCount).toBe(2);
    expect(res.pendingDocuments).toBe(3);
    expect(res.openEscalations).toBe(1);
    expect(res.protocolsToValidate).toBe(2);
    expect(res.upcomingVisits).toBe(4);
    expect(res.earningsMonthCents).toBe(2000);
    expect(res.earningsTotalCents).toBe(9000);
  });

  it('il numero «Da validare» conta le stesse righe che la coda mostra', async () => {
    const decisionCount = jest.fn().mockResolvedValue(2);
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'p1', name: 'Anna' }]) },
      document: { count: jest.fn().mockResolvedValue(0) },
      escalation: { count: jest.fn().mockResolvedValue(0) },
      engineDecision: { count: decisionCount },
      visit: { count: jest.fn().mockResolvedValue(0) },
      ledgerEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }) },
    };
    await make(prisma).dashboard(user);

    // Contava `flaggedForReview: true` e basta: includeva le decisioni già revisionate e quelle
    // dei percorsi conclusi. Il pulsante sul telefono diceva 9, la coda che apriva ne aveva 2 —
    // e un contatore che non combacia con la lista che apre insegna a non fidarsi di entrambi.
    expect(decisionCount.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        flaggedForReview: true,
        reviewedAt: null,
        client: expect.objectContaining({ subscriptions: expect.anything() }),
      }),
    );
  });

  it('nessuno staff → isNutritionist false', async () => {
    const prisma = { staff: { findUnique: jest.fn().mockResolvedValue(null) } };
    expect(await make(prisma).dashboard(user)).toEqual({ isNutritionist: false });
  });
});

describe('NutritionistService.validationQueue', () => {
  it('nutrizionista: solo decisioni dei propri pazienti + protocolli altrui (no diete)', async () => {
    const engineDecisionFindMany = jest.fn().mockResolvedValue([
      { id: 'dec1', clientId: 'p1', date: D('2026-07-12'), flagReason: 'fuori range', action: { note: 'x' }, rule: { id: 'r1', name: 'Soglia' } },
    ]);
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'p1', name: 'Anna' }]) },
      // Dall'11/8 i numeri fra parentesi nei titoli vengono da `count()` e non dalla lunghezza
      // dell'elenco troncato: qui i conteggi sono più alti delle righe, ed è il punto del test.
      engineDecision: { findMany: engineDecisionFindMany, count: jest.fn().mockResolvedValue(240) },
      diet: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      protocol: {
        findMany: jest.fn().mockResolvedValue([{ id: 'pr1', name: 'Menu corr', type: 'menu_correction', updatedAt: D('2026-07-10') }]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const res = await make(prisma).validationQueue(user);
    // le decisioni sono filtrate sui pazienti assegnati
    expect(engineDecisionFindMany.mock.calls[0][0].where.clientId).toEqual({ in: ['p1'] });
    expect(res.engineDecisions).toHaveLength(1);
    expect((res.engineDecisions[0] as { patientName: string }).patientName).toBe('Anna');
    expect(res.dietsInReview).toHaveLength(0); // il nutrizionista non approva diete
    expect(res.protocolsPending).toHaveLength(1);
    // `counts` = quante ce ne sono nel database; `mostrati` = quante righe sono arrivate.
    expect(res.counts).toEqual({ engineDecisions: 240, dietsInReview: 0, protocolsPending: 1 });
    expect(res.mostrati).toEqual({ engineDecisions: 1, dietsInReview: 0, protocolsPending: 1 });
  });

  it('la coda nomina solo chi ha un piano alimentare attivo', async () => {
    const engineDecisionFindMany = jest.fn().mockResolvedValue([]);
    const conteggio = jest.fn().mockResolvedValue(0);
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'p1', name: 'Anna' }]) },
      engineDecision: { findMany: engineDecisionFindMany, count: conteggio },
      diet: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      protocol: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    await make(prisma).validationQueue(user);

    // Filtrare solo `runBatch` non basta: le righe scritte prima restano a database, ed è così
    // che Rosaria — piano concluso il 22/07 — compariva nella coda del 13/8.
    const atteso = expect.objectContaining({
      subscriptions: expect.objectContaining({
        some: expect.objectContaining({ status: 'active' }),
      }),
    });
    expect(engineDecisionFindMany.mock.calls[0][0].where.client).toEqual(atteso);
    // E il CONTEGGIO usa lo stesso filtro dell'elenco: due filtri diversi qui vorrebbero dire
    // «(9)» nel titolo e due righe sotto.
    expect(conteggio.mock.calls[0][0].where.client).toEqual(atteso);
  });

  it('nutrizionista senza pazienti → nessuna query globale sulle decisioni', async () => {
    const engineDecisionFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([]) },
      engineDecision: { findMany: engineDecisionFindMany, count: jest.fn().mockResolvedValue(0) },
      diet: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      protocol: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    await make(prisma).validationQueue(user);
    expect(engineDecisionFindMany.mock.calls[0][0].where.clientId).toEqual({ in: ['__none__'] });
  });

  it('capo: vede tutte le decisioni flaggate + diete in revisione', async () => {
    const engineDecisionFindMany = jest.fn().mockResolvedValue([
      { id: 'dec1', clientId: 'p9', date: D('2026-07-12'), flagReason: null, action: {}, rule: null },
    ]);
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'head-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'p9', name: 'Zoe' }]) },
      engineDecision: { findMany: engineDecisionFindMany, count: jest.fn().mockResolvedValue(1) },
      diet: {
        findMany: jest.fn().mockResolvedValue([{ id: 'di1', name: 'Mediterranea', regime: 'omnivore', style: 'mediterranean', updatedAt: D('2026-07-11') }]),
        count: jest.fn().mockResolvedValue(1),
      },
      protocol: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    const res = await make(prisma).validationQueue(head);
    // il capo non filtra per paziente (nessun clientId nel where)
    expect(engineDecisionFindMany.mock.calls[0][0].where.clientId).toBeUndefined();
    expect(res.dietsInReview).toHaveLength(1);
    expect((res.engineDecisions[0] as { patientName: string }).patientName).toBe('Zoe');
  });
});

describe('NutritionistService.reviewDecision (scoping per-paziente)', () => {
  it('nutrizionista: rifiuta la revisione se il paziente non è assegnato', async () => {
    const engine = makeEngine();
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p-altrui' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedNutritionistId: 'nut-2' }) },
    };
    await expect(make(prisma, engine).reviewDecision(user, 'dec1', 'confirmed')).rejects.toThrow('non assegnato');
    expect(engine.reviewDecision).not.toHaveBeenCalled();
  });

  it('nutrizionista: revisiona il proprio paziente → delega al motore', async () => {
    const engine = makeEngine();
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p1' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedNutritionistId: 'nut-1' }) },
    };
    await make(prisma, engine).reviewDecision(user, 'dec1', 'corrected', 'nota');
    expect(engine.reviewDecision).toHaveBeenCalledWith('u-nut', 'dec1', 'corrected', 'nota');
  });

  it('capo: revisiona qualsiasi paziente senza controllo di assegnazione', async () => {
    const engine = makeEngine();
    const prisma = {
      engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p-qualsiasi' }) },
    };
    await make(prisma, engine).reviewDecision(head, 'dec1', 'confirmed');
    expect(engine.reviewDecision).toHaveBeenCalled();
  });

  it('decisione inesistente → 404', async () => {
    const prisma = { engineDecision: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(make(prisma).reviewDecision(user, 'x', 'confirmed')).rejects.toThrow('non trovata');
  });
});

/**
 * «CORREGGI»: le azioni ammesse per la causa, e le due che toccano il piano (§15.2 punti 2-4).
 *
 * La tabella causa → azioni non è un suggerimento per l'interfaccia: è la regola. Questi test
 * esistono perché una regola che vive solo nei pulsanti si aggira con una POST.
 */
describe('NutritionistService — azioni sulla decisione', () => {
  const prismaCon = (over: Record<string, unknown> = {}) => ({
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
    engineDecision: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'dec1', clientId: 'p1', reasonKey: 'calo_rapido_energia', flagReason: 'Calo troppo rapido…',
      }),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ assignedNutritionistId: 'nut-1', planHeldAt: null, rapidLossBaselineAt: null }),
      update: jest.fn().mockResolvedValue({}),
    },
    ...over,
  });

  it('calo rapido: offre «autorizza a proseguire», e dice cosa fa PRIMA che sia premuto', async () => {
    const res = await make(prismaCon()).azioniDecisione(user, 'dec1');
    const azioni = res.azioni.map((a) => a.azione);
    expect(azioni).toContain('autorizza_proseguire');
    expect(azioni).toContain('blocca_piano');
    const autorizza = res.azioni.find((a) => a.azione === 'autorizza_proseguire');
    expect(autorizza?.cosaFa).toContain('non cambiano'); // i progressi restano interi
    expect(autorizza?.eseguitaDalServer).toBe(true);
    // «Apri la scheda» e «Scrivi in chat» sono rimandi: non li esegue il backend.
    expect(res.azioni.find((a) => a.azione === 'apri_scheda')?.eseguitaDalServer).toBe(false);
  });

  it('screening: NON offre «autorizza a proseguire» né «blocca il piano»', async () => {
    const prisma = prismaCon({
      engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p1', reasonKey: 'screening', flagReason: 'x' }) },
    });
    const res = await make(prisma).azioniDecisione(user, 'dec1');
    expect(res.azioni.map((a) => a.azione)).toEqual(['apri_scheda', 'scrivi_in_chat']);
  });

  it('un’azione non prevista per quella causa viene RIFIUTATA, non solo nascosta', async () => {
    const prisma = prismaCon({
      engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p1', reasonKey: 'screening', flagReason: 'x' }) },
    });
    await expect(make(prisma).eseguiAzione(user, 'dec1', 'blocca_piano')).rejects.toThrow('non prevista');
  });

  it('«autorizza a proseguire» scrive SOLO il baseline: nessuna misura toccata', async () => {
    const prisma = prismaCon();
    await make(prisma).eseguiAzione(user, 'dec1', 'autorizza_proseguire');
    const data = (prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(['rapidLossBaselineAt']);
    expect(data.rapidLossBaselineAt).toBeInstanceOf(Date);
  });

  it('«blocca il piano» registra CHI l’ha messo: da lì dipende chi può riattivarlo', async () => {
    const prisma = prismaCon();
    await make(prisma).eseguiAzione(user, 'dec1', 'blocca_piano', 'la sento domani');
    const data = (prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data;
    expect(data.planHeldAt).toBeInstanceOf(Date);
    expect(data.planHeldById).toBe('nut-1');
    expect(data.planHeldReason).toBe('la sento domani');
  });

  it('l’azione chiude anche la riga in coda: un gesto solo, non due', async () => {
    const engine = makeEngine();
    await make(prismaCon(), engine).eseguiAzione(user, 'dec1', 'blocca_piano');
    expect(engine.reviewDecision).toHaveBeenCalled();
  });

  /**
   * ⛔ **«ALZA LE CALORIE»: LA COSA CHE QUESTA CODA NON SAPEVA FARE** (28/8, decisione di Simone del
   * 27/8: *«Vera lo chiede al nutrizionista che risponde, e la sua risposta si salva nelle note
   * della scheda cliente»*).
   *
   * Il motore **proponeva** di alzarle (`menu: 'increase_calories'`) e quella proposta non la
   * leggeva nessuno; i due pulsanti registravano soltanto «l'ho letta». Da oggi il nutrizionista
   * scrive di quanto, e il numero arriva nel piatto passando dalla **stessa porta** della scheda.
   */
  describe('⛔ alza le calorie', () => {
    const prismaKcal = (over: Record<string, unknown> = {}, profilo: Record<string, unknown> = {}) =>
      prismaCon({
        // ⚠️ Col `displayName`: senza, la nota si firmava «staff» e il test che dice di verificare
        // «chi» passava lo stesso — cioè non verificava la metà della richiesta di Simone.
        staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1', displayName: 'Dr.ssa Bini' }) },
        clientProfile: {
          findUnique: jest.fn().mockResolvedValue({
            assignedNutritionistId: 'nut-1', planHeldAt: null, rapidLossBaselineAt: null,
            kcalDeficitOverride: null, kcalAdjustPct: null, kcalAdjustUntil: null, name: 'Anna', ...profilo,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        kcalOverride: { create: jest.fn().mockResolvedValue({ id: 'k1' }) },
        clientNote: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
        escalation: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
        user: { findMany: jest.fn().mockResolvedValue([]) },
        notification: { create: jest.fn() },
        ...over,
        // ⚠️ Il tipo si allarga qui e non a ogni uso: `prismaCon` restituisce la forma dei suoi
        // default, e i modelli aggiunti dallo spread TypeScript non li vede.
      }) as unknown as Record<string, Record<string, jest.Mock>>;
    const stima = (target: number) => ({
      bmr: 1300, activityFactor: 1.4, activitySource: 'activity', tdee: 1900, target, deficit: 0,
      floored: false, objective: 'dimagrimento', weightKg: 70, pesoIncoerente: null,
      fonteDeficit: 'nessuno', deficitCalcolato: 0, calcoloDeficit: 'nessuno', correzionePct: 0,
      sottoSoglia: false, tettoApplicato: false, correzioneFinoAl: null, correzioneScaduta: false,
      spiegazione: `${target} kcal/giorno`,
    });
    const kcalNeed = () => makeKcalNeed({
      estimate: jest.fn().mockImplementation((_c: string, sim?: { correzionePct?: number }) =>
        Promise.resolve(stima(sim?.correzionePct ? 1760 : 1600)),
      ),
    });

    it('⛔ è offerta sul calo rapido e sull\'energia bassa, e il server la esegue', async () => {
      const res = await make(prismaKcal()).azioniDecisione(user, 'dec1');
      const alza = res.azioni.find((a) => a.azione === 'alza_calorie');
      expect(alza).toBeDefined();
      expect(alza!.eseguitaDalServer).toBe(true);
      expect(alza!.chiedeUnNumero).toBe(true);
    });

    /**
     * ⛔ **UNA CORREZIONE SCADUTA NON È UNA CORREZIONE IN CORSO.** Il campo non si cancella alla
     * scadenza: si **spegne**, e il valore resta scritto. Mostrandolo grezzo, la finestra avrebbe
     * detto «c'è già un −15%, quello che scrivi la sostituisce» su qualcosa che non tocca il piatto
     * da una settimana — cioè avrebbe fatto esitare qualcuno davanti a un fantasma.
     */
    it('⛔ mostra la correzione in corso, e NON quella già scaduta', async () => {
      const ieri = new Date(Date.now() - 2 * 86_400_000);
      const domani = new Date(Date.now() + 2 * 86_400_000);
      const scaduta = await make(prismaKcal({}, { kcalAdjustPct: -15, kcalAdjustUntil: ieri })).azioniDecisione(user, 'dec1');
      expect(scaduta.correzioneAttualePct).toBeNull();
      const viva = await make(prismaKcal({}, { kcalAdjustPct: -15, kcalAdjustUntil: domani })).azioniDecisione(user, 'dec1');
      expect(viva.correzioneAttualePct).toBe(-15);
      const senzaScadenza = await make(prismaKcal({}, { kcalAdjustPct: -15 })).azioniDecisione(user, 'dec1');
      expect(senzaScadenza.correzioneAttualePct).toBe(-15);
    });

    it('⚠️ ma NON sullo screening: lì non è una domanda sulle calorie', async () => {
      const prisma = prismaKcal({
        engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p1', reasonKey: 'screening', flagReason: 'x' }) },
      });
      const res = await make(prisma).azioniDecisione(user, 'dec1');
      expect(res.azioni.map((a) => a.azione)).not.toContain('alza_calorie');
      await expect(make(prisma).eseguiAzione(user, 'dec1', 'alza_calorie', 'perché sì', { correzionePct: 10 }))
        .rejects.toThrow('non prevista');
    });

    /**
     * ⛔ **LA PROPOSTA DEL MOTORE ARRIVA DAVANTI A CHI DECIDE.** `menu: 'increase_calories'` finiva
     * soltanto nel payload della notifica quotidiana — viaggiava e non cambiava niente. ⚠️ «Non lo
     * leggeva nessuno», come diceva la prima stesura di questa nota, era falso.
     */
    it('⛔ dice che il motore proponeva proprio quello', async () => {
      const prisma = prismaKcal({
        engineDecision: { findUnique: jest.fn().mockResolvedValue({
          id: 'dec1', clientId: 'p1', reasonKey: 'calo_rapido_energia', flagReason: 'x',
          action: { menu: 'increase_calories', tone: 'supportive' },
        }) },
      });
      expect((await make(prisma).azioniDecisione(user, 'dec1')).motoreProponeAumento).toBe(true);
      expect((await make(prismaKcal()).azioniDecisione(user, 'dec1')).motoreProponeAumento).toBe(false);
    });

    it('⛔ senza il numero non parte, e lo dice a parole', async () => {
      const prisma = prismaKcal();
      await expect(make(prisma).eseguiAzione(user, 'dec1', 'alza_calorie', 'energia a terra'))
        .rejects.toThrow('serve di quanto');
      await expect(make(prisma).eseguiAzione(user, 'dec1', 'alza_calorie', 'energia a terra', { correzionePct: 0 }))
        .rejects.toThrow('serve di quanto');
      // ⚠️ E nemmeno in negativo: da questa porta si ALZA. Per ridurre c'è la scheda.
      await expect(make(prisma).eseguiAzione(user, 'dec1', 'alza_calorie', 'energia a terra', { correzionePct: -10 }))
        .rejects.toThrow('serve di quanto');
      expect(prisma.clientProfile.update).not.toHaveBeenCalled();
    });

    it('⛔ e senza motivo nemmeno: è l\'unica cosa che fra tre mesi spiega il numero', async () => {
      const prisma = prismaKcal();
      await expect(make(prisma).eseguiAzione(user, 'dec1', 'alza_calorie', '  ', { correzionePct: 10 }))
        .rejects.toThrow('Scrivi il motivo');
      expect(prisma.clientProfile.update).not.toHaveBeenCalled();
    });

    it('⛔ scrive la correzione, la durata, e chiude la riga in coda', async () => {
      const prisma = prismaKcal();
      const engine = makeEngine();
      const res = await make(prisma, engine, makePersonalBase(), makeAudit(), kcalNeed())
        .eseguiAzione(user, 'dec1', 'alza_calorie', 'energia bassa da due settimane', { correzionePct: 10, perGiorni: 7 });
      const data = (prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data;
      expect(data.kcalAdjustPct).toBe(10);
      expect(data.kcalAdjustUntil).toBeInstanceOf(Date);
      expect(engine.reviewDecision).toHaveBeenCalled();
      expect(res.ok).toBe(true);
    });

    /**
     * ⛔ **IL DEFICIT SCRITTO A MANO NON DEVE SPARIRE.** `impostaKcal` normalizza a `null` quello che
     * non riceve: passando solo la percentuale, un deficit imposto settimane prima svanirebbe in
     * silenzio — cioè «alza del 10%» ne alzerebbe **molte** di più, senza che nessuno l'abbia
     * chiesto. È il difetto più insidioso di questa consegna, e vive in una riga.
     */
    it('⛔ e NON cancella il deficit che il nutrizionista aveva già scritto', async () => {
      const prisma = prismaKcal({}, { kcalDeficitOverride: 400 });
      await make(prisma, makeEngine(), makePersonalBase(), makeAudit(), kcalNeed())
        .eseguiAzione(user, 'dec1', 'alza_calorie', 'energia bassa', { correzionePct: 10, perGiorni: 7 });
      expect((prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data.kcalDeficitOverride).toBe(400);
    });

    /**
     * ⛔ **LA CONFERMA SOTTO SOGLIA ARRIVA FINO IN FONDO.** Alzando le calorie il target sale, quindi
     * la soglia può mordere solo se mordeva già — ed è proprio il caso in cui rifiutare senza dare
     * modo di confermare sarebbe un vicolo cieco con l'aria di un divieto. La mutazione che toglieva
     * `confermaSottoSoglia` dal passaggio restava verde: adesso no.
     */
    it('⛔ la conferma sotto soglia passa dalla coda fino a `impostaKcal`', async () => {
      const sotto = makeKcalNeed({
        estimate: jest.fn().mockImplementation((_c: string, sim?: { correzionePct?: number }) =>
          Promise.resolve({ ...stima(sim?.correzionePct ? 1100 : 1000), sottoSoglia: true }),
        ),
      });
      const prisma = prismaKcal();
      // Senza la spunta il server rifiuta, e il rifiuto porta dentro il numero.
      await expect(
        make(prisma, makeEngine(), makePersonalBase(), makeAudit(), sotto)
          .eseguiAzione(user, 'dec1', 'alza_calorie', 'energia a terra', { correzionePct: 10 }),
      ).rejects.toThrow('soglia minima');
      expect(prisma.clientProfile.update).not.toHaveBeenCalled();
      // Con la spunta passa: il clinico è lui.
      await make(prismaKcal(), makeEngine(), makePersonalBase(), makeAudit(), sotto)
        .eseguiAzione(user, 'dec1', 'alza_calorie', 'energia a terra', { correzionePct: 10, confermaSottoSoglia: true });
    });

    /** ⚠️ E la riga in scheda nasce: è la richiesta di Simone, non un di più. */
    it('⛔ lascia la nota in scheda, con chi, quando, di quanto e perché', async () => {
      const prisma = prismaKcal();
      await make(prisma, makeEngine(), makePersonalBase(), makeAudit(), kcalNeed())
        .eseguiAzione(user, 'dec1', 'alza_calorie', 'energia bassa da due settimane', { correzionePct: 10, perGiorni: 7 });
      const nota = (prisma.clientNote.create as jest.Mock).mock.calls[0][0].data;
      expect(nota.clientId).toBe('p1');
      expect(nota.body).toMatch(/^Aumento calorie autorizzato da /);
      // ⛔ Il NOME di chi ha deciso: è metà della richiesta («autorizzato da… il…»), e senza questa
      // riga il test passava anche con la nota firmata «staff».
      expect(nota.body).toContain('Dr.ssa Bini');
      expect(nota.authorId).toBe('nut-1');
      expect(nota.body).toContain('+10% per 7 giorni');
      expect(nota.body).toContain('da 1600 a 1760 kcal/giorno');
      expect(nota.body).toContain('energia bassa da due settimane');
    });
  });

  it('riattivare: chi NON ha messo il blocco non può toglierlo', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ planHeldAt: new Date(), planHeldById: 'nut-ALTRA' }),
        update: jest.fn(),
      },
    };
    await expect(make(prisma).riattivaPianoFermato(user, 'p1')).rejects.toThrow('può riattivarlo lui');
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
  });

  it('riattivare: il capo può sempre, e ripulisce tutti e tre i campi', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'capo-1' }) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ planHeldAt: new Date(), planHeldById: 'nut-ALTRA' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    await make(prisma).riattivaPianoFermato(head, 'p1');
    expect((prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data).toEqual({
      planHeldAt: null, planHeldReason: null, planHeldById: null,
    });
  });

  it('riattivare un piano che non è fermo → errore chiaro, non un finto ok', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planHeldAt: null, planHeldById: null }), update: jest.fn() },
    };
    await expect(make(prisma).riattivaPianoFermato(user, 'p1')).rejects.toThrow('non è fermo');
  });
});

/**
 * §15.5 — LE CALORIE SCRITTE A MANO.
 *
 * I test guardano tre cose e non i numeri: **cosa viene salvato**, **cosa viene rifiutato** e **chi
 * viene avvisato**. I numeri (l'ordine fra deficit, percentuale e soglie) hanno il loro file, che è
 * `menu/correzione-kcal.spec.ts`: là si prova la regola, qui si prova che intorno alla regola
 * succedano le cose giuste.
 */
describe('NutritionistService — le calorie scritte a mano (§15.5)', () => {
  /** Una stima finta che risponde in base ai valori simulati, come farebbe quella vera. */
  const stimaChe = (target: number, sottoSoglia = false) => ({
    bmr: 1300, activityFactor: 1.4, activitySource: 'activity', tdee: 1900,
    target, deficit: 285, floored: false, objective: 'dimagrimento', weightKg: 70,
    fonteDeficit: 'calcolato', deficitCalcolato: 285, correzionePct: 0,
    sottoSoglia, tettoApplicato: false, spiegazione: `${target} kcal/giorno`,
  });

  const prismaBase = (profilo: Record<string, unknown> = {}) => ({
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        assignedNutritionistId: 'nut-1', kcalDeficitOverride: null, kcalAdjustPct: null, name: 'Anna', ...profilo,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    kcalOverride: { create: jest.fn().mockResolvedValue({ id: 'k1' }), findMany: jest.fn().mockResolvedValue([]) },
    // ⚠️ Dal 28/8 ogni cambio di calorie lascia una riga nelle note della scheda: è la porta da cui
    // la coach guarda cos'è successo a una cliente, e senza questo finto il salvataggio esplode.
    clientNote: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    escalation: { create: jest.fn().mockResolvedValue({ id: 'e1' }), findFirst: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u-capo' }]) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  });

  it('salva i due valori, e nello storico finisce anche il PRIMA e il DOPO in kcal', async () => {
    const prisma = prismaBase();
    const kcal = makeKcalNeed({
      estimate: jest.fn((_c: string, sim?: { deficitImposto?: number | null }) =>
        Promise.resolve(sim ? stimaChe(1450) : stimaChe(1620))),
    });
    const res = await make(prisma, undefined, undefined, undefined, kcal)
      .impostaKcal(user, 'p1', { deficitKcal: 450, correzionePct: -5, motivo: 'ferma da tre settimane a 1600' });

    expect((prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data)
      // ⚠️ `kcalAdjustUntil` dal 14/8 viaggia SEMPRE nella scrittura: senza durata vale `null`,
      // che è «vale finché non la tolgo» — il comportamento di prima, scritto in chiaro.
      .toEqual({ kcalDeficitOverride: 450, kcalAdjustPct: -5, kcalAdjustUntil: null });
    const riga = (prisma.kcalOverride.create as jest.Mock).mock.calls[0][0].data;
    // I valori dicono cosa è stato scritto, il target dice cosa è arrivato nel piatto: servono
    // entrambi, perché in mezzo c'è il fabbisogno, che cambia da solo quando cambia il peso.
    expect(riga).toMatchObject({
      deficitKcal: 450, adjustPct: -5, prevDeficitKcal: null, prevAdjustPct: null,
      targetPrima: 1620, targetDopo: 1450, sottoSoglia: false, motivo: 'ferma da tre settimane a 1600',
      byStaffId: 'nut-1',
    });
    expect(res.targetDopo).toBe(1450);
  });

  it('sotto la soglia SENZA conferma: rifiutato col numero, e non salva niente', async () => {
    const prisma = prismaBase();
    const kcal = makeKcalNeed({
      estimate: jest.fn((_c: string, sim?: unknown) => Promise.resolve(sim ? stimaChe(1000, true) : stimaChe(1620))),
    });
    const s = make(prisma, undefined, undefined, undefined, kcal);
    await expect(s.impostaKcal(user, 'p1', { deficitKcal: 900, motivo: 'caso particolare' }))
      .rejects.toThrow('1000 kcal/giorno');
    // Rifiutare e salvare a metà sarebbe il peggiore dei due mondi.
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
    expect(prisma.kcalOverride.create).not.toHaveBeenCalled();
  });

  it('sotto la soglia CON conferma: salva, lo marca, apre la segnalazione e avvisa i capi', async () => {
    const prisma = prismaBase();
    const kcal = makeKcalNeed({
      estimate: jest.fn((_c: string, sim?: unknown) => Promise.resolve(sim ? stimaChe(1000, true) : stimaChe(1620))),
    });
    const res = await make(prisma, undefined, undefined, undefined, kcal)
      .impostaKcal(user, 'p1', { deficitKcal: 900, motivo: 'caso particolare', confermaSottoSoglia: true });

    expect(res.sottoSoglia).toBe(true);
    expect((prisma.kcalOverride.create as jest.Mock).mock.calls[0][0].data.sottoSoglia).toBe(true);
    // Simone: il capo nutrizionista lo deve SAPERE, non lo deve cercare.
    expect(prisma.escalation.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('azzerare le correzioni è una modifica come le altre: torna al calcolo E resta scritto', async () => {
    const prisma = prismaBase({ kcalDeficitOverride: 450, kcalAdjustPct: -5 });
    const kcal = makeKcalNeed({ estimate: jest.fn().mockResolvedValue(stimaChe(1620)) });
    await make(prisma, undefined, undefined, undefined, kcal)
      .impostaKcal(user, 'p1', { deficitKcal: null, correzionePct: null, motivo: 'ha ripreso a calare, torno al calcolo' });

    expect((prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data)
      // Togliere la correzione toglie anche la sua scadenza: non resta una data appesa a niente.
      .toEqual({ kcalDeficitOverride: null, kcalAdjustPct: null, kcalAdjustUntil: null });
    // «Chi gliele ha tolte» è una domanda che si fa quanto «chi gliele ha messe».
    expect((prisma.kcalOverride.create as jest.Mock).mock.calls[0][0].data)
      .toMatchObject({ deficitKcal: null, adjustPct: null, prevDeficitKcal: 450, prevAdjustPct: -5 });
  });

  it('zero e null sono la stessa cosa: scrivere 0 dove c’era già null non è una modifica', async () => {
    const prisma = prismaBase();
    const s = make(prisma, undefined, undefined, undefined, makeKcalNeed({ estimate: jest.fn().mockResolvedValue(stimaChe(1620)) }));
    await expect(s.impostaKcal(user, 'p1', { deficitKcal: 0, correzionePct: 0, motivo: 'niente' }))
      .rejects.toThrow('già questi');
  });

  it('paziente di un’altra nutrizionista: non si tocca', async () => {
    const prisma = prismaBase({ assignedNutritionistId: 'nut-ALTRA' });
    const s = make(prisma, undefined, undefined, undefined, makeKcalNeed({ estimate: jest.fn().mockResolvedValue(stimaChe(1620)) }));
    await expect(s.impostaKcal(user, 'p1', { deficitKcal: 400, motivo: 'x' })).rejects.toThrow('non assegnato');
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
  });

  it('il capo può scrivere anche sui pazienti che non sono suoi', async () => {
    const prisma = prismaBase({ assignedNutritionistId: 'nut-ALTRA' });
    const kcal = makeKcalNeed({ estimate: jest.fn().mockResolvedValue(stimaChe(1620)) });
    await expect(make(prisma, undefined, undefined, undefined, kcal)
      .impostaKcal(head, 'p1', { deficitKcal: 400, motivo: 'rivisto insieme in studio' })).resolves.toMatchObject({ ok: true });
  });

  it('dopo il salvataggio i giorni futuri si rigenerano: erano sulle calorie vecchie', async () => {
    const prisma = prismaBase();
    const kcal = makeKcalNeed({ estimate: jest.fn().mockResolvedValue(stimaChe(1620)) });
    const menu = makeMenu({ redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 2, delivered: ['a', 'b'], ripristinati: 0 }) });
    const res = await make(prisma, undefined, undefined, undefined, kcal, menu)
      .impostaKcal(user, 'p1', { deficitKcal: 400, motivo: 'x' });
    expect((menu as unknown as { redeliverFutureDays: jest.Mock }).redeliverFutureDays).toHaveBeenCalledWith('p1');
    expect(res.menu).toMatchObject({ removed: 2, ripristinati: 0 });
  });

  it('se la rigenerazione non produce niente lo si dice, invece di far credere che sia fatta', async () => {
    const prisma = prismaBase();
    const kcal = makeKcalNeed({ estimate: jest.fn().mockResolvedValue(stimaChe(1620)) });
    const menu = makeMenu({ redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [], ripristinati: 2 }) });
    const res = await make(prisma, undefined, undefined, undefined, kcal, menu)
      .impostaKcal(user, 'p1', { deficitKcal: 400, motivo: 'x' });
    // La modifica è salvata, ma nel piatto non è ancora arrivata: sono due fatti diversi.
    expect(res.ok).toBe(true);
    expect(res.menu.ripristinati).toBe(2);
  });

  it('il quadro calorico esce insieme allo storico: il valore da solo non spiega niente', async () => {
    const prisma = prismaBase({ kcalDeficitOverride: 450, kcalAdjustPct: null });
    prisma.kcalOverride.findMany = jest.fn().mockResolvedValue([{ id: 'k1', motivo: 'ferma da tre settimane' }]);
    const kcal = makeKcalNeed({ estimate: jest.fn().mockResolvedValue(stimaChe(1450)) });
    const res = await make(prisma, undefined, undefined, undefined, kcal).kcalCliente(user, 'p1');
    expect(res.valori).toEqual({ deficitKcal: 450, correzionePct: null });
    expect(res.storico).toHaveLength(1);
    expect((prisma.kcalOverride.findMany as jest.Mock).mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });

  it('la simulazione non salva niente: serve a vedere prima, non a scoprire dopo', async () => {
    const prisma = prismaBase();
    const kcal = makeKcalNeed({
      estimate: jest.fn((_c: string, sim?: unknown) => Promise.resolve(sim ? stimaChe(1000, true) : stimaChe(1620))),
    });
    const res = await make(prisma, undefined, undefined, undefined, kcal).simulaKcal(user, 'p1', 900, null);
    expect(res.prima?.target).toBe(1620);
    expect(res.dopo?.target).toBe(1000);
    expect(res.dopo?.sottoSoglia).toBe(true);
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
    expect(prisma.kcalOverride.create).not.toHaveBeenCalled();
  });
});

/**
 * LA CORREZIONE A TERMINE (risposta di Nocanty, 13/8): «riduci le kcal del 10% per 7 giorni e poi
 * riprendi col normale ritmo». Decisione in progetto/NOTA_Correzione_Kcal_A_Termine.md.
 */
/**
 * ⛔ **«NON L'HO SCRITTO» NON È «TOGLILO»** — la regola trovata in revisione il 28/8, e il difetto
 * che ha scoperto: ogni volta che la nutrizionista dettava a Vera «aumenta le calorie del 10%», un
 * **deficit imposto** scritto a mano settimane prima spariva in silenzio, perché `impostaKcal`
 * normalizzava a `null` tutto quello che non riceveva.
 *
 * ⚠️ I due test qui sotto tengono ferme **tutte e due** le leve, e la seconda non è teoria: è la
 * stessa trappola dall'altro verso, e la prossima porta che chiamerà questo metodo con una leva sola
 * la troverebbe uguale.
 */
describe('⛔ le leve che non vengono nominate restano come sono', () => {
  const stima = (target: number) => ({
    bmr: 1300, activityFactor: 1.4, activitySource: 'activity', tdee: 1900, target, deficit: 0,
    floored: false, objective: 'dimagrimento', weightKg: 70, pesoIncoerente: null,
    fonteDeficit: 'nessuno', deficitCalcolato: 0, calcoloDeficit: 'nessuno', correzionePct: 0,
    sottoSoglia: false, tettoApplicato: false, correzioneFinoAl: null, correzioneScaduta: false,
    spiegazione: `${target} kcal/giorno`,
  });
  const prismaCon2 = (profilo: Record<string, unknown>) => ({
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1', displayName: 'Dr.ssa Bini' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        assignedNutritionistId: 'nut-1', kcalDeficitOverride: null, kcalAdjustPct: null,
        kcalAdjustUntil: null, name: 'Anna', ...profilo,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    kcalOverride: { create: jest.fn().mockResolvedValue({ id: 'k1' }) },
    clientNote: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    escalation: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn() },
  });
  const servizio = (prisma: Record<string, unknown>) =>
    make(prisma, makeEngine(), makePersonalBase(), makeAudit(), makeKcalNeed({
      estimate: jest.fn().mockResolvedValue(stima(1600)),
    }));

  it('⛔ scrivendo SOLO la percentuale, il deficit imposto resta dov\'è', async () => {
    const prisma = prismaCon2({ kcalDeficitOverride: 400 });
    await servizio(prisma).impostaKcal(user, 'p1', { correzionePct: 10, motivo: 'energia bassa' });
    expect((prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data.kcalDeficitOverride).toBe(400);
  });

  it('⛔ e scrivendo SOLO il deficit, la percentuale e la sua scadenza restano dove sono', async () => {
    const fino = new Date('2026-09-04T00:00:00.000Z');
    const prisma = prismaCon2({ kcalAdjustPct: -10, kcalAdjustUntil: fino });
    await servizio(prisma).impostaKcal(user, 'p1', { deficitKcal: 300, motivo: 'ricalibro' });
    const data = (prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data;
    expect(data.kcalAdjustPct).toBe(-10);
    // ⚠️ **E la scadenza con lei.** Ricalcolarla da `perGiorni` assente trasformerebbe in silenzio
    // una correzione a termine in una permanente — cioè la differenza fra una settimana di scarico
    // e un cambio di piano.
    expect(data.kcalAdjustUntil).toEqual(fino);
  });

  it('⚠️ mentre chi la nomina la cambia davvero: `null` toglie', async () => {
    const prisma = prismaCon2({ kcalDeficitOverride: 400, kcalAdjustPct: -10 });
    await servizio(prisma).impostaKcal(user, 'p1', { deficitKcal: null, correzionePct: -10, motivo: 'tolgo il deficit' });
    const data = (prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data;
    expect(data.kcalDeficitOverride).toBeNull();
    expect(data.kcalAdjustPct).toBe(-10);
  });
});

describe('NutritionistService — la correzione con una durata', () => {
  const stima = (target: number) => ({
    bmr: 1300, activityFactor: 1.4, activitySource: 'activity', tdee: 1900,
    target, deficit: 285, floored: false, objective: 'dimagrimento', weightKg: 70,
    fonteDeficit: 'calcolato', deficitCalcolato: 285, correzionePct: 0,
    sottoSoglia: false, tettoApplicato: false, correzioneFinoAl: null, correzioneScaduta: false,
    spiegazione: `${target} kcal/giorno`,
  });
  const prismaBase = (profilo: Record<string, unknown> = {}) => ({
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        assignedNutritionistId: 'nut-1', kcalDeficitOverride: null, kcalAdjustPct: null,
        kcalAdjustUntil: null, name: 'Anna', ...profilo,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    kcalOverride: { create: jest.fn().mockResolvedValue({ id: 'k1' }), findMany: jest.fn().mockResolvedValue([]) },
    // ⚠️ Dal 28/8 ogni cambio di calorie lascia una riga nelle note della scheda: è la porta da cui
    // la coach guarda cos'è successo a una cliente, e senza questo finto il salvataggio esplode.
    clientNote: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    escalation: { create: jest.fn().mockResolvedValue({ id: 'e1' }), findFirst: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u-capo' }]) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  });
  const kcalFinta = () => makeKcalNeed({ estimate: jest.fn(() => Promise.resolve(stima(1450))) });

  it('«−10% per 7 giorni» scrive anche la scadenza, e l\'ultimo giorno è compreso', async () => {
    const prisma = prismaBase();
    await make(prisma, undefined, undefined, undefined, kcalFinta())
      .impostaKcal(user, 'p1', { correzionePct: -10, perGiorni: 7, motivo: 'settimana di scarico' });
    const dati = (prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data;
    expect(dati.kcalAdjustPct).toBe(-10);
    const atteso = aGiorno(new Date());
    atteso.setUTCHours(0, 0, 0, 0);
    atteso.setUTCDate(atteso.getUTCDate() + 6);
    expect((dati.kcalAdjustUntil as Date).toISOString().slice(0, 10)).toBe(atteso.toISOString().slice(0, 10));
  });

  it('senza durata la correzione resta come prima: vale finché non la tolgono', async () => {
    const prisma = prismaBase();
    await make(prisma, undefined, undefined, undefined, kcalFinta())
      .impostaKcal(user, 'p1', { correzionePct: -10, motivo: 'stima alta' });
    expect((prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data.kcalAdjustUntil).toBeNull();
  });

  it('⚠️ togliere la correzione toglie anche la scadenza: non resta una data appesa a niente', async () => {
    const prisma = prismaBase({ kcalAdjustPct: -10, kcalAdjustUntil: new Date('2026-08-21') });
    await make(prisma, undefined, undefined, undefined, kcalFinta())
      .impostaKcal(user, 'p1', { correzionePct: null, motivo: 'ripresa normale' });
    const dati = (prisma.clientProfile.update as jest.Mock).mock.calls[0][0].data;
    expect(dati.kcalAdjustPct).toBeNull();
    expect(dati.kcalAdjustUntil).toBeNull();
  });

  it('la durata finisce nello storico: si deve poter dire «per quanti giorni» era', async () => {
    const prisma = prismaBase();
    await make(prisma, undefined, undefined, undefined, kcalFinta())
      .impostaKcal(user, 'p1', { correzionePct: -10, perGiorni: 7, motivo: 'settimana di scarico' });
    expect((prisma.kcalOverride.create as jest.Mock).mock.calls[0][0].data.motivo).toContain('7 giorni');
  });

  it('⚠️ cambiare SOLO la durata è un cambiamento vero: non è «non c\'è niente da cambiare»', async () => {
    const prisma = prismaBase({ kcalAdjustPct: -10, kcalAdjustUntil: null });
    await expect(
      make(prisma, undefined, undefined, undefined, kcalFinta())
        .impostaKcal(user, 'p1', { correzionePct: -10, perGiorni: 7, motivo: 'la chiudo a sette giorni' }),
    ).resolves.toBeDefined();
  });
});
