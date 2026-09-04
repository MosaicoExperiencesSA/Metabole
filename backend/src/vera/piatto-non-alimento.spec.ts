import { capisci } from './capisci';
import { testi } from './vera-chat';

/**
 * ⛔ **UN PIATTO NON È UN ALIMENTO** — gruppo «le ricette» della voce
 * `vera-vocabolario-quattro-gruppi`, misurato il 31/8 e chiuso il 3/9.
 *
 * Prima di questa riga:
 *
 * ```
 * «sostituisci la ricetta Pasta al pomodoro con Riso alle verdure»
 *    → da: ["ricetta Pasta al pomodoro"]                        ← la parola «ricetta» DENTRO il nome
 * «togli la ricetta Pasta al pomodoro dal menu di ilaria»
 *    → vietati: ["ricetta Pasta al pomodoro dal menu di ilaria"] ← e dentro anche il nome della cliente
 * ```
 *
 * ⚠️ Le regole che ne uscivano erano **inerti** — nessun alimento si chiama così — ma Vera
 * rispondeva con un'anteprima plausibile da confermare, e chi aveva scritto restava convinta di aver
 * scritto qualcosa. *Una lettura plausibile e sbagliata è peggio di un onesto «non ci arrivo».*
 */
describe('⛔ le frasi che parlano di un PIATTO non diventano regole su un alimento', () => {
  it.each([
    ['sostituisci la ricetta Pasta al pomodoro con Riso alle verdure', 'Pasta al pomodoro'],
    ['togli la ricetta Pasta al pomodoro dal menu di ilaria', 'Pasta al pomodoro'],
    ['sostituisci il piatto Pasta al pomodoro con Riso alle verdure', 'Pasta al pomodoro'],
    ['a ilaria cambia il piatto Pasta al pomodoro con Riso alle verdure', 'Pasta al pomodoro'],
    ['elimina la ricetta Tonno alle olive', 'Tonno alle olive'],
    ['leva la ricetta Vellutata di zucca dal menu', 'Vellutata di zucca'],
  ])('«%s» → si dice che è il piatto «%s»', (frase, piatto) => {
    expect(capisci(frase)).toEqual({ tipo: 'fuori_portata', cosa: 'ricetta_nel_menu', dettaglio: piatto });
  });

  /**
   * ⛔ **E NON si mangia il caso normale**, che è il modo in cui questo progetto ha già sbagliato
   * due volte: una guardia che blocca la frase di tutti i giorni non è prudente, è rotta e sembra
   * prudente. Le sostituzioni fra **alimenti** restano quelle di sempre.
   */
  it.each([
    ['sostituisci il pane con le gallette'],
    ['a patrizia sostituisci i ceci con i fagioli'],
    ['metti il tacchino al posto del pollo'],
    ['il merluzzo è sostituibile con orata'],
  ])('⚠️ «%s» resta una sostituzione di alimento', (frase) => {
    expect(capisci(frase)).toMatchObject({ tipo: 'sostituzione' });
  });

  /**
   * ⛔ **«piatto di …» è una PORZIONE, non una ricetta.** La preposizione dopo la parola è tutta la
   * differenza — la stessa lezione di `coda-di-quando.ts`, dove «**a** colazione» è un orario e
   * «**da** colazione» è un prodotto.
   */
  it('⛔ «un piatto di pasta» non è una ricetta', () => {
    expect(capisci('sostituisci un piatto di pasta con del riso')).toMatchObject({ tipo: 'sostituzione' });
  });

  /**
   * ⛔ **Servono tutt'e due le condizioni**: la parola che dice «è un piatto» e un verbo del
   * sostituire o togliere. Senza il verbo è un commento; senza la parola è una sostituzione di
   * alimento, che si sa fare.
   */
  it.each([
    ['la ricetta Pasta al pomodoro ha troppi carboidrati'],
    ['il piatto Pasta al pomodoro piace a tutte'],
  ])('⚠️ «%s» non è un ordine: non si legge di qui', (frase) => {
    const r = capisci(frase);
    expect(r === null || r.tipo !== 'fuori_portata').toBe(true);
  });

  /**
   * ⚠️ **E le ricette che si sanno già fare restano dove stanno.** «crea la ricetta X» e «modifica
   * la ricetta X» hanno un riconoscitore loro dal 13/8, e va **prima** di questo: prenderle di qui
   * vorrebbe dire spegnere una cosa che funziona.
   */
  it.each([
    ['crea la ricetta Tonno alle olive', 'nuova'],
    ['modifica la ricetta Tonno alle olive', 'modifica'],
  ])('⚠️ «%s» resta una ricetta da scrivere (%s)', (frase, modo) => {
    expect(capisci(frase)).toMatchObject({ tipo: 'ricetta', modo });
  });

  /** ⚠️ E la regola su un tipo di dieta resta l'altro `fuori_portata`, con la sua strada. */
  it('⚠️ la regola di dieta resta un fuori_portata suo, che va in coda al capo', () => {
    expect(capisci('nella mediterranea non deve comparire più il tonno')).toMatchObject({
      tipo: 'fuori_portata',
      cosa: 'regola_dieta',
    });
  });
});

/**
 * ⛔ **E LA RISPOSTA NON APRE UNA PRATICA.** La regola su un tipo di dieta nasce come proposta in
 * coda al capo perché cambia il menu di **centinaia** di clienti; cambiare un piatto nel menu di una
 * persona è il contrario — un gesto piccolo su una schermata che esiste già. ⚠️ Aprire una pratica
 * per una cosa che si fa in trenta secondi non è prudenza: è una riga in più in una coda che
 * qualcuno deve svuotare, e una risposta che **sposta** il lavoro invece di indicarlo.
 */
describe('⛔ la risposta dice dove si fa, e non scrive niente', () => {
  const testo = testi.piattoNonAlimento('Pasta al pomodoro');

  it('nomina il piatto, così si vede subito se abbiamo capito quello sbagliato', () => {
    expect(testo).toContain('Pasta al pomodoro');
  });

  it('⛔ dice DOVE si fa, invece di «non ci arrivo»', () => {
    expect(testo).toContain('Menu a mano');
    expect(testo).toContain('Ricette');
    expect(testo).not.toMatch(/non ci arrivo/i);
  });

  it('⚠️ e dice anche cosa Vera sa fare, così la frase si può riscrivere', () => {
    expect(testo).toMatch(/aliment/i);
  });
});
