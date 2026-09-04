import { accorpabili, MAX_PROPOSTE, testoChiediAccorpamento, type GruppoEsistente } from './gia-in-un-altro-gruppo';

/**
 * ⛔ **LA METÀ CHE TIENE PULITO** — richiesta di Simone del 4/9. Unire i doppioni di oggi è un
 * lavoro che si fa una volta; se poi ogni gruppo nuovo può nascere accanto a uno che dice quasi la
 * stessa cosa, fra sei mesi la pagina è di nuovo com'era.
 */
const g = (id: string, name: string, items: string[], status = 'draft'): GruppoEsistente => ({ id, name, status, items });

const CATALOGO: GruppoEsistente[] = [
  g('g1', 'Carni bianche', ['petto di pollo', 'tacchino', 'coniglio'], 'approved'),
  g('g2', 'Pesci bianchi', ['merluzzo', 'orata', 'branzino']),
  g('g3', 'Legumi', ['ceci', 'lenticchie', 'fagioli']),
];

describe('accorpabili', () => {
  it('senza alimenti non chiede niente', () => {
    expect(accorpabili('Carni bianche', [], CATALOGO)).toEqual([]);
  });

  /** ⚠️ Il nome uguale basta da solo: è il segnale che ha prodotto i doppioni di oggi. */
  it('il nome uguale basta, anche senza un alimento in comune', () => {
    const [t] = accorpabili('carni  bianche', ['pernice', 'quaglia'], CATALOGO);
    expect(t.id).toBe('g1');
    expect(t.perche).toBe('stesso nome');
    expect(t.inComune).toEqual([]);
    expect(t.daAggiungere).toEqual(['pernice', 'quaglia']);
    expect(t.quantiHa).toBe(3);
  });

  /**
   * ⛔ La soglia: **un** alimento in comune non fa scattare la domanda. «Petto di pollo» sta in
   * decine di gruppi, e una domanda che compare sempre è una domanda a cui si risponde senza
   * leggerla.
   */
  it('un solo alimento in comune non basta', () => {
    expect(accorpabili('Proteine della sera', ['petto di pollo', 'tofu'], CATALOGO)).toEqual([]);
  });

  it('due alimenti in comune sì, e dice cosa aggiungerebbe', () => {
    const [t] = accorpabili('Proteine della sera', ['petto di pollo', 'coniglio', 'tofu'], CATALOGO);
    expect(t.id).toBe('g1');
    expect(t.perche).toBe('alimenti in comune');
    expect(t.inComune).toEqual(['petto di pollo', 'coniglio']);
    expect(t.daAggiungere).toEqual(['tofu']);
  });

  /**
   * ⚠️ Il confronto vale nei **due versi**: chi scrive «pollo» e chi scrive «petto di pollo» deve
   * ricevere la stessa domanda. `combaciaAlimento` da sola è asimmetrica, e senza questa riga la
   * domanda comparirebbe o no a seconda di quale nome è stato battuto per primo.
   */
  it('«pollo» e «petto di pollo» sono lo stesso alimento, in tutti e due i versi', () => {
    const [t] = accorpabili('Secondi leggeri', ['pollo', 'tacchino'], CATALOGO);
    expect(t.id).toBe('g1');
    /**
     * ⛔ **`inComune` porta i nomi COME STANNO NEL GRUPPO**, non quelli proposti — corretto in
     * revisione, 4/9. Prima erano i proposti, e la schermata scriveva «ha già latte di mandorla» di
     * un gruppo che ha soltanto «latte»: una frase falsa su cui una nutrizionista decide.
     */
    expect(t.inComune).toEqual(['petto di pollo', 'tacchino']);
  });

  it('mette per primo il nome uguale, anche se un altro ha più roba in comune', () => {
    const catalogo = [...CATALOGO, g('g4', 'Secondi', ['petto di pollo', 'tacchino', 'coniglio'])];
    const trovati = accorpabili('Carni bianche', ['petto di pollo', 'tacchino', 'coniglio'], catalogo);
    expect(trovati.map((t) => t.id)).toEqual(['g1', 'g4']);
  });

  it('non ne propone più di tre: un elenco lungo è una domanda a cui non si risponde', () => {
    const tanti = Array.from({ length: 8 }, (_, i) => g(`x${i}`, `Gruppo ${i}`, ['ceci', 'lenticchie']));
    expect(accorpabili('Nuovo', ['ceci', 'lenticchie'], tanti)).toHaveLength(MAX_PROPOSTE);
  });
});

describe('testoChiediAccorpamento', () => {
  it('elenca i gruppi numerati e dice come si risponde', () => {
    const trovati = accorpabili('Carni bianche', ['petto di pollo', 'tacchino', 'pernice'], CATALOGO);
    const testo = testoChiediAccorpamento('Carni bianche', trovati);
    expect(testo).toContain('1) «Carni bianche»');
    expect(testo).toContain('ci aggiungerei pernice');
    expect(testo).toContain('«nuovo»');
  });

  /**
   * ⛔ La riga che non può mancare: accorpare dentro un gruppo **approvato** manda quegli alimenti
   * nel motore dal menu della notte. Chi accorpa lo deve sapere prima, non dopo.
   */
  it('quando il gruppo è approvato lo dice, e dice cosa comporta', () => {
    const testo = testoChiediAccorpamento('Carni bianche', accorpabili('Carni bianche', ['pernice', 'quaglia'], CATALOGO));
    expect(testo).toContain('approvato');
    expect(testo).toContain('dal prossimo menu');
  });

  it('e quando sono tutti in bozza non spaventa nessuno', () => {
    const testo = testoChiediAccorpamento('Legumi', accorpabili('Legumi', ['ceci', 'lenticchie'], CATALOGO));
    expect(testo).toContain('in bozza');
    expect(testo).not.toContain('dal prossimo menu');
  });
});
