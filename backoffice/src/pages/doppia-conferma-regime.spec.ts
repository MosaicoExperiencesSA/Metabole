import { describe, expect, it } from 'vitest';

const sorgenti = import.meta.glob('./Ricette.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ricette = sorgenti['./Ricette.tsx'] ?? '';

/**
 * ⛔ **LA DOPPIA CONFERMA È UN SECONDO PASSO, NON UN CAMPO IN PIÙ** (Simone, 4/9: «2 chiede doppia
 * conferma»).
 *
 * ⚠️ Il difetto che queste righe impediscono è già successo su questo progetto, sulla scrittura del
 * menu a mano: `conferma` calcolata **nello stesso clic** del salvataggio. Così non è una conferma —
 * è un campo che il codice si mette da solo — e per giunta lì sbagliava anche il valore, lasciando
 * senza uscita proprio il caso che doveva sbloccare.
 */
describe('il regime che il contenuto smentisce chiede una seconda conferma', () => {
  it('⛔ `confermaRegime` si manda solo quando `save` è chiamata con la conferma', () => {
    expect(ricette).toMatch(/async function save\(conferma = false\)/);
    expect(ricette).toMatch(/\.\.\.\(conferma \? \{ confermaRegime: true \} : \{\}\)/);
  });

  /**
   * ⛔ **«Non si può» e «va confermato» restano due cose.** L'elenco ingredienti vuoto è un errore
   * rosso senza scampatoia — non è una decisione di nessuno, è una dimenticanza; il regime chiede.
   */
  it('⛔ il prefisso «Da confermare:» si legge, e non finisce fra gli errori rossi', () => {
    expect(ricette).toMatch(/messaggio\.startsWith\('Da confermare:'\)/);
    expect(ricette).toMatch(/setDaConfermare\(messaggio\.replace/);
  });

  /**
   * ⛔ **Il secondo pulsante compare solo dopo la frase del server.** Un pulsante «salva lo stesso»
   * sempre a schermo insegna a cliccare senza leggere «lo stesso che cosa».
   */
  it('⛔ il pulsante di conferma esiste solo quando c\'è qualcosa da confermare', () => {
    expect(ricette).toMatch(/\{daConfermare\s*\n?\s*\? \(/);
    expect(ricette).toMatch(/Ho letto, salva lo stesso/);
  });

  it('⚠️ e quello che c\'è da leggere si vede, non solo il pulsante', () => {
    expect(ricette).toMatch(/Da leggere prima di salvare/);
  });

  /**
   * ⛔ **IL PULSANTE NORMALE NON DEVE PASSARE L'EVENTO A `save`.**
   *
   * `onClick={save}` passa l'evento React come primo argomento: un oggetto, quindi **truthy**,
   * quindi `confermaRegime: true` **al primo clic** — e la doppia conferma sparisce del tutto,
   * senza che niente diventi rosso. Una revisione avversariale l'ha misurato mutando quella riga:
   * 283 prove su 283 restavano verdi, perché questa spec guardava la **firma** di `save` e il
   * pulsante di conferma, mai **come viene chiamata** dal pulsante normale.
   */
  it('⛔ il pulsante normale chiama save() SENZA argomenti', () => {
    expect(ricette).toMatch(/onClick=\{\(\) => void save\(\)\}/);
    expect(ricette).not.toMatch(/onClick=\{save\}/);
  });
});
