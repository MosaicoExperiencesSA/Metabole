import {
  abbinaRighe,
  contaGiornata,
  leggiGiornataDettata,
  TOLLERANZA_KCAL_PCT,
} from './giornata-dettata';

/**
 * «DETTA LE COMBINAZIONI E CREA MENU SPECIFICI» — voce 241, decisione B di Simone (14/8).
 * Il rischio della B è uno solo: «pasta al pomodoro» sono cinque ricette con calorie diverse.
 * La regola di casa lo chiude: una sola → si propone; più d'una → si CHIEDE; nessuna → si dice.
 * Decisione in progetto/DECISIONE_Menu_Dettati.md.
 */

describe('leggiGiornataDettata — dal testo alle righe', () => {
  it('legge la forma naturale: un pasto per riga, coi due punti', () => {
    expect(leggiGiornataDettata(
      'Colazione: yogurt greco e frutta secca\nPranzo: pasta al pomodoro\nCena: orata al forno',
    )).toEqual([
      { slot: 'breakfast', testo: 'yogurt greco e frutta secca' },
      { slot: 'lunch', testo: 'pasta al pomodoro' },
      { slot: 'dinner', testo: 'orata al forno' },
    ]);
  });

  it('legge anche merenda e spuntino, e non si perde con le maiuscole', () => {
    const r = leggiGiornataDettata('SPUNTINO: mandorle\nmerenda: yogurt');
    expect(r.map((x) => x.slot)).toEqual(['morning_snack', 'afternoon_snack']);
  });

  it('accetta il trattino al posto dei due punti', () => {
    expect(leggiGiornataDettata('pranzo - riso e pollo')).toEqual([{ slot: 'lunch', testo: 'riso e pollo' }]);
  });

  it('⚠️ una riga senza pasto non si indovina: si SALTA, non si attribuisce a caso', () => {
    // Attribuire «e poi vediamo» alla cena vorrebbe dire scrivere una cena che nessuno ha dettato.
    expect(leggiGiornataDettata('Colazione: porridge\ne poi vediamo')).toEqual([
      { slot: 'breakfast', testo: 'porridge' },
    ]);
  });

  it('⚠️ un pasto ripetuto vince l\'ULTIMO: chi si corregge dettando lo fa scrivendo di nuovo', () => {
    expect(leggiGiornataDettata('Cena: pizza\nCena: orata al forno')).toEqual([
      { slot: 'dinner', testo: 'orata al forno' },
    ]);
  });

  it('un pasto senza niente scritto non è una riga', () => {
    expect(leggiGiornataDettata('Pranzo:\nCena: orata')).toEqual([{ slot: 'dinner', testo: 'orata' }]);
  });

  it('un testo che non parla di pasti non è una giornata', () => {
    expect(leggiGiornataDettata('a Giulia niente formaggi molli')).toEqual([]);
  });
});

describe('abbinaRighe — il cuore della decisione B', () => {
  const POOL = [
    { recipeId: 'r1', nome: 'Pasta al pomodoro e basilico', kcal: 520, slot: 'lunch' },
    { recipeId: 'r2', nome: 'Pasta al pomodoro integrale', kcal: 610, slot: 'lunch' },
    { recipeId: 'r3', nome: 'Orata al forno con patate', kcal: 480, slot: 'dinner' },
    { recipeId: 'r4', nome: 'Yogurt greco con frutta secca', kcal: 320, slot: 'breakfast' },
  ];

  it('una sola che combacia: si propone, con le sue kcal', () => {
    const [riga] = abbinaRighe([{ slot: 'dinner', testo: 'orata al forno' }], POOL);
    expect(riga.esito).toBe('una');
    expect(riga.candidate).toHaveLength(1);
    expect(riga.candidate[0].kcal).toBe(480);
  });

  it('⚠️ più d\'una: NON si sceglie — si chiede, e le calorie devono esserci per poter scegliere', () => {
    const [riga] = abbinaRighe([{ slot: 'lunch', testo: 'pasta al pomodoro' }], POOL);
    expect(riga.esito).toBe('molte');
    expect(riga.candidate.map((c) => c.recipeId).sort()).toEqual(['r1', 'r2']);
    expect(riga.candidate.every((c) => typeof c.kcal === 'number')).toBe(true);
  });

  it('nessuna: si dice, e non si ripiega su qualcosa che le somiglia', () => {
    const [riga] = abbinaRighe([{ slot: 'dinner', testo: 'sushi' }], POOL);
    expect(riga.esito).toBe('nessuna');
    expect(riga.candidate).toEqual([]);
  });

  it('⚠️ si cerca SOLO dentro lo slot dettato: la colazione non può finire a cena', () => {
    const [riga] = abbinaRighe([{ slot: 'dinner', testo: 'yogurt greco con frutta secca' }], POOL);
    expect(riga.esito).toBe('nessuna');
  });

  it('⚠️ il confronto è per PAROLA con la radice: «paste al pomodoro» trova le stesse due', () => {
    const [riga] = abbinaRighe([{ slot: 'lunch', testo: 'paste al pomodoro' }], POOL);
    expect(riga.esito).toBe('molte');
  });

  it('⚠️ una parola sola e generica non basta a dire «è questa»', () => {
    // «pasta» da sola combacia con due: si chiede. Il punto è che NON si sceglie la prima.
    const [riga] = abbinaRighe([{ slot: 'lunch', testo: 'pasta' }], POOL);
    expect(riga.esito).toBe('molte');
  });
});

describe('contaGiornata — il totale si mostra prima di scrivere', () => {
  const scelte = [
    { slot: 'breakfast', recipeId: 'r4', nome: 'Yogurt greco', kcal: 320 },
    { slot: 'lunch', recipeId: 'r1', nome: 'Pasta al pomodoro', kcal: 520 },
    { slot: 'dinner', recipeId: 'r3', nome: 'Orata al forno', kcal: 480 },
  ];

  it('somma le kcal e dice lo scostamento dal target', () => {
    const c = contaGiornata(scelte, 1400);
    expect(c.kcal).toBe(1320);
    expect(c.scostamentoPct).toBeCloseTo(-5.7, 1);
    expect(c.dentroTolleranza).toBe(true);
  });

  it('⚠️ fuori dalla tolleranza lo dice: sopra il ±15% non si scrive (decisione di Simone)', () => {
    const c = contaGiornata(scelte, 1000);
    expect(c.dentroTolleranza).toBe(false);
    expect(c.scostamentoPct).toBeGreaterThan(TOLLERANZA_KCAL_PCT);
  });

  it('senza target non si inventa un verdetto: la tolleranza non si può giudicare', () => {
    const c = contaGiornata(scelte, null);
    expect(c.kcal).toBe(1320);
    expect(c.dentroTolleranza).toBeNull();
  });
});
