import { describe, expect, it } from 'vitest';

const sorgenti = import.meta.glob('./MenuAMano.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const menu = sorgenti['./MenuAMano.tsx'] ?? '';

/**
 * ⚠️ **Il testo SENZA i commenti**, come in `giorno-aperto-si-riscrive.spec.ts` e per la stessa
 * ragione: le note di questo progetto **citano la riga vecchia** per spiegare perché è stata
 * cambiata, e un `not.toContain` sul sorgente grezzo sarebbe rosso su una prova giusta.
 */
const senzaCommenti = menu
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((r) => !/^\s*(\/\/|\*)/.test(r))
  .join('\n');

/**
 * ⛔ **LA SCHERMATA NON RIPARTE PIÙ DA ZERO** — richiesta di Simone, 14/9: *«se scelgo un giorno già
 * erogato dovrebbe comparire il menu esistente, così se il nutrizionista deve modificare solo uno
 * dei pasti non perde tutto il resto»*.
 *
 * ⚠️ **Queste sono prove `grep`, e il progetto sa già quanto valgono**: sorvegliano una riga, non
 * una regola (`giorno-aperto-si-riscrive.spec.ts` lo dice per esteso, e il backoffice non ha
 * `@testing-library`). Il giudizio vero — cosa si ripropone e cosa no — sta nel modulo puro del
 * backend, `giornata-gia-scritta.spec.ts`, dove si prova davvero. Qui si sorveglia una cosa sola e
 * precisa: che il caricamento non torni a **buttare via** quello che il server manda, che è il
 * difetto che questa consegna ha corretto e il più facile da rimettere per sbaglio in un riordino.
 */
describe('scrivere il menu a mano su un giorno che c\'è già', () => {
  it('⛔ il caricamento non azzera più le scelte', () => {
    expect(senzaCommenti).not.toMatch(/setScelte\(\{\}\);\s*setSlotAperto/);
    expect(senzaCommenti).toMatch(/setScelte\(pastiGiaScritti\(c\)\)/);
  });

  /**
   * ⛔ **Nome, kcal e verdetto arrivano dal SERVER.** Se un giorno qualcuno componesse le righe qui
   * dai `meals`, la schermata mostrerebbe lo scatto di quando il giorno è stato scritto — e un
   * piatto diventato incompatibile nel frattempo comparirebbe **non barrato**. È lo stesso motivo
   * per cui il `POST` manda solo `slot` e `recipeId`.
   */
  it('⛔ le righe si leggono da `esistente.pasti`, non da `meals`', () => {
    expect(senzaCommenti).toMatch(/c\?\.esistente\?\.pasti \?\? \[\]/);
    expect(senzaCommenti).not.toContain('esistente.meals');
  });

  /** ⛔ E quello che non si è potuto riportare si dice, col nome: una riga che sparisce mente. */
  it('⛔ i pasti non riproposti si mostrano', () => {
    expect(senzaCommenti).toMatch(/cornice\?\.esistente\?\.nonRiproposti\?\.length \? \(/);
    expect(senzaCommenti).toContain('Non si è potuto riportare tutto.');
  });

  /** ⚠️ E chi apre deve leggere da dove vengono i piatti che trova nei riquadri. */
  it('⚠️ la riga informativa dice che il menu è riportato qui sotto', () => {
    expect(senzaCommenti).toContain('riportato qui sotto');
  });
});
