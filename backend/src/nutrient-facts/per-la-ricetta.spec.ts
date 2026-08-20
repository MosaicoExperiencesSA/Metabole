import { esitoPerIngrediente } from './per-la-ricetta';

/**
 * ⚠️ LA DOMANDA INTERA IN UN POSTO SOLO — e questo file nasce da due difetti dello stesso giorno.
 *
 * «Questo ingrediente di ricetta, che riga è e la posso usare?» la fanno in due: il conto dei macro
 * quando la nutrizionista detta, e il passo notturno che riempie l'elenco di lavoro. Erano tre passi
 * scritti due volte, e il 20/8 ne sono divergiti **due su tre**:
 *
 *   · `diag:crudo-cotto` abbinava **senza passare lo stato della riga** → mandava la nutrizionista a
 *     scrivere righe che non servivano;
 *   · il passo notturno raccoglieva le «righe con lo stesso nome» con l'indice **nome-o-sinonimo**
 *     invece dell'uguaglianza sul nome → insieme diverso, verdetto diverso.
 *
 * ⛔ Nessuno dei due si vedeva da fuori: la produzione contava bene e l'elenco raccontava un'altra
 * cosa. *Due punti che rispondono alla stessa domanda non devono somigliarsi.*
 */
describe('esitoPerIngrediente — i tre passi, in un posto solo', () => {
  it('1) il nome esatto vince, e le righe con lo stesso nome si guardano INSIEME', () => {
    const righe = [
      { name: 'riso', synonyms: [], state: 'crudo' },
      { name: 'riso', synonyms: [], state: 'bollito' },
    ];
    // ⚠️ Insieme: c'è la riga a crudo, quindi per la ricetta va bene. Prendendone una sola, quale
    // rispondesse lo deciderebbe l'ordine di lettura del database — la voce 228.
    expect(esitoPerIngrediente('riso', righe).tipo).toBe('va_bene');
  });

  it('e se dello stesso nome c\'è solo il cotto, lo dice', () => {
    expect(esitoPerIngrediente('riso', [{ name: 'riso', synonyms: [], state: 'bollito' }]).tipo).toBe('solo_cotto');
  });

  it('2) senza nome esatto si prova l\'abbinamento, CON lo stato della riga', () => {
    const righe = [{ name: 'spinaci', synonyms: [], state: 'crudo' }];
    expect(esitoPerIngrediente('spinaci freschi', righe).tipo).toBe('va_bene');
  });

  /**
   * ⚠️ IL CRITERIO CHE ERA DIVERGENTE. Le righe da guardare insieme sono quelle con **lo stesso
   * nome**, non quelle che condividono un sinonimo: un sinonimo di un'altra riga non è la stessa
   * riga, e allargare qui farebbe entrare nella decisione un alimento che non c'entra.
   */
  /**
   * ⚠️ **QUESTO TEST NASCE DA UN MIO ERRORE, ED È PIÙ UTILE DEL TEST CHE VOLEVO SCRIVERE.**
   *
   * Volevo dimostrare che guardare le righe «con lo stesso nome **o sinonimo**» invece che «con lo
   * stesso nome» cambia il verdetto. ⛔ Non può: se un'altra riga porta quel nome — come nome o come
   * sinonimo — `abbina` la vede come un secondo candidato di pari peso e torna `null`. Quindi quando
   * l'abbinamento risponde, quella riga è **unica**, e i due criteri coincidono sempre.
   *
   * Me l'ha detto una mutazione che non mordeva, non il ragionamento: avevo già scritto la
   * divergenza nel commento del modulo come se fosse un difetto trovato. *Una ragione falsa in un
   * commento è peggio di nessun commento.*
   */
  it('⚠️ due righe che portano lo stesso nome: l\'abbinamento non sceglie, e non è un verdetto', () => {
    const dueVolte = [
      { name: 'ceci', synonyms: [], state: 'bollito' },
      { name: 'ceci', synonyms: [], state: 'crudo' },
    ];
    // ⛔ «niente», non «va bene»: indovinare fra le due vorrebbe dire scrivere calorie a caso.
    expect(esitoPerIngrediente('ceci bio', dueVolte).tipo).toBe('niente');

    const nomeESinonimo = [
      { name: 'ceci', synonyms: [], state: 'bollito' },
      { name: 'ceci del fornitore', synonyms: ['ceci'], state: 'crudo' },
    ];
    expect(esitoPerIngrediente('ceci bio', nomeESinonimo).tipo).toBe('niente');

    // ⚠️ E con una riga sola risponde, perché non c'è niente da indovinare.
    expect(esitoPerIngrediente('ceci bio', [dueVolte[0]]).tipo).toBe('solo_cotto');
  });

  it('3) e quello che non porta a niente resta «niente»', () => {
    expect(esitoPerIngrediente('grano saraceno', [{ name: 'riso', synonyms: [], state: 'crudo' }]).tipo).toBe('niente');
    expect(esitoPerIngrediente('ab', [{ name: 'riso', synonyms: [], state: 'crudo' }]).tipo).toBe('niente');
  });
});
