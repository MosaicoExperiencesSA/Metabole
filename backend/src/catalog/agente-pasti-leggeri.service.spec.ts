import { AgentePastiLeggeriService, prompt } from './agente-pasti-leggeri.service';

/**
 * ⛔ Le prove qui non guardano «genera ricette buone» — quello dipende dall'AI. Guardano i **freni**:
 * l'interruttore, il tetto, e il fatto che si rilegga. Sono le tre cose che, se saltano, questo
 * agente diventa il modo più veloce di riempire il catalogo di spazzatura pagandola.
 */
describe('l\'agente dei pasti leggeri — i freni', () => {
  const ricette = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `r${i}`, name: `Piatto ${i}`, ingredients: [{ name: 'petto di pollo', qty: 150, unit: 'g' }],
  }));

  const monta = (over: Record<string, unknown> = {}) => {
    const create = jest.fn().mockResolvedValue({ id: 'nuova' });
    const generateJson = jest.fn().mockResolvedValue({
      recipes: Array.from({ length: 12 }, (_, i) => ({
        name: `Porridge ${i}`, kcal: 300,
        ingredients: [{ name: 'avena', qty: 60, unit: 'g' }, { name: 'mela', qty: 100, unit: 'g' }],
      })),
    });
    const prisma = {
      diet: { findMany: jest.fn().mockResolvedValue([{ id: 'd1', name: 'Mediterranea', regime: 'omnivore' }]) },
      dietDayTemplate: {
        findMany: jest.fn().mockResolvedValue([{ dietId: 'd1', meals: [{ slot: 'breakfast', recipeId: 'r0' }] }]),
      },
      recipe: { findMany: jest.fn().mockResolvedValue(ricette(1)), create },
      nutrientFact: {
        findMany: jest.fn().mockResolvedValue([
          { name: 'avena', synonyms: [], category: 'cereali' },
          { name: 'mela', synonyms: [], category: 'frutta' },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      ...over,
    };
    const ai = { generateJson, lastErrorFatale: false, lastError: null };
    const config = { getBool: jest.fn().mockResolvedValue(false), getNumber: jest.fn().mockResolvedValue(20), getString: jest.fn() };
    const s = new AgentePastiLeggeriService(prisma as never, ai as never, config as never);
    return { s, create, generateJson, config, ai };
  };

  /**
   * ⛔ Un agente che scrive in catalogo si accende quando qualcuno decide, non perché è stato
   * distribuito. Spento non deve nemmeno leggere: zero chiamate, zero costo.
   */
  it('⛔ nasce SPENTO: il passo notturno non chiama l\'AI e non scrive', async () => {
    const { s, create, generateJson, config } = monta();
    const esito = await s.passoNotturno();
    expect(esito.acceso).toBe(false);
    expect(generateJson).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(config.getBool).toHaveBeenCalledWith('agente_leggeri_acceso', false);
  });

  it('⚠️ e in sola lettura fa il piano senza chiamare l\'AI: vedere quanto manca non deve costare', async () => {
    const { s, generateJson, create } = monta();
    const esito = await s.riempi({ max: 40, scrive: false });
    expect(esito.piano.length).toBeGreaterThan(0);
    expect(generateJson).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  /** ⛔ Ogni ricetta è una chiamata pagata: senza tetto, una notte costa quanto un mese. */
  it('⛔ il tetto si rispetta anche se l\'AI ne manda di più', async () => {
    const { s, create } = monta();
    const esito = await s.riempi({ max: 3, scrive: true });
    expect(esito.create).toBe(3);
    expect(create).toHaveBeenCalledTimes(3);
  });

  /**
   * ⛔ **Il passo che fa la differenza.** Se l'AI risponde piatti di pesce, non ne entra nessuno — e
   * lo scarto si conta. È il difetto del 31/8: «Merluzzo crudo in tartare» a colazione, perché
   * nessuno rileggeva.
   */
  it('⛔ quello che l\'AI manda si RILEGGE: i piatti di pesce non entrano, e si contano', async () => {
    const { s, create, generateJson } = monta();
    generateJson.mockResolvedValue({
      recipes: [{ name: 'Tartare di merluzzo', kcal: 300, ingredients: [{ name: 'merluzzo', qty: 150, unit: 'g' }] }],
    });
    const esito = await s.riempi({ max: 5, scrive: true });
    expect(create).not.toHaveBeenCalled();
    expect(esito.scarti.pesce).toBeGreaterThan(0);
  });

  it('⚠️ e dopo tre giri a vuoto si passa oltre invece di bruciare chiamate', async () => {
    const { s, generateJson } = monta();
    generateJson.mockResolvedValue({ recipes: [] });
    const esito = await s.riempi({ max: 50, scrive: true });
    expect(generateJson.mock.calls.length).toBeLessThanOrEqual(9);
    expect(esito.arrese.length).toBeGreaterThan(0);
  });

  /** ⛔ Credito finito: il 12/8 un ciclo così ha sparato 270 chiamate tutte allo stesso 400. */
  it('⛔ su un errore fatale dell\'AI si ferma subito', async () => {
    const { s, generateJson, ai } = monta();
    generateJson.mockImplementation(async () => { ai.lastErrorFatale = true; return null; });
    const esito = await s.riempi({ max: 50, scrive: true });
    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(esito.fermatoPer).toBeTruthy();
  });

  it('⚠️ le ricette nascono BOZZE: non entrano in nessun menu finché non le approva qualcuno', async () => {
    const { s, create } = monta();
    await s.riempi({ max: 1, scrive: true });
    expect(create.mock.calls[0][0].data).toMatchObject({ active: false, allergensReviewed: false });
  });
});

describe('il prompt', () => {
  const passo = { famiglia: 'Keto', regime: 'vegan', slot: 'breakfast', ora: 8, obiettivo: 84, clienti: 0, mancano: 76 };

  /**
   * ⚠️ Il criterio si scrive **come lo applica il vaglio**. Se dicesse solo «niente verdure», l'AI
   * toglierebbe anche gli spinaci dalla frittata — e la frittata con gli spinaci è una colazione.
   */
  it('⛔ dice «ingrediente principale», non «niente verdure»', () => {
    const p = prompt(passo, 6);
    expect(p).toMatch(/ingrediente PRINCIPALE/);
    expect(p).toMatch(/frittata con gli spinaci è una colazione/);
  });

  it('e porta dentro regime, famiglia e pasto, che sono quello che cambia', () => {
    const p = prompt(passo, 6);
    expect(p).toContain('Keto');
    expect(p).toContain('nessun alimento di origine animale');
    expect(p).toContain('colazione');
    expect(p).toContain('Genera 6 ricette');
  });
});
