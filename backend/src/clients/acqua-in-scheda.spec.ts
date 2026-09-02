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
    // ⚠️ `SignalsService` (28/8): le pesate corrette dallo staff fanno scattare gli stessi segnali.
    {} as never,
    { buildPersonalBase: jest.fn().mockResolvedValue({}) } as never,
  );
  return { service, prisma };
}

const riga = (glasses: number, unit: string | null) => ({ id: `w-${unit ?? 'x'}`, date: new Date(), glasses, goal: 8, unit });

describe('l\'acqua in scheda si legge come la legge lei', () => {
  /**
   * Simone, 24/8: «la vera unità la mettiamo in una colonna, il titolo non è più bicchieri ma
   * quantità, e anche l'obiettivo si deve aggiornare con quello mostrato in app che varia in
   * funzione dell'unità di misura scelta».
   */
  it('12 bicchieri contati a bottiglie da 1 L si leggono «3», unità «bottiglie da 1 L»', async () => {
    const { service } = schedaCon([riga(12, 'bottle1')]);
    const scheda = (await service.getDetail('c1', 'admin')) as unknown as {
      waterLogs: { glasses: number; goal: number; quantita: string; unitaDetta: string | null; obiettivoDetto: string }[];
    };
    const r = scheda.waterLogs[0];
    expect(r.quantita).toBe('3');
    expect(r.unitaDetta).toBe('bottiglie da 1 L');
    // ⚠️ L'obiettivo è quello dell'app: 8 bicchieri sono 2 bottiglie da 1 L, intere.
    expect(r.obiettivoDetto).toBe('2');
    // ⛔ E i due numeri veri restano in bicchieri: sono quelli su cui il motore valuta l'aderenza,
    // e gli unici confrontabili fra due giornate contate in modi diversi.
    expect(r.glasses).toBe(12);
    expect(r.goal).toBe(8);
    expect(scheda.waterLogs[0]).toMatchObject({ id: expect.any(String), date: expect.any(Date) });
  });

  /**
   * ⚠️ **La giornata mista non si arrotonda**: otto bicchieri la mattina, poi lei passa alle
   * bottiglie e ne tocca una. Sono 2,5 bottiglie — ed è esattamente quello che le ha mostrato
   * l'app. Scrivere 2 racconterebbe mezzo litro come se non l'avesse bevuto.
   */
  it('⚠️ una giornata a unità miste resta a mezzi: 2,5, come in app', async () => {
    const { service } = schedaCon([riga(10, 'bottle1')]);
    const scheda = (await service.getDetail('c1', 'admin')) as unknown as { waterLogs: { quantita: string }[] };
    expect(scheda.waterLogs[0].quantita).toBe('2,5');
  });

  it('⛔ e una giornata senza unità NON diventa «bicchieri»: la colonna resta vuota, ed è la verità', async () => {
    const { service } = schedaCon([riga(9, null)]);
    const scheda = (await service.getDetail('c1', 'admin')) as unknown as {
      waterLogs: { glasses: number; quantita: string; unitaDetta: string | null; obiettivoDetto: string }[];
    };
    // Il valore salvato è in bicchieri: si mostra com'è, e l'unità è `null` — chi disegna la riga
    // ci mette un trattino, non la parola «bicchieri» (che sarebbe una cosa che non sappiamo).
    expect(scheda.waterLogs[0].quantita).toBe('9');
    expect(scheda.waterLogs[0].obiettivoDetto).toBe('8');
    expect(scheda.waterLogs[0].unitaDetta).toBeNull();
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
