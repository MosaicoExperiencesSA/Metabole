import { ForbiddenException } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AlertsService } from './alerts.service';

const dayIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

interface PrismaMock {
  clientProfile: { findUnique: jest.Mock; findMany: jest.Mock };
  measurement: { findMany: jest.Mock };
  dailyCheckin: { findMany: jest.Mock };
  recipeRating: { findMany: jest.Mock };
  waterLog: { findMany: jest.Mock };
  event: { findFirst: jest.Mock };
  escalation: { findFirst: jest.Mock };
  milestone: { findFirst: jest.Mock };
  analyticsEvent: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock };
  staff: { findUnique: jest.Mock };
  alert: { findMany: jest.Mock; createMany: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
}

function basePrisma(over: Partial<Record<string, unknown>> = {}): PrismaMock {
  return {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'coach-1', character: 'follows', planStartDate: D(dayIso(-10)) }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    measurement: { findMany: jest.fn().mockResolvedValue([]) },
    dailyCheckin: { findMany: jest.fn().mockResolvedValue([]) },
    recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
    waterLog: { findMany: jest.fn().mockResolvedValue([]) },
    event: { findFirst: jest.fn().mockResolvedValue(null) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null) },
    milestone: { findFirst: jest.fn().mockResolvedValue(null) },
    analyticsEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    // `coachTeamScope` legge il ruolo da prisma.user prima di arrivare a staff.
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
    alert: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    ...(over as Record<string, never>),
  } as PrismaMock;
}

function makeService(
  prisma: PrismaMock,
  gate = { blocking: false, cycleDate: null as string | null },
  // ⚠️ Le soglie normalmente sono i default; questo terzo argomento serve a un test solo, dove la
  // finestra dell'aumento e quella dello stallo devono essere DIVERSE fra loro in modo netto.
  soglie: Record<string, number> = {},
) {
  const config = { getNumber: jest.fn((k: string, d?: number) => Promise.resolve(k in soglie ? soglie[k] : d ?? 0)) };
  const menu = { measurementGate: jest.fn().mockResolvedValue({ required: gate.blocking, blocking: gate.blocking, cycleDate: gate.cycleDate }) };
  return new AlertsService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigParamsService,
    menu as unknown as MenuService,
  );
}

const createdTypes = (prisma: PrismaMock): string[] => {
  const call = prisma.alert.createMany.mock.calls[0];
  return call ? (call[0].data as { type: string }[]).map((d) => d.type) : [];
};

