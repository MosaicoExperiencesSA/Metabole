import { capisci } from './capisci';
import { testi } from './vera-chat';

/**
 * ⛔ **IL GRUPPO «LISTE DI CATALOGO»** della voce `vera-vocabolario-quattro-gruppi`, misurato il
 * 31/8 e chiuso il 3/9.
 *
 * ⚠️ Il grosso non erano forme sconosciute: erano **varianti di forme già capite**, e la differenza
 * fra il capire e il non capire era una preposizione o un apostrofo. «crea la lista **dei** formaggi
 * molli» funzionava, «crea una lista **con** i formaggi molli» no; «aggiungi **un'**equivalenza»
 * funzionava, «aggiungi **una** equivalenza» no. *Una nutrizionista che scrive la stessa cosa in due
 * modi e ne vede funzionare uno non impara la regola: impara che «a volte non funziona».*
 */
describe('⚠️ le varianti della stessa richiesta si capiscono tutte', () => {
  it.each([
    ['crea la lista dei formaggi molli'],
    ['crea una lista con i formaggi molli'],
    ['crea una lista di formaggi molli'],
    ['fammi una lista con i formaggi molli'],
    ['fammi la lista dei formaggi molli'],
    ['prepara la lista dei formaggi molli'],
    ['rifai la lista dei formaggi molli'],
  ])('«%s» → la lista si crea', (frase) => {
    expect(capisci(frase)).toEqual({ tipo: 'famiglia', azione: 'crea', nome: 'formaggi molli' });
  });

  it.each([
    ["aggiungi un'equivalenza tra pane e gallette"],
    ['aggiungi una equivalenza fra pane e gallette'],
    ['crea una equivalenza fra pane e gallette'],
    ['metti pane e gallette nella stessa equivalenza'],
  ])('«%s» → l\'equivalenza si legge', (frase) => {
    expect(capisci(frase)).toEqual({ tipo: 'equivalenza', alimenti: ['pane', 'gallette'], nome: null });
  });

  /** ⚠️ E «aggiungi equivalenza» secco resta una richiesta capita: si chiede quali alimenti. */
  it('⚠️ «aggiungi equivalenza» da solo è capito, e la risposta è una domanda', () => {
    expect(capisci('aggiungi equivalenza')).toEqual({ tipo: 'equivalenza', alimenti: [], nome: null });
  });
});

/**
 * ⛔ **CAMBIARE UNA LISTA NON È VIETARE UN ALIMENTO A UNA CLIENTE.**
 *
 * «togli» è la stessa parola con cui si vieta un alimento, e il riconoscitore dei divieti prendeva
 * tutta la coda:
 *
 * ```
 * «togli le gallette dalla lista dei formaggi molli»
 *    → restrizione, vietati: ["gallette dalla lista dei formaggi molli"]
 * ```
 *
 * ⚠️ Il divieto era **inerte** — nessun alimento si chiama così — ma con un'anteprima plausibile, e
 * alla domanda «su quale cliente?» si sarebbe scritto un divieto vero su un termine inventato.
 */
describe('⛔ le frasi che cambiano una lista non diventano divieti su una cliente', () => {
  it.each([
    ['aggiungi le gallette alla lista dei formaggi molli'],
    ['togli le gallette dalla lista dei formaggi molli'],
    ['nella lista dei formaggi molli aggiungi la ricotta'],
    ['elimina la ricotta dalla lista dei formaggi molli'],
  ])('«%s» → si dice che è la lista «formaggi molli»', (frase) => {
    expect(capisci(frase)).toEqual({
      tipo: 'fuori_portata',
      cosa: 'voce_di_lista',
      dettaglio: 'formaggi molli',
    });
  });

  /**
   * ⛔ **E i divieti veri restano divieti**, che è il caso di tutti i giorni: prenderli di qui
   * vorrebbe dire spegnere quello che funziona — il modo in cui questo progetto ha già sbagliato
   * due volte.
   */
  it.each([
    ['a Giulia niente formaggi molli'],
    ['togli il tonno a Giulia'],
    ['a patrizia togli i latticini'],
  ])('⚠️ «%s» resta un divieto su una cliente', (frase) => {
    expect(capisci(frase)).toMatchObject({ tipo: 'restrizione' });
  });

  /** ⚠️ Il nome della lista si ferma al verbo: senza, si sarebbe suggerito «rifai la lista dei
   *  formaggi molli aggiungi la ricotta». */
  it('⚠️ il nome della lista non si porta dentro mezza frase', () => {
    expect(capisci('nella lista dei formaggi molli aggiungi la ricotta')).toMatchObject({
      dettaglio: 'formaggi molli',
    });
  });
});

/**
 * ⛔ **La risposta dice la strada che ESISTE**, e non è un ripiego: è la stessa frase che Vera
 * suggerisce da sola quando mostra una lista («Se va corretta, dimmi "rifai la lista dei X"»).
 */
describe('⛔ la risposta ricorda la strada che esiste', () => {
  const testo = testi.voceDiLista('formaggi molli');

  it('nomina la lista capita', () => {
    expect(testo).toContain('formaggi molli');
  });

  it('⛔ dice cosa fare adesso, invece di «non ci arrivo»', () => {
    expect(testo).toContain('rifai la lista dei formaggi molli');
    expect(testo).not.toMatch(/non ci arrivo/i);
  });

  it('⚠️ e offre di far vedere prima com\'è adesso', () => {
    expect(testo).toContain('hai la lista dei formaggi molli?');
  });
});
