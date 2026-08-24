import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService (flusso approvazione diete)', () => {
  let service: CatalogService;
  let prisma: any;
  let config: any;

  beforeEach(async () => {
    prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-head' }) },
      diet: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'd1', status: 'draft' }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'd1', ...data })),
      },
      dietDayTemplate: { deleteMany: jest.fn(), createMany: jest.fn() },
      recipe: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      clientProfile: { count: jest.fn().mockResolvedValue(5) },
      subscription: { count: jest.fn().mockResolvedValue(2) },
      crmRecord: { count: jest.fn().mockResolvedValue(12) },
      rulePreset: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    config = { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        // Provider aggiunto al costruttore del servizio ma dimenticato qui: il test non
        // falliva su un'asserzione, non partiva proprio (Nest non risolve le dipendenze).
        { provide: NotificationsService, useValue: { notify: jest.fn().mockResolvedValue(undefined) } },
        { provide: ConfigParamsService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
  });

  const diet = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    status: 'in_review',
    authorId: 'staff-author',
    dayTemplates: [{ id: 't1' }],
    ...over,
  });

  it('publicStats: methods = diete APPROVATE nel catalogo (una per dieta, senza dedup per stile)', async () => {
    prisma.diet.findMany.mockResolvedValue([
      { id: 'd1', style: 'keto', name: 'Keto', status: 'approved' },
      { id: 'd2', style: 'mediterranean', name: 'Med', status: 'approved' },
      { id: 'd3', style: 'keto', name: 'Keto (bis)', status: 'approved' },
    ]);
    const s = await service.publicStats();
    expect(s.methods).toBe(3); // ogni dieta approvata conta: 3 diete → 3 percorsi
    // Sul sito vanno solo le diete che il capo nutrizionista ha reso visibili: approvata
    // non basta più. Il test diceva ancora "approved e basta".
    expect(prisma.diet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'approved', siteVisible: true } }),
    );
    // ⚠️ Definizione cambiata: i "clienti seguiti" NON sono più gli abbonamenti attivati, ma le
    // schede CRM arrivate a 'paid' OPPURE con un pagamento pregresso (clienti storici) — l'OR
    // deduplica da solo. È il numero che sta sulla home del sito, quindi la definizione conta.
    expect(s.clients).toBe(12); // base 0 + schede CRM paid/storiche
    expect(s.reached).toBe(12); // base 0 + tutte le schede CRM
    expect(s.years).toBeUndefined(); // config 0 → campo omesso
    expect(prisma.crmRecord.count).toHaveBeenCalledWith({
      // ⚠️ «Cliente» sono DUE colonne dal 25/8: «Acquisito» e «In sospensione». Con la sola `paid` il
      // numero pubblico delle clienti seguite CALAVA a ogni vacanza.
      where: { OR: [{ stage: { in: ['paid', 'in_sospensione'] } }, { historicalPaidCents: { gt: 0 } }] },
    });
  });

  it('publicPaths: sotto il nome vanno le note cliniche del preset se manca la descrizione cliente', async () => {
    prisma.diet.findMany.mockResolvedValue([
      { id: 'd1', style: 'keto', name: 'Keto — bozza generata', status: 'approved' },
      { id: 'd2', style: 'mediterranean', name: 'Med', clientDescription: 'Equilibrata e varia.', status: 'approved' },
    ]);
    prisma.rulePreset.findMany.mockResolvedValue([
      { style: 'keto', clinicalNotes: 'Carboidrati < 50 g/die; grassi ≥ 65–70%.' },
    ]);
    const paths = await service.publicPaths();
    expect(paths[0].desc).toBe('Carboidrati < 50 g/die; grassi ≥ 65–70%.'); // fallback note cliniche
    expect(paths[0].clinicalNotes).toBe('Carboidrati < 50 g/die; grassi ≥ 65–70%.');
    expect(paths[1].desc).toBe('Equilibrata e varia.'); // la descrizione cliente vince
  });

  it('publicStats: la base storica (config_param) si SOMMA ai conteggi reali', async () => {
    const bases: Record<string, number> = {
      stats_clients_base: 18979,
      stats_reached_base: 85218,
      site_stats_years: 20,
    };
    config.getNumber.mockImplementation(async (k: string, d?: number) => bases[k] ?? d ?? 0);
    prisma.diet.findMany.mockResolvedValue([
      { id: 'd1', style: 'keto', name: 'Keto', status: 'approved' },
    ]);
    const s = await service.publicStats();
    expect(s.clients).toBe(18979 + 12); // base + schede CRM paid/storiche
    expect(s.reached).toBe(85218 + 12); // base + lead CRM
    expect(s.years).toBe(20);
    expect(s.methods).toBe(1);
  });

  it('il capo approva una dieta in revisione di un altro autore', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet());
    const result = await service.approveDiet('head-user', 'd1');
    expect(result.status).toBe('approved');
    expect(prisma.diet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvedById: 'staff-head' }),
      }),
    );
  });

  it('il capo NON può approvare una propria dieta', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ authorId: 'staff-head' }));
    await expect(service.approveDiet('head-user', 'd1')).rejects.toThrow(ForbiddenException);
  });

  it('non si approva una dieta che non è in revisione', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'draft' }));
    await expect(service.approveDiet('head-user', 'd1')).rejects.toThrow(BadRequestException);
  });

  it('submit richiede almeno un template giornata', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'draft', dayTemplates: [] }));
    await expect(service.submitForReview('u1', 'd1')).rejects.toThrow(BadRequestException);
  });

  it('una dieta approvata non si modifica', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'approved' }));
    await expect(service.updateDiet('u1', 'd1', { name: 'Nuovo nome' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('ogni modifica riporta la dieta in bozza e azzera l\'approvazione', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'rejected' }));
    await service.updateDiet('u1', 'd1', { name: 'V2' });
    expect(prisma.diet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft', approvedById: null }),
      }),
    );
  });

  it('i template rifiutano ricette inesistenti', async () => {
    prisma.diet.findUnique.mockResolvedValue(diet({ status: 'draft' }));
    prisma.recipe.count.mockResolvedValue(0);
    await expect(
      service.setDayTemplates('u1', 'd1', {
        days: [{ level: 1, dayIndex: 1, meals: [{ slot: 'lunch', recipeId: 'ghost' }] }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

/**
 * LA SCHEDA RICETTA CON LE GRAMMATURE DI QUESTA CLIENTE (voce 255, coda della strada C).
 *
 * Il modulo puro è provato in `menu/porzione-del-giorno.spec.ts`. Qui si prova la parte che nessun
 * modulo puro può provare: che il fattore arrivi **dalla giornata di chi guarda** e che la scheda
 * si apra lo stesso quando qualcosa non torna.
 */
describe('CatalogService.getRecipe — la porzione del giorno', () => {
  let service: CatalogService;
  let prisma: any;

  const ricetta = {
    id: 'r-pranzo',
    name: 'Farro e ceci',
    kcal: 495,
    active: true,
    tags: ['interno:x'],
    ingredients: [
      { name: 'farro perlato', qty: 80, unit: 'g' },
      { name: 'ceci', qty: 100, unit: 'g' },
    ],
  };

  beforeEach(async () => {
    prisma = {
      recipe: { findUnique: jest.fn().mockResolvedValue(ricetta) },
      menuDay: {
        findUnique: jest.fn().mockResolvedValue({
          meals: [{ slot: 'lunch', recipeId: 'r-pranzo', name: 'Farro e ceci', kcal: 891, kcalBase: 495, porzione: 1.8 }],
        }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
  });

  it('col giorno e lo slot le grammature sono già quelle della cliente, e le kcal quelle del menu', async () => {
    const r: any = await service.getRecipe('r-pranzo', { clientId: 'c1', giorno: '2026-08-20', slot: 'lunch' });
    expect(r.ingredients).toEqual([
      { name: 'farro perlato', qty: 144, unit: 'g' },
      { name: 'ceci', qty: 180, unit: 'g' },
    ]);
    // ⚠️ 891 è il numero che ha letto nel menu, non `495 × 1,8` ricalcolato qui.
    expect(r.kcal).toBe(891);
    expect(r.kcalBase).toBe(495);
    expect(r.porzione).toBe(1.8);
    // ⚠️ Il giorno si legge come PROPRIO: `clientId` è quello di chi guarda, non un parametro.
    expect(prisma.menuDay.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId_date: { clientId: 'c1', date: new Date('2026-08-20T00:00:00.000Z') } } }),
    );
  });

  /**
   * ⚠️ IL TEST CHE PROTEGGE L'APP PUBBLICATA. Finché non esce l'OTA, l'app in mano alle clienti
   * dice ancora «pesa gli ingredienti per 1,8 volte» e NON manda `giorno`. Se la scalatura fosse
   * automatica peserebbero ×3,24. Senza contesto la risposta deve restare identica a prima.
   */
  it('⚠️ senza `giorno` la risposta è quella di sempre: grammature di catalogo, nessun campo nuovo', async () => {
    const r: any = await service.getRecipe('r-pranzo');
    expect(r.ingredients[0].qty).toBe(80);
    expect(r.kcal).toBe(495);
    expect(r.porzione).toBeUndefined();
    expect(r.kcalBase).toBeUndefined();
    expect(prisma.menuDay.findUnique).not.toHaveBeenCalled();
    // I tag interni restano fuori dalla risposta, come prima.
    expect(r.tags).toBeUndefined();
  });

  it('la giornata che non c\'è, il piatto che quel giorno non c\'era e la data storta non scalano niente', async () => {
    prisma.menuDay.findUnique.mockResolvedValue(null);
    expect((await service.getRecipe('r-pranzo', { clientId: 'c1', giorno: '2026-08-20' }) as any).porzione).toBeUndefined();

    prisma.menuDay.findUnique.mockResolvedValue({ meals: [{ slot: 'dinner', recipeId: 'altra', name: 'x', kcal: 500 }] });
    expect((await service.getRecipe('r-pranzo', { clientId: 'c1', giorno: '2026-08-20' }) as any).porzione).toBeUndefined();

    prisma.menuDay.findUnique.mockClear();
    await service.getRecipe('r-pranzo', { clientId: 'c1', giorno: '20/08/2026' });
    expect(prisma.menuDay.findUnique).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ La porzione è un DI PIÙ: se la lettura del giorno esplode, la ricetta si apre lo stesso —
   * ma l'errore finisce nei log, perché tornare in silenzio alle grammature di catalogo è proprio
   * il difetto che questa consegna chiude.
   */
  it('⚠️ se la lettura del giorno fallisce la scheda si apre lo stesso, e l\'errore si scrive', async () => {
    const log = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    prisma.menuDay.findUnique.mockRejectedValue(new Error('connessione persa'));
    const r: any = await service.getRecipe('r-pranzo', { clientId: 'c1', giorno: '2026-08-20', slot: 'lunch' });
    expect(r.ingredients[0].qty).toBe(80);
    expect(r.porzione).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('connessione persa'));
  });
});