describe('AlertsService.recompute', () => {
  it('crea missing_measurements quando il gate blocca', async () => {
    const prisma = basePrisma();
    const svc = makeService(prisma, { blocking: true, cycleDate: dayIso(-1) });
    const res = await svc.recompute('c1');
    expect(createdTypes(prisma)).toContain('missing_measurements');
    expect(prisma.alert.createMany.mock.calls[0][0].data[0].coachId).toBe('coach-1');
    expect(res.resolved).toBe(0);
  });

  describe('⚠️ «gestito» scade dopo sette giorni (Simone, 12/8)', () => {
    const gestito = (giorniFa: number) => ({
      id: 'a-vecchio',
      type: 'missing_measurements',
      status: 'handled',
      handledAt: new Date(Date.now() - giorniFa * 86_400_000),
    });

    it('un gestito vecchio la cui condizione VALE ANCORA torna «open»', async () => {
      // Senza, la coach non lo rivede mai più: sparisce dalla sua lista e da quella del manager.
      const prisma = basePrisma();
      prisma.alert.findMany.mockResolvedValue([gestito(9)]);
      const svc = makeService(prisma, { blocking: true, cycleDate: dayIso(-1) });
      await svc.recompute('c1');

      const riaperture = prisma.alert.updateMany.mock.calls.filter((c) => c[0].data.status === 'open');
      expect(riaperture).toHaveLength(1);
      expect(riaperture[0][0].where.id.in).toEqual(['a-vecchio']);
      // La data si azzera: è la data di QUESTO gestito, non dell'ultimo di sempre.
      expect(riaperture[0][0].data.handledAt).toBeNull();
      // E NON se ne crea uno nuovo: la riga è la stessa, con la sua storia.
      expect(createdTypes(prisma)).not.toContain('missing_measurements');
    });

    it('un gestito recente resta gestito: ci sta ancora lavorando', async () => {
      const prisma = basePrisma();
      prisma.alert.findMany.mockResolvedValue([gestito(2)]);
      const svc = makeService(prisma, { blocking: true, cycleDate: dayIso(-1) });
      await svc.recompute('c1');
      expect(prisma.alert.updateMany.mock.calls.filter((c) => c[0].data.status === 'open')).toHaveLength(0);
    });

    it('⚠️ se la condizione è passata non si riapre: si CHIUDE, come sempre', async () => {
      // Il gate non blocca più → `missing_measurements` non è più desiderato. La via normale lo
      // risolve; riaprirlo vorrebbe dire rimettere in lista un problema che non c'è più.
      const prisma = basePrisma();
      prisma.alert.findMany.mockResolvedValue([gestito(30)]);
      const svc = makeService(prisma, { blocking: false, cycleDate: null });
      await svc.recompute('c1');
      const chiamate = prisma.alert.updateMany.mock.calls;
      expect(chiamate.filter((c) => c[0].data.status === 'open')).toHaveLength(0);
      expect(chiamate.filter((c) => c[0].data.status === 'resolved')).toHaveLength(1);
    });
  });

  it('rileva aumento di peso negli ultimi giorni', async () => {
    const prisma = basePrisma();
    prisma.measurement.findMany.mockResolvedValue([
      { date: D(dayIso(-5)), weightKg: 70 },
      { date: D(dayIso(-1)), weightKg: 71.2 },
    ]);
    const svc = makeService(prisma); // getNumber restituisce il default (weightGainDays=7)
    await svc.recompute('c1');
    expect(createdTypes(prisma)).toContain('weight_gain');
  });

  /**
   * ⛔ **PESATE CHE NON POSSONO ESSERE DELLA STESSA PERSONA** (28/8, richiesta di Simone).
   *
   * ⚠️ Il secondo test è il più importante dei due: senza di lui la coda della coach avrebbe
   * mostrato *«+20 kg negli ultimi 7 giorni»* — una frase su un corpo, costruita su un numero
   * digitato male. **Una ragione falsa è peggio di un ordine sbagliato.**
   */
  describe('⛔ pesate incoerenti', () => {
    const ROTTE = [
      { date: D(dayIso(-5)), weightKg: 70 },
      { date: D(dayIso(-1)), weightKg: 90 },
    ];

    it('⛔ apre l\'avviso quando due pesate consecutive non stanno in piedi', async () => {
      const prisma = basePrisma();
      prisma.measurement.findMany.mockResolvedValue(ROTTE);
      await makeService(prisma).recompute('c1');
      expect(createdTypes(prisma)).toContain('weight_incoherent');
    });

    it('⛔ e in quella finestra NON racconta un aumento di peso che non è mai avvenuto', async () => {
      const prisma = basePrisma();
      prisma.measurement.findMany.mockResolvedValue(ROTTE);
      await makeService(prisma).recompute('c1');
      expect(createdTypes(prisma)).not.toContain('weight_gain');
      expect(createdTypes(prisma)).not.toContain('plateau');
    });

    /**
     * ⚠️ **Ogni finestra si controlla per conto suo.** Un salto di due mesi fa sospende il
     * fabbisogno (novanta giorni), ma non deve zittire l'aumento di peso di questa settimana — che
     * è vero e la coach lo deve vedere.
     */
    it('⚠️ un salto vecchio non zittisce l\'aumento di peso di questa settimana', async () => {
      const prisma = basePrisma();
      const righe = [
        { date: D(dayIso(-60)), weightKg: 60 },
        { date: D(dayIso(-55)), weightKg: 95 },
        { date: D(dayIso(-5)), weightKg: 70 },
        { date: D(dayIso(-1)), weightKg: 71.2 },
      ];
      prisma.measurement.findMany.mockImplementation(({ where }: never) => {
        const gte = (where as { date?: { gte?: Date } })?.date?.gte;
        return Promise.resolve(gte ? righe.filter((r) => r.date.getTime() >= gte.getTime()) : righe);
      });
      await makeService(prisma).recompute('c1');
      expect(createdTypes(prisma)).toContain('weight_incoherent');
      expect(createdTypes(prisma)).toContain('weight_gain');
    });

    /**
     * ⚠️ **UNA CONSEGUENZA DELL'`else if`, e va tenuta ferma perché non è ovvia** (trovata in
     * revisione). Se il salto sta **solo** nella finestra dell'aumento (7 giorni) e non in quella
     * dello stallo (6), sopprimere l'aumento fa **cadere nel ramo dello stallo**, che prima non
     * veniva nemmeno valutato: dove compariva «Peso in aumento» adesso compare «Peso fermo».
     *
     * ⛔ È giusto così — «fermo da sei giorni» è calcolato su numeri puliti, quindi è una frase
     * vera — ma è un cambio di comportamento che nessuno aveva chiesto, e senza questo test la
     * prossima persona lo scoprirebbe da una segnalazione della coach.
     */
    it('⚠️ se il salto sta solo nella finestra dell\'aumento, resta lo stallo (che è vero)', async () => {
      const prisma = basePrisma();
      prisma.measurement.findMany.mockResolvedValue([
        { date: D(dayIso(-12)), weightKg: 70 },
        { date: D(dayIso(-10)), weightKg: 85 },
        { date: D(dayIso(-5)), weightKg: 85 },
        { date: D(dayIso(-1)), weightKg: 85 },
      ]);
      // ⚠️ Finestre volutamente distanti (14 e 6 giorni): il salto sta a −10, cioè dentro l'aumento e
      // fuori dallo stallo. Coi default (7 e 6) l'unico giorno buono sarebbe stato il **bordo** della
      // finestra dell'aumento, e un test appoggiato a un bordo diventa rosso a mezzanotte — è già
      // successo in questo repo, ed è il motivo per cui la suite gira anche col calendario alle 00:30.
      await makeService(prisma, { blocking: false, cycleDate: null }, { alert_weight_gain_days: 14, stall_days_before_coach_alert: 6 }).recompute('c1');
      expect(createdTypes(prisma)).toContain('weight_incoherent');
      expect(createdTypes(prisma)).not.toContain('weight_gain');
      expect(createdTypes(prisma)).toContain('plateau');
    });

    it('⚠️ con pesate normali non compare nessun avviso di incoerenza', async () => {
      const prisma = basePrisma();
      prisma.measurement.findMany.mockResolvedValue([
        { date: D(dayIso(-5)), weightKg: 70 },
        { date: D(dayIso(-1)), weightKg: 71.2 },
      ]);
      await makeService(prisma).recompute('c1');
      expect(createdTypes(prisma)).not.toContain('weight_incoherent');
    });
  });

  it('segnala inattività se non ci sono attività da N giorni', async () => {
    const prisma = basePrisma();
    prisma.analyticsEvent.findFirst.mockResolvedValue({ receivedAt: D(dayIso(-10)) });
    const svc = makeService(prisma);
    await svc.recompute('c1');
    expect(createdTypes(prisma)).toContain('inactive');
  });

  it('rischio abbandono: umore basso ripetuto + carattere quits', async () => {
    const prisma = basePrisma();
    prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 'coach-1', character: 'quits', planStartDate: D(dayIso(-10)) });
    prisma.dailyCheckin.findMany.mockResolvedValue([
      { date: D(dayIso(0)), mood: 'hard' },
      { date: D(dayIso(-1)), mood: 'stressed' },
    ]);
    // attività recente → non "inactive"
    prisma.analyticsEvent.findFirst.mockResolvedValue({ receivedAt: D(dayIso(0)) });
    const svc = makeService(prisma);
    await svc.recompute('c1');
    expect(createdTypes(prisma)).toContain('dropout_risk');
  });

  it('risolve gli alert la cui condizione non vale più', async () => {
    const prisma = basePrisma();
    prisma.alert.findMany.mockResolvedValue([{ id: 'a1', type: 'plateau' }]);
    const svc = makeService(prisma); // nessun segnale → desired vuoto
    const res = await svc.recompute('c1');
    expect(prisma.alert.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a1'] } }, data: { status: 'resolved' } });
    expect(res.resolved).toBe(1);
    expect(prisma.alert.createMany).not.toHaveBeenCalled();
  });

  it('non ricrea un alert già attivo (idempotente)', async () => {
    const prisma = basePrisma();
    prisma.alert.findMany.mockResolvedValue([{ id: 'a1', type: 'missing_measurements' }]);
    const svc = makeService(prisma, { blocking: true, cycleDate: dayIso(-1) });
    await svc.recompute('c1');
    expect(prisma.alert.createMany).not.toHaveBeenCalled();
    expect(prisma.alert.updateMany).not.toHaveBeenCalled();
  });
});

