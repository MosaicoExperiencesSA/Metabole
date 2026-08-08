import { apriSegnalazione } from './apri-segnalazione';

/**
 * Il caso vero, quello che ha fatto scrivere questa funzione (9/8).
 *
 * Rosaria si iscrive il 20 luglio: dichiara una condizione clinica e un'allergia al pesce, il
 * motore non riesce a comporre un piano sicuro (pranzo 0, cena 0 ricette compatibili) e apre la
 * segnalazione «Piano bloccato». Non aveva ancora una nutrizionista assegnata, quindi la
 * segnalazione nasceva **senza destinatario**: nessuna notifica, nessuno che la vedesse se non
 * andando a cercare l'elenco. Quattro giorni di menu senza pranzo né cena, prova gratuita
 * scaduta il 30 luglio, venti giorni di silenzio. Nessun errore da nessuna parte.
 */
function harness(over: Record<string, unknown> = {}) {
  return {
    escalation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'esc-1', ...data })),
    },
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: null, name: 'Rosaria' }) },
    staff: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'staff-capo', userId: 'user-capo' }),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
    ...over,
  } as any;
}

describe('apriSegnalazione', () => {
  it('nessuna nutrizionista assegnata → la prende in carico il CAPO, e viene avvisato', async () => {
    const prisma = harness();
    await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'diet_blocked', reason: 'pranzo 0, cena 0' });

    // Prima restava «non assegnata a nessuno»: in elenco è esattamente quella che nessuno guarda.
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: 'staff-capo' }) }),
    );
    expect(prisma.staff.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { role: 'head_nutritionist' } } }),
    );
    const notifica = prisma.notification.create.mock.calls[0][0].data;
    expect(notifica.userId).toBe('user-capo');
    expect(notifica.type).toBe('escalation_diet_blocked');
    expect(notifica.payload.nonAssegnata).toBe(true);
    expect(notifica.payload.body).toContain('Rosaria');
  });

  it('con la nutrizionista assegnata la prende lei, e l’avviso arriva anche alla coach', async () => {
    const prisma = harness({
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'staff-coach', assignedNutritionistId: 'staff-nutri', name: 'Anna' }) },
      staff: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'staff-coach', userId: 'user-coach' },
          { id: 'staff-nutri', userId: 'user-nutri' },
        ]),
        findFirst: jest.fn(),
      },
    });
    await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'diet_blocked', reason: 'x' });

    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: 'staff-nutri' }) }),
    );
    // Il capo non viene disturbato: c'è già chi la prende.
    expect(prisma.staff.findFirst).not.toHaveBeenCalled();
    const destinatari = prisma.notification.create.mock.calls.map((c: any) => c[0].data.userId);
    expect(destinatari.sort()).toEqual(['user-coach', 'user-nutri']);
  });

  it('una segnalazione aperta della stessa categoria non si duplica', async () => {
    const prisma = harness({ escalation: { findFirst: jest.fn().mockResolvedValue({ id: 'gia-aperta' }), create: jest.fn() } });
    const res = await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'diet_blocked', reason: 'x' });
    expect(res).toEqual({ id: 'gia-aperta' });
    expect(prisma.escalation.create).not.toHaveBeenCalled();
  });

  /**
   * Aggiornato l'8/8 con un contratto MIGLIORE di quello di prima. Se la lettura del profilo cade,
   * la segnalazione non veniva creata affatto; ora nasce **orfana** e la si adotta con
   * `npm run fix:segnalazioni`. In entrambi i casi l'eccezione non risale — che era il punto del
   * test — ma un allarme clinico che esiste vale più di uno perduto per un intoppo del database.
   */
  it('se la lettura del profilo esplode, non risale l\'eccezione e la segnalazione nasce comunque', async () => {
    const prisma = harness({ clientProfile: { findUnique: jest.fn().mockRejectedValue(new Error('db giù')) } });
    const res = await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'diet_blocked', reason: 'x' });
    expect(res).not.toBeNull();
    expect(prisma.escalation.create).toHaveBeenCalled();
    expect(prisma.escalation.create.mock.calls[0][0].data.assignedToId).toBeUndefined();
  });
});

