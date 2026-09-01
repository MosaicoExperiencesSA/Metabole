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
