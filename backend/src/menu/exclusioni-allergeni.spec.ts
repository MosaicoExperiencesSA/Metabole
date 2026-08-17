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

  /**
   * ⚠️ QUESTO TEST REGISTRAVA IL DIFETTO COME SE FOSSE LA REGOLA (corretto il 12/8).
   *
   * La riga diceva `expect(mancanti).toEqual(['frutta_a_guscio', 'lupini', 'sedano', 'senape',
   * 'solfiti'])` con il commento «non hanno derivati: la parola stessa basta». Per quattro dei
   * cinque era discutibile; per `frutta_a_guscio` era **falso** — la mappa ce l'ha, i derivati, ma
   * sotto la chiave `'frutta a guscio'` con gli spazi. Il questionario salva l'underscore, quindi
   * `expandExclusion('frutta_a_guscio')` tornava `['frutta_a_guscio']`: una stringa che non compare
   * in nessun piatto e in nessun ingrediente. **Quell'allergia non escludeva niente**, sulla stessa
   * strada che l'8/8 ha proposto il burro a Giusy.
   *
   * Un test che fotografa il comportamento invece di affermare la regola non protegge: certifica.
   * Adesso l'elenco dev'essere **vuoto**, e chi aggiunge un'opzione al questionario lo scopre qui.
   */
  it('⚠️ TUTTI i 14 allergeni UE si espandono: nessuno vale solo come parola', () => {
    const mancanti = EU_ALLERGENS.map((a) => a.code).filter(
      (code) => expandExclusion(code).length === 1 && !INTOLERANCE_MAP[code],
    );
    expect(mancanti.sort()).toEqual([]);
  });

  it('⚠️ IL CASO FRUTTA A GUSCIO: l\'underscore del questionario non è un\'allergia diversa', () => {
    // `onboarding.questions.ts` salva `frutta_a_guscio`; la mappa conosce `'frutta a guscio'`.
    const chiavi = exclusionKeys(['frutta_a_guscio']);
    expect(scartato(chiavi, 'insalata di noci e pere')).toBe(true);
    expect(scartato(chiavi, 'crema di mandorle')).toBe(true);
    expect(scartato(chiavi, 'pesto con pinoli')).toBe(true);
    // E non chiude tutto: il filtro deve restare un filtro.
    expect(scartato(chiavi, 'petto di pollo')).toBe(false);
  });

  it('⚠️ vale per QUALSIASI underscore, non solo per questo caso', () => {
    // Si normalizza nella funzione invece di aggiungere l'alias a mano, così la prossima opzione
    // che nasce con l'underscore non riapre lo stesso buco in silenzio.
    expect(expandExclusion('frutta_secca')).toContain('noci');
    expect(expandExclusion('latte_e_derivati')).toContain('burro');
  });

  it('⚠️ ma l\'alias `latticini_` continua a funzionare: si guarda la forma grezza per prima', () => {
    // Esiste davvero, con l'underscore in fondo. Normalizzare senza controllare prima la forma
    // originale l'avrebbe rotto — una correzione che ne apre un'altra.
    expect(expandExclusion('latticini_')).toContain('mozzarella');
  });

  it.each([
    ['sedano', 'vellutata di sedano rapa'],
    ['senape', 'salsa alla mostarda'],
    ['lupini', 'farina di lupino'],
  ])('il nuovo allergene «%s» protegge da «%s»', (allergene, alimento) => {
    expect(scartato(exclusionKeys([allergene]), alimento)).toBe(true);
  });

  it('✅ i SOLFITI adesso tolgono qualcosa: l\'elenco è arrivato dalla nutrizionista (13/8)', () => {
    // Fino al 13/8 questo test diceva l'OPPOSTO — «vino: non scartato» — ed era giusto così: senza
    // l'elenco, «solfiti» non compare in nessun ingrediente e quell'allergia non toglieva niente.
    // L'elenco è arrivato (tabella Reg. UE 1129/2011 passata da Simone), e con lui il divieto morde.
    const chiavi = exclusionKeys(['solfiti']);
    expect(scartato(chiavi, 'vino bianco')).toBe(true);
    expect(scartato(chiavi, 'albicocche disidratate')).toBe(true);
  });
});

/**
 * I SOLFITI — l'elenco della nutrizionista (13/8).
 *
 * ⚠️ Il test che conta di più non è quello che verifica cosa si toglie: è quello che verifica cosa
 * NON si toglie. Un divieto sui solfiti che porta via l'uva fresca, le patate e i pomodori non
 * protegge nessuno — fa solo smettere di fidarsi dell'elenco, e a quel punto lo si disattiva.
 */
