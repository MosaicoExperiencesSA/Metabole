import { describe, expect, it } from 'vitest';
import { elencoIntolleranze, statoAllergie } from './vincoliProfilo';

/**
 * ALLERGIE E INTOLLERANZE IN CIMA AL PROFILO — richiesta di Simone (16/8).
 *
 * ⚠️ La distinzione che regge tutto questo file: **«nessuna allergia» e «non ce l'hai mai detto»
 * non sono la stessa cosa**. La prima è un'affermazione — vuol dire che il piatto è libero — e
 * scriverla quando in realtà non lo sappiamo è il modo più veloce di far fidare una persona di una
 * cosa che nessuno ha verificato.
 */

describe('statoAllergie', () => {
  it('le elenca, con la maiuscola solo sulla prima', () => {
    expect(statoAllergie(['nocciole', 'latte'], '2026-08-01')).toEqual({ tipo: 'elenco', testo: 'Nocciole, latte' });
  });

  it('dichiarate e vuote: «nessuna» si può dire, perché gliel\'abbiamo chiesto', () => {
    expect(statoAllergie([], '2026-08-01')).toEqual({ tipo: 'nessuna' });
  });

  it('⚠️ mai chieste: NON si dice «nessuna» — non lo sappiamo', () => {
    expect(statoAllergie([], null)).toEqual({ tipo: 'mai_chieste' });
    expect(statoAllergie(null, null)).toEqual({ tipo: 'mai_chieste' });
    expect(statoAllergie(undefined, undefined)).toEqual({ tipo: 'mai_chieste' });
  });

  it('⚠️ se ci sono allergie, valgono anche senza la data: il dato batte il marcatore', () => {
    // Le clienti iscritte prima che la dichiarazione esistesse hanno le allergie in scheda e
    // `allergieDichiarateIl` a null. Nasconderle sarebbe il peggiore dei due errori possibili.
    expect(statoAllergie(['nocciole'], null)).toEqual({ tipo: 'elenco', testo: 'Nocciole' });
  });

  it('le voci vuote non diventano una virgola in più', () => {
    expect(statoAllergie(['nocciole', '', '  '], '2026-08-01')).toEqual({ tipo: 'elenco', testo: 'Nocciole' });
  });
});

describe('elencoIntolleranze', () => {
  it('le elenca', () => {
    expect(elencoIntolleranze(['lattosio', 'glutine'])).toBe('Lattosio, glutine');
  });

  it('⚠️ nessuna intolleranza è `null`: la riga non compare proprio', () => {
    // Diverso dalle allergie: un elenco vuoto di intolleranze non è un\'affermazione di sicurezza,
    // quindi non c\'è niente da dire — e una riga che dice «nessuna» è rumore.
    expect(elencoIntolleranze([])).toBeNull();
    expect(elencoIntolleranze(null)).toBeNull();
    expect(elencoIntolleranze(undefined)).toBeNull();
    expect(elencoIntolleranze(['', '  '])).toBeNull();
  });
});
