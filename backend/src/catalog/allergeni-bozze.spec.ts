/**
 * LE RICETTE CHE ASPETTANO GLI ALLERGENI — e perché la pagina era vuota (19/8).
 *
 * Segnalazione del nutrizionista, girata da Simone: il riquadro in cima alla pagina Ricette diceva
 * «4612 aspettano gli allergeni →» e la pagina collegata non mostrava niente.
 *
 * ⚠️ **Due cause, e la prima da sola bastava.** Le ricette generate nascono BOZZE (`active: false`,
 * «non entra nel motore finché non approvata»), e la pagina Allergeni chiedeva al server
 * `includeInactive=false`: le 4612 non entravano nemmeno nella query. La seconda: il filtro «Da
 * rivedere» girava in memoria sulle mille righe che il tetto aveva già scelto in ordine alfabetico
 * — lo stesso difetto che `listRecipes` racconta di aver chiuso l'11/8 per la pagina Ricette.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService — le bozze che aspettano gli allergeni', () => {
  let service: CatalogService;
  let prisma: any;
  let audit: any;

  const conFarina = [{ name: 'farina 00', qty: 100, unit: 'g' }];

  beforeEach(async () => {
    prisma = {
      recipe: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'r1', name: 'Pane', ingredients: conFarina, allergensReviewed: false, active: false, tags: [] }),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
      },
      dietDay: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]) },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
  });

  const whereUsato = () => (prisma.recipe.findMany as jest.Mock).mock.calls[0][0].where;

  describe('il filtro «aspetta gli allergeni»', () => {
    /**
     * ⚠️ IL CASO CHE VALE LA CORREZIONE. Con 4612 ricette da rivedere sparse su 19347 e un tetto di
     * mille righe in ordine alfabetico, un filtro applicato dopo cerca dentro una fetta arbitraria
     * del catalogo: «una ricetta che c'è ma non compare è peggio di un errore, perché chi cerca
     * conclude che non esiste».
     */
    it('⚠️ gira sul database, non sulle righe ricevute', async () => {
      await service.listRecipes({ daRivedere: true, includeInactive: true });
      expect(whereUsato().allergensReviewed).toBe(false);
    });

    /** Chi non lo chiede riceve quello che riceveva prima: il filtro non si applica da solo. */
    it('senza il filtro non compare nessuna condizione sulla conferma', async () => {
      await service.listRecipes({ includeInactive: true });
      expect(whereUsato().allergensReviewed).toBeUndefined();
    });

    /**
     * ⚠️ E il conto vero deve stare sulla STESSA condizione: se `total` contasse tutto il catalogo,
     * la pagina direbbe «19347 aspettano gli allergeni» a chi ne sta rivedendo 4612.
     */
    it('⚠️ il totale si conta con lo stesso filtro delle righe', async () => {
      await service.listRecipes({ daRivedere: true, includeInactive: true });
      expect((prisma.recipe.count as jest.Mock).mock.calls[0][0].where.allergensReviewed).toBe(false);
    });
  });

  describe('confermare gli allergeni fa entrare la ricetta in catalogo', () => {
    /** Decisione di Simone, 19/8: un gesto solo. Prima la conferma non attivava niente. */
    it('una bozza mai confermata si attiva', async () => {
      await service.setRecipeAllergens('u1', 'r1', ['glutine']);
      expect((prisma.recipe.update as jest.Mock).mock.calls[0][0].data.active).toBe(true);
    });

    /**
     * ⚠️ MA UNA RICETTA ARCHIVIATA A MANO NON RESUSCITA. È archiviata di proposito, e correggerle
     * gli allergeni non è chiedere di rimetterla nel piatto di qualcuno. La conferma passata è
     * quello che distingue «bozza appena nata» da «tolta dal catalogo da qualcuno».
     */
    it('⚠️ una ricetta già confermata e archiviata NON si riattiva', async () => {
      prisma.recipe.findUnique.mockResolvedValue({ id: 'r2', name: 'Vecchia', ingredients: conFarina, allergensReviewed: true, active: false, tags: [] });
      await service.setRecipeAllergens('u1', 'r2', ['glutine']);
      expect((prisma.recipe.update as jest.Mock).mock.calls[0][0].data.active).toBeUndefined();
    });

    /** Una ricetta già attiva resta attiva, e non si scrive un campo che non cambia niente. */
    it('una ricetta attiva non viene toccata sull\'attivazione', async () => {
      prisma.recipe.findUnique.mockResolvedValue({ id: 'r3', name: 'In uso', ingredients: conFarina, allergensReviewed: false, active: true, tags: [] });
      await service.setRecipeAllergens('u1', 'r3', ['glutine']);
      expect((prisma.recipe.update as jest.Mock).mock.calls[0][0].data.active).toBeUndefined();
    });

    /** ⚠️ «È entrata in catalogo» è una notizia diversa da «qualcuno ha spuntato il glutine». */
    it('⚠️ il registro dice se la ricetta è stata attivata', async () => {
      await service.setRecipeAllergens('u1', 'r1', ['glutine']);
      expect(audit.log.mock.calls[0][0].metadata.attivata).toBe(true);
    });
  });

  describe('la conferma in blocco', () => {
    const tre = [
      { id: 'a', name: 'Pane', ingredients: conFarina, allergensReviewed: false, active: false },
      { id: 'b', name: 'Riso', ingredients: [{ name: 'riso', qty: 80, unit: 'g' }], allergensReviewed: false, active: false },
      { id: 'c', name: 'Torta', ingredients: conFarina, allergensReviewed: true, active: true },
    ];

    beforeEach(() => { prisma.recipe.findMany.mockResolvedValue(tre); });

    /**
     * ⚠️ IL CASO CHE VALE IL BLOCCO. Scrivere `[]` — cioè «nessun allergene» — su quattromila
     * ricette per «confermarle in fretta» sarebbe una dichiarazione falsa sulla cosa dove sbagliare
     * fa più male. Il gesto è «di queste mi fido del riconoscitore», quindi si scrive quello che il
     * riconoscitore trova negli ingredienti.
     */
    it('⚠️ scrive gli allergeni RICONOSCIUTI, non un elenco vuoto', async () => {
      await service.confermaAllergeniInBlocco('u1', ['a', 'b', 'c']);
      const scritte = (prisma.recipe.update as jest.Mock).mock.calls.map((c) => c[0]);
      const pane = scritte.find((u) => u.where.id === 'a');
      expect(pane.data.allergens).toContain('glutine');
      expect(pane.data.allergensReviewed).toBe(true);
      // Il riso non ha allergeni: lì l'elenco vuoto è la verità, non una scorciatoia.
      expect(scritte.find((u) => u.where.id === 'b').data.allergens).toEqual([]);
    });

    /** Attiva solo le bozze mai confermate: la torta era già in catalogo. */
    it('conta quante ne ha attivate davvero', async () => {
      const esito = await service.confermaAllergeniInBlocco('u1', ['a', 'b', 'c']);
      expect(esito).toEqual({ confermate: 3, attivate: 2, saltate: 0 });
    });

    /**
     * ⚠️ Una riga sola di registro per il blocco: quattromila righe per un clic renderebbero
     * illeggibile il registro proprio nel giorno in cui serve rileggerlo.
     */
    it('⚠️ scrive UNA riga di registro, con i numeri', async () => {
      await service.confermaAllergeniInBlocco('u1', ['a', 'b', 'c']);
      expect(audit.log).toHaveBeenCalledTimes(1);
      expect(audit.log.mock.calls[0][0].metadata).toEqual({ chieste: 3, confermate: 3, attivate: 2, saltate: 0 });
    });

    /** Un id che non esiste più non fa fallire il blocco: si conta fra i saltati e si dice. */
    it('gli id spariti si contano, non fanno cadere tutto', async () => {
      prisma.recipe.findMany.mockResolvedValue([tre[0]]);
      expect(await service.confermaAllergeniInBlocco('u1', ['a', 'sparita'])).toEqual({ confermate: 1, attivate: 1, saltate: 1 });
    });

    /** Nessun id: non si scrive niente e non si finge un'operazione. */
    it('senza id non tocca niente', async () => {
      expect(await service.confermaAllergeniInBlocco('u1', [])).toEqual({ confermate: 0, attivate: 0, saltate: 0 });
      expect(prisma.recipe.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });
  });
});

