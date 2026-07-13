import { DayComboService, RecipeInfo } from './day-combo.service';

const svc = new DayComboService();

const r = (id: string, kcal: number, score = 1, proteinShare = 0.3): RecipeInfo => ({ id, kcal, score, proteinShare });

describe('DayComboService.compose', () => {
  it('compone una giornata dentro la banda kcal del target', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([
      ['colazione', [r('c1', 300), r('c2', 400)]],
      ['pranzo', [r('p1', 500), r('p2', 700)]],
      ['cena', [r('d1', 500), r('d2', 800)]],
    ]);
    const res = svc.compose({
      slots: ['colazione', 'pranzo', 'cena'],
      poolBySlot,
      targetKcal: 1400,
      tolerancePct: 15,
      dayIndex: 0,
    });
    expect(res).not.toBeNull();
    const kcal = res!.reduce((a, m) => a + (poolBySlot.get(m.slot)!.find((x) => x.id === m.recipeId)!.kcal), 0);
    expect(kcal).toBeGreaterThanOrEqual(1400 * 0.85);
    expect(kcal).toBeLessThanOrEqual(1400 * 1.15);
    // una ricetta per slot, slot corretti e in ordine
    expect(res!.map((m) => m.slot)).toEqual(['colazione', 'pranzo', 'cena']);
  });

  it('a parità di kcal preferisce il punteggio più alto', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([
      ['pranzo', [r('p_lo', 700, 0.1), r('p_hi', 700, 0.9)]],
    ]);
    const res = svc.compose({ slots: ['pranzo'], poolBySlot, targetKcal: 700, tolerancePct: 15, dayIndex: 0 });
    expect(res![0].recipeId).toBe('p_hi');
  });

  it('varia la giornata al variare del dayIndex (rotazione tra i migliori)', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([
      ['pranzo', [r('a', 700, 0.9), r('b', 700, 0.9), r('c', 700, 0.9)]],
    ]);
    const d0 = svc.compose({ slots: ['pranzo'], poolBySlot, targetKcal: 700, tolerancePct: 15, dayIndex: 0 })![0].recipeId;
    const d1 = svc.compose({ slots: ['pranzo'], poolBySlot, targetKcal: 700, tolerancePct: 15, dayIndex: 1 })![0].recipeId;
    expect(d0).not.toBe(d1);
  });

  it('nessuna combinazione nella banda kcal → null (fallback ai template)', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([
      ['colazione', [r('c1', 300)]],
      ['pranzo', [r('p1', 300)]],
      ['cena', [r('d1', 300)]],
    ]);
    // solo 900 kcal totali, target 1600 ±15% = [1360,1840] → fuori banda
    const res = svc.compose({ slots: ['colazione', 'pranzo', 'cena'], poolBySlot, targetKcal: 1600, tolerancePct: 15, dayIndex: 0 });
    expect(res).toBeNull();
  });

  it('slot senza candidati → null', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([['colazione', [r('c1', 300)]]]);
    const res = svc.compose({ slots: ['colazione', 'pranzo'], poolBySlot, targetKcal: 600, tolerancePct: 15, dayIndex: 0 });
    expect(res).toBeNull();
  });

  it('target non valido → null', () => {
    const poolBySlot = new Map<string, RecipeInfo[]>([['pranzo', [r('p1', 500)]]]);
    expect(svc.compose({ slots: ['pranzo'], poolBySlot, targetKcal: 0, tolerancePct: 15, dayIndex: 0 })).toBeNull();
  });

  it('pool grande → usa la greedy e resta nella banda', () => {
    // 5 slot × 12 candidati = 248832 combinazioni > cap default → ramo greedy
    const poolBySlot = new Map<string, RecipeInfo[]>();
    const slots: string[] = [];
    for (let s = 0; s < 5; s++) {
      const slot = `slot${s}`;
      slots.push(slot);
      const arr: RecipeInfo[] = [];
      for (let i = 0; i < 12; i++) arr.push(r(`${slot}_${i}`, 200 + i * 30, ((s * 7 + i * 3) % 11) / 11));
      poolBySlot.set(slot, arr);
    }
    const res = svc.compose({ slots, poolBySlot, targetKcal: 1600, tolerancePct: 15, dayIndex: 0, maxCombos: 20000 });
    expect(res).not.toBeNull();
    const kcal = res!.reduce((a, m) => a + poolBySlot.get(m.slot)!.find((x) => x.id === m.recipeId)!.kcal, 0);
    expect(kcal).toBeGreaterThanOrEqual(1600 * 0.85);
    expect(kcal).toBeLessThanOrEqual(1600 * 1.15);
  });
});
