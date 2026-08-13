/**
 * LE ESCLUSIONI DICHIARATE NEL QUESTIONARIO — punti B, C e §1.3 dell'handoff.
 *
 * I due test che contano sono il primo e l'ultimo: che «altro» non finisca in banca dati come se
 * fosse un alimento, e che il testo libero **resti dentro `allergies`** anche adesso che ha una
 * colonna sua. Il secondo sembra il contrario di quello che si vorrebbe, ed è la cosa che tiene in
 * piedi le esclusioni: sette punti del codice leggono quell'array per togliere i piatti dal menu.
 */
import { NON_ALIMENTI, allergieDaCodificare, allergieDichiarate, intolleranzeDichiarate } from './allergie';

const QUANDO = new Date('2026-08-12T10:00:00Z');
const CODICI_UE = ['glutine', 'latte', 'uova', 'pesce', 'frutta_a_guscio'];

describe('«altro» non è un alimento', () => {
  it('⚠️ il flag si toglie, il testo che ha scritto resta', () => {
    const out = allergieDichiarate(['latte', 'altro'], ['fragole'], QUANDO);
    expect(out.allergies).toEqual(['latte', 'fragole']);
  });

  it('anche «nessuna», «none» e i loro fratelli', () => {
    // Sono risposte, non alimenti: cercarle nei nomi dei piatti non ha senso.
    for (const v of [...NON_ALIMENTI]) {
      expect(allergieDichiarate([v], [], QUANDO).allergies).toEqual([]);
    }
  });

  it('spazi e maiuscole non lo fanno passare', () => {
    expect(allergieDichiarate(['  Altro '], [], QUANDO).allergies).toEqual([]);
  });
});

describe('il testo libero si sa che è testo libero', () => {
  it('⚠️ ma resta ANCHE fra le allergie: è l\'array che esclude davvero i piatti', () => {
    // Sette punti del codice leggono `allergies` per escludere (menu, sostituti di Gaia, base
    // personale, report, CRM, scheda cliente). Spostare il testo libero altrove li disarmerebbe
    // tutti insieme e in silenzio — sarebbe il difetto `frutta_a_guscio`, rifatto in grande.
    const out = allergieDichiarate(['latte'], ['fragole', 'kiwi'], QUANDO);
    expect(out.allergies).toEqual(['latte', 'fragole', 'kiwi']);
    expect(out.allergiesOther).toEqual(['fragole', 'kiwi']);
  });

  it('un codice UE non finisce fra il testo libero', () => {
    const out = allergieDichiarate(['latte'], [], QUANDO);
    expect(out.allergiesOther).toEqual([]);
  });

  it('e non si duplica se arriva da tutte e due le parti', () => {
    const out = allergieDichiarate(['fragole'], ['fragole'], QUANDO);
    expect(out.allergies).toEqual(['fragole']);
    expect(out.allergiesOther).toEqual([]);
  });
});

describe('«non ne ho» contro «non ho risposto»', () => {
  it('una risposta qualsiasi vale come risposta', () => {
    expect(allergieDichiarate(['latte'], [], QUANDO).allergieDichiarateIl).toEqual(QUANDO);
    // Anche un «nessuna» esplicito: non lascia allergeni, ma è una risposta.
    expect(allergieDichiarate(['nessuna'], [], QUANDO).allergieDichiarateIl).toEqual(QUANDO);
    // E anche il solo testo libero, se ha spuntato «altro» e scritto lì.
    expect(allergieDichiarate([], ['fragole'], QUANDO).allergieDichiarateIl).toEqual(QUANDO);
  });

  it('⚠️ ma la pagina saltata NO: nessun campo lì è obbligatorio', () => {
    // È il caso che la colonna esiste per distinguere. Finché il questionario non ha l'opzione
    // «nessuna» esplicita, l'array vuoto va contato coi dubbi, non coi sicuri.
    expect(allergieDichiarate([], [], QUANDO).allergieDichiarateIl).toBeNull();
    expect(allergieDichiarate(undefined, undefined, QUANDO).allergieDichiarateIl).toBeNull();
  });

  it('⚠️ e non è un blocco: la data si scrive, non decide niente', () => {
    // Il «freno forte» lo definisce la nutrizionista. Bloccare 315 piani perché una colonna nuova
    // è vuota sarebbe un guasto di massa introdotto da una migrazione.
    const out = allergieDichiarate([], [], QUANDO);
    expect(out.allergies).toEqual([]);
    expect(out.allergiesOther).toEqual([]);
  });
});

