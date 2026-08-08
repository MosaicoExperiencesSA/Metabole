import {
  ordinaAlternative,
  preferenzaDaTesto,
  rilevaIntentoAltroPiatto,
  testoNessunaAlternativa,
  testoProponiAlternative,
  type CandidatoPiatto,
} from './cambio-piatto';

/**
 * La conversazione vera che ha fatto scrivere questo file (8/8):
 *
 *   cliente → «no, voglio una colazione proteica»
 *   Gaia    → «Mi piacerebbe aiutarti! 😊 Puoi dirmi di più? Stai cercando di cambiare qualcosa nel
 *              tuo menu, nelle abitudini, o nell'approccio al dimagrimento?»
 *
 * Una risposta da modulo davanti a una richiesta chiarissima. Il dialogo sapeva scambiare un
 * ingrediente, non cambiare un piatto.
 */
describe('rilevaIntentoAltroPiatto', () => {
  it('riconosce le frasi vere della conversazione', () => {
    expect(rilevaIntentoAltroPiatto('no  voglio una colazione proteica')).toBe(true);
    expect(rilevaIntentoAltroPiatto('lo voglio diverso')).toBe(true);
  });

  it('riconosce i modi normali di chiederlo', () => {
    for (const frase of [
      'voglio un altro piatto',
      'cambia la colazione',
      'qualcosa di diverso',
      'più proteica per favore',
      'vorrei qualcosa di leggero',
      'una cena diversa',
    ]) {
      expect(rilevaIntentoAltroPiatto(frase)).toBe(true);
    }
  });

  it('non scatta su una conversazione qualunque', () => {
    for (const frase of ['grazie mille', 'quando arriva il menu nuovo?', 'ho messo le misure', 'sì']) {
      expect(rilevaIntentoAltroPiatto(frase)).toBe(false);
    }
  });
});

describe('preferenzaDaTesto', () => {
  it('legge che cosa vuole', () => {
    expect(preferenzaDaTesto('voglio una colazione proteica')).toBe('proteico');
    expect(preferenzaDaTesto('qualcosa di leggero')).toBe('leggero');
    expect(preferenzaDaTesto('non ho tempo, qualcosa di veloce')).toBe('veloce');
    expect(preferenzaDaTesto('lo voglio diverso')).toBeNull();
  });

  it('le proteine hanno la precedenza: è la richiesta più specifica', () => {
    expect(preferenzaDaTesto('una colazione proteica ma leggera')).toBe('proteico');
  });
});

