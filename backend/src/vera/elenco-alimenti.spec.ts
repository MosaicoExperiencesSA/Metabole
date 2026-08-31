/**
 * Le prove nascono dalle frasi VERE della nutrizionista (pagina «frasi che non ho capito», 31/8),
 * non da casi inventati: è l'unico modo per sapere che quello che si aggiunge serve davvero.
 */
import { eUnElenco, leggiElenco } from './elenco-alimenti';

describe('leggiElenco — o si legge tutto, o non si è capito', () => {
  it('⛔ IL CASO LORENA: undici verdure restano undici, non quattro', () => {
    const undici = 'zucchine, melanzane, peperoni, carciofi, fagiolini, spinaci, erbe cotte, carote, minestrone, insalata, pomodoro';
    const letto = leggiElenco(undici);
    expect(letto).toHaveLength(11);
    expect(letto).toContain('pomodoro');
    expect(letto).toContain('erbe cotte'); // due parole, e restano due
  });

  it('⛔ IL CASO JOLANDA: le alternative si leggono anche senza virgole', () => {
    expect(leggiElenco('fagioli o lenticchie')).toEqual(['fagioli', 'lenticchie']);
  });

  it('«a, b e c»: l\'italiano mette la congiunzione prima dell\'ultimo, e con la virgola si spezza', () => {
    expect(leggiElenco('zucchine, melanzane e peperoni')).toEqual(['zucchine', 'melanzane', 'peperoni']);
  });

  it('⛔ SENZA virgole «e» non separa — e il nome con «e» dentro si dichiara ILLEGGIBILE', () => {
    /**
     * ⚠️ Questa prova dice due cose, e la seconda è il punto.
     *
     * «Biscotti d'Avena e Banana» è UNA ricetta: spezzarla su «e» inventerebbe due alimenti che
     * non esistono. Quindi «e» non separa. Ma `nomeAlimento` — che legge un nome, non un elenco —
     * si ferma da sé alla congiunzione: da «sale e pepe» tira fuori «sale».
     *
     * ⛔ E allora si risponde `null`, non «sale». Oggi quella mezza lettura passa in silenzio ed è
     * esattamente il difetto del 31/8: un nome tagliato che nessuno vede. Un «non ci arrivo» costa
     * alla nutrizionista dieci secondi per riformulare; «sale» al posto di «sale e pepe» costa una
     * regola sbagliata sul cibo di una persona.
     *
     * ⚠️ Vuol dire che i nomi con «e» dentro — le RICETTE — restano non leggibili, come oggi. È il
     * lavoro successivo, e va fatto guardando il catalogo ricette: non lo si indovina da qui.
     */
    expect(leggiElenco('sale e pepe')).toBeNull();
    expect(leggiElenco('Biscotti d\'Avena e Banana')).toBeNull();
  });

  it('un alimento solo è un elenco di uno', () => {
    expect(leggiElenco('broccoli')).toEqual(['broccoli']);
  });

  it('⛔ un pezzo ILLEGGIBILE ferma tutto: niente elenchi parziali', () => {
    expect(leggiElenco('zucchine, , peperoni')).toEqual(['zucchine', 'peperoni']); // il vuoto si scarta
    expect(leggiElenco('zucchine, di, peperoni')).toBeNull(); // «di» non è un alimento
  });

  it('⛔ e nemmeno un pezzo letto A METÀ: il troncamento silenzioso è il difetto di partenza', () => {
    // Cinque parole: `nomeAlimento` si fermerebbe a quattro. Meglio «non ho capito» che una metà.
    expect(leggiElenco('minestrone di verdure miste di stagione')).toBeNull();
  });

  it('un doppione si tiene una volta sola: è una ripetizione, non un errore', () => {
    expect(leggiElenco('zucchine, melanzane, zucchine')).toEqual(['zucchine', 'melanzane']);
  });

  it('vuoto e spazi: niente', () => {
    expect(leggiElenco('')).toBeNull();
    expect(leggiElenco('   ')).toBeNull();
  });
});

describe('eUnElenco — il segnale che apre la lettura', () => {
  it.each([
    ['zucchine, melanzane', true],
    ['fagioli o lenticchie', true],
    ['ceci oppure fagioli', true],
    ['zucchine; melanzane', true],
    ['Biscotti d\'Avena e Banana', false],
    ['broccoli', false],
  ])('«%s» → %s', (testo, atteso) => {
    expect(eUnElenco(testo)).toBe(atteso);
  });
});
