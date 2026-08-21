/**
 * LA CHIAVE DI UNA VOCE È UNA PAROLA SOLA — 20/8 sera.
 *
 * ⛔ Lo script con cui aggiorno le voci di questo elenco ha attaccato un pezzo di testo **dentro la
 * `chiave`** invece che nel dettaglio: cercava «la fine del campo, subito prima di `categoria`», e in
 * quella voce `categoria` viene subito dopo `chiave`. La chiave è diventata lunga 1640 caratteri, con
 * dentro degli a capo.
 *
 * ⚠️ E non è un difetto estetico: `carica:lavori` fa `findUnique({ where: { chiave } })` per decidere
 * se una voce **esiste già**. Con la chiave storpiata avrebbe creato un **doppione** invece di
 * aggiornare la voce vera — e il doppione sarebbe comparso nella pagina accanto all'originale.
 *
 * Questo test non guarda una funzione: guarda i dati, perché è lì che il difetto vive.
 */
import { VOCI_INIZIALI } from './voci-iniziali';

describe('le chiavi', () => {
  it('⛔ sono minuscole, senza spazi e senza a capo', () => {
    const rotte = VOCI_INIZIALI.filter((v) => !/^[a-z0-9-]+$/.test(v.chiave)).map((v) => v.chiave.slice(0, 50));
    expect(rotte).toEqual([]);
  });

  it('⚠️ e sono corte: una chiave lunga è quasi sempre del testo finito nel campo sbagliato', () => {
    const lunghe = VOCI_INIZIALI.filter((v) => v.chiave.length > 45).map((v) => `${v.chiave.slice(0, 40)}… (${v.chiave.length})`);
    expect(lunghe).toEqual([]);
  });

  it('non ci sono due voci con la stessa chiave: `carica:lavori` ne caricherebbe una sola', () => {
    const viste = VOCI_INIZIALI.map((v) => v.chiave);
    expect(viste).toEqual([...new Set(viste)]);
  });

  it('ogni voce ha un titolo e un dettaglio veri, non un campo scambiato con un altro', () => {
    for (const v of VOCI_INIZIALI) {
      expect(v.titolo.length).toBeGreaterThan(10);
      expect(v.titolo.length).toBeLessThan(200);
      expect(v.dettaglio.length).toBeGreaterThan(20);
    }
  });
});
