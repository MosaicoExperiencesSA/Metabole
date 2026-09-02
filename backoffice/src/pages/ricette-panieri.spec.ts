import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./Ricette.tsx', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const pagina = sorgenti['./Ricette.tsx'] ?? '';

/**
 * ⛔ **«DOVE È USATA» E «IN QUALI PANIERI STA» SONO DUE DOMANDE DIVERSE** — richiesta di Simone del
 * 2/9, e la parte concettuale che conta.
 *
 * La prima sono le **giornate** che nominano il piatto; la seconda è il **pool** da cui il motore
 * pesca. Con `panieri_sorgente_pool` su `paniere` è la seconda a decidere cosa arriva nel piatto di
 * una cliente, e le giornate diventano storia. Mescolarle in un elenco solo farebbe credere che
 * togliere una riga di «Dove è usata» tolga il piatto dai menu — e da quel giorno non è più vero.
 */
describe('la sezione dei panieri nel popup della ricetta', () => {
  it('⛔ è una sezione a parte, non righe in fondo a «Dove è usata»', () => {
    expect(pagina).toMatch(/function InQualiPanieri/);
    expect(pagina).toMatch(/<DoveUsata recipe=\{recipe\}/);
    expect(pagina).toMatch(/<InQualiPanieri recipe=\{recipe\}/);
  });

  it('⛔ e dice che il paniere è una cosa diversa dalle giornate', () => {
    expect(pagina).toMatch(/da dove il motore pesca/);
  });

  /**
   * ⛔ **Il motivo si dice PRIMA del clic che fallirebbe.** Il server rifiuta una ricetta spenta o
   * con gli allergeni non confermati: scoprirlo premendo un pulsante, paniere per paniere, è far
   * cercare a qualcuno una cosa che sappiamo già.
   */
  it('⛔ se non si può aggiungere, lo dice prima invece di far fallire il clic', () => {
    expect(pagina).toMatch(/stato\.bloccata \?/);
  });

  /**
   * ⛔ **Se il terzo di cinque fallisce, i primi due sono scritti davvero.** Dire «non riuscito» e
   * basta nasconderebbe due scritture avvenute, e chi legge riproverebbe tutto.
   */
  it('⛔ aggiungendo a più panieri conta i riusciti e i falliti separatamente', () => {
    expect(pagina).toMatch(/const fatti: string\[\] = \[\];/);
    expect(pagina).toMatch(/const falliti: string\[\] = \[\];/);
  });

  /**
   * ⚠️ Chi non ha la chiave `panieri` non deve vedere un errore rosso in fondo alla scheda: la
   * sezione semplicemente non c'è. Un 403 previsto non è un guasto da mostrare.
   */
  it('⚠️ e senza la chiave `panieri` la sezione sparisce invece di mostrare un errore', () => {
    expect(pagina).toMatch(/e\.status === 403 \|\| e\.status === 401/);
  });

  /** ⚠️ La conferma dice cosa cambia per le clienti, come nella pagina Panieri. */
  it('⚠️ togliere da un paniere dice cosa cambia per le clienti', () => {
    expect(pagina).toMatch(/Non lo riceverà più nessuna cliente di quel paniere/);
  });
});
