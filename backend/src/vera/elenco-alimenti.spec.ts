/**
 * Le prove nascono dalle frasi VERE della nutrizionista (pagina «frasi che non ho capito», 31/8),
 * non da casi inventati: è l'unico modo per sapere che quello che si aggiunge serve davvero.
 */
import { eUnElenco, leggiElenco } from './elenco-alimenti';

describe('leggiElenco — o si legge tutto, o non si è capito', () => {
  /**
   * ⛔ **L'ARTICOLO NON È UNA PAROLA PERSA** (31/8). Il controllo anti-troncamento confrontava il
   * nome letto con le parole grezze del pezzo: siccome `nomeAlimento` toglie l'articolo di
   * proposito, «il merluzzo» risultava «letto a metà» e l'intero elenco veniva rifiutato. Cinque
   * forme normali su sette cadevano così, e la nutrizionista si sentiva rispondere «non ci arrivo»
   * scrivendo in italiano corrente.
   */
  it('⛔ gli alimenti con l\'articolo si leggono', () => {
    expect(leggiElenco('il merluzzo')).toEqual(['merluzzo']);
    expect(leggiElenco('le zucchine, le melanzane e i peperoni')).toEqual(['zucchine', 'melanzane', 'peperoni']);
    expect(leggiElenco('la ricotta o lo stracchino')).toEqual(['ricotta', 'stracchino']);
    expect(leggiElenco('il pesce azzurro')).toEqual(['pesce azzurro']);
  });

  it('⚠️ ma il troncamento vero resta un no: la rete non si allenta', () => {
    // Oltre le quattro parole `nomeAlimento` taglia, e un nome tagliato non entra.
    expect(leggiElenco('minestrone di verdure miste di stagione')).toBeNull();
    // E fermarsi a una congiunzione È un troncamento, non un articolo scartato.
    expect(leggiElenco('sale e pepe')).toBeNull();
  });

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

/**
 * ⛔ **LE DUE STRADE DEVONO CAPIRE LA STESSA FRASE ALLO STESSO MODO** (3/9, trovato in revisione).
 *
 * `capisci` prova prima gli elenchi e poi la lettura singola. Finché solo la seconda toglieva la
 * coda del quando, bastava **una «o»** per cambiare ramo e cambiare esito:
 *
 *     «sostituisci il pane con le gallette a colazione»              → «gallette»
 *     «sostituisci il pane con le gallette o i cracker a colazione»  → «cracker a colazione»
 *
 * ⚠️ E questo è il ramo che **esegue un ordine**, cioè quello dove una lettura sporca pesa di più.
 */
describe('⛔ anche negli elenchi la coda del quando non entra nel nome', () => {
  it.each([
    ['le gallette o i cracker a colazione', ['gallette', 'cracker']],
    ['le zucchine, le melanzane tutti i giorni', ['zucchine', 'melanzane']],
    ['la ricotta o lo stracchino a merenda', ['ricotta', 'stracchino']],
  ])('«%s» → %s', (testo, atteso) => {
    expect(leggiElenco(testo)).toEqual(atteso);
  });

  /**
   * ⛔ **E il taglio va fatto PRIMA di `paroleDaLeggere`**, non solo prima di `nomeAlimento`: quel
   * confronto misura «quanto ho letto contro quanto c'era», e contando la coda fra le parole «che
   * c'erano» ogni pezzo con un orario risulterebbe **letto a metà** — cioè l'elenco intero
   * rifiutato, che qui vuol dire «non ci arrivo» su una frase normale.
   */
  it('⛔ e il pezzo con la coda non risulta «letto a metà»: l\'elenco non si rifiuta', () => {
    expect(leggiElenco('le gallette o il petto di tacchino a colazione')).toEqual([
      'gallette',
      'petto di tacchino',
    ]);
  });

  /**
   * ⛔ **E IL TAGLIO NON DEVE FABBRICARE SILENZI** (seconda revisione). Tolta la coda, «il **tè** a
   * colazione» resta «tè» (sotto il minimo di tre caratteri) e «lo **snack** a metà mattina» resta
   * «snack» (che è in `NON_ALIMENTI`): `nomeAlimento` risponde `null`, e qui **un pezzo solo fa
   * cadere l'elenco intero** — cioè un «non ci arrivo» su una frase normale. Adesso, quando il
   * taglio rende il pezzo illeggibile, si torna al pezzo intero: il comportamento è **quello di
   * prima di questa consegna**, non un ripiego inventato.
   */
  it.each([
    ['il tè a colazione o il caffè'],
    ['lo snack a metà mattina o la frutta'],
    ['la porzione a cena o la frutta'],
  ])('⛔ «%s» non diventa un silenzio', (testo) => {
    expect(leggiElenco(testo)).not.toBeNull();
    expect(leggiElenco(testo)).toHaveLength(2);
  });

  /**
   * ⛔ **E la guardia «letto a metà» continua a fare il suo mestiere** su quello che il taglio non
   * ha capito: «fette biscottate durante la settimana» non è una coda riconosciuta (lascerebbe
   * «durante» appeso), quindi il pezzo resta intero, `nomeAlimento` si ferma a quattro parole e
   * l'elenco si rifiuta — com'è giusto, perché nessuno l'ha letto tutto.
   */
  it('⛔ un pezzo che nessuno ha letto tutto fa ancora cadere l\'elenco', () => {
    expect(leggiElenco('pane, gallette o fette biscottate durante la settimana')).toBeNull();
  });

  /** ⚠️ E quello che non è una coda resta dentro, qui come di là: «da colazione» è un prodotto. */
  it('⚠️ «da colazione» è un nome di prodotto e non si tocca nemmeno qui', () => {
    expect(leggiElenco('i biscotti da colazione o le gallette')).toEqual([
      'biscotti da colazione',
      'gallette',
    ]);
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
