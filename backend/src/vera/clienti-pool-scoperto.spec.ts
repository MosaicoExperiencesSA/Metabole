import { contaClientiSottoSoglia, type ClienteDaContare } from './clienti-pool-scoperto';
import type { RicettaDelPool } from './pool-disponibile';

const r = (id: string, name: string, ingredients: { name: string }[] = []): RicettaDelPool => ({ id, name, ingredients });

/** Una dieta con tre pranzi e tre cene: sopra soglia (3) finché non si esclude qualcosa. */
const DIETA_PIENA = new Map<string, RicettaDelPool[]>([
  ['lunch', [r('l1', 'Pasta al pomodoro'), r('l2', 'Riso e piselli'), r('l3', 'Insalata di tonno')]],
  ['dinner', [r('d1', 'Pollo e verdure'), r('d2', 'Frittata'), r('d3', 'Merluzzo al forno')]],
]);

const cliente = (o: Partial<ClienteDaContare> & { id: string }): ClienteDaContare => ({
  nome: 'Anna', dietId: 'dieta1', chiaviEscluse: [], ...o,
});

const pool = new Map([['dieta1', DIETA_PIENA]]);

describe('contaClientiSottoSoglia', () => {
  it('senza esclusioni non è scoperta nessuna', () => {
    const e = contaClientiSottoSoglia([cliente({ id: 'c1' })], pool, 3);
    expect(e).toEqual({ quante: 0, nomi: [], esaminate: 1, nonValutabili: 0 });
  });

  it('chi si porta via un pranzo scende sotto soglia e viene contata, col nome', () => {
    const e = contaClientiSottoSoglia(
      [cliente({ id: 'c1', nome: 'Sonia', chiaviEscluse: ['tonno'] })],
      pool,
      3,
    );
    expect(e.quante).toBe(1);
    expect(e.nomi).toEqual(['Sonia']);
  });

  /**
   * ⚠️ TRE STATI. Una cliente senza dieta assegnata non è una cliente a posto: è una di cui non
   * sappiamo niente. Contarla fra le sane darebbe un numero rassicurante e falso — che è il modo
   * più efficace di non guardare più questo riquadro.
   */
  it('⚠️ senza dieta non è «a posto»: finisce fra le non valutabili', () => {
    const e = contaClientiSottoSoglia([cliente({ id: 'c1', dietId: null })], pool, 3);
    expect(e).toMatchObject({ quante: 0, esaminate: 0, nonValutabili: 1 });
  });

  it('⚠️ e nemmeno una dieta di cui non abbiamo letto il pool', () => {
    const e = contaClientiSottoSoglia([cliente({ id: 'c1', dietId: 'sconosciuta' })], pool, 3);
    expect(e.nonValutabili).toBe(1);
    expect(e.esaminate).toBe(0);
  });

  it('un pool vuoto vale come «non lo so», non come «zero piatti»', () => {
    const vuoto = new Map([['dieta1', new Map<string, RicettaDelPool[]>()]]);
    expect(contaClientiSottoSoglia([cliente({ id: 'c1' })], vuoto, 3).nonValutabili).toBe(1);
  });

  it('i nomi si fermano a cinque: oltre è un elenco, non un avviso', () => {
    const molte = Array.from({ length: 9 }, (_, i) =>
      cliente({ id: `c${i}`, nome: `Cliente ${i}`, chiaviEscluse: ['tonno'] }),
    );
    const e = contaClientiSottoSoglia(molte, pool, 3);
    expect(e.quante).toBe(9);
    expect(e.nomi).toHaveLength(5);
  });

  it('una cliente senza nome non fa sparire il conto', () => {
    const e = contaClientiSottoSoglia(
      [cliente({ id: 'c1', nome: null, chiaviEscluse: ['tonno'] })],
      pool,
      3,
    );
    expect(e.nomi).toEqual(['una cliente']);
  });

  /**
   * ⚠️ La soglia vale sui pasti PRINCIPALI: uno spuntino con due opzioni non è un piano rotto. Il
   * giudizio sta in `calcolaPool` e ha i suoi test — qui si difende solo che questo conteggio usi
   * QUELLO e non una sua copia, perché due conti della stessa cosa prima o poi divergono.
   */
  it('⚠️ uno spuntino povero non conta: la soglia è sui pasti principali', () => {
    const conSpuntino = new Map([
      ['dieta1', new Map<string, RicettaDelPool[]>([
        ...DIETA_PIENA,
        ['morning_snack', [r('s1', 'Yogurt')]],
      ])],
    ]);
    expect(contaClientiSottoSoglia([cliente({ id: 'c1' })], conSpuntino, 3).quante).toBe(0);
  });

  it('nessuna cliente: zero su zero, senza esplodere', () => {
    expect(contaClientiSottoSoglia([], pool, 3)).toEqual({ quante: 0, nomi: [], esaminate: 0, nonValutabili: 0 });
  });
});
