/**
 * ⛔ **GLI OTTO FALSI DEL 4/9, E QUELLO CHE NON DEVE SPARIRE INSIEME A LORO.**
 *
 * `npm run diag:carne-fuori-posto` in produzione ha segnalato otto piatti «carne o pesce dove non
 * devono stare». Nessuno era un errore di catalogo — il regime della ricetta era compatibile in
 * tutti e otto. Erano nomi: prosciutto **vegetale**, pollo **di tempeh**, polpo **di ceci**,
 * branzino **di melanzane**.
 *
 * ⚠️ **La metà che conta non è questa.** Lo stesso riconoscitore ha scartato **1342 piatti come
 * carne** derivando i panieri pescetariani: gli otto si vedevano, quelli no.
 *
 * ⛔ **E la seconda parte di queste prove vale più della prima**: la regola è larga per costruzione
 * (una famiglia aperta), e l'errore che non ci si può permettere è il verso opposto — carne vera
 * letta come finta, cioè carne nel piatto di una pescetariana.
 */
import { eCarne, eCarneIngrediente, ePesce, senzaImitazioni } from './piatto-di-cosa';

describe('la carne finta e il pesce finto', () => {
  it.each([
    'Bocconcini di melone con prosciutto vegetale e ricotta',
    'Melone Giallo con Prosciutto Vegetale e Formaggio di Capra',
    'Chili Bianco di Cannellini con Pollo di Tempeh e Avena',
  ])('«%s» non è carne', (piatto) => {
    expect(eCarne(piatto)).toBe(false);
    expect(eCarneIngrediente(piatto)).toBe(false);
  });

  it.each([
    'Polpo di ceci croccanti su letto di radicchio rosso saltato',
    "Polpo d'Alghe Nori Farcito Riso Integrale Rosso e Edamame",
    'Branzino di melanzane al cartoccio con olive e origano',
    'Branzino di Ceci al Forno con Verdure Arrostite e Tahina',
  ])('«%s» non è pesce', (piatto) => {
    expect(ePesce(piatto)).toBe(false);
  });

  /** ⚠️ La famiglia è aperta: domani sarà «tonno di ceci» o «bresaola vegana», e la regola le prende. */
  it.each([
    ['Tonno di ceci in insalata', 'pesce'],
    ['Bresaola vegana con rucola', 'carne'],
    ['Salmone vegetale affumicato', 'pesce'],
    ['Wurstel di soia alla griglia', 'carne'],
  ])('«%s» non è %s, e nessuno l\'ha dovuto scrivere in un elenco', (piatto, cosa) => {
    expect(cosa === 'carne' ? eCarne(piatto) : ePesce(piatto)).toBe(false);
  });
});

/**
 * ⛔ **IL VERSO CHE NON SI PUÒ SBAGLIARE.** Un falso positivo toglie un piatto buono da un paniere;
 * un falso negativo mette carne nel piatto di chi non la mangia. Per questo il segno vegetale deve
 * stare **attaccato** all'animale, e «con» non vale.
 */
describe('quello che resta carne e pesce', () => {
  it.each([
    'Pollo con ceci e rosmarino',
    'Prosciutto crudo e melone',
    'Spezzatino di manzo con patate',
    'Petto di pollo alla piastra',
    'Insalata di pollo, quinoa e verdure',
    'Straccetti di pollo con soia e zenzero',
    'Salame e formaggio',
    'Uova di gallina strapazzate con pollo',
  ])('«%s» resta carne', (piatto) => {
    expect(eCarne(piatto)).toBe(true);
  });

  /**
   * ⛔ **La parola «vegetale» più avanti nel piatto NON smonta l'animale**, e questo è il caso che
   * `sembraUnImitazione` aveva già imparato a sue spese: «filetto di merluzzo · brodo vegetale» era
   * il falso positivo di partenza. Deve stare **attaccata**, o si torna lì.
   */
  it.each([
    'Filetto di merluzzo con brodo vegetale',
    'Petto di pollo con contorno vegetale',
    'Prosciutto crudo con crema vegetale di ceci',
  ])('«%s» resta carne o pesce: il segno vegetale non è attaccato all\'animale', (piatto) => {
    expect(eCarne(piatto) || ePesce(piatto)).toBe(true);
  });

  it.each([
    'Branzino al forno con verdure',
    'Filetto di branzino con ceci in umido',
    'Polpo con patate e prezzemolo',
    'Tonno scottato con sesamo',
  ])('«%s» resta pesce', (piatto) => {
    expect(ePesce(piatto)).toBe(true);
  });

  /**
   * ⛔ **«con» non è «di», e qui si vede perché la differenza vale il piatto di qualcuno.**
   * «Pollo con ceci» è pollo vero; «pollo di ceci» non esiste come pollo.
   */
  it('la stessa coppia di parole, con la preposizione diversa, dà due risposte opposte', () => {
    expect(eCarne('Pollo con ceci')).toBe(true);
    expect(eCarne('Pollo di ceci')).toBe(false);
  });
});

describe('senzaImitazioni', () => {
  /** ⚠️ Si cancella solo l'animale: il segno vegetale serve ancora agli altri controlli. */
  it('toglie il nome dell\'animale e lascia il resto dov\'era', () => {
    expect(senzaImitazioni('polpo di ceci')).toBe(`${' '.repeat('polpo'.length)} di ceci`);
  });

  /** ⚠️ Le posizioni non si spostano: altre regole leggono questo testo per indice. */
  it('non sposta niente: la lunghezza resta la stessa', () => {
    const prima = 'branzino di melanzane al cartoccio';
    expect(senzaImitazioni(prima)).toHaveLength(prima.length);
  });

  it('non tocca un testo che non ha imitazioni', () => {
    expect(senzaImitazioni('petto di pollo alla piastra')).toBe('petto di pollo alla piastra');
  });
});
