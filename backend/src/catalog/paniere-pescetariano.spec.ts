import { righeDerivate, verdettoPescetariano } from './paniere-pescetariano';

describe('cosa può mangiare una pescetariana', () => {
  it('riconosce il pesce dal nome o dagli ingredienti', () => {
    expect(verdettoPescetariano('Branzino al forno', [])).toBe('pesce');
    expect(verdettoPescetariano('Insalata di riso', ['riso', 'tonno', 'mais'])).toBe('pesce');
    expect(verdettoPescetariano('Spaghetti alle vongole', [])).toBe('pesce');
  });

  /**
   * ⛔ **Si guardano TUTTI gli ingredienti, non solo il principale.** Per la regola delle colazioni
   * la domanda è di cosa *è* il piatto; qui è «questa persona può mangiarlo?», e a quella risponde
   * qualunque grammo di carne.
   */
  it('⛔ un grammo di carne fra gli ingredienti basta a escluderlo', () => {
    expect(verdettoPescetariano('Risotto agli asparagi', ['riso', 'asparagi', 'speck'])).toBe('carne');
    expect(verdettoPescetariano('Vellutata di zucca', ['zucca', 'pancetta'])).toBe('carne');
  });

  /** ⚠️ «Mare e monti» esiste: se c'è tutti e due, vince la carne e il piatto resta fuori. */
  it('⚠️ la carne vince sul pesce', () => {
    expect(verdettoPescetariano('Mare e monti', ['gamberi', 'funghi', 'pollo'])).toBe('carne');
  });

  it('e quello che non ha né carne né pesce si dichiara per quello che è', () => {
    expect(verdettoPescetariano('Pasta al pomodoro', ['pasta', 'pomodoro', 'basilico'])).toBe('ne_carne_ne_pesce');
    expect(verdettoPescetariano('', [])).toBe('ne_carne_ne_pesce');
  });
});

describe('la derivazione del paniere pescetariano', () => {
  const riga = (slot: string, recipeId: string) => ({ slot, recipeId });

  it('prende tutto il vegetariano e solo il pesce dall\'onnivoro', () => {
    const esito = righeDerivate({
      giaNelPescetariano: [],
      dalVegetariano: [riga('lunch', 'v1'), riga('dinner', 'v2')],
      dallOnnivoro: [riga('dinner', 'branzino'), riga('dinner', 'pollo'), riga('lunch', 'pasta')],
      verdetto: (id) => (id === 'branzino' ? 'pesce' : id === 'pollo' ? 'carne' : 'ne_carne_ne_pesce'),
    });
    expect(esito.daAggiungere.map((r) => r.recipeId)).toEqual(['v1', 'v2', 'branzino']);
    expect(esito.scartatePerCarne).toBe(1);
  });

  /**
   * ⛔ Un piatto onnivoro senza né carne né pesce resta fuori: se fosse davvero vegetariano starebbe
   * nel paniere vegetariano, e se non c'è è perché nessuno l'ha detto.
   */
  it('⛔ un piatto onnivoro «neutro» non entra per conto suo', () => {
    const esito = righeDerivate({
      giaNelPescetariano: [],
      dalVegetariano: [],
      dallOnnivoro: [riga('lunch', 'pasta')],
      verdetto: () => 'ne_carne_ne_pesce',
    });
    expect(esito.daAggiungere).toEqual([]);
  });

  /**
   * ⚠️ Il decimo paniere, quello non vuoto, è stato riempito da qualcuno: la derivazione
   * **aggiunge** e non sostituisce.
   */
  it('⚠️ quello che c\'è già non si tocca e non si duplica', () => {
    const esito = righeDerivate({
      giaNelPescetariano: [riga('lunch', 'v1')],
      dalVegetariano: [riga('lunch', 'v1'), riga('lunch', 'v2')],
      dallOnnivoro: [],
      verdetto: () => 'ne_carne_ne_pesce',
    });
    expect(esito.daAggiungere).toEqual([riga('lunch', 'v2')]);
  });

  /**
   * ⛔ La stessa ricetta può stare nel vegetariano e — per una variante diversa — anche
   * nell'onnivoro. `@@unique` la fermerebbe con un errore, cioè fermerebbe tutta la migrazione per
   * una cosa che non è un problema.
   */
  it('⛔ un doppione fra le due sorgenti si toglie qui, non lo scopre il database', () => {
    const esito = righeDerivate({
      giaNelPescetariano: [],
      dalVegetariano: [riga('dinner', 'salmone')],
      dallOnnivoro: [riga('dinner', 'salmone')],
      verdetto: () => 'pesce',
    });
    expect(esito.daAggiungere).toEqual([riga('dinner', 'salmone')]);
  });

  it('lo stesso piatto in due pasti diversi sono due righe, non un doppione', () => {
    const esito = righeDerivate({
      giaNelPescetariano: [],
      dalVegetariano: [riga('lunch', 'x'), riga('dinner', 'x')],
      dallOnnivoro: [],
      verdetto: () => 'ne_carne_ne_pesce',
    });
    expect(esito.daAggiungere).toHaveLength(2);
  });
});
