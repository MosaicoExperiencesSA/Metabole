import {
  RISERVA_SPENTA,
  assegnaLaRiserva,
  clientiSenzaCoach,
  coachDiRiserva,
  giudicaLaRiserva,
  type ClienteSenzaCoach,
  type RigaDiRegistro,
  type SchedaPerRiserva,
} from './coach-di-riserva';

/**
 * ⛔ **LA COACH DI RISERVA (Simone, 4/9): «tutte le clienti non assegnate ad una coach vanno a
 * Giusy», anche quelle che verranno, con un parametro.**
 *
 * Queste prove tengono ferme tre cose: che una `sales` **possa** fare da riserva (è il caso vero),
 * che una riserva non valida **non faccia niente e lo dica**, e che la scrittura passi dal ponte del
 * 6/8 — cioè riempia il vuoto e non sovrascriva mai.
 */

const giusy: SchedaPerRiserva = {
  id: 'st-giusy', userId: 'u-giusy', displayName: 'Giusy Vita', active: true,
  user: { role: 'sales', status: 'active', deletedAt: null },
};

describe('giudicaLaRiserva: chi può fare da riserva', () => {
  /** ⛔ Il caso vero: Giusy è `sales`, non `coach`. Se questa riga diventa rossa, la decisione del 4/9 non regge più. */
  it('⛔ una commerciale attiva può fare da riserva', () => {
    expect(giudicaLaRiserva('st-giusy', giusy)).toEqual({
      esito: 'ok', staffId: 'st-giusy', userId: 'u-giusy', displayName: 'Giusy Vita', role: 'sales',
    });
  });

  it('⚠️ e anche una coach o una coordinatrice', () => {
    expect(giudicaLaRiserva('x', { ...giusy, user: { ...giusy.user!, role: 'coach' } }).esito).toBe('ok');
    expect(giudicaLaRiserva('x', { ...giusy, user: { ...giusy.user!, role: 'coach_coordinator' } }).esito).toBe('ok');
  });

  /** ⛔ La nutrizionista ha la sua regola, e chi sta in `assignedCoachId` riceve i compiti della coach. */
  it('⛔ una nutrizionista no: il ruolo non fa da coach', () => {
    const v = giudicaLaRiserva('x', { ...giusy, user: { ...giusy.user!, role: 'nutritionist' } });
    expect(v.esito).toBe('non_valida');
    expect((v as { motivo: string }).motivo).toContain('non fa da coach');
  });

  it('⚠️ «off», vuoto, «nessuna» e simili spengono la regola senza guardare la scheda', () => {
    for (const v of [RISERVA_SPENTA, '', '  ', 'no', '-', 'nessuna', 'OFF']) {
      expect(giudicaLaRiserva(v, giusy)).toEqual({ esito: 'spenta' });
    }
  });

  /** ⛔ Non valida ≠ spenta: la regola non fa niente in tutti e due i casi, ma nel secondo lo dice. */
  it('⛔ un id che non esiste è «non valida», con il motivo, e non «spenta»', () => {
    const v = giudicaLaRiserva('st-che-non-esiste', null);
    expect(v.esito).toBe('non_valida');
    expect((v as { motivo: string }).motivo).toContain('nessuna scheda');
  });

  it('⚠️ una scheda archiviata, un utente sospeso o cancellato non fanno da riserva', () => {
    expect(giudicaLaRiserva('x', { ...giusy, active: false }).esito).toBe('non_valida');
    expect(giudicaLaRiserva('x', { ...giusy, user: { ...giusy.user!, status: 'suspended' } }).esito).toBe('non_valida');
    expect(giudicaLaRiserva('x', { ...giusy, user: { ...giusy.user!, deletedAt: new Date() } }).esito).toBe('non_valida');
    expect(giudicaLaRiserva('x', { ...giusy, user: null }).esito).toBe('non_valida');
  });

  it('⚠️ senza nome in scheda si usa il ruolo, così una riga di registro non resta vuota', () => {
    const v = giudicaLaRiserva('x', { ...giusy, displayName: '  ' });
    expect((v as { displayName: string }).displayName).toBe('sales');
  });
});

describe('coachDiRiserva: legge il parametro e la scheda', () => {
  it('⚠️ con la riga assente il ripiego è «off»: non un errore', async () => {
    const findUnique = jest.fn();
    const v = await coachDiRiserva({ staff: { findUnique } }, { getString: async (_k, d) => d ?? '' });
    expect(v).toEqual({ esito: 'spenta' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('⛔ con un id legge la scheda e giudica', async () => {
    const findUnique = jest.fn().mockResolvedValue(giusy);
    const v = await coachDiRiserva({ staff: { findUnique } }, { getString: async () => ' st-giusy ' });
    expect(v.esito).toBe('ok');
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'st-giusy' } }));
  });
});

