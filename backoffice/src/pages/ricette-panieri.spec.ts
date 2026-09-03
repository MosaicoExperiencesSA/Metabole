import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./Ricette.tsx', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const pagina = sorgenti['./Ricette.tsx'] ?? '';

/**
 * ⛔ **«DOVE È USATA» È STATA TOLTA DAL POPUP — decisione di Simone, 3/9.**
 *
 * Il 2/9 le due sezioni convivevano, ed era già scritto qui perché fossero **due domande diverse**:
 * «Dove è usata» sono le **giornate** che nominano il piatto, «In quali panieri» è il **pool** da
 * cui il motore pesca. Con `panieri_sorgente_pool` su `paniere` è il secondo a decidere cosa arriva
 * nel piatto di una cliente, e le giornate sono diventate storia.
 *
 * ⛔ Il passo successivo era inevitabile: un elenco che **sembra comandare** e non comanda più — con
 * un pulsante «Togli» per ogni riga — è peggio di un elenco che non c'è. Resta la stessa domanda,
 * fatta alla porta giusta.
 */
describe('la sezione dei panieri nel popup della ricetta', () => {
  it('⛔ «Dove è usata» non c\'è più: restano i panieri, che sono la porta vera', () => {
    expect(pagina).toMatch(/function InQualiPanieri/);
    expect(pagina).toMatch(/<InQualiPanieri recipe=\{recipe\}/);
    expect(pagina).not.toMatch(/<DoveUsata/);
    expect(pagina).not.toMatch(/function DoveUsata/);
  });

  /** ⚠️ E il motivo resta scritto nella pagina: senza, fra sei mesi sembra una dimenticanza. */
  it('⚠️ e la pagina dice PERCHÉ è stata tolta', () => {
    expect(pagina).toMatch(/«DOVE È USATA» È STATA TOLTA/);
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
