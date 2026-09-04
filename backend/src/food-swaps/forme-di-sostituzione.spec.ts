import {
  eUnElenco,
  FORMA_AL_POSTO_IN_TESTA,
  FORMA_PASSIVA,
  FORME_CON_IL_NOME_PRIMA,
  VOCATIVO,
} from './forme-di-sostituzione';
import { sostituzioniNelMessaggio } from './impara-dalla-chat';

/** Le due parti lette da una forma: chi esce, chi entra. */
const leggi = (re: RegExp, frase: string): [string, string] | null => {
  const m = re.exec(frase);
  return m ? [m[1].trim(), m[2].trim()] : null;
};

describe('la forma passiva: il nome che esce sta PRIMA del verbo', () => {
  it.each([
    ['il merluzzo può essere sostituito con orata', 'il merluzzo', 'orata'],
    ['i ceci possono essere sostituiti con fagioli', 'i ceci', 'fagioli'],
    ['il merluzzo va sostituito con orata', 'il merluzzo', 'orata'],
    ['il merluzzo si può sostituire con orata', 'il merluzzo', 'orata'],
    ['il pane deve essere cambiato con le gallette', 'il pane', 'le gallette'],
  ])('«%s» → «%s» esce, «%s» entra', (frase, da, a) => {
    expect(leggi(FORMA_PASSIVA, frase)).toEqual([da, a]);
  });

  /**
   * ⛔ **«è sostituibile con» è un AGGETTIVO, non un participio**, e per questo mancava: la riga
   * dell'ausiliare non poteva prenderlo. È una delle frasi vere del 31/8, e fino al 3/9 non la
   * leggeva nessuna delle due strade.
   */
  it.each([
    ['il merluzzo è sostituibile con orata', 'il merluzzo', 'orata'],
    ['il merluzzo e sostituibile con orata', 'il merluzzo', 'orata'],
    ['i ceci sono sostituibili con i fagioli', 'i ceci', 'i fagioli'],
    ['il pane è rimpiazzabile con le gallette', 'il pane', 'le gallette'],
  ])('«%s» → «%s» esce, «%s» entra', (frase, da, a) => {
    expect(leggi(FORMA_PASSIVA, frase)).toEqual([da, a]);
  });

  /**
   * ⛔ **L'ausiliare resta obbligatorio.** È la riga che una revisione ha già dovuto imporre una
   * volta: col participio **nudo**, «il pane **era stato** sostituito con gallette» — un resoconto —
   * diventava una regola. Aggiungere l'aggettivo non riapre quella porta.
   */
  it.each([
    ['il pane era stato sostituito con gallette'],
    ['il pane sostituito con gallette non le piace'],
    ['la sostituzione del pane con le gallette è andata bene'],
  ])('⛔ «%s» non è un ordine: non si legge', (frase) => {
    expect(FORMA_PASSIVA.exec(frase)).toBeNull();
  });
});

describe('«al posto di» che APRE la frase', () => {
  it.each([
    ['al posto del merluzzo può mettere orata', 'merluzzo', 'orata'],
    ['al posto del merluzzo metti orata', 'merluzzo', 'orata'],
    ['al posto dei ceci usa i fagioli', 'ceci', 'i fagioli'],
    ['invece del merluzzo possiamo mettere orata', 'merluzzo', 'orata'],
    ['al posto della carne mangia il pesce', 'carne', 'il pesce'],
    ['al posto del pane scegli le gallette', 'pane', 'le gallette'],
    ['al posto del burro prova la ricotta', 'burro', 'la ricotta'],
    ['Ricorda: al posto del merluzzo metti orata', 'merluzzo', 'orata'],
  ])('«%s» → «%s» esce, «%s» entra', (frase, da, a) => {
    expect(leggi(FORMA_AL_POSTO_IN_TESTA, frase)).toEqual([da, a]);
  });

  /**
   * ⛔ **Il verbo del mettere è obbligatorio**: senza, «al posto del merluzzo qualcosa di leggero»
   * diventerebbe una regola su un alimento che nessuno ha nominato — e questo lato decide **cosa
   * esce dal piatto**.
   */
  it.each([
    ['al posto del merluzzo qualcosa di leggero'],
    ['al posto del merluzzo niente'],
  ])('⛔ «%s» non si legge: manca il verbo', (frase) => {
    expect(FORMA_AL_POSTO_IN_TESTA.exec(frase)).toBeNull();
  });

  /** ⚠️ Con qualcosa davanti è l'altra forma («Y al posto di X»), che il riconoscitore ha già. */
  it('⚠️ non si applica quando «al posto di» sta in mezzo', () => {
    expect(FORMA_AL_POSTO_IN_TESTA.exec('metti orata al posto del merluzzo')).toBeNull();
  });
});

