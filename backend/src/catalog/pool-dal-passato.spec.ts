import { poolDalPassato, type GiornataDelPassato } from './pool-dal-passato';

const giorno = (chiave: string, caloKg: number, gradimento: number | null, piatti: string[]): GiornataDelPassato => ({
  chiave,
  caloKg,
  gradimento,
  recenza: Number(chiave.replace(/\D/g, '')) || 0,
  pasti: [
    { slot: 'breakfast', recipeId: `${piatti[0]}` },
    { slot: 'lunch', recipeId: `${piatti[1]}` },
    { slot: 'dinner', recipeId: `${piatti[2]}` },
  ],
});

/** Trenta giornate distinte, con piatti diversi. */
const trenta = Array.from({ length: 30 }, (_, i) =>
  giorno(`g${i}`, -(30 - i) / 10, 5 - (i % 5), [`c${i}`, `p${i}`, `d${i}`]));

describe('il pool che viene dal passato', () => {
  it('con storico sufficiente costruisce il pool dai piatti delle giornate migliori', () => {
    const esito = poolDalPassato(trenta, 28, 28)!;
    expect(esito).not.toBeNull();
    expect(esito.giornateUsate).toBe(28);
    expect(esito.pool.get('lunch')!.size).toBe(28);
    expect(esito.avviso).toBeNull();
  });

  /**
   * ⛔ **Sotto la soglia si torna `null` invece di fare del proprio meglio.** «Un mese dei tuoi
   * piatti migliori» costruito su quattro giornate sono quattro giornate girate sette volte: la
   * promessa non regge, e chi la riceve se ne accorge mangiando. Meglio il paniere normale, che è
   * pieno.
   */
  it('⛔ sotto la soglia non compone niente', () => {
    expect(poolDalPassato(trenta.slice(0, 4), 28, 28)).toBeNull();
    expect(poolDalPassato(trenta.slice(0, 27), 28, 28)).toBeNull();
    expect(poolDalPassato(trenta.slice(0, 28), 28, 28)).not.toBeNull();
  });

  it('e la soglia la decide chi chiama: è un numero di prodotto, non una costante', () => {
    expect(poolDalPassato(trenta.slice(0, 10), 28, 10)).not.toBeNull();
  });

  /**
   * ⛔ **Un pool con un pasto vuoto non è un pool**: la composizione non riuscirebbe e la cliente
   * resterebbe senza giornata.
   */
  it('⛔ se un pasto resta senza piatti si rinuncia, invece di dare un pool monco', () => {
    const monche = trenta.map((g) => ({ ...g, pasti: g.pasti.filter((m) => m.slot !== 'dinner') }));
    const esito = poolDalPassato(monche, 28, 28)!;
    // le cene non ci sono affatto: il pool ha due slot, ed è legittimo — quello che non deve
    // succedere è uno slot PRESENTE e vuoto
    expect(esito.pool.has('dinner')).toBe(false);
    expect(esito.pool.get('lunch')!.size).toBe(28);
  });

  it('senza nessuna giornata non c\'è pool', () => {
    expect(poolDalPassato([], 28, 28)).toBeNull();
    expect(poolDalPassato([], 28, 0)).toBeNull();
  });

  /**
   * ⚠️ Lo stesso piatto in due giornate diverse conta **una volta**: il pool è un insieme, e chi
   * legge «28 pranzi» deve poter contare su 28 piatti diversi.
   */
  it('⚠️ i piatti ripetuti fra giornate diverse contano una volta sola', () => {
    const conDoppioni = trenta.map((g, i) => ({
      ...g,
      pasti: g.pasti.map((m) => (m.slot === 'lunch' ? { ...m, recipeId: `p${i % 5}` } : m)),
    }));
    const esito = poolDalPassato(conDoppioni, 28, 28)!;
    expect(esito.pool.get('lunch')!.size).toBe(5);
  });

  /**
   * ⚠️ L'avviso c'è solo quando serve: se le giornate diverse sono meno di quelle chieste, chi
   * legge deve saperlo **prima** che se ne accorga la cliente.
   */
  it('⚠️ e dice quando il mese è più povero di quanto promette', () => {
    const esito = poolDalPassato(trenta.slice(0, 10), 30, 10)!;
    expect(esito.avviso).toContain('10 giornate diverse su 30');
  });
});

/**
 * ⛔ **IL POOL DAL PASSATO PASSA DALLA PORTA — trovato dalla revisione avversariale del 2/9.**
 *
 * `poolDalPassato` si costruiva la mappa a mano: era la **quarta** copia di «quali ricette, per
 * ogni pasto», e come tutte le copie era già indietro di una regola. `poolPerSlot` fa
 * l'allargamento spuntino↔merenda dalla Fase 2 (1/9), questa no — quindi una cliente su «Ritorno
 * in Equilibrio» perdeva, in silenzio, lo scambio fra i due pasti che tutte le altre hanno.
 *
 * ⚠️ È saltato fuori misurando un'altra cosa: il pool delle «ricette semplici» aveva smesso di
 * chiamare `puoStareNelloSlot` **perché** il pool è già allargato — vero su tre percorsi su
 * quattro. Quella funzione è stata poi tolta (2/9); questa correzione resta, perché l'incoerenza
 * era fra due modi di costruire `slotPool` e li legge tutto il motore.
 */
describe('il pool dal passato e l\'allargamento spuntino↔merenda', () => {
  const conSpuntini = Array.from({ length: 30 }, (_, i) => ({
    chiave: `g${i}`, caloKg: -(30 - i) / 10, gradimento: 5 - (i % 5), recenza: i,
    pasti: [
      { slot: 'breakfast', recipeId: `c${i}` },
      { slot: 'morning_snack', recipeId: `sm${i}` },
      { slot: 'lunch', recipeId: `p${i}` },
      { slot: 'afternoon_snack', recipeId: `sp${i}` },
      { slot: 'dinner', recipeId: `d${i}` },
    ],
  })) as never as GiornataDelPassato[];

  it('⛔ una merenda del suo passato è pescabile anche allo spuntino, e viceversa', () => {
    const esito = poolDalPassato(conSpuntini, 28, 28)!;
    expect(esito).not.toBeNull();
    const mattina = esito.pool.get('morning_snack')!;
    const pomeriggio = esito.pool.get('afternoon_snack')!;
    // Le due liste sono la stessa cosa: è quello che fa `allargaAiGemelli`.
    expect([...mattina].sort()).toEqual([...pomeriggio].sort());
    expect(mattina.size).toBe(56); // 28 spuntini + 28 merende
  });

  /**
   * ⚠️ **Questa non morde, e si tiene lo stesso.** Rimettendo il ciclo a mano resta verde: `trenta`
   * ha solo colazione, pranzo e cena, quindi non c'è niente da allargare. Non è una sentinella su
   * `poolPerSlot` — è la clausola che fissa il limite della regola: se un giorno `allargaAiGemelli`
   * cominciasse a **creare** chiavi, cadrebbe questa.
   */
  it('⚠️ e non inventa un pasto che le sue giornate non avevano', () => {
    const esito = poolDalPassato(trenta, 28, 28)!;
    expect(esito.pool.has('morning_snack')).toBe(false);
    expect(esito.pool.has('afternoon_snack')).toBe(false);
    expect([...esito.pool.keys()].sort()).toEqual(['breakfast', 'dinner', 'lunch']);
  });
});