describe('AlertsService.updateStatus', () => {
  const coachUser = { sub: 'u-coach', role: 'coach' } as AuthUser;

  it('la coach proprietaria può gestire l alert', async () => {
    const prisma = basePrisma();
    prisma.alert.findUnique.mockResolvedValue({ id: 'a1', coachId: 'coach-1' });
    prisma.staff.findUnique.mockResolvedValue({ id: 'coach-1' });
    const svc = makeService(prisma);
    await svc.updateStatus('a1', coachUser, 'handled');
    // ⚠️ `handledAt` insieme allo stato: è da lì che parte il rinvio di sette giorni (12/8).
    // Senza la data, «gestito» tornerebbe a essere una chiusura definitiva mascherata.
    const scritto = prisma.alert.update.mock.calls[0][0];
    expect(scritto.where).toEqual({ id: 'a1' });
    expect(scritto.data.status).toBe('handled');
    expect(scritto.data.handledAt).toBeInstanceOf(Date);
  });

  it('una coach non proprietaria è bloccata', async () => {
    const prisma = basePrisma();
    prisma.alert.findUnique.mockResolvedValue({ id: 'a1', coachId: 'coach-2' });
    prisma.staff.findUnique.mockResolvedValue({ id: 'coach-1' });
    const svc = makeService(prisma);
    await expect(svc.updateStatus('a1', coachUser, 'handled')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

/**
 * «SEGNA COME GESTITO» DEVE RESTARE GESTITO (segnalazione delle coach, 11/8).
 *
 * «Se clicco su segna come gestito, quando faccio refresh gli avvisi ricompaiono.» La riga sparisce
 * perché la pagina la toglie da sé; poi il server la rimandava indietro, perché la coda della coach e
 * il controllo «devo ricreare questo avviso?» leggevano la STESSA lista di stati — e in quella lista
 * `handled` ci sta di diritto, ma solo per la seconda domanda.
 *
 * Questi test tengono separate le due domande. Sono scritti sul `where` della query e non sul
 * risultato: è lì che stava il difetto, e un mock che restituisce tre righe non lo avrebbe mostrato.
 */
describe('AlertsService.listForCoach — cosa resta da fare', () => {
  const coach = { sub: 'u-coach', role: 'coach' } as AuthUser;
  const admin = { sub: 'u-admin', role: 'admin' } as AuthUser;

  const statiChiesti = (prisma: PrismaMock): string[] => {
    // La prima `findMany` su alert dentro `listForCoach` è quella della coda (le altre sono di sync).
    const call = prisma.alert.findMany.mock.calls.at(-1);
    return ((call?.[0] as { where?: { status?: { in?: string[] } } })?.where?.status?.in ?? []) as string[];
  };

  it('alla coach si chiedono SOLO gli avvisi aperti: gestito vuol dire chiuso', async () => {
    const prisma = basePrisma();
    prisma.clientProfile.findMany.mockResolvedValue([]); // nessun ricalcolo da fare
    const svc = makeService(prisma);
    await svc.listForCoach(coach);

    expect(statiChiesti(prisma)).toEqual(['open']);
    expect(statiChiesti(prisma)).not.toContain('handled');
  });

  it('a chi ha il perimetro completo si chiedono anche gli inoltrati: è chi li raccoglie', async () => {
    const prisma = basePrisma();
    const svc = makeService(prisma);
    await svc.listForCoach(admin);

    expect(statiChiesti(prisma)).toEqual(['open', 'escalated']);
  });

  /**
   * L'altra metà: `sync` deve continuare a considerare `handled` come «già esistente», altrimenti
   * l'avviso chiuso rinasce al ricalcolo successivo finché la condizione dura — che è il difetto
   * opposto, e più fastidioso, perché la coach lo chiude e se lo ritrova subito.
   */
  it('il ricalcolo NON ricrea un avviso già gestito', async () => {
    const prisma = basePrisma();
    prisma.alert.findMany.mockResolvedValue([{ id: 'a1', type: 'measures_missing' }]);
    const svc = makeService(prisma, { blocking: true, cycleDate: dayIso(0) });
    await svc.recompute('cli-1');

    const where = prisma.alert.findMany.mock.calls[0][0] as { where: { status: { in: string[] } } };
    expect(where.where.status.in).toContain('handled');
    // Esiste già (in qualunque stato non chiuso): non se ne crea un altro dello stesso tipo.
    expect(createdTypes(prisma)).not.toContain('measures_missing');
  });
});
