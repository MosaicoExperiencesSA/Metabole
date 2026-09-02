import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./ClientDetail.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../../backend/src/personal-base/personal-base.controller.ts', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const src = (f: string) => sorgenti[f] ?? '';

/**
 * ⛔ **IL PULSANTE CHE MANCAVA** — 2/9. L'endpoint `POST /clients/:id/personal-base/rebuild` esiste
 * dal principio e **nessuna schermata lo chiamava**: una porta senza maniglia, cioè «una chiave
 * dichiarata che non accende niente» (`CLAUDE.md`).
 *
 * ⚠️ Serve perché la ricostruzione automatica, giustamente, non copre il caso di una cliente **già**
 * spostata: lì non cambia nessun campo, quindi non scatta niente. Era il caso delle diciannove
 * della Fase 9.
 */
describe('il pulsante «Rifai base ricette»', () => {
  const pagina = src('./ClientDetail.tsx');
  const controller = src('../../../backend/src/personal-base/personal-base.controller.ts');

  it('⚠️ vede tutti e due i file', () => {
    expect(pagina.length).toBeGreaterThan(1000);
    expect(controller).toMatch(/personal-base\/rebuild/);
  });

  it('⛔ chiama l\'endpoint che esiste', () => {
    expect(controller).toMatch(/@Post\('clients\/:id\/personal-base\/rebuild'\)/);
    expect(pagina).toMatch(/\/clients\/\$\{id\}\/personal-base\/rebuild/);
  });

  /**
   * ⛔ **Gli stessi ruoli dell'endpoint, e non uno di più.** Mostrarlo a una coach vorrebbe dire
   * farle premere una cosa che risponde 403 — la stessa lezione del pulsante «Modifica» nei
   * panieri.
   */
  it('⛔ e lo mostra solo a chi l\'endpoint accetta', () => {
    expect(controller).toMatch(/@Roles\('nutritionist', 'head_nutritionist', 'admin'\)[\s\S]{0,120}?rebuildFor/);
    expect(pagina).toMatch(/puoRifareLaBase = eNutrizionista\(me\?\.role\) \|\| me\?\.role === 'admin'/);
    expect(pagina).toMatch(/\{puoRifareLaBase && \(/);
  });

  /**
   * ⛔ **L'esito `blocked` si legge come errore, non come «fatto».** `buildPersonalBase` può
   * rispondere che con i dati di oggi la base non si certifica, e apre una segnalazione: è la
   * risposta, ed è quella che serve sapere. Un pulsante che dicesse «fatto» in tutti e due i casi
   * sarebbe peggio di nessun pulsante.
   */
  it('⛔ distingue «rifatta» da «bloccata», e dice i motivi', () => {
    expect(pagina).toMatch(/r\.status === 'ready'/);
    expect(pagina).toMatch(/Base personale rifatta/);
    expect(pagina).toMatch(/Base NON certificabile/);
    expect(pagina).toMatch(/r\.reasons \?\? \[\]/);
  });

  /** ⚠️ E la conferma dice cosa succede, non «sei sicuro?». */
  it('⚠️ la conferma spiega cos\'è la base e cosa può succedere', () => {
    expect(pagina).toMatch(/cambio di piatto in chat/);
    expect(pagina).toMatch(/il piano viene bloccato e si apre una segnalazione/);
    const senzaCitazioni = pagina.replace(/«[^»]*»/g, ' ');
    expect(senzaCitazioni).not.toMatch(/sei sicuro/i);
  });
});