describe('quali allergie deve ancora codificare il nutrizionista', () => {
  it('quando c\'è il fatto, si usa il fatto', () => {
    expect(allergieDaCodificare(['latte', 'fragole'], ['fragole'], CODICI_UE)).toEqual(['fragole']);
  });

  it('⚠️ per chi è iscritta da prima si ricade sulla deduzione, che è tutto quello che c\'è', () => {
    // `allergiesOther` è vuota per costruzione, non perché non abbia scritto niente: scinderla
    // all'indietro in automatico su un dato sanitario è proprio quello che non si fa.
    expect(allergieDaCodificare(['latte', 'fragole'], [], CODICI_UE)).toEqual(['fragole']);
    expect(allergieDaCodificare(['latte', 'fragole'], null, CODICI_UE)).toEqual(['fragole']);
  });

  it('⚠️ le due risposte possono NON coincidere, ed è voluto', () => {
    // Se un codice UE cambia nome, la deduzione comincia a sbagliare — in silenzio. La colonna no:
    // dice quello che la cliente ha scritto a mano, e resta vera comunque cambi il catalogo.
    const catalogoRinominato = ['glutine', 'latte_e_derivati'];
    expect(allergieDaCodificare(['latte'], [], catalogoRinominato)).toEqual(['latte']); // ipotesi sbagliata
    expect(allergieDaCodificare(['latte'], ['fragole'], catalogoRinominato)).toEqual(['fragole']); // fatto
  });

  it('niente da codificare: nessuna riga di avviso', () => {
    expect(allergieDaCodificare(['latte'], [], CODICI_UE)).toEqual([]);
    expect(allergieDaCodificare([], [], CODICI_UE)).toEqual([]);
    expect(allergieDaCodificare(null, null, CODICI_UE)).toEqual([]);
  });
});

/**
 * LE INTOLLERANZE E IL LORO CAMPO LIBERO (13/8, §1.3 dell'handoff).
 *
 * Il test che conta è il secondo: `'other'` si toglie **solo** se lei ha detto cosa. Toglierlo
 * comunque vorrebbe dire cancellare la domanda invece di rispondere — e quella stringa, inutile
 * com'è per i menu, è l'unico modo di trovare chi ha un'intolleranza che noi non sappiamo.
 */
describe('le intolleranze, e la domanda che «Altro» lasciava aperta', () => {
  it('«none» via, come già prima', () => {
    expect(intolleranzeDichiarate(['none'], []).intolerances).toEqual([]);
    expect(intolleranzeDichiarate(['lactose', 'none'], []).intolerances).toEqual(['lactose']);
  });

  it('⚠️ «other» RESTA se non ha scritto cosa: è la sola traccia di quello che non sappiamo', () => {
    // Non esclude niente e non è un alimento — ma è il modo in cui si trova chi ricontattare.
    // Un questionario da un'app vecchia, che il campo nuovo non ce l'ha, ricade qui.
    const out = intolleranzeDichiarate(['lactose', 'other'], []);
    expect(out.intolerances).toEqual(['lactose', 'other']);
    expect(out.scioglieIgnota).toBe(false);
  });

  it('⚠️ e sparisce appena lo dice: la domanda è stata sostituita dalla risposta', () => {
    const out = intolleranzeDichiarate(['lactose', 'other'], ['i latticini di capra']);
    expect(out.intolerances).toEqual(['lactose', 'i latticini di capra']);
    expect(out.intolerancesOther).toEqual(['i latticini di capra']);
    expect(out.scioglieIgnota).toBe(true);
  });

  it('⚠️ il testo libero resta ANCHE fra le intolleranze: è quell\'array che esclude', () => {
    // Stesso disegno delle allergie: `intolerancesOther` è un marcatore, non uno spostamento.
    const out = intolleranzeDichiarate([], ['fichi']);
    expect(out.intolerances).toContain('fichi');
    expect(out.intolerancesOther).toEqual(['fichi']);
  });

  it('non si duplica, e gli spazi non contano', () => {
    const out = intolleranzeDichiarate(['fichi'], [' fichi ']);
    expect(out.intolerances).toEqual(['fichi']);
    expect(out.intolerancesOther).toEqual([]);
  });

  it('una risposta «altro» vuota non diventa un alimento', () => {
    // Se scrive «nessuna» nel campo libero non è un'intolleranza: è una risposta.
    const out = intolleranzeDichiarate(['other'], ['nessuna']);
    expect(out.intolerances).toEqual(['other']);
    expect(out.scioglieIgnota).toBe(false);
  });
});