describe('ordinaAlternative', () => {
  // La colazione vera del caso: 340 kcal, «Burro di macadamia con cacao».
  const attuale = { kcalAttuali: 340, proteineAttualiG: 6 };
  const pool: CandidatoPiatto[] = [
    { recipeId: 'r-uova', nome: 'Uova strapazzate e pane di segale', kcal: 350, proteineG: 24, difficolta: 'semplice' },
    { recipeId: 'r-skyr', nome: 'Skyr con mandorle e cannella', kcal: 330, proteineG: 20, difficolta: 'semplice' },
    { recipeId: 'r-porridge', nome: 'Porridge di avena e frutti rossi', kcal: 345, proteineG: 9, difficolta: 'media' },
    { recipeId: 'r-brioche', nome: 'Brioche e cappuccino', kcal: 520, proteineG: 12, difficolta: 'semplice' },
    { recipeId: 'r-attuale', nome: 'Burro di macadamia con cacao', kcal: 340, proteineG: 6, difficolta: 'semplice' },
  ];

  it('«proteica»: propone le più proteiche, e solo dentro le calorie', () => {
    const res = ordinaAlternative(pool, { ...attuale, preferenza: 'proteico', escludiRecipeIds: ['r-attuale'] });
    expect(res.map((r) => r.recipeId)).toEqual(['r-uova', 'r-skyr']);
    // La brioche da 520 kcal è fuori tolleranza: scartata, non messa in fondo.
    expect(res.map((r) => r.recipeId)).not.toContain('r-brioche');
    expect(res[0].deltaProteineG).toBe(18);
  });

  it('non propone come «proteica» una ricetta con MENO proteine di adesso', () => {
    const res = ordinaAlternative([{ recipeId: 'r-poco', nome: 'Fette e marmellata', kcal: 340, proteineG: 4 }], {
      ...attuale,
      preferenza: 'proteico',
    });
    expect(res).toHaveLength(0);
  });

  it('senza macro dichiarate non promette proteine', () => {
    const res = ordinaAlternative([{ recipeId: 'r-ignota', nome: 'Piatto senza macro', kcal: 340 }], {
      ...attuale,
      preferenza: 'proteico',
    });
    expect(res).toHaveLength(0);
  });

  it('il piatto attuale e quelli già di oggi non sono alternative', () => {
    const res = ordinaAlternative(pool, {
      ...attuale,
      preferenza: null,
      escludiRecipeIds: ['r-attuale', 'r-uova', 'r-skyr'],
    });
    expect(res.map((r) => r.recipeId)).toEqual(['r-porridge']);
  });

  it('«veloce» preferisce le ricette semplici', () => {
    const res = ordinaAlternative(pool, { ...attuale, preferenza: 'veloce', escludiRecipeIds: ['r-attuale'] });
    expect(res[0].difficolta).toBe('semplice');
  });

  it('«leggero» sceglie le kcal più basse, senza uscire dalla tolleranza', () => {
    const res = ordinaAlternative(pool, { ...attuale, preferenza: 'leggero', escludiRecipeIds: ['r-attuale'] });
    expect(res[0].recipeId).toBe('r-skyr'); // 330, la più bassa dentro il ±15%
  });

  it('a parità vince chi resta più vicino alle calorie di partenza', () => {
    const res = ordinaAlternative(
      [
        { recipeId: 'a', nome: 'A', kcal: 300, proteineG: 20 },
        { recipeId: 'b', nome: 'B', kcal: 338, proteineG: 20 },
      ],
      { ...attuale, preferenza: 'proteico' },
    );
    expect(res[0].recipeId).toBe('b');
  });

  it('senza calorie di riferimento non propone niente invece di indovinare', () => {
    expect(ordinaAlternative(pool, { kcalAttuali: 0, preferenza: 'proteico' })).toHaveLength(0);
  });

  it('ne propone due: una è un ordine, tre sono un catalogo', () => {
    const res = ordinaAlternative(pool, { ...attuale, preferenza: null, escludiRecipeIds: ['r-attuale'] });
    expect(res).toHaveLength(2);
  });
});

describe('i testi della proposta', () => {
  const alternative = ordinaAlternative(
    [
      { recipeId: 'r-uova', nome: 'Uova strapazzate e pane di segale', kcal: 350, proteineG: 24 },
      { recipeId: 'r-skyr', nome: 'Skyr con mandorle', kcal: 330, proteineG: 20 },
    ],
    { kcalAttuali: 340, proteineAttualiG: 6, preferenza: 'proteico' },
  );

  it('dice il perché, le calorie e le proteine in più: la stessa cosa che guarda il nutrizionista', () => {
    const t = testoProponiAlternative('Colazione', { nome: 'Burro di macadamia con cacao', kcal: 340 }, alternative, 'proteico', 'Giusy');
    expect(t).toContain('Giusy');
    expect(t).toContain('più proteine e le stesse calorie');
    expect(t).toContain('1) Uova strapazzate e pane di segale — 350 kcal · +18 g di proteine');
    expect(t).toContain('Rispondi col numero');
  });

  it('senza nome la frase resta corretta', () => {
    const t = testoProponiAlternative('Colazione', { nome: 'X', kcal: 340 }, alternative, 'proteico');
    expect(t).toMatch(/^Ho cercato/);
    expect(t).not.toContain('undefined');
  });

  it('quando non c\'è niente da proporre lo dice, e passa alla nutrizionista', () => {
    const t = testoNessunaAlternativa('Colazione', 'proteico', 'Giusy');
    expect(t).toContain('non trovo');
    expect(t).toContain('nutrizionista');
    // Non promette di riprovare né inventa un piatto fuori piano.
    expect(t).not.toContain('riprova');
  });
});
