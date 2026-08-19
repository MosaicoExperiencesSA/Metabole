import { describe, expect, it } from 'vitest';
import { etichetteDaMostrare } from './etichetteAsse';

/** Gli indici che finiscono sull'asse, per leggerli come li vede chi guarda il grafico. */
const mostrati = (n: number, max?: number) =>
  etichetteDaMostrare(n, max)
    .map((si, i) => (si ? i : -1))
    .filter((i) => i >= 0);

describe('etichetteDaMostrare', () => {
  it('con pochi punti si scrivono tutti: è il caso della dashboard e dei grafici clienti', () => {
    expect(mostrati(1)).toEqual([0]);
    expect(mostrati(4)).toEqual([0, 1, 2, 3]);
    expect(mostrati(6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  /**
   * ⚠️ IL CASO CHE VALE IL MODULO: i dodici mesi della contabilità. Tutti e dodici scritti sotto una
   * scheda da 320 px si sovrappongono fino a diventare una riga grigia — e un'etichetta illeggibile
   * è come un'etichetta assente, solo che sembra messa apposta.
   */
  it('⚠️ con dodici mesi se ne scrive una ogni due', () => {
    expect(mostrati(12)).toEqual([1, 3, 5, 7, 9, 11]);
  });

  /**
   * ⚠️ L'ULTIMA C'È SEMPRE. È il mese che si sta guardando, quello dei numeri grandi in cima alla
   * pagina: senza la sua etichetta il grafico direbbe un numero senza dire di quando.
   */
  it('⚠️ l\'ultima etichetta non si dirada mai, qualunque sia il numero di punti', () => {
    for (let n = 1; n <= 40; n++) {
      expect(etichetteDaMostrare(n)[n - 1]).toBe(true);
    }
  });

  /** ⚠️ E il passo è regolare: due etichette vicine non devono mai finire attaccate. */
  it('⚠️ le etichette mostrate sono equidistanti', () => {
    const indici = mostrati(25);
    const passi = indici.slice(1).map((v, i) => v - indici[i]);
    expect(new Set(passi).size).toBe(1);
  });

  it('non si scrive mai più del massimo chiesto', () => {
    for (let n = 1; n <= 40; n++) {
      expect(mostrati(n).length).toBeLessThanOrEqual(6);
    }
  });

  it('nessun punto, nessuna etichetta', () => {
    expect(etichetteDaMostrare(0)).toEqual([]);
  });
});
