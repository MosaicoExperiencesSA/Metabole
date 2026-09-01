import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./Panieri.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../App.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../components/Layout.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../lib/labels.ts', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;

const src = (f: string) => sorgenti[f] ?? '';

/**
 * ⛔ **UNA PAGINA NUOVA È QUATTRO COSE, NON UNA** — regola di progetto (`CLAUDE.md`, Simone 13/8):
 * la chiave nei permessi, l'etichetta, la rotta e la voce di menu. ⚠️ Dimenticarne una non rompe
 * niente in modo visibile: la pagina esiste e funziona, ma o non compare nel menu, o compare nei
 * Permessi con la **chiave grezza**, o è raggiungibile solo scrivendo l'indirizzo a mano.
 *
 * ⛔ E la guardia sull'endpoint sta nel backend (`panieri-guardia.spec.ts`): senza quella, la
 * chiave qui sarebbe un interruttore che non accende niente.
 */
describe('la pagina Panieri è dichiarata dappertutto', () => {
  it('⛔ ha la rotta, protetta dalla sua chiave', () => {
    expect(src('../App.tsx')).toMatch(/path="\/panieri"[\s\S]{0,120}?pageKey="panieri"/);
  });

  it('⛔ ha la voce di menu, con la stessa chiave', () => {
    expect(src('../components/Layout.tsx')).toMatch(/key: 'panieri',[\s\S]{0,80}?to: '\/panieri'/);
  });

  it('⛔ ha l\'etichetta, o nei Permessi comparirebbe la chiave grezza', () => {
    expect(src('../lib/labels.ts')).toMatch(/panieri: '[^']+'/);
  });
});

/**
 * ⚠️ Le due cose che la pagina deve **dire**, e che non sono decorazione: chi legge questa tabella
 * decide cosa mangiano centinaia di persone.
 */
describe('quello che la pagina spiega', () => {
  const pagina = src('./Panieri.tsx');

  /**
   * ⛔ **Il pulsante che toglie un piatto cambia il menu di TUTTE le clienti del paniere.** Una
   * conferma che dice «sei sicuro?» non informa nessuno: deve dire cosa cambia, e per chi.
   */
  it('⛔ la conferma dice cosa cambia per le clienti, non «sei sicuro?»', () => {
    expect(pagina).toMatch(/Non lo riceverà più nessuna cliente di questo paniere/);
    /**
     * ⚠️ **Le citazioni non contano** — la stessa lezione della sentinella sul cron, imparata
     * un'ora prima: qui sopra la frase sbagliata è **citata** per dire di non usarla, e cercare
     * le parole nude farebbe cadere la prova sul commento che la spiega. Un guardiano che vieta
     * di scrivere la lezione cancella la lezione.
     */
    const senzaCitazioni = pagina.replace(/«[^»]*»/g, ' ');
    expect(senzaCitazioni).not.toMatch(/sei sicuro/i);
  });

  /** ⚠️ E il pulsante esiste solo per chi ha `manage`: la sola vista non tocca niente. */
  it('⚠️ togliere è solo di chi ha `manage`', () => {
    expect(pagina).toMatch(/can\('panieri', 'manage'\)/);
    expect(pagina).toMatch(/puoGestire && \(\s*<td>/);
  });

  /**
   * ⚠️ Una ricetta in bozza sta nel paniere ma il motore non la usa. Mostrarla senza dirlo
   * farebbe contare piatti che a nessuna cliente arrivano.
   */
  it('⚠️ una bozza si vede per quello che è', () => {
    expect(pagina).toMatch(/bozza — il motore non la usa/);
  });

  /** ⚠️ Spuntino e merenda sono un paniere solo, e chi apre l'elenco deve saperlo. */
  it('⚠️ e lo dice che i due spuntini sono lo stesso paniere', () => {
    expect(pagina).toMatch(/pescano dallo stesso paniere/);
  });
});
