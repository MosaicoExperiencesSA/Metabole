import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_MODULES,
  DEFAULT_CHART_KEYS,
  DEFAULT_MODULE_IDS,
  DEFAULT_SHORTCUT_IDS,
  homeDiFabbrica,
} from './dashboardModules';

/**
 * «RIPRISTINA DEFAULT» — la strada di ritorno, e per settimane ne copriva un pezzo solo.
 *
 * Simone, 18/8: «non esistono blocchi fissi, tutti sono attivabili o spegnibili e si possono
 * riorganizzare; quelli di default sono evidenziati da un colore diverso, e **se un utente si è
 * perso preme il pulsante (ripristina default) e noi provvediamo**».
 *
 * ⛔ Il pulsante c'era e rimetteva **solo i moduli**. Chi si era perso spegnendo il portafoglio, gli
 * avvisi o la tabella clienti — che si salvano altrove, in `dashboardBlocksOff` — lo premeva e non
 * tornava niente. Un pulsante di soccorso che soccorre un terzo dei casi è **peggio** di nessun
 * pulsante: chi lo preme e non vede tornare la sua roba conclude che non si può più recuperare.
 */
describe('la home di fabbrica', () => {
  it('⚠️ rimette tutte e quattro le cose che compongono la home, non solo i moduli', () => {
    expect(Object.keys(homeDiFabbrica()).sort()).toEqual([
      'dashboardBlocksOff', 'dashboardCharts', 'dashboardModules', 'dashboardShortcuts',
    ]);
  });

  /** I blocchi nascono ACCESI e si spengono: «tutti accesi» è l'elenco degli spenti vuoto. */
  it('⚠️ i blocchi tornano tutti accesi', () => {
    expect(homeDiFabbrica().dashboardBlocksOff).toEqual([]);
  });

  /**
   * ⚠️ LE SCORCIATOIE SI RISCRIVONO PER ESTESO, NON SI AZZERANO. Chi le legge fa
   * `prefs.dashboardShortcuts ?? DEFAULT`, e un array **vuoto non è nullo**: salvare `[]` darebbe
   * una dashboard senza nessuna scorciatoia — l'opposto di «ripristina».
   */
  it('⚠️ le scorciatoie tornano quelle vere, non un elenco vuoto', () => {
    expect(homeDiFabbrica().dashboardShortcuts).toEqual(DEFAULT_SHORTCUT_IDS);
    expect(homeDiFabbrica().dashboardShortcuts.length).toBeGreaterThan(0);
  });

  it('i grafici tornano i tre predefiniti', () => {
    expect(homeDiFabbrica().dashboardCharts).toEqual(DEFAULT_CHART_KEYS);
  });

  /**
   * ⚠️ NON SI SALVANO RIGHE MORTE. Il default dei moduli è uno e globale, e contiene id che un
   * coach non ha il permesso di aprire: rimetterli tutti scriverebbe nelle sue preferenze voci
   * invisibili, che restano lì e riemergono il giorno che il permesso arriva.
   */
  it('⚠️ i moduli si filtrano su quelli che quel ruolo vede davvero', () => {
    expect(homeDiFabbrica(['m_clienti']).dashboardModules).toEqual(['m_clienti']);
    expect(homeDiFabbrica([]).dashboardModules).toEqual([]);
  });

  it('senza filtro tornano tutti i predefiniti: è il caso dell\'admin', () => {
    expect(homeDiFabbrica().dashboardModules).toEqual(DEFAULT_MODULE_IDS);
  });

  /** I predefiniti devono esistere davvero nel catalogo, o il pulsante rimetterebbe fantasmi. */
  it('⚠️ ogni modulo predefinito esiste nel catalogo', () => {
    const ids = new Set(DASHBOARD_MODULES.map((m) => m.id));
    expect(DEFAULT_MODULE_IDS.filter((id) => !ids.has(id))).toEqual([]);
  });

  /** ⚠️ E non ritorna lo stesso array: chi lo riceve lo modifica, e modificherebbe la costante. */
  it('⚠️ torna copie, non le costanti', () => {
    const a = homeDiFabbrica();
    a.dashboardCharts.push('inventato');
    a.dashboardShortcuts.push('inventato');
    expect(DEFAULT_CHART_KEYS).not.toContain('inventato');
    expect(DEFAULT_SHORTCUT_IDS).not.toContain('inventato');
  });
});
