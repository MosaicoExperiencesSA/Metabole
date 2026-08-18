import { describe, expect, it } from 'vitest';
import { PORZIONE_DA_DIRE } from './porzione';

/**
 * ⚠️ IL GEMELLO DI DUE TEST CHE STANNO ALTROVE: `backend/src/menu/porzione-del-giorno.spec.ts` e
 * `app/src/lib/testo-porzione.spec.ts` tengono fermo lo stesso numero. Se qualcuno lo cambia in un
 * posto solo, uno dei tre diventa rosso — che è tutto quello che serve.
 */
describe('la soglia della porzione è una sola, in tre posti', () => {
  it('vale 1,05 anche qui', () => {
    expect(PORZIONE_DA_DIRE).toBe(1.05);
  });
});
