/**
 * ⛔ **«RICETTE SEMPLICI» È SPENTA — e l'interruttore deve esistere davvero.**
 *
 * Il 31/8 il menu del rientro di Patrizia è rimasto fermo, e i piatti che lo bloccavano non erano
 * nemmeno della sua dieta: erano biscotti della «Flexitariana», arrivati dal pool delle ricette
 * semplici. Quel pool pesca `where: { regime, active, difficulty: 'semplice', mealSlot }` — **senza
 * filtro sulla dieta** — e non mette `allergens` nel `select`, quindi la sua sicurezza è fatta di
 * sole parole: un piatto col tag Glutine che il glutine non lo nomina passa, entra nella giornata, e
 * la guardia ferma **tutta** l'erogazione.
 *
 * Simone, 31/8: *«facciamo in modo che quell'interruttore non comandi nulla, per il momento
 * disattiviamo la sua funzione»*.
 *
 * ⚠️ Questi test tengono ferme due cose che è facile perdere: che il valore di partenza sia
 * **spento**, e che l'interruttore sia **dichiarato** — un parametro che il motore legge e che nella
 * pagina Parametri non compare è un interruttore che nessuno sa di avere.
 */
import { ENGINE_RULES } from '../engine-rules/engine-rules.catalog';

const CHIAVE = 'menu_simple_recipes_enabled';

describe('l\'interruttore delle ricette semplici', () => {
  const riga = ENGINE_RULES.find((r) => r.code === CHIAVE);

  it('esiste nel catalogo dei parametri: si accende dalla pagina, non da un rilascio', () => {
    expect(riga).toBeDefined();
  });

  it('⛔ parte SPENTO: finché quel pool non filtra per dieta e non legge i tag, resta giù', () => {
    expect(riga?.default).toBe(false);
  });

  it('è un interruttore, non un numero', () => {
    expect(riga?.kind).toBe('boolean');
  });

  it('si può decidere per singola dieta, come gli altri parametri del menu', () => {
    expect(riga?.perDiet).toBe(true);
  });

  it('⚠️ la descrizione dice PERCHÉ è spenta: chi la riaccende deve sapere cosa riaccende', () => {
    const d = riga?.description ?? '';
    // Le due ragioni vere, non una frase generica: il pool ignora la dieta e ignora gli allergeni.
    expect(d).toMatch(/dieta/i);
    expect(d).toMatch(/allergen/i);
  });
});

describe('il motore legge davvero quell\'interruttore', () => {
  /**
   * ⚠️ Prova **strutturale**: il gate sta dentro `deliverIfEligible`, che per essere chiamato
   * vorrebbe mezzo database. Qui si guarda il sorgente — come fanno le altre prove di struttura del
   * progetto — perché la cosa da impedire è precisa: che qualcuno tolga la condizione e la
   * preferenza torni attiva senza che nessuna prova cada.
   */
  const sorgente = require('fs').readFileSync(`${__dirname}/menu.service.ts`, 'utf8') as string;

  it('la preferenza della cliente da sola non basta più: serve anche il parametro', () => {
    expect(sorgente).toContain('prefersSimpleRecipes && simpliciAbilitate');
  });

  it('⚠️ chi ha la preferenza accesa mentre la funzione è spenta finisce nel log, non nel silenzio', () => {
    expect(sorgente).toContain('prefersSimpleRecipes && !simpliciAbilitate');
    expect(sorgente).toMatch(/Ricette semplici: .*preferenza ACCESA ma la funzione è spenta/);
  });

  it('il valore di partenza nel codice è spento, come nel catalogo', () => {
    expect(sorgente).toContain("getBool('menu_simple_recipes_enabled', false)");
  });
});
