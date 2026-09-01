import {
  leggiSorgente, poolPerSlot, ricetteDelPool, righeDalPaniere, righeDalleGiornate,
} from './pool-del-paniere';

describe('da dove viene il pool', () => {
  describe('l\'interruttore', () => {
    it('apre il paniere solo con la parola esatta', () => {
      expect(leggiSorgente('paniere')).toBe('paniere');
    });

    /**
     * ⛔ Un refuso in `config_param` non deve poter spostare da cosa mangiano le clienti: qualunque
     * altra cosa torna al comportamento di sempre.
     */
    it.each([[null], [undefined], [''], ['panieri'], ['Paniere'], ['giornate'], ['si'], ['1']])(
      '⛔ «%s» lascia le giornate', (v) => {
        expect(leggiSorgente(v as string)).toBe('giornate');
      },
    );
  });

  describe('le righe dalle giornate', () => {
    it('si appiattiscono tenendo slot e ricetta', () => {
      expect(righeDalleGiornate([
        { meals: [{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }] },
        { meals: [{ slot: 'lunch', recipeId: 'r3' }] },
      ])).toEqual([
        { slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }, { slot: 'lunch', recipeId: 'r3' },
      ]);
    });

    it.each([[null], [undefined], [[]], [[{ meals: null }]], [[{ meals: 'lunch' }]], [[{ meals: [{ slot: 'lunch' }] }]], [[{ meals: [{ recipeId: 'r' }] }]]])(
      '⚠️ da %p non legge niente invece di inventare', (g) => {
        expect(righeDalleGiornate(g as never)).toEqual([]);
      },
    );
  });

  describe('il pool per pasto', () => {
    const righe = [
      { slot: 'lunch', recipeId: 'r1' }, { slot: 'lunch', recipeId: 'r2' },
      { slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r3' },
    ];

    it('⚠️ una ricetta nominata da dieci giornate sta nel pool UNA volta', () => {
      const pool = poolPerSlot(righe);
      expect([...pool.get('lunch')!]).toEqual(['r1', 'r2']);
      expect([...pool.get('dinner')!]).toEqual(['r3']);
    });

    it('e le ricette di tutti i pasti si contano una volta sola', () => {
      expect(ricetteDelPool(poolPerSlot(righe)).size).toBe(3);
    });

    /**
     * ⛔ È la ragione per cui la porta può essere UNA: le due sorgenti hanno la stessa forma, quindi
     * lo stesso pool. Se un giorno divergessero, questa prova cadrebbe — ed è il suo mestiere.
     */
    it('⛔ giornate e paniere, sulle stesse righe, danno lo stesso pool', () => {
      const dalleGiornate = poolPerSlot(righeDalleGiornate([{ meals: righe }]));
      const dalPaniere = poolPerSlot(righe);
      expect([...dalleGiornate.keys()].sort()).toEqual([...dalPaniere.keys()].sort());
      for (const k of dalleGiornate.keys()) {
        expect([...dalleGiornate.get(k)!].sort()).toEqual([...dalPaniere.get(k)!].sort());
      }
    });

    it('un pool vuoto è una mappa vuota, non un errore', () => {
      expect(poolPerSlot([]).size).toBe(0);
      expect(ricetteDelPool(poolPerSlot([])).size).toBe(0);
    });

    /**
     * ⚠️ **Fase 2 (1/9): spuntino e merenda pescano dallo stesso paniere**, e l'allargamento sta
     * dentro la porta. Se qualcuno lo togliesse di qui per rifarlo in chi chiama, la composizione e
     * la base personale tornerebbero a vedere due pool diversi — il difetto per cui la porta esiste.
     */
    it('⚠️ lo spuntino vede le merende, e la merenda vede gli spuntini', () => {
      const pool = poolPerSlot([
        { slot: 'morning_snack', recipeId: 's1' },
        { slot: 'afternoon_snack', recipeId: 'm1' },
        { slot: 'lunch', recipeId: 'r1' },
      ]);
      expect([...pool.get('morning_snack')!].sort()).toEqual(['m1', 's1']);
      expect([...pool.get('afternoon_snack')!].sort()).toEqual(['m1', 's1']);
      expect([...pool.get('lunch')!]).toEqual(['r1']);
    });

    /** ⛔ E non aggiunge la merenda a chi ha solo lo spuntino: sarebbero kcal in più nel piano. */
    it('⛔ non inventa il pasto che le giornate non hanno', () => {
      const pool = poolPerSlot([
        { slot: 'morning_snack', recipeId: 's1' },
        { slot: 'lunch', recipeId: 'r1' },
      ]);
      expect([...pool.keys()].sort()).toEqual(['lunch', 'morning_snack']);
    });
  });

  describe('le righe dal paniere', () => {
    const prisma = (righe: { recipeId: string; slot: string }[]) => ({
      paniereRicetta: { findMany: jest.fn().mockResolvedValue(righe) },
    });

    it('chiede il paniere per FAMIGLIA e regime, non per dieta', async () => {
      const p = prisma([{ recipeId: 'r1', slot: 'lunch' }]);
      await righeDalPaniere(p, 'Mediterranea', 'vegan');
      expect(p.paniereRicetta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { paniere: { famiglia: 'Mediterranea', regime: 'vegan' } } }),
      );
    });

    it('⚠️ senza famiglia o regime non chiede niente al database', async () => {
      const p = prisma([]);
      expect(await righeDalPaniere(p, '', 'vegan')).toEqual([]);
      expect(await righeDalPaniere(p, 'Mediterranea', '')).toEqual([]);
      expect(p.paniereRicetta.findMany).not.toHaveBeenCalled();
    });
  });
});