/**
 * ⚠️ IL TERZO STRATO — la revisione di una BOZZA non deve rispondere 404.
 *
 * `getRecipe` risponde 404 su una ricetta non attiva, ed è giusto: la usa anche la cliente che apre
 * una scheda dall'app. Ma la revisione degli allergeni lavora **esattamente** sulle bozze: passando
 * di lì, il riquadro «Rivedi» non poteva né leggere i suggerimenti né salvare la conferma. Anche
 * elencandole e mandandole, la pagina non avrebbe funzionato.
 */
describe('CatalogService — rivedere gli allergeni di una BOZZA', () => {
  let service: CatalogService;
  let prisma: any;

  const bozza = { id: 'b1', name: 'Pane generato', ingredients: [{ name: 'farina 00', qty: 100, unit: 'g' }], allergens: [], allergensReviewed: false, active: false, tags: ['gen:low_carb'] };

  beforeEach(async () => {
    prisma = {
      recipe: {
        findUnique: jest.fn().mockResolvedValue(bozza),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
  });

  it('⚠️ i suggerimenti si leggono anche su una bozza', async () => {
    const r = await service.recipeAllergenSuggestions('b1');
    expect(r.reviewed).toBe(false);
    expect(r.suggestions.map((s) => s.allergen)).toContain('glutine');
  });

  it('⚠️ e la conferma si salva, invece di rispondere «Ricetta non trovata»', async () => {
    await expect(service.setRecipeAllergens('u1', 'b1', ['glutine'])).resolves.toBeDefined();
  });

  /** Quello che non esiste resta un 404: il cancello si apre per le bozze, non per tutto. */
  it('una ricetta che non c\'è resta non trovata', async () => {
    prisma.recipe.findUnique.mockResolvedValue(null);
    await expect(service.setRecipeAllergens('u1', 'boh', [])).rejects.toThrow('Ricetta non trovata');
  });
});
