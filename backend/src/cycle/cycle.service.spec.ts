import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { CycleService } from './cycle.service';

const DAY = 86_400_000;
const d = (n: number) => new Date(Date.UTC(2026, 6, n));

function make(over: {
  menuDays?: Record<string, unknown>[];
  ratings?: { recipeId: string; stars: number }[];
  existingCycle?: { id: string; state: string } | null;
  lastFeedback?: Record<string, unknown> | null;
  cookingMethods?: Record<string, unknown>[];
  defaultRating?: number;
}) {
  const cycleWrites: Record<string, unknown>[] = [];
  const prisma = {
    menuDay: { findMany: jest.fn().mockResolvedValue(over.menuDays ?? []) },
    recipe: { findMany: jest.fn().mockResolvedValue(over.cookingMethods ?? [{ cookingMethods: [{ type: 'veloce' }, { type: 'forno' }] }]) },
    recipeRating: { findMany: jest.fn().mockResolvedValue(over.ratings ?? []) },
    clientCycle: {
      findFirst: jest.fn().mockResolvedValue(over.existingCycle ?? null),
      create: jest.fn((a: { data: Record<string, unknown> }) => { cycleWrites.push(a.data); return Promise.resolve(a.data); }),
      update: jest.fn((a: { data: Record<string, unknown> }) => { cycleWrites.push(a.data); return Promise.resolve(a.data); }),
    },
    cycleFeedback: { findFirst: jest.fn().mockResolvedValue(over.lastFeedback ?? null) },
  };
  const config = { getNumber: jest.fn((k: string, def?: number) => Promise.resolve(k === 'cycle_default_rating' ? (over.defaultRating ?? 5) : def ?? 2)) };
  const service = new CycleService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
  return { service, cycleWrites, prisma };
}

const twoDays = [
  { date: d(10), dietId: 'diet1', level: 1, meals: [{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }] },
  { date: d(9), dietId: 'diet1', level: 1, meals: [{ slot: 'lunch', recipeId: 'r3' }] },
];

describe('CycleService.getActiveCycle', () => {
  it('nessun menu erogato → nessun ciclo attivo', async () => {
    const { service } = make({ menuDays: [] });
    const res = await service.getActiveCycle('c1');
    expect(res.active).toBe(false);
  });

  it('materializza il ciclo attivo con finestra, cotture e stato di default', async () => {
    const { service, cycleWrites } = make({ menuDays: twoDays });
    const res = await service.getActiveCycle('c1');
    expect(res.active).toBe(true);
    if (!res.active) return;
    expect(res.cycleEnd).toEqual(d(10));
    expect(res.cycleStart).toEqual(d(9));
    expect(res.state).toBe('normale');
    expect(res.cooking.g1).toBe('veloce');
    expect(res.cooking.g2).toBe('forno');
    expect(cycleWrites).toHaveLength(1); // creato
  });

  it('conserva lo stato del ciclo esistente (non lo resetta)', async () => {
    const { service } = make({ menuDays: twoDays, existingCycle: { id: 'cy1', state: 'conforto' } });
    const res = await service.getActiveCycle('c1');
    if (!res.active) throw new Error('atteso attivo');
    expect(res.state).toBe('conforto');
  });

  it('gradimento = MIN tra i max delle ricette; default 5 se non valutate', async () => {
    const { service } = make({ menuDays: twoDays }); // r1,r2,r3 non valutate
    const res = await service.getActiveCycle('c1');
    if (!res.active) throw new Error('atteso attivo');
    expect(res.gradimento).toBe(5);
  });

  it('una ricetta con poche stelle abbassa il gradimento del ciclo (pasto peggiore traina)', async () => {
    const { service } = make({ menuDays: twoDays, ratings: [{ recipeId: 'r2', stars: 2 }] });
    const res = await service.getActiveCycle('c1');
    if (!res.active) throw new Error('atteso attivo');
    expect(res.gradimento).toBe(2);
  });

  /**
   * ⚠️ IL 3 CHE L'APP SCRIVE AL POSTO DELLA CLIENTE NON ABBASSA PIÙ IL GRADIMENTO (decisione della
   * notte del 18/8). Chi tocca solo «Seguita / Non seguita» manda `stars: 3` col tag
   * `stelle_non_date`: qui quel valore di scorta decideva il gradimento del ciclo al posto suo.
   * Il filtro sta nella QUERY, quindi il test guarda la query — è l'unico punto dove si vede.
   */
  it('⚠️ le stelle mai date restano fuori dal gradimento: si filtrano nella lettura', async () => {
    const { service, prisma } = make({ menuDays: twoDays });
    await service.getActiveCycle('c1');
    expect(prisma.recipeRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ NOT: { tags: { has: 'stelle_non_date' } } }) }),
    );
  });

  it('espone l\'esito dell\'ultimo ciclo chiuso', async () => {
    const { service } = make({ menuDays: twoDays, lastFeedback: { esitoPeso: 'perso', esitoCm: 'stabile', followed: true, cycleEnd: d(8) } });
    const res = await service.getActiveCycle('c1');
    if (!res.active) throw new Error('atteso attivo');
    // ⚠️ `cycleEnd` viaggia con l'esito (19/8): senza, chi lo mostra non può sapere **di quale
    // ciclo** parla — e il feedback più recente può essere quello dei giorni che si stanno guardando.
    expect(res.lastOutcome).toEqual({ esitoPeso: 'perso', esitoCm: 'stabile', followed: true, cycleEnd: d(8) });
  });
});

