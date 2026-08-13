import { calcolaPool, raccontaPool, RicettaDelPool } from './pool-disponibile';

const r = (id: string, name: string, ingredienti: string[] = []): RicettaDelPool => ({
  id,
  name,
  ingredients: ingredienti.map((n) => ({ name: n })),
});

const pool = (perSlot: Record<string, RicettaDelPool[]>) => new Map(Object.entries(perSlot));

describe('calcolaPool', () => {
  it('conta quello che resta e nomina quello che è uscito', () => {
    const esito = calcolaPool(
      pool({
        dinner: [
          r('1', 'Branzino al forno'),
          r('2', 'Insalata di tonno', ['tonno', 'insalata']),
          r('3', 'Pollo alle erbe'),
        ],
      }),
      ['tonno'],
      3,
    );
    const cena = esito.slots[0];
    expect(cena.totale).toBe(3);
    expect(cena.restano).toBe(2);
    expect(cena.tolti).toEqual(['Insalata di tonno']);
  });

  it('cerca le parole chiave anche negli INGREDIENTI, non solo nel nome del piatto', () => {
    // È il caso che conta: «Insalatona dell'orto» non dice da nessuna parte che dentro c'è la
    // mozzarella. Se si guardasse solo il titolo, l'anteprima direbbe alla nutrizionista che quel
    // piatto resta — e il motore poi lo toglierebbe, dandole due numeri diversi sulla stessa regola.
    const esito = calcolaPool(
      pool({ lunch: [r('1', "Insalatona dell'orto", ['pomodori', 'mozzarella', 'basilico'])] }),
      ['mozzarella'],
      1,
    );
    expect(esito.slots[0].restano).toBe(0);
  });

  it('segnala sotto soglia SOLO i pasti principali', () => {
    const esito = calcolaPool(
      pool({
        dinner: [r('1', 'Pollo'), r('2', 'Tonno', ['tonno'])],
        morning_snack: [r('3', 'Yogurt', ['yogurt'])],
      }),
      ['tonno', 'yogurt'],
      3,
    );
    const cena = esito.slots.find((s) => s.slot === 'dinner')!;
    const spuntino = esito.slots.find((s) => s.slot === 'morning_snack')!;
    expect(cena.sottoSoglia).toBe(true);
    // Uno spuntino con zero opzioni non è un piano rotto: marcarlo come la cena abituerebbe a
    // ignorare l'avviso, ed è il modo più rapido per renderlo inutile.
    expect(spuntino.sottoSoglia).toBe(false);
    expect(esito.pastiScoperti).toEqual(['cena']);
  });

  it('mette i pasti principali in ordine di giornata, sempre nello stesso ordine', () => {
    const esito = calcolaPool(
      pool({ dinner: [r('1', 'a')], breakfast: [r('2', 'b')], lunch: [r('3', 'c')] }),
      [],
      1,
    );
    expect(esito.slots.map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('con zero esclusioni non toglie niente', () => {
    const esito = calcolaPool(pool({ lunch: [r('1', 'Pasta al pesto')] }), [], 1);
    expect(esito.totaleRestanti).toBe(1);
    expect(esito.slots[0].tolti).toEqual([]);
  });
});

describe('raccontaPool', () => {
  it('quando non cambia niente lo dice, invece di dare numeri a vuoto', () => {
    const p = calcolaPool(pool({ lunch: [r('1', 'Pasta')] }), [], 3);
    expect(raccontaPool(p, p)).toContain('non toglie nessuna ricetta');
  });

  it('dice quante ne toglie e avvisa sul pasto che scende sotto soglia', () => {
    const ricette = [r('1', 'Pollo'), r('2', 'Tonno', ['tonno']), r('3', 'Insalata di tonno', ['tonno'])];
    const prima = calcolaPool(pool({ dinner: ricette }), [], 3);
    const dopo = calcolaPool(pool({ dinner: ricette }), ['tonno'], 3);
    const testo = raccontaPool(prima, dopo);
    expect(testo).toContain('toglie 2 ricette');
    expect(testo).toContain('cena');
    expect(testo).toContain('sotto la soglia di 3');
  });

  it('al singolare scrive «ricetta» e non «ricette»', () => {
    const ricette = [r('1', 'Pollo'), r('2', 'Tonno', ['tonno'])];
    const prima = calcolaPool(pool({ dinner: ricette }), [], 1);
    const dopo = calcolaPool(pool({ dinner: ricette }), ['tonno'], 1);
    expect(raccontaPool(prima, dopo)).toContain('toglie 1 ricetta ');
  });
});
