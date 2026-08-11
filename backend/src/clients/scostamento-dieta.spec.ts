import { scostamentoDieta } from './scostamento-dieta';

const cristina = { famiglia: 'Flessibile', regime: 'omnivore', style: 'flexible', mealsPerDay: 5 };

describe('scostamentoDieta — quello che è stato chiesto e quello che viene servito', () => {
  it('la variante esatta esiste: non c’è niente da segnalare', () => {
    const s = scostamentoDieta(cristina, { regime: 'omnivore', style: 'flexible', mealsPerDay: 5 }, true);
    expect(s).toBeNull();
  });

  it('IL CASO CRISTINA: chiesti 5 pasti, in catalogo solo 3 → lo dice, e dice come si chiude', () => {
    const s = scostamentoDieta(cristina, { regime: 'omnivore', style: 'flexible', mealsPerDay: 3 }, false);
    expect(s?.motivo).toBe('pasti');
    expect(s?.testo).toContain('5 pasti');
    expect(s?.testo).toContain('3 pasti');
    // La cosa da fare è generare la variante mancante, NON cambiare il profilo della cliente per
    // farlo combaciare con quello che c'è: il secondo modo fa sparire il sintomo e lascia il buco.
    expect(s?.testo).toContain('non cambiando il profilo');
  });

  it('il REGIME diverso non è un ripiego: è un dato incoerente, e va detto con altre parole', () => {
    // `pickDietFor` non lascia mai cadere il regime. Se qui compare, uno dei due dati è sbagliato —
    // ed è l'unico caso in cui la cliente potrebbe trovarsi nel piatto qualcosa che non mangia.
    const s = scostamentoDieta(cristina, { regime: 'vegan', style: 'flexible', mealsPerDay: 5 }, false);
    expect(s?.motivo).toBe('regime');
    expect(s?.testo).toContain('Non è un ripiego');
    expect(s?.testo).toContain('Da guardare subito');
  });

  it('stile e pasti insieme: un motivo solo, non due mezze frasi', () => {
    const s = scostamentoDieta(cristina, { regime: 'omnivore', style: 'mediterranean', mealsPerDay: 3 }, false);
    expect(s?.motivo).toBe('stile_e_pasti');
  });

  it('cambia solo l’obiettivo: la frase non parla di pasti, che sono giusti', () => {
    const s = scostamentoDieta(cristina, { regime: 'omnivore', style: 'flexible', mealsPerDay: 5 }, false);
    expect(s?.motivo).toBe('obiettivo');
    expect(s?.testo).not.toContain('pasti:');
  });

  it('senza regime o senza pasti non si inventa niente', () => {
    // Una cliente che non ha ancora dichiarato regime o pasti non ha «chiesto» niente: segnalarle
    // uno scostamento sarebbe rumore, e il rumore è il modo in cui una segnalazione vera si perde.
    expect(scostamentoDieta({ ...cristina, regime: null }, { regime: 'omnivore', style: 'flexible', mealsPerDay: 3 }, false)).toBeNull();
    expect(scostamentoDieta({ ...cristina, mealsPerDay: null }, { regime: 'omnivore', style: 'flexible', mealsPerDay: 3 }, false)).toBeNull();
  });

  it('nessuna dieta servita: niente da confrontare', () => {
    expect(scostamentoDieta(cristina, null, false)).toBeNull();
  });
});