describe('CycleService.cicloPerLaCliente — la strada dell\'app', () => {
  /**
   * ⚠️ LA SCHERMATA DELLA CLIENTE NON SCRIVE. `getActiveCycle` materializza la riga del ciclo a ogni
   * chiamata: oggi non lo chiama nessuno, quindi quella scrittura ha frequenza **zero** — ma
   * collegandoci l'app sarebbe diventata **una scrittura a ogni apertura**. È idempotente e non
   * sporca i dati, ma una schermata che scrive quando la guardi è una cosa che si scopre sempre nel
   * momento sbagliato.
   */
  it('⚠️ non materializza niente: è una lettura e basta', async () => {
    const { service, cycleWrites, prisma } = make({ menuDays: twoDays });
    await service.cicloPerLaCliente('c1');
    expect(cycleWrites).toHaveLength(0);
    expect(prisma.clientCycle.create).not.toHaveBeenCalled();
    expect(prisma.clientCycle.update).not.toHaveBeenCalled();
  });

  it('manda le cotture di questi giorni e le date del ciclo', async () => {
    const { service } = make({ menuDays: twoDays });
    const r = await service.cicloPerLaCliente('c1');
    expect(r.attivo).toBe(true);
    expect(r.dal).toBe('2026-07-09');
    expect(r.al).toBe('2026-07-10');
    expect(r.cotture).toEqual([
      { tipo: 'veloce', etichetta: 'Veloce' },
      { tipo: 'forno', etichetta: 'Al forno' },
    ]);
  });

  /**
   * ⚠️ IL `gradimento` NON ESCE DA QUI. Non è il gradimento: è il minimo del massimo delle stelle,
   * con **default 5** per le ricette mai valutate. Mostrarlo a chi non ha votato niente sarebbe il
   * difetto delle tre stelle inventate (voce 270) rifatto in una schermata.
   */
  it('⚠️ il «gradimento» non arriva alla cliente', async () => {
    const { service } = make({ menuDays: twoDays });
    const r = (await service.cicloPerLaCliente('c1')) as Record<string, unknown>;
    expect(r.gradimento).toBeUndefined();
    expect(Object.keys(r)).toEqual(['attivo', 'dal', 'al', 'cotture', 'esitoPrecedente']);
  });

  it('l\'esito del ciclo chiuso arriva in italiano, non come enum', async () => {
    const { service } = make({
      menuDays: twoDays,
      lastFeedback: { esitoPeso: 'perso', esitoCm: 'stabile', followed: true, cycleEnd: d(8) },
    });
    const r = await service.cicloPerLaCliente('c1');
    expect(r.esitoPrecedente?.riga).toContain('il peso è sceso');
    expect(r.esitoPrecedente?.riga).not.toContain('perso');
  });

  /**
   * ⚠️ «PRECEDENTE» VUOL DIRE PRECEDENTE. Il feedback si scrive quando lei si pesa al **secondo
   * giorno del ciclo**, cioè prima che arrivi l'erogazione nuova: in quella finestra il più recente
   * parla dei giorni che sta guardando adesso. La scheda diceva «in questi giorni si cucina…» e
   * subito sotto «nei due giorni precedenti il peso è sceso», sugli stessi due giorni.
   */
  it('⚠️ l\'esito del ciclo CORRENTE non si spaccia per quello precedente', async () => {
    const { service } = make({
      menuDays: twoDays, // finestra 9→10 luglio
      lastFeedback: { esitoPeso: 'perso', esitoCm: 'perso', followed: true, cycleEnd: d(10) },
    });
    expect((await service.cicloPerLaCliente('c1')).esitoPrecedente).toBeNull();
  });

  /**
   * ⚠️ LE COTTURE INVENTATE NON SI MOSTRANO. `pickTwoCookings` ha un ripiego («veloce» e «al forno»)
   * perché la riga di `ClientCycle` vuole due valori: se le ricette del ciclo non dichiarano nessun
   * metodo, quella coppia è un **default**. Scriverle «in questi giorni si cucina veloce e al forno»
   * sarebbe il difetto delle cinque stelle di scorta, rifatto in una schermata — ed è la ragione per
   * cui il «gradimento» è stato tenuto fuori.
   */
  it('⚠️ se le ricette non dichiarano cotture, non se ne inventano', async () => {
    const { service } = make({ menuDays: twoDays, cookingMethods: [{ cookingMethods: [] }] });
    expect((await service.cicloPerLaCliente('c1')).cotture).toEqual([]);
  });

  it('e con una sola cottura vera si dice quella, non due', async () => {
    const { service } = make({ menuDays: twoDays, cookingMethods: [{ cookingMethods: [{ type: 'vapore' }] }] });
    expect((await service.cicloPerLaCliente('c1')).cotture).toEqual([{ tipo: 'vapore', etichetta: 'Al vapore' }]);
  });

  it('senza menu erogati lo dice, senza inventare date', async () => {
    const { service } = make({ menuDays: [] });
    expect(await service.cicloPerLaCliente('c1')).toEqual({
      attivo: false, dal: null, al: null, cotture: [], esitoPrecedente: null,
    });
  });
});

describe('CycleService.menuGradimento', () => {
  it('max per ricetta, poi min sul ciclo', async () => {
    const { service } = make({ ratings: [{ recipeId: 'a', stars: 3 }, { recipeId: 'a', stars: 5 }, { recipeId: 'b', stars: 4 }] });
    // a → max 5, b → max 4, c → default 5 ; min = 4
    expect(await service.menuGradimento('c1', ['a', 'b', 'c'])).toBe(4);
  });
});