/**
 * «NUTRIZIONISTA RICHIESTO» (regola di Simone, 8/8): c'è un solo nutrizionista, il capo, e le
 * clienti non ne hanno una assegnata. Quando ne serve uno si avvisa la COACH con questa etichetta,
 * «così aiutano nella gestione».
 *
 * La coach la notifica la riceveva già; quello che le mancava era sapere **cosa deve fare**. Il
 * titolo della categoria («Sicurezza clinica») racconta cosa è successo, non di chi è la palla.
 */
describe('apriSegnalazione — quando il nutrizionista non c\'è', () => {
  const conCoach = () =>
    harness({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'staff-coach', assignedNutritionistId: null, name: 'Giusy' }),
      },
      staff: {
        findMany: jest.fn().mockResolvedValue([{ id: 'staff-coach', userId: 'user-coach' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-capo', userId: 'user-capo' }),
      },
    });

  const notificaA = (prisma: any, userId: string) =>
    prisma.notification.create.mock.calls.map((c: any) => c[0].data).find((d: any) => d.userId === userId);

  it('alla coach arriva «Nutrizionista richiesto», non l\'etichetta della categoria', async () => {
    const prisma = conCoach();
    await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'clinical', reason: 'Calo rapido: 2.87 kg/settimana' });
    const perCoach = notificaA(prisma, 'user-coach');
    expect(perCoach.payload.title).toBe('Nutrizionista richiesto');
    expect(perCoach.payload.nutrizionistaRichiesto).toBe(true);
    // Il motivo resta nel corpo: la coach deve sapere di cosa si tratta, non solo che serve aiuto.
    expect(perCoach.payload.body).toContain('Calo rapido');
  });

  it('al capo nutrizionista arriva la segnalazione normale, non l\'etichetta della coach', async () => {
    const prisma = conCoach();
    await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'clinical', reason: 'x' });
    const perCapo = notificaA(prisma, 'user-capo');
    expect(perCapo.payload.title).not.toBe('Nutrizionista richiesto');
    expect(perCapo.payload.nutrizionistaRichiesto).toBe(false);
  });

  it('se la nutrizionista C\'È, alla coach torna l\'etichetta normale', async () => {
    const prisma = harness({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'staff-coach', assignedNutritionistId: 'staff-nutri', name: 'Giulia' }),
      },
      staff: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'staff-coach', userId: 'user-coach' },
          { id: 'staff-nutri', userId: 'user-nutri' },
        ]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });
    await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'clinical', reason: 'x' });
    expect(notificaA(prisma, 'user-coach').payload.nutrizionistaRichiesto).toBe(false);
    // E il capo non viene disturbato: c'è chi se ne occupa.
    expect(notificaA(prisma, 'user-capo')).toBeUndefined();
  });
});

/**
 * L'ORDINE fra decidere e creare. Sembra un dettaglio interno ed è la differenza fra una
 * segnalazione riparabile e un allarme clinico perduto.
 */
describe('apriSegnalazione — la segnalazione vale più del suo instradamento', () => {
  it('se la ricerca dei destinatari esplode, la segnalazione NASCE comunque (orfana)', async () => {
    const prisma = harness({
      // Il database fa i capricci proprio sulla lettura che serve a decidere a chi darla.
      staff: {
        findFirst: jest.fn().mockRejectedValue(new Error('connessione persa')),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const res = await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'clinical', reason: 'Calo rapido' });
    expect(res).not.toBeNull();
    expect(prisma.escalation.create).toHaveBeenCalled();
    // Nasce senza destinatario: la si adotta con `npm run fix:segnalazioni`.
    expect(prisma.escalation.create.mock.calls[0][0].data.assignedToId).toBeUndefined();
    // E nessuna notifica, perché non sappiamo a chi: meglio muta che sbagliata.
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('se invece è la CREATE a fallire, non si finge che sia andata', async () => {
    const prisma = harness({
      escalation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(new Error('vincolo violato')),
      },
    });
    await expect(apriSegnalazione(prisma, { clientId: 'cli-1', category: 'clinical', reason: 'x' })).resolves.toBeNull();
  });
});
