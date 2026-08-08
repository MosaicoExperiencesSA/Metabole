/**
 * IL FILTRO DEGLI ALLERGENI SUI SOSTITUTI — il difetto più grave trovato l'8/8/2026.
 *
 * Nella conversazione vera: Giusy, `allergies: ['latte']`, chiede di cambiare la panna e Gaia le
 * propone **70 g di burro**. Il burro è un derivato del latte. L'ha fermata lei rispondendo «no».
 *
 * Il motivo per cui è passato è piccolo e istruttivo: il filtro cerca le parole chiave
 * dell'esclusione dentro il nome dell'alimento proposto, e `expandExclusion('latte')` restituiva
 * solo «latte» — che nella parola «burro» non c'è. La mappa aveva `lattosio` e `latticini` ma non
 * `latte`, cioè proprio il termine con cui l'allergene si chiama nell'elenco UE.
 * Secondo problema, sullo stesso profilo: le sue intolleranze dicono `lactose`, in inglese, e
 * nessuna chiave lo riconosceva.
 *
 * Questi test descrivono lo scenario reale, col nome della cliente, perché un giorno qualcuno
 * potrebbe voler «semplificare» questa mappa e deve sapere cosa ha in mano.
 */

import { EU_ALLERGENS } from '../catalog/allergens';
import { exclusionKeys, expandExclusion, INTOLERANCE_MAP } from './exclusions';

/** Come lo verifica il codice vero: la parola chiave dentro il testo dell'alimento. */
const scartato = (chiavi: Set<string>, alimento: string) =>
  [...chiavi].some((k) => k && alimento.toLowerCase().includes(k));

describe('allergeni: derivati e alias', () => {
  it('IL CASO GIUSY: con allergia al «latte» il burro NON si propone', () => {
    const chiavi = exclusionKeys(['latte']);
    expect(scartato(chiavi, 'burro')).toBe(true);
    expect(scartato(chiavi, 'panna fresca')).toBe(true);
    expect(scartato(chiavi, 'parmigiano reggiano')).toBe(true);
    expect(scartato(chiavi, 'yogurt greco')).toBe(true);
  });

  it('e un alimento che non c\'entra resta proponibile: il filtro non deve chiudere tutto', () => {
    const chiavi = exclusionKeys(['latte']);
    expect(scartato(chiavi, 'olio evo')).toBe(false);
    expect(scartato(chiavi, 'avocado')).toBe(false);
    expect(scartato(chiavi, 'petto di pollo')).toBe(false);
  });

  it('`lactose` in inglese vale come «lattosio»: è quello che ha davvero in scheda', () => {
    const chiavi = exclusionKeys(['lactose']);
    expect(scartato(chiavi, 'burro')).toBe(true);
    expect(scartato(chiavi, 'mozzarella di bufala')).toBe(true);
  });

  it.each([
    ['milk', 'burro'],
    ['dairy', 'ricotta'],
    ['gluten', 'pane integrale'],
    ['nuts', 'mandorle'],
    ['peanuts', 'arachidi'],
    ['soy', 'tofu'],
    ['fish', 'salmone'],
    ['shellfish', 'gamberi'],
    ['eggs', 'frittata di verdure'],
    ['sesame', 'tahini'],
  ])('l\'alias «%s» protegge da «%s»', (allergene, alimento) => {
    expect(scartato(exclusionKeys([allergene]), alimento)).toBe(true);
  });

  it('il termine scritto dalla cliente resta sempre fra le chiavi, anche se sconosciuto', () => {
    // Una parola che la mappa non conosce non deve sparire: vale almeno per sé stessa.
    expect(expandExclusion('kiwi')).toEqual(['kiwi']);
    expect(scartato(exclusionKeys(['kiwi']), 'kiwi a fette')).toBe(true);
  });

  it('un termine vuoto non produce chiavi (una chiave vuota escluderebbe TUTTO)', () => {
    expect(expandExclusion('')).toEqual([]);
    expect(expandExclusion('   ')).toEqual([]);
    expect([...exclusionKeys([null, undefined, ''])]).toEqual([]);
  });

  /**
   * La guardia contro il divario: i derivati del latte sono scritti in due posti — qui e nel
   * dizionario UE compilato con la nutrizionista. Se uno dei due cresce e l'altro no, torna il
   * buco di stasera: la ricetta viene taggata come «latte» ma il sostituto passa.
   */
  it('i derivati del latte coprono le parole del dizionario UE (nessun divario fra i due elenchi)', () => {
    const ue = EU_ALLERGENS.find((a) => a.code === 'latte');
    expect(ue).toBeDefined();
    const chiavi = exclusionKeys(['latte']);
    const scoperti = (ue?.keywords ?? []).filter((kw) => {
      // Le voci UE sono radici («formagg», «mozzarell»): si confrontano con la parola intera.
      const esempio = kw.replace(/[^a-z ]/g, '');
      return !scartato(chiavi, esempio) && ![...chiavi].some((k) => esempio.startsWith(k) || k.startsWith(esempio));
    });
    expect(scoperti).toEqual([]);
  });

  it('la mappa conosce tutti i 14 allergeni UE, per nome o per alias', () => {
    const mancanti = EU_ALLERGENS.map((a) => a.code).filter(
      (code) => expandExclusion(code).length === 1 && !INTOLERANCE_MAP[code],
    );
    // `sedano`, `senape`, `solfiti` e `lupini` non hanno derivati: la parola stessa basta.
    expect(mancanti.sort()).toEqual(['frutta_a_guscio', 'lupini', 'sedano', 'senape', 'solfiti']);
  });
});
