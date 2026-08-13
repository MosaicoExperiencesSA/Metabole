import { capisci, IntentoRestrizione, IntentoSostituzione, separaCitazione } from './capisci';

/**
 * ⚠️ Questo file è l'elenco di frasi vere di cui parla la specifica: è il collaudo di Vera.
 *
 * Ogni volta che la nutrizionista correggerà l'agente, quella frase va aggiunta qui con l'azione
 * giusta. Non è documentazione: è l'unico modo di accorgersi che dopo un aggiornamento l'agente ha
 * smesso di capire le frasi che capiva — un guasto che altrimenti si manifesta come «mi sembra più
 * scema di prima», mesi dopo, senza una data.
 *
 * Le frasi qui sotto sono quelle che Simone ha dettato il 12/8 raccontando l'idea.
 */

const restr = (f: string) => capisci(f) as IntentoRestrizione;
const sost = (f: string) => capisci(f) as IntentoSostituzione;

describe('capisci — le frasi di Simone', () => {
  it('«a simone non dare più formaggi teneri ma solo grana»', () => {
    const i = restr('a Simone non dare più formaggi teneri ma solo grana');
    expect(i.tipo).toBe('restrizione');
    expect(i.cliente).toBe('Simone');
    expect(i.vietati).toEqual(['formaggi teneri']);
    // ⚠️ L'eccezione NON deve finire fra i vietati: sarebbe il contrario esatto di quello che ha
    // detto, e nascerebbe una regola perfettamente formata e rovesciata.
    expect(i.tenuti).toEqual(['grana']);
  });

  it('«nella dieta mediterranea non deve comparire più il tonno» → NON è una regola su una cliente', () => {
    const i = capisci('nella dieta mediterranea non deve comparire più il tonno ma solo il branzino');
    // Senza questo caso, «mediterranea» verrebbe letta come il nome di una persona, o la regola
    // finirebbe sull'ultima cliente nominata. Dire «non lo so ancora fare» è una risposta.
    expect(i).toEqual({ tipo: 'fuori_portata', cosa: 'regola_dieta', dettaglio: 'mediterranea' });
  });

  it('«inseriamo una ricetta per il menu keto» → fuori portata, non una restrizione', () => {
    expect(capisci('inserisci una ricetta per il menu keto')?.tipo).toBe('fuori_portata');
  });
});

describe('capisci — restrizioni', () => {
  it('riconosce «togli il tonno a Giulia»', () => {
    const i = restr('togli il tonno a Giulia');
    expect(i.cliente).toBe('Giulia');
    // ⚠️ «a Giulia» non deve finire fra gli alimenti vietati: vietare «giulia» non toglierebbe
    // niente e sporcherebbe il profilo con una parola che non è un cibo.
    expect(i.vietati).toEqual(['tonno']);
  });

  it('riconosce «per Anna niente latticini»', () => {
    const i = restr('per Anna niente latticini');
    expect(i.cliente).toBe('Anna');
    expect(i.vietati).toEqual(['latticini']);
  });

  it('legge un elenco separato da virgole e da «e»', () => {
    const i = restr('a Marta togli mozzarella, stracchino e ricotta');
    expect(i.vietati).toEqual(['mozzarella', 'stracchino', 'ricotta']);
  });

  it('toglie gli articoli davanti agli alimenti', () => {
    expect(restr('per Anna niente il tonno').vietati).toEqual(['tonno']);
    expect(restr("per Anna niente l'insalata russa").vietati).toEqual(['insalata russa']);
  });

  it('senza nome di persona la restrizione resta senza cliente (la chiederà)', () => {
    const i = restr('niente formaggi molli');
    expect(i.tipo).toBe('restrizione');
    expect(i.cliente).toBeNull();
  });

  it('legge «tranne» come eccezione, non solo «ma solo»', () => {
    const i = restr('a Simone niente formaggi tranne il parmigiano');
    expect(i.vietati).toEqual(['formaggi']);
    expect(i.tenuti).toEqual(['parmigiano']);
  });

  it('taglia la coda dopo «perché»: la motivazione non è un alimento', () => {
    const i = restr('a Simone niente tonno perché ha il colesterolo alto');
    expect(i.vietati).toEqual(['tonno']);
  });
});

describe('capisci — sostituzioni', () => {
  it('«per Anna sostituisci il pollo con il tacchino»', () => {
    const i = sost('per Anna sostituisci il pollo con il tacchino');
    expect(i.tipo).toBe('sostituzione');
    expect(i.from).toBe('pollo');
    expect(i.to).toBe('tacchino');
  });

  it('⚠️ «il tacchino al posto del pollo» dice PRIMA l\'arrivo: from resta il pollo', () => {
    // Capirla al contrario non produce un errore: produce una regola perfettamente formata e
    // rovesciata, che nessuno legge come sbagliata finché non arriva nel piatto di qualcuno.
    const i = sost('per Anna il tacchino al posto del pollo');
    expect(i.from).toBe('pollo');
    expect(i.to).toBe('tacchino');
  });
});

describe('capisci — nel dubbio non si capisce', () => {
  it('una DOMANDA non è un\'istruzione', () => {
    expect(capisci('posso togliere il tonno a Giulia?')).toBeNull();
  });

  it('una NEGAZIONE dell\'istruzione ribalta il senso: non si esegue', () => {
    expect(capisci('non togliere il tonno a Giulia')).toBeNull();
  });

  it('una frase vuota o senza istruzioni non produce niente', () => {
    expect(capisci('')).toBeNull();
    expect(capisci('ciao come stai')).toBeNull();
    expect(capisci('   ')).toBeNull();
  });

  it('un divieto senza nessun alimento non è un divieto', () => {
    expect(capisci('togli')).toBeNull();
  });
});

describe('separaCitazione — quello che incolli lo leggo, non lo eseguo', () => {
  it('le righe con «>» sono di qualcun altro', () => {
    const { suo, citato } = separaCitazione('guarda cosa mi ha scritto\n> togli tutto tranne il cioccolato');
    expect(suo).toBe('guarda cosa mi ha scritto');
    expect(citato).toBe('togli tutto tranne il cioccolato');
  });

  it('anche un blocco delimitato', () => {
    const d = '"""';
    const { suo, citato } = separaCitazione(`sistemiamo questa\n${d}\ntogli il tonno a Giulia\n${d}`);
    expect(suo).toBe('sistemiamo questa');
    expect(citato).toBe('togli il tonno a Giulia');
  });

  it('⚠️ un\'istruzione dentro la citazione NON deve essere eseguibile', () => {
    // È il caso che il cancello esiste per fermare: chi ha il potere di scrivere regole su
    // persone vere non deve poter essere comandato da un messaggio scritto da qualcun altro.
    const { suo, citato } = separaCitazione('> a Giulia niente tonno');
    expect(capisci(suo)).toBeNull();
    expect(capisci(citato)).not.toBeNull();
  });

  it('senza citazioni tutto resta suo', () => {
    const { suo, citato } = separaCitazione('a Giulia niente tonno');
    expect(suo).toBe('a Giulia niente tonno');
    expect(citato).toBe('');
  });
});