describe('clientiSenzaCoach: si contano le clienti, non i profili', () => {
  it('⛔ chiede gli utenti cliente vivi senza scheda O con la coach vuota', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'u1', email: 'a@x.it', createdAt: new Date('2026-08-01'), clientProfile: null },
      { id: 'u2', email: 'b@x.it', createdAt: new Date('2026-08-02'), clientProfile: { name: 'B', assignedCoachId: null, onboardingCompletedAt: new Date('2026-08-03') } },
    ]);
    const out = await clientiSenzaCoach({ user: { findMany } });
    const where = findMany.mock.calls[0][0].where;
    expect(where.role).toBe('client');
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toEqual([{ clientProfile: null }, { clientProfile: { assignedCoachId: null } }]);
    // Un lead con una coach che deve ancora accettare non è «senza coach».
    expect(where.NOT).toEqual({ crmRecord: { assignedCoachId: { not: null } } });
    expect(out.map((c) => [c.userId, c.haScheda, c.nome])).toEqual([['u1', false, null], ['u2', true, 'B']]);
  });
});

describe('assegnaLaRiserva: riempie il vuoto, non sovrascrive, e scrive il registro', () => {
  const riserva = { staffId: 'st-giusy', displayName: 'Giusy Vita' };
  const clienti: ClienteSenzaCoach[] = [
    { userId: 'u1', email: 'a@x.it', nome: null, registrataIl: new Date(), haScheda: false, questionarioIl: null },
    { userId: 'u2', email: 'b@x.it', nome: 'B', registrataIl: new Date(), haScheda: true, questionarioIl: new Date() },
    { userId: 'u3', email: 'c@x.it', nome: 'C', registrataIl: new Date(), haScheda: true, questionarioIl: new Date() },
  ];

  function prismaFinto(profili: Record<string, { assignedCoachId: string | null } | null>) {
    return {
      configParam: { findUnique: jest.fn().mockResolvedValue({ value: 'st-giusy' }) },
      clientProfile: {
        findUnique: jest.fn(async ({ where }: { where: { userId: string } }) =>
          profili[where.userId] === null ? null : { assignedCoachId: profili[where.userId]?.assignedCoachId ?? null, assignedNutritionistId: null }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
  }

  it('⛔ crea la scheda a chi non ce l\'ha, riempie il vuoto a chi ce l\'ha, e NON tocca chi nel frattempo è di qualcuno', async () => {
    const prisma = prismaFinto({ u1: null, u2: { assignedCoachId: null }, u3: { assignedCoachId: 'st-altra' } });
    const registro: RigaDiRegistro[] = [];
    const esito = await assegnaLaRiserva(prisma as never, riserva, clienti, 'giro_notturno', async (r) => { registro.push(r); });

    expect(esito).toEqual({ assegnate: 2, schedeCreate: 1, giaAssegnate: 1 });
    expect(prisma.clientProfile.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', assignedCoachId: 'st-giusy' }) }));
    expect(prisma.clientProfile.update).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u2' }, data: { assignedCoachId: 'st-giusy' } }));
    expect(prisma.clientProfile.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u3' } }));
  });

  /** ⛔ Una riga per cliente assegnata, con la porta: fra un mese si sa perché quella cliente è di Giusy. */
  it('⛔ scrive una riga di registro per ogni cliente assegnata, con la porta, e nessuna per chi non è stata toccata', async () => {
    const prisma = prismaFinto({ u1: null, u2: { assignedCoachId: null }, u3: { assignedCoachId: 'st-altra' } });
    const registro: RigaDiRegistro[] = [];
    await assegnaLaRiserva(prisma as never, riserva, clienti, 'script', async (r) => { registro.push(r); }, 'admin-1');

    expect(registro.map((r) => r.entityId)).toEqual(['u1', 'u2']);
    expect(registro[0]).toMatchObject({
      action: 'assegnazione.coach_di_riserva', actorId: 'admin-1', entityType: 'client_profile',
      metadata: { staffId: 'st-giusy', coach: 'Giusy Vita', porta: 'script', schedaCreata: true },
    });
    expect(registro[1].metadata.schedaCreata).toBe(false);
  });
});
