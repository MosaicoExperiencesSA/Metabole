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
   * ⚠️ I MODULI **NON** SI FILTRANO SUI PERMESSI, e stamattina lo facevo — la revisione
   * avversariale del 19/8 sera ha mostrato due modi in cui il filtro peggiorava le cose:
   *
   * ⛔ una coach senza «Bonifici» premeva il pulsante e si salvava una lista **senza** quel modulo:
   * il giorno che il permesso arrivava, il modulo non tornava più. Il filtro aveva reso permanente
   * una restrizione che prima era dinamica.
   * ⛔ e un ruolo che non vedesse nessuno dei quattro predefiniti si salvava `[]`, che **non è
   * nullo**: il ripiego `?? DEFAULT` non scatta più e la home resta vuota per sempre — la stessa
   * trappola documentata per le scorciatoie, tre righe più su.
   *
   * ⚠️ Chi filtra è la **lettura**. La preferenza dice cosa vuole la persona, il permesso cosa può
   * vedere oggi: due cose che cambiano per ragioni diverse.
   */
  it('⚠️ rimette SEMPRE tutti i predefiniti, permessi o no', () => {
    expect(homeDiFabbrica().dashboardModules).toEqual(DEFAULT_MODULE_IDS);
  });

  it('⚠️ e non può mai tornare una lista vuota: `[]` non fa scattare il ripiego di chi legge', () => {
    expect(homeDiFabbrica().dashboardModules.length).toBeGreaterThan(0);
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
    a.dashboardModules.push('inventato');
    a.dashboardShortcuts.push('inventato');
    expect(DEFAULT_CHART_KEYS).not.toContain('inventato');
    expect(DEFAULT_SHORTCUT_IDS).not.toContain('inventato');
    expect(DEFAULT_MODULE_IDS).not.toContain('inventato');
  });
});
