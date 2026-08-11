import { PrismaService } from '../prisma/prisma.service';
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
const make = (
  prisma: Record<string, unknown>,
  engine: EngineService = makeEngine(),
  personalBase = makePersonalBase(),
  audit = makeAudit(),
) => new NutritionistService(prisma as unknown as PrismaService, engine, personalBase, audit);

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
