import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from './finance.service';

/**
 * «RICALCOLA PROVVIGIONI» LAVORA SOLO SULLA RETE COACH (Simone, 20/8).
 *
 * ⚠️ Il difetto non era un errore di calcolo: era una **differenza fra quello che il proprietario
 * crede che il pulsante faccia e quello che faceva**. Rispondendo a un'altra domanda Simone l'ha
 * descritto come «lavora solo sulle provvigioni della rete coach, non su quella dei nutrizionisti»,
 * e il codice invece percorreva tutte e due le catene. Su un pulsante che muove soldi quella
 * differenza è il difetto, quale che sia la versione migliore.
 *
 * ⚠️ Quello che è già stato pagato ai nutrizionisti **resta pagato**: questa funzione non ha mai
 * tolto niente a nessuno, e adesso quelle righe semplicemente non le guarda.
 */
describe('ricalcolaProvvigioni — solo la catena coach', () => {
  let service: FinanceService;
  let prisma: any;

  const PIANO = {
    priceCents: 30000,
    commissionCoachPct: 25, commissionCoordinatorPct: 35, commissionManagerPct: 45,
    commissionNutritionistPct: 10, commissionHeadNutritionistPct: 15,
  };

  beforeEach(async () => {
    prisma = {
      payment: {
        findUnique: jest.fn(async ({ select }: any) =>
          select?.subscription
            ? { subscription: { plan: PIANO }, order: null }
            : { id: 'pay-1', clientId: 'c1', amountCents: 30000, status: 'approved', subscriptionId: 'sub-1' },
        ),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      /**
       * ⚠️ Il finto profilo restituisce **anche** `assignedNutritionistId`, e il codice vero non lo
       * chiede più. È voluto: al primo giro il finto tornava la sola coach, e la mutazione che
       * rimetteva la catena nutrizionista **non mordeva** — perché senza nutrizionista assegnata
       * quel ramo è un giro a vuoto comunque. Il test era verde per la ragione sbagliata. Con la
       * cliente che ha tutte e due le assegnazioni, se qualcuno rimette quel ramo si vede.
       */
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'st-coach', assignedNutritionistId: 'st-nutri' }) },
      staff: {
        findUnique: jest.fn(async ({ where }: any) => {
          const rete: Record<string, unknown> = {
            'st-coach': { id: 'st-coach', displayName: 'Coach Anna', managerId: null, user: { role: 'coach' } },
            'st-nutri': { id: 'st-nutri', displayName: 'Nutriz. Lucia', managerId: null, user: { role: 'nutritionist' } },
          };
          return rete[where.id] ?? null;
        }),
      },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      staffCompensation: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
        // `getString`: dal 4/9 il ricalcolo chiede chi è la coach di riserva (qui: spenta, col ripiego).
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d), getString: jest.fn(async (_k: string, d?: string) => d) } },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(FinanceService);
  });

  it('aggiunge la quota della coach', async () => {
    const esito = await service.ricalcolaProvvigioni('pay-1');
    expect(esito.aggiunte).toEqual([{ staff: 'Coach Anna', ruolo: 'coach', importoCents: 7500 }]);
  });

  it('⛔ NON guarda la catena nutrizionista: non la interroga nemmeno', async () => {
    await service.ricalcolaProvvigioni('pay-1');
    // Se la guardasse, `dovutoLungoCatena` chiederebbe questo staff. Il controllo è su CHI viene
    // interrogato e non solo sul risultato: con un elenco vuoto il risultato sarebbe identico.
    const chiesti = prisma.staff.findUnique.mock.calls.map((c: any) => c[0].where.id);
    expect(chiesti).toContain('st-coach');
    expect(chiesti).not.toContain('st-nutri');
    // E il profilo non chiede nemmeno più il nutrizionista assegnato.
    const select = prisma.clientProfile.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('assignedNutritionistId');
  });

  it('una quota già pagata al nutrizionista non risulta né mancante né in eccesso', async () => {
    // Il registro ha una riga per la nutrizionista: la funzione non deve accorgersene in nessun modo.
    prisma.ledgerEntry.findMany.mockResolvedValue([{ staffId: 'st-nutri', amountCents: 3000 }]);
    const esito = await service.ricalcolaProvvigioni('pay-1');
    expect(esito.eccessi).toEqual([]);
    expect(esito.aggiunte.map((a) => a.staff)).toEqual(['Coach Anna']);
  });
});
