/**
 * ⛔ **«RICETTE SEMPLICI» NON C'È PIÙ, E QUESTE PROVE SERVONO A NON RIMETTERLA PER SBAGLIO.**
 *
 * Il 31/8 il menu del rientro di Patrizia è rimasto fermo, e i piatti che lo bloccavano non erano
 * nemmeno della sua dieta: erano biscotti della «Flexitariana», arrivati dal pool delle ricette
 * semplici. Quel pool pescava `where: { regime, active, difficulty: 'semplice', mealSlot }` —
 * **senza filtro sulla dieta** — e non metteva `allergens` nel `select`, quindi la sua sicurezza era
 * fatta di sole parole: un piatto col tag Glutine che il glutine non lo nomina passava, entrava
 * nella giornata, e la guardia fermava **tutta** l'erogazione.
 *
 * Simone, 31/8: *«facciamo in modo che quell'interruttore non comandi nulla, per il momento
 * disattiviamo la sua funzione»*. Il 2/9 il difetto è stato riparato — pool della sua dieta,
 * `valutaRicetta`, tag compresi — e poi Simone ha deciso l'altra cosa: *«io lo lascerei spento
 * sai... anzi lo toglierei proprio»*.
 *
 * ⛔ **Riparare e togliere sono due decisioni diverse**, e la seconda la prende chi fa il prodotto:
 * una funzione che non serve non si tiene spenta «per quando servirà», perché il codice che non
 * gira invecchia senza che nessuno se ne accorga — questa era ancora scritta nel modo che aveva
 * fermato il menu di Patrizia due giorni dopo essere stata spenta.
 *
 * ⚠️ Quello che resta acceso, e che queste prove tengono fermo, è che **non torni da sola**.
 */
import { ENGINE_RULES } from '../engine-rules/engine-rules.catalog';

const CHIAVE = 'menu_simple_recipes_enabled';
const sorgente = require('fs').readFileSync(`${__dirname}/menu.service.ts`, 'utf8') as string;

describe('la preferenza «ricette semplici» è stata tolta', () => {
  it('⛔ il parametro non esiste più nel catalogo: non c\'è un interruttore da riaccendere', () => {
    expect(ENGINE_RULES.find((r) => r.code === CHIAVE)).toBeUndefined();
  });

  it('⛔ e il motore non lo legge da nessuna parte', () => {
    expect(sorgente).not.toContain(CHIAVE);
  });

  it('⛔ il pool «semplici» e la sostituzione per difficoltà non ci sono più', () => {
    expect(sorgente).not.toContain('buildSimpleSlotPool');
    expect(sorgente).not.toContain('applySimplePreference');
    /**
     * ⚠️ Si cerca la **query**, non le parole: `difficulty: 'semplice'` compare ancora nel commento
     * che racconta com'era fatta, ed è giusto che ci sia. Quello che non deve tornare è una `where`
     * che ci pesca dentro.
     */
    expect(sorgente).not.toMatch(/where:[^\n]*difficulty/);
  });

  /**
   * ⚠️ **Il commento che racconta perché**, e non è pignoleria: senza, fra sei mesi qualcuno vede
   * un campo `prefersSimpleRecipes` che nessuno legge, lo prende per una dimenticanza e o lo
   * ricollega o lo cancella. Tutti e due sarebbero sbagliati, e per la stessa ragione — non sapere
   * cos'è successo il 31 agosto.
   */
  it('⚠️ e il motore dice perché non c\'è più, invece di lasciare un buco', () => {
    expect(sorgente).toMatch(/«RICETTE SEMPLICI» NON ESISTE PIÙ/);
    expect(sorgente).toMatch(/prefersSimpleRecipes.* resta/);
  });
});

describe('quello che NON si è tolto, e perché', () => {
  const dto = require('fs').readFileSync(`${__dirname}/../profile/dto/update-profile.dto.ts`, 'utf8') as string;

  /**
   * ⛔ **IL CAMPO NEL DTO RESTA, e toglierlo sarebbe un guasto.**
   *
   * L'interruttore nel Profilo dell'app manda `prefersSimpleRecipes` a ogni salvataggio. Un DTO che
   * non lo accetta più risponde **400 a tutte le app già installate**: la cliente non salva più il
   * profilo — nome, obiettivo, allergie — per un campo che non serve a nessuno. Sparisce dall'app
   * al prossimo rilascio, e il DTO lo segue quando le versioni vecchie non sono più in giro.
   */
  it('⛔ `prefersSimpleRecipes` resta nel DTO: le app installate lo mandano ancora', () => {
    expect(dto).toContain('prefersSimpleRecipes');
  });

  /**
   * ⚠️ La prima stesura cercava `/app già installate|rilascio/`, e «rilascio» compare in mezza
   * pagina di quel file: era verde anche cancellando la spiegazione. Adesso chiede la **conseguenza**
   * — il 400 — che è la sola cosa che ferma la mano a chi passa di lì a pulire.
   */
  it('⚠️ e il DTO dice cosa SUCCEDE a toglierlo, non solo che va tolto un giorno', () => {
    /**
     * ⚠️ La frase intera, non la parola «400» da sola: `400` compare in altri due punti di quel
     * file (il `forbidNonWhitelisted` e la finestra del digiuno), quindi cercarla e basta sarebbe
     * verde anche cancellando questo commento.
     */
    expect(dto).toMatch(/risponde 400 a tutte[\s\S]{0,40}\*\*app già installate\*\*/);
  });
});
