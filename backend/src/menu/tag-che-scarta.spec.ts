import { readFileSync } from 'fs';
import { join } from 'path';
import { codiciAllergeneDichiarati, codiciCheBloccanoDalTag, tagCheScarta } from './tag-che-scarta';
import { esclusioniDi, valutaRicetta } from './esclusioni-della-cliente';

/**
 * ⛔ **DUE PORTE, UNA RISPOSTA.** La composizione dei menu e la base personale rispondevano diverso
 * alla stessa domanda sul tag `solfiti`, e il giro dei 3080 tag del 5/9 ha reso la divergenza
 * grossa. La seconda metà di questo file è la prova che conta: **stessi dati, stesso verdetto** dai
 * due percorsi. Se qualcuno cambia una delle due regole senza l'altra, diventa rossa.
 */

const cliente = (allergie: string[]) => esclusioniDi({ allergies: allergie, intolerances: [], dislikedFoods: [] } as never);

describe('tagCheScarta', () => {
  it('⛔ un allergene qualunque: il tag basta a togliere il piatto', () => {
    expect(tagCheScarta({ allergens: ['glutine'], ingredienti: ['pane'] }, ['glutine'], false))
      .toEqual({ scarta: true, codice: 'glutine', perche: 'tag' });
  });

  it('✅ un tag che la cliente non ha dichiarato non toglie niente', () => {
    expect(tagCheScarta({ allergens: ['latte'], ingredienti: ['burro'] }, ['glutine'], false)).toEqual({ scarta: false });
  });

  it('⛔ SOLFITI dichiarati: il tag da solo NON toglie, se un ingrediente si sostituisce (decisione del 24/8)', () => {
    expect(tagCheScarta({ allergens: ['solfiti'], ingredienti: ['aceto di mele', 'insalata'] }, ['solfiti'], true))
      .toEqual({ scarta: false });
    // «vino» si toglie e basta: il piatto resta, senza il vino.
    expect(tagCheScarta({ allergens: ['solfiti'], ingredienti: ['vino bianco', 'pere'] }, ['solfiti'], true))
      .toEqual({ scarta: false });
  });

  it('⛔ ma un ingrediente che CAMBIEREBBE il piatto lo toglie: un gambero non è un branzino', () => {
    expect(tagCheScarta({ allergens: ['solfiti'], ingredienti: ['gamberi', 'aceto di mele'] }, ['solfiti'], true))
      .toEqual({ scarta: true, codice: 'solfiti', perche: 'ingrediente_senza_sostituto' });
  });

  it('⛔ IL RIPIEGO: tag solfiti e nessun ingrediente che sappiamo trattare → la nutrizionista sa più di noi, si toglie', () => {
    expect(tagCheScarta({ allergens: ['solfiti'], ingredienti: ['qualcosa che non nominiamo'] }, ['solfiti'], true))
      .toEqual({ scarta: true, codice: 'solfiti', perche: 'tag_senza_ingrediente' });
  });

  it('⚠️ senza il tag solfiti sulla ricetta non si toglie niente, anche con gli ingredienti dell\'elenco', () => {
    expect(tagCheScarta({ allergens: [], ingredienti: ['aceto di mele'] }, ['solfiti'], true)).toEqual({ scarta: false });
  });

  it('⚠️ chi NON dichiara i solfiti non guarda nemmeno gli ingredienti', () => {
    expect(tagCheScarta({ allergens: ['solfiti'], ingredienti: ['gamberi'] }, ['glutine'], false)).toEqual({ scarta: false });
  });

  it('codiciAllergeneDichiarati tiene solo i codici UE, senza doppioni e senza maiuscole', () => {
    expect(codiciAllergeneDichiarati(['Latte', 'latte', 'nichel', 'solfiti'])).toEqual(['latte', 'solfiti']);
  });

  it('codiciCheBloccanoDalTag toglie i solfiti solo a chi li dichiara', () => {
    expect(codiciCheBloccanoDalTag(['latte', 'solfiti'], true)).toEqual(['latte']);
    expect(codiciCheBloccanoDalTag(['latte', 'solfiti'], false)).toEqual(['latte', 'solfiti']);
  });
});

describe('⛔ LE DUE PORTE DANNO LO STESSO VERDETTO', () => {
  const casi: { nome: string; allergie: string[]; ricetta: { name: string; allergens: string[]; ingredienti: string[] } }[] = [
    { nome: 'insalata con aceto, solfiti dichiarati', allergie: ['solfiti'], ricetta: { name: 'Insalata', allergens: ['solfiti'], ingredienti: ['aceto di mele', 'insalata'] } },
    { nome: 'pere al vino, solfiti dichiarati', allergie: ['solfiti'], ricetta: { name: 'Pere', allergens: ['solfiti'], ingredienti: ['vino rosso', 'pere'] } },
    { nome: 'gamberi, solfiti dichiarati', allergie: ['solfiti'], ricetta: { name: 'Gamberi', allergens: ['solfiti'], ingredienti: ['gamberi', 'zucchine'] } },
    { nome: 'tag solfiti su ingrediente che non nominiamo', allergie: ['solfiti'], ricetta: { name: 'Misterioso', allergens: ['solfiti'], ingredienti: ['bevanda artigianale'] } },
    { nome: 'glutine dichiarato, ricetta col tag', allergie: ['glutine'], ricetta: { name: 'Pasta', allergens: ['glutine'], ingredienti: ['pasta'] } },
    { nome: 'latte dichiarato, ricetta senza tag', allergie: ['latte'], ricetta: { name: 'Riso', allergens: [], ingredienti: ['riso'] } },
    { nome: 'solfiti e latte insieme', allergie: ['solfiti', 'latte'], ricetta: { name: 'Panna e aceto', allergens: ['solfiti', 'latte'], ingredienti: ['panna', 'aceto di mele'] } },
  ];

  for (const c of casi) {
    it(`⚠️ ${c.nome}`, () => {
      const e = cliente(c.allergie);
      const dalMotore = valutaRicetta(
        { id: 'r', name: c.ricetta.name, ingredients: c.ricetta.ingredienti.map((name) => ({ name })), allergens: c.ricetta.allergens },
        e,
      );
      const dallaBase = tagCheScarta({ allergens: c.ricetta.allergens, ingredienti: c.ricetta.ingredienti }, e.codiciAllergene, e.solfiti);
      expect(dallaBase.scarta).toBe(dalMotore.violations.length > 0);
    });
  }
});

describe('⛔ la porta è una sola, letta nei sorgenti', () => {
  const radice = join(__dirname, '..', '..');
  const leggi = (p: string) => readFileSync(join(radice, p), 'utf8');

  it('⛔ la base personale NON ha più il suo confronto sui tag: chiama il modulo comune', () => {
    const src = leggi('src/personal-base/personal-base.service.ts');
    expect(src).toContain('tagCheScarta(');
    expect(src).not.toMatch(/allergens\s*\?\?\s*\[\]\)\.some\(\(a\)\s*=>\s*codedSet/);
  });

  it('⛔ e nemmeno il motore: la regola dei solfiti sta in un posto solo', () => {
    const src = leggi('src/menu/esclusioni-della-cliente.ts');
    expect(src).toContain('codiciCheBloccanoDalTag(');
    expect(src).toContain('ilTagSolfitiRipiega(');
  });
});
