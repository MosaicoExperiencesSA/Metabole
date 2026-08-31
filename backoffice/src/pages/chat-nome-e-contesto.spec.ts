import { describe, expect, it } from 'vitest';

const SORGENTI: Record<string, string> = import.meta.glob('./*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const chat = SORGENTI['./Chat.tsx'] ?? '';

/**
 * Le due cose chieste da Simone il 31/8 guardando la chat con Sonia.
 *
 * ⚠️ Sono prove sul SORGENTE, come le altre di questa cartella: dicono che la riga c'è, non che si
 * comporta bene. Il comportamento del contesto è collaudato dove nasce
 * (`backend/src/menu/contesto-per-lo-staff.spec.ts`).
 */
describe('Chat — il nome apre la scheda, e un «1» non arriva nudo', () => {
  it('il file c\'è', () => {
    expect(chat).not.toBe('');
  });

  it('⛔ il nome della cliente è un link alla sua scheda, in un\'ALTRA finestra', () => {
    // ← prima era `<b>{nameOf(sel)}</b>`: per guardare la scheda si perdeva la conversazione.
    expect(chat).toMatch(/href=\{`\/clienti\/\$\{sel\.client\.id\}`\}/);
    expect(chat).toMatch(/target="_blank"/);
  });

  it('⚠️ e solo a chi ha il permesso della scheda: `chat` e `clients` sono due permessi diversi', () => {
    // Senza, una coach senza `clients` aprirebbe «accesso non consentito».
    expect(chat).toMatch(/can\('clients'\)/);
  });

  it('⛔ il contesto del messaggio inoltrato si mostra: un «1» da solo non si capisce', () => {
    expect(chat).toMatch(/meta\?\.contesto/);
    // Il tipo lo deve dichiarare, o il campo non arriva mai fin qui.
    expect(chat).toMatch(/meta\?:\s*\{\s*contesto\?:/);
  });
});