describe('solfiti: quello che si toglie', () => {
  const parole = expandExclusion('solfiti');

  it('la parola letterale resta: è quella che compare in etichetta', () => {
    expect(parole).toEqual(expect.arrayContaining(['solfiti', 'anidride solforosa']));
  });

  it('prende il vino e la frutta essiccata, che sono le due categorie più cariche', () => {
    expect(parole).toEqual(expect.arrayContaining(['vino', 'uvetta', 'albicocche secche', 'prugne secche']));
  });

  it('prende i gamberi e il baccalà: crostacei e pesce salato ne hanno per legge', () => {
    expect(parole).toEqual(expect.arrayContaining(['gamberi', 'baccal', 'stoccafisso']));
  });
});

describe('⚠️ solfiti: quello che NON si toglie', () => {
  const parole = expandExclusion('solfiti');

  it('l\'uva FRESCA resta: i solfiti stanno nell\'uvetta', () => {
    expect(parole).not.toContain('uva');
  });

  it('le patate, i pomodori e il limone freschi restano', () => {
    // Si toglie «purè di patate» e «pomodori secchi», non la patata e il pomodoro.
    expect(parole).not.toContain('patate');
    expect(parole).not.toContain('pomodoro');
    expect(parole).not.toContain('limone');
  });
});

/**
 * DUE ALIMENTI DENTRO UN TAG SOLO — caso Jolanda Todde, 17/8.
 *
 * In scheda aveva `Cibi esclusi (1): "Carne .ceci"`: una stringa sola, scritta di getto nel campo
 * a tag del questionario. `expandExclusion` non riconosceva quella chiave e restituiva la stringa
 * intera, che il motore andava a cercare dentro il nome e gli ingredienti dei piatti — dove non
 * compare mai. **Né la carne né i ceci sono stati esclusi**, e le è arrivata in menu un'insalata di
 * ceci il giorno dopo aver detto che i ceci non li vuole.
 *
 * ⚠️ È la terza volta che questo progetto paga la stessa riga: `latte` che non espandeva i derivati
 * (8/8), `frutta_a_guscio` con l'underscore (12/8), e adesso due alimenti in un tag. Il difetto è
 * sempre lo stesso, ed è quello scritto in testa a `exclusions.ts`: **una chiave che la mappa non
 * riconosce si comporta come un'esclusione che non c'è, e non produce nessun errore.**
 *
 * Si corregge QUI e non solo nel questionario perché qui agisce subito su tutte le clienti che
 * hanno già un tag sporco in scheda, senza migrazioni e senza toccare un dato scritto da loro.
 */
describe('expandExclusion — un tag che contiene più alimenti', () => {
  it('«Carne .ceci» esclude la carne E i ceci', () => {
    const k = expandExclusion('Carne .ceci');
    expect(k).toContain('carne');
    expect(k).toContain('ceci');
  });

  it('i separatori che escono da una tastiera vera: virgola, punto, punto e virgola, slash', () => {
    for (const t of ['carne, ceci', 'carne. ceci', 'carne; ceci', 'carne / ceci', 'carne e ceci']) {
      const k = expandExclusion(t);
      expect(k).toContain('carne');
      expect(k).toContain('ceci');
    }
  });

  it('⚠️ ogni pezzo si espande per conto suo: «latte, ceci» porta dentro anche il burro', () => {
    // Spezzare senza riespandere sarebbe mezza correzione: «latte» vale solo se tira dentro i
    // derivati, che è la lezione dell'8/8 (il burro proposto a una cliente allergica al latte).
    const k = expandExclusion('latte, ceci');
    expect(k).toContain('burro');
    expect(k).toContain('ceci');
  });

  it('⚠️ un alimento dal nome composto NON si spezza: «frutta a guscio», «insalata russa»', () => {
    // Spezzare sugli spazi trasformerebbe «frutta a guscio» in «frutta», «guscio» — cioè in
    // un'esclusione molto più larga di quella dichiarata, che toglierebbe tutta la frutta.
    expect(expandExclusion('frutta a guscio')).toContain('noci');
    expect(expandExclusion('insalata russa')).toContain('insalata russa');
  });

  it('un tag pulito resta esattamente com\'era', () => {
    expect(expandExclusion('kiwi')).toEqual(['kiwi']);
    expect(expandExclusion('')).toEqual([]);
  });
});
