import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsController } from './clients.controller';
import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { BACKOFFICE_PAGES, DEFAULT_PERMISSIONS } from '../permissions/pages';

/**
 * LA SCHEDA CLIENTE, DUE RICHIESTE DI SIMONE DEL 24/8 CHE SI TOCCANO:
 *
 * 1. «Nella riga [dell'acqua] va inserito se è un valore in bicchiere, bottiglia da 0,5, da 1 o da
 *    1,5» — e le parole le scrive il BACKEND, non la pagina: l'elenco delle unità è già in due copie
 *    (app e backend) e una terza nel back office sarebbe quella che diverge.
 * 2. «La visualizzazione e gestione della modalità viaggio deve essere configurabile dalla pagina
 *    permessi» — la chiave `travel_mode` c'era dal 23/8, ma con una guardia sola (`manage`): la
 *    casella «Vede» era spuntabile e non accendeva niente.
 */
const vuoto = () => ({
  findMany: jest.fn().mockResolvedValue([]),
  findFirst: jest.fn().mockResolvedValue(null),
  findUnique: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockResolvedValue(0),
});

function schedaCon(acqua: unknown[]) {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c1', email: 'g@x.it', role: 'client', createdAt: new Date() }),
      findUnique: jest.fn().mockResolvedValue({ role: 'admin' }),
    },
    clientProfile: vuoto(),
    objective: vuoto(),
    measurement: vuoto(),
    dailyCheckin: vuoto(),
    waterLog: { ...vuoto(), findMany: jest.fn().mockResolvedValue(acqua) },
    stepLog: vuoto(),
    subscription: vuoto(),
    payment: vuoto(),
    crmRecord: vuoto(),
    clientNote: vuoto(),
    pendingCommission: vuoto(),
    pipelineStage: vuoto(),
    menuDay: vuoto(),
    diet: vuoto(),
    staff: vuoto(),
    auditLog: vuoto(),
  };
  const service = new ClientsService(
    prisma as unknown as PrismaService,
    {} as never,
    { log: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

const riga = (glasses: number, unit: string | null) => ({ id: `w-${unit ?? 'x'}`, date: new Date(), glasses, goal: 8, unit });

describe('l\'acqua in scheda dice anche COME la contava lei', () => {
  it('12 bicchieri contati a bottiglie da 1 L si leggono anche «3 bottiglie da 1 L»', async () => {
    const { service } = schedaCon([riga(12, 'bottle1')]);
    const scheda = (await service.getDetail('c1', 'admin')) as unknown as {
      waterLogs: { glasses: number; unitaDetta: string | null; comeContati: string | null }[];
    };
    // ⚠️ Il numero resta in bicchieri: è quello su cui il motore misura l'aderenza, ed è l'unico
    // confrontabile fra due giornate contate in modi diversi.
    expect(scheda.waterLogs[0].glasses).toBe(12);
    expect(scheda.waterLogs[0].comeContati).toBe('3 bottiglie da 1 L');
    expect(scheda.waterLogs[0].unitaDetta).toBe('bottiglie da 1 L');
    // ⚠️ E la riga porta ancora con sé quello che serve a disegnarla: senza `date` la colonna Data
    // direbbe «Invalid Date», senza `id` la chiave di React sarebbe `undefined`. Un `map` che
    // «ripulisce» i campi è il modo più facile di perderli — e nessun altro test li guarda.
    expect(scheda.waterLogs[0]).toMatchObject({ id: expect.any(String), date: expect.any(Date), goal: 8 });
  });

  /**
   * ⛔ LA GIORNATA MISTA: otto bicchieri la mattina, poi lei passa alle bottiglie e tocca una volta.
   * Dodici bicchieri, unità `bottle1`. La prima stesura scriveva «3 bottiglie da 1 L» — di bottiglie
   * ne ha bevuta una. Vedi il riquadro su `comeLiHaContati`.
   */
  it('⛔ una giornata a unità miste non racconta bottiglie che non ci sono state', async () => {
    const { service } = schedaCon([riga(10, 'bottle1')]);
    const scheda = (await service.getDetail('c1', 'admin')) as unknown as {
      waterLogs: { comeContati: string | null }[];
    };
    expect(scheda.waterLogs[0].comeContati).toBe('a fine giornata contava in bottiglie da 1 L');
  });

  it('⛔ e una giornata senza unità NON diventa «bicchieri»: resta senza, ed è la verità', async () => {
    const { service } = schedaCon([riga(9, null)]);
    const scheda = (await service.getDetail('c1', 'admin')) as unknown as {
      waterLogs: { glasses: number; unitaDetta: string | null; comeContati: string | null }[];
    };
    expect(scheda.waterLogs[0].glasses).toBe(9);
    expect(scheda.waterLogs[0].unitaDetta).toBeNull();
    expect(scheda.waterLogs[0].comeContati).toBeNull();
  });

  it('⚠️ la colonna `unit` viene CHIESTA al database: senza, la riga non potrebbe dirlo', async () => {
    const { service, prisma } = schedaCon([]);
    await service.getDetail('c1', 'admin');
    expect(prisma.waterLog.findMany.mock.calls[0][0].select).toMatchObject({ unit: true });
  });
});

describe('le sospensioni: due caselle, due cancelli', () => {
  const pagina = (metodo: string) =>
    new Reflector().get(PAGE_KEY, (ClientsController.prototype as never as Record<string, () => unknown>)[metodo]) as
      | { pageKey: string; level?: string }
      | undefined;

  it('la chiave esiste fra le pagine del backoffice (altrimenti non compare in Permessi)', () => {
    expect(BACKOFFICE_PAGES).toContain('travel_mode');
  });

  /**
   * ⛔ È QUESTA LA META' CHE MANCAVA. Senza guardia sul GET, «Vede» era una spunta che non apriva
   * niente — il difetto raccontato in testa a `permissions/pages.ts` (`assignments`), ricomparso
   * dentro una chiave che quel difetto lo cita.
   */
  it('⛔ LEGGERE l\'elenco chiede `travel_mode` in VISTA', () => {
    expect(pagina('sospensioni')).toEqual({ pageKey: 'travel_mode', level: 'view' });
  });

  it('e METTERE o togliere una sospensione chiede `travel_mode` in GESTIONE', () => {
    expect(pagina('setTravel')).toEqual({ pageKey: 'travel_mode', level: 'manage' });
  });

  it('di default lo ha solo l\'admin: gli altri li accende Simone dalla tabella, senza un rilascio', () => {
    expect(DEFAULT_PERMISSIONS.admin?.travel_mode).toEqual({ view: true, manage: true });
    for (const ruolo of ['head_nutritionist', 'nutritionist', 'coach', 'coach_coordinator', 'sales', 'client'] as const) {
      expect(DEFAULT_PERMISSIONS[ruolo]?.travel_mode).toBeUndefined();
    }
  });
});