/**
 * ⛔ **LA FRECCIA NON SI LEGGE, ED È UNA DECISIONE MISURATA.** La prima stesura la leggeva; una
 * revisione avversariale l'ha provata su venticinque righe di chat vere con una freccia dentro e
 * **sedici diventavano una regola** — «legumi → 3 volte a settimana», «olio evo → 3 cucchiai al
 * giorno», «da eliminare → pane, pasta e riso» (il rovescio di quel che c'è scritto). ⚠️ Le altre
 * due forme hanno un'ancora lessicale che dice «questo è un ordine di sostituzione»; la freccia no.
 *
 * Queste righe tengono ferma la decisione: se qualcuno la rimette, la deve rimettere con una regola
 * che distingua un alimento da una quantità — e queste diventano rosse.
 */
describe('⛔ la freccia resta fuori finché non si sa distinguere un cibo da una quantità', () => {
  it.each([
    ['legumi -> 3 volte a settimana'],
    ['olio evo -> 3 cucchiai al giorno'],
    ['pesce azzurro -> almeno 2 volte a settimana'],
    ['peso 80->78 in due mesi, ottimo'],
    ['kcal 1800 -> 1600 da domani'],
    ['da eliminare -> pane, pasta e riso'],
    ['allergie -> arachidi, noci'],
    ['merluzzo -> orata'],
  ])('⛔ «%s» non produce nessuna regola', (frase) => {
    expect(sostituzioniNelMessaggio(frase)).toEqual([]);
  });

  it('⛔ e l\'elenco delle forme non la contiene', () => {
    expect(FORME_CON_IL_NOME_PRIMA).toHaveLength(2);
    expect(FORME_CON_IL_NOME_PRIMA.map((f) => f.re.source).join(' ')).not.toContain('→');
  });
});

describe('eUnElenco — il segnale che apre la lettura a elenco', () => {
  it.each([
    ['orata, salmone', true],
    ['orata o salmone', true],
    ['orata oppure salmone', true],
    ['orata; salmone', true],
    ['petto di tacchino', false],
    ['orata', false],
  ])('«%s» → %s', (t, atteso) => {
    expect(eUnElenco(t)).toBe(atteso);
  });
});

describe('il vocativo', () => {
  it('si toglie quando il nome è scritto con la maiuscola', () => {
    expect('a Marta il merluzzo è sostituibile con orata'.replace(VOCATIVO, '')).toBe(
      'il merluzzo è sostituibile con orata',
    );
  });

  /**
   * ⚠️ **Minuscolo non si toglie**, ed è il difetto **già aperto** «dove comincia il nome»: «a
   * patrizia sogari» tutto minuscolo non viene letto come nome di cliente da nessuna parte. Sta qui
   * perché una forma nuova non la si aggiunge senza sapere cosa eredita.
   */
  it('⚠️ minuscolo resta: è il difetto aperto, non una svista di questo file', () => {
    expect('a patrizia il merluzzo è sostituibile con orata'.replace(VOCATIVO, '')).toBe(
      'a patrizia il merluzzo è sostituibile con orata',
    );
  });
});

/**
 * ⛔ **L'elenco è quello che leggono TUTT'E DUE le strade.** Se qualcuno ne aggiungesse una qui e
 * la usasse in un file solo, tornerebbe il difetto che questo modulo esiste per chiudere: la stessa
 * frase capita o buttata via a seconda di quante alternative ha scritto la nutrizionista.
 */
describe('⛔ l\'elenco condiviso', () => {
  it('contiene le due forme in cui il nome sta prima, e dice quali vanno lette risalendo', () => {
    expect(FORME_CON_IL_NOME_PRIMA.map((f) => f.risalita)).toEqual([true, false]);
    expect(FORME_CON_IL_NOME_PRIMA.map((f) => f.re)).toEqual([
      FORMA_PASSIVA,
      FORMA_AL_POSTO_IN_TESTA,
    ]);
  });
});
