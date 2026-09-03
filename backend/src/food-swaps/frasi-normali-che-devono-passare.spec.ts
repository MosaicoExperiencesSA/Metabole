/**
 * ⛔ **LA RETE CHE MANCAVA: le frasi normali che devono continuare a funzionare.**
 *
 * Il 2/9 sera ho chiuso quattro versi del troncamento silenzioso e, per chiuderne uno, ho spento
 * **diciannove frasi perfettamente normali** — «metti il petto di tacchino al posto del pollo»,
 * «usa il latte di soia invece del latte vaccino», «prova della ricotta al posto dello yogurt».
 * L'ha trovato una revisione avversariale scrivendosi un corpus di frasi vere; le mie prove, tutte
 * costruite sui casi da bloccare, erano verdi.
 *
 * ⚠️ **È la lezione che questo stesso file ha già scritto due volte** — sul «senza glutine» il 31/8
 * e sui verbi «furbi»: *«una guardia che blocca il caso normale non è prudente: è rotta, e sembra
 * prudente»*. Mancava il modo di accorgersene: un elenco di frasi che una nutrizionista manderebbe
 * davvero, tenute ferme come qualunque altra prova.
 *
 * ⛔ **E il costo di sbagliare qui non è simmetrico.** Su `capisci` un rifiuto diventa una domanda;
 * su `impara-dal-nutrizionista.ts` è un `return 0` **senza notifica**: la nutrizionista scrive alla
 * cliente, non viene registrato niente, e nessuno le chiede niente. Un falso allarme lì non è «una
 * domanda in più», è **un silenzio in più**.
 *
 * ⚠️ Chi aggiunge una guardia a questo file aggiunge prima una frase qui.
 */
import { sostituzioniNelMessaggio } from './impara-dalla-chat';

/** Ogni riga: la frase, il nome che deve USCIRE, il nome che deve ENTRARE. */
const FRASI: [string, RegExp, RegExp][] = [
  // — la forma diretta, con nomi composti —
  ['sostituisci il pane con le gallette', /^pane$/i, /^gallette$/i],
  ['sostituisci il latte con la bevanda di soia', /^latte$/i, /^bevanda di soia$/i],
  ['sostituisci il pane con Gallette di riso', /^pane$/i, /^gallette di riso$/i],
  ['sostituisci il pollo con il petto di tacchino', /^pollo$/i, /^petto di tacchino$/i],
  ['sostituisci il riso con l\'insalata di farro', /^riso$/i, /^insalata di farro$/i],
  ['cambia il burro con la crema di mandorle', /^burro$/i, /^crema di mandorle$/i],
  /**
   * ⚠️ **«a colazione» entra nel nome, ed è un difetto preesistente che questa riga TIENE FERMO
   * invece di nasconderlo.** Con la regex a sottostringa (`/gallette/i`) non si vedeva. Il pezzo
   * dopo «con» non è delimitato da niente e la coda di contesto ci finisce dentro: si chiude
   * quando si saprà separarla, non con una guardia — vedi cos'è successo il 2/9 sera.
   */
  ['sostituisci il pane con le gallette a colazione', /^pane$/i, /^gallette a colazione$/i],
  ['Sostituisci il latte con la bevanda di soia, che ti resta più leggera.', /^latte$/i, /^bevanda di soia$/i],
  ['sostituisci il latte con la soia perché è più leggera', /^latte$/i, /^soia$/i],
  ['sostituisci il latte con la soia ma solo la mattina', /^latte$/i, /^soia$/i],
  ['sostitusci i ceci con i fagioli', /^ceci$/i, /^fagioli$/i],

  // — la forma rovesciata: «Y al posto di X» —
  ['metti il tacchino al posto del pollo', /^pollo$/i, /^tacchino$/i],
  ['Ricorda: tacchino al posto del pollo', /^pollo$/i, /^tacchino$/i],
  ['per favore metti le gallette al posto del pane', /^pane$/i, /^gallette$/i],
  ['metti il pane al posto delle gallette', /^gallette$/i, /^pane$/i],
  ['metti della ricotta al posto del burro', /^burro$/i, /^ricotta$/i],


  /**
   * ⚠️ **I verbi con cui una persona scrive davvero**, che non sono quattro: la lista bianca che
   * avevo messo ne conosceva sette e spegneva tutte le altre.
   */
  ['ti consiglio della bresaola al posto del prosciutto', /^prosciutto$/i, /^bresaola$/i],
  ['prova della ricotta al posto dello yogurt', /^yogurt$/i, /^ricotta$/i],
  ['facciamo del riso al posto della pasta', /^pasta$/i, /^riso$/i],
  ['lascia del parmigiano al posto del pecorino', /^pecorino$/i, /^parmigiano$/i],
  ['scegli del pane integrale al posto del pane bianco', /^pane bianco$/i, /^pane integrale$/i],
  ['alterna del pesce al posto della carne', /^carne$/i, /^pesce$/i],

  /**
   * ⚠️ **Le congiunzioni di discorso non sono elenchi di alimenti**, e nella forma rovesciata
   * arrivano prima del nome.
   */
  ['l\'ideale è yogurt greco al posto del latte', /^latte$/i, /^yogurt greco$/i],
  ['metti anche gallette al posto del pane', /^pane$/i, /^gallette$/i],
  ['A colazione sempre gallette al posto del pane', /^pane$/i, /^gallette$/i],
  ['Sostituisci le uova con la ricotta e vedrai che va meglio', /^uova$/i, /^ricotta$/i],
  ['sostituisci il pane con le gallette e fammi sapere', /^pane$/i, /^gallette$/i],

  /**
   * ⛔ **I NOMI COMPOSTI NELLA FORMA ROVESCIATA**: erano la famiglia rotta, e sono la ragione per
   * cui questo file esiste. In italiano «X di Y» è il modo normale di chiamare mezzo scaffale, e
   * nella forma rovesciata il nome sta **prima** del verbo, quindi lo legge la risalita.
   * ✅ Chiusi il 3/9 correggendo `codaDellaFrase`: l'articolo chiude il nome solo quando prima c'è
   * chi scrive. Fino al 2/9 di «crema di mandorle» restava «mandorle».
   */
  ['metti il petto di tacchino al posto del pollo', /^pollo$/i, /^petto di tacchino$/i],
  ['metti il filetto di merluzzo al posto del pollo', /^pollo$/i, /^filetto di merluzzo$/i],
  ['usa il latte di soia invece del latte vaccino', /^latte vaccino$/i, /^latte di soia$/i],
  ['metti la crema di mandorle al posto del burro', /^burro$/i, /^crema di mandorle$/i],
  ['metti le gallette di riso al posto del pane', /^pane$/i, /^gallette di riso$/i],
  ["metti l'insalata di farro al posto del riso", /^riso$/i, /^insalata di farro$/i],
  ['metti il gelato alla crema al posto del budino', /^budino$/i, /^gelato alla crema$/i],
  ['metti i cracker ai cereali al posto del pane', /^pane$/i, /^cracker ai cereali$/i],
  ['metti le penne agli spinaci al posto del riso', /^riso$/i, /^penne agli spinaci$/i],
  /** ⚠️ E il verbo di chi scrive non entra più nel nome quando l'articolo è elidato e attaccato. */
  ["metti l'orzo perlato al posto del riso", /^riso$/i, /^orzo perlato$/i],

  /**
   * ⚠️ **E il nome della cliente non entra nel piatto.** Correggendo la risalita, la prima stesura
   * del 3/9 leggeva «per Anna il tacchino al posto del pollo» come «Anna il tacchino»: l'articolo
   * vero chiude il nome, la preposizione no.
   */
  ['per Anna il tacchino al posto del pollo', /^pollo$/i, /^tacchino$/i],
  ['per Giulia le gallette al posto del pane', /^pane$/i, /^gallette$/i],

  /**
   * ⚠️ **I due punti chiudono quello che c'era prima**, anche quando davanti non c'è un verbo che
   * la risalita sa riconoscere: «Nota importante» non è un piatto.
   */
  ['Nota importante: tacchino al posto del pollo', /^pollo$/i, /^tacchino$/i],

  /**
   * ⛔ **GLI ALIMENTI CHE COMINCIANO COME UN VERBO.** La prima stesura del 3/9 confrontava i verbi
   * di chi scrive **per prefisso**: «**prov**ola», «**punt**arelle», «**passa**ta», «**lev**istico»,
   * «**dai**kon» venivano scambiati per verbi e buttati fuori dal nome — e la frase non imparava
   * più niente. ⚠️ «passata di pomodoro» è un ingrediente di questo catalogo, non un caso di scuola.
   * ✅ Adesso il confronto è per parola intera.
   */
  ['metti la provola al posto della mozzarella', /^mozzarella$/i, /^provola$/i],
  ['metti il provolone al posto del parmigiano', /^parmigiano$/i, /^provolone$/i],
  ['metti le puntarelle al posto della rucola', /^rucola$/i, /^puntarelle$/i],
  ['usa la passata di pomodoro al posto del sugo pronto', /^sugo pronto$/i, /^passata di pomodoro$/i],
  ['metti il levistico al posto del sedano', /^sedano$/i, /^levistico$/i],
  ['metti il daikon al posto del ravanello', /^ravanello$/i, /^daikon$/i],
  ['metti la provola affumicata al posto della scamorza', /^scamorza$/i, /^provola affumicata$/i],
  ['metti le punte di asparagi al posto dei carciofi', /^carciofi$/i, /^punte di asparagi$/i],
  ['metti il passato di verdure al posto del minestrone', /^minestrone$/i, /^passato di verdure$/i],

  /**
   * ⛔ **I PARTITIVI SONO ARTICOLI, e aprono il nome come «la».** La prima stesura li aveva lasciati
   * fuori — sembrano preposizioni — e il **nome della cliente** finiva nel piatto: «per Anna della
   * ricotta» imparava «Anna della ricotta».
   */
  ['per Anna della ricotta al posto del formaggio spalmabile', /^formaggio spalmabile$/i, /^ricotta$/i],
  ['per Giulia del pane integrale al posto del pane bianco', /^pane bianco$/i, /^pane integrale$/i],
  ['per Chiara delle gallette al posto delle fette biscottate', /^fette biscottate$/i, /^gallette$/i],
  ['a colazione dello yogurt greco al posto del latte', /^latte$/i, /^yogurt greco$/i],

  /**
   * ⚠️ **E l'articolo elidato è attaccato al nome**, quindi non combacia con nessuna voce
   * dell'elenco: anche lì il nome della cliente ci finiva dentro. Vale con tutt'e due gli apostrofi,
   * perché chi scrive dal telefono prende quello tipografico senza accorgersene.
   */
  ["per Anna un'insalata di farro al posto del riso", /^riso$/i, /^insalata di farro$/i],
  ['per Anna l’insalata di farro al posto del riso', /^riso$/i, /^insalata di farro$/i],

  /**
   * ⛔ **IL NOME SENZA ARTICOLO DAVANTI: è l'unico caso in cui serve riconoscere chi scrive.**
   * Con l'articolo la risalita si ferma da sé; qui no, e senza l'elenco dei verbi il piatto
   * imparato sarebbe «metti tacchino».
   */
  ['metti tacchino al posto del pollo', /^pollo$/i, /^tacchino$/i],
  ['consiglio tacchino al posto del pollo', /^pollo$/i, /^tacchino$/i],
  ['proviamo yogurt greco al posto del latte', /^latte$/i, /^yogurt greco$/i],

  // — chi scrive di corsa, senza accenti —
  ['sostituisci il parmigiano con il grana padano perche e piu leggero', /^parmigiano$/i, /^grana padano$/i],
];

describe('le frasi normali continuano a funzionare', () => {
  it.each(FRASI)('«%s»', (frase, da, a) => {
    const r = sostituzioniNelMessaggio(frase);
    expect(r).toHaveLength(1);
    expect(r[0].from).toMatch(da);
    expect(r[0].to).toMatch(a);
  });
});

/**
 * ⛔ **E QUESTO BLOCCO ERA PIENO — dieci `it.failing`, e il 3/9 sono diventate tutte rosse.**
 *
 * `it.failing` vuol dire «deve fallire»: la suite resta verde finché il difetto c'è, e diventa
 * rossa **il giorno che qualcuno lo corregge**, obbligandolo a spostare la riga nel corpus qui
 * sopra. È il contrario di una prova che documenta lo sbaglio e lo fa sembrare voluto — e ha
 * funzionato: la correzione di `codaDellaFrase` le ha fatte cadere tutte e dieci insieme, e sono
 * salite di sopra.
 *
 * ⚠️ Qui dentro sta quello che è **misurato e non ancora corretto**: il prossimo difetto si scrive
 * qui, non in un commento.
 */
describe('⛔ difetti noti, misurati e non ancora corretti', () => {
  /**
   * ⛔ **Davanti al nome, quello che la risalita non riconosce se lo porta dentro.**
   *
   * La risalita si ferma su un articolo vero, su chi scrive (per radice) o su una congiunzione. Un
   * saluto, un nome proprio o una parola qualsiasi non è nessuna delle tre, e finisce nel piatto:
   *
   *     «ciao Anna Maria buongiorno gallette al posto del pane» → impara «Anna Maria buongiorno gallette»
   *
   * ⚠️ **Il limite di quattro parole lo accorcia, non lo corregge**: è una regola dichiarata contro
   * i nomi che crescono all'infinito, non contro quelli sbagliati.
   *
   * ⛔ **E la cura non è allungare l'elenco dei verbi.** Un elenco di saluti e di nomi propri non
   * finisce mai, ed è la strada che il 2/9 sera ha spento ventuno frasi normali. Il verso giusto è
   * l'opposto: capire dove **comincia** il nome invece di elencare quello che non lo è.
   */
  it.failing('⛔ oggi un saluto davanti al nome ci finisce dentro', () => {
    const r = sostituzioniNelMessaggio('ciao Anna Maria buongiorno gallette al posto del pane');
    /**
     * ⚠️ **`toHaveLength(1)` PRIMA di leggere `r[0]`**, e non è pignoleria: senza, il giorno che
     * quella frase smettesse di produrre qualcosa `r[0].to` lancerebbe un `TypeError` — e
     * `it.failing` conta il lancio come «fallimento previsto», restando **verde**. Cioè il difetto
     * peggiore (il silenzio) si nasconderebbe dentro la prova che sorveglia quello opposto.
     */
    expect(r).toHaveLength(1);
    expect(r[0].to).toMatch(/^gallette$/i);
  });

  /**
   * ⚠️ **Il nome imparato non supera le quattro parole dichiarate.**
   *
   * ⛔ E il limite dentro `codaDellaFrase` **nessuna prova lo uccide**: togliendolo questa resta
   * verde. ⚠️ Non perché sia ridondante — `nomeAlimento` conta in modo diverso, e senza quel limite
   * «un piatto **di** crema di mandorle» diventerebbe «piatto di crema di» — ma perché nessuna
   * frase scritta qui lo distingue. Lo si dice invece di lasciar credere che sia coperto.
   */
  it('⚠️ e comunque il nome imparato non supera le quattro parole dichiarate', () => {
    const r = sostituzioniNelMessaggio('ciao Anna Maria buongiorno come stai gallette al posto del pane');
    expect(r).toHaveLength(1);
    expect((r[0].to ?? '').split(/\s+/)).toHaveLength(4);
    /** ⚠️ E l'alimento c'è dentro: senza, «non supera quattro parole» sarebbe verde anche su un
     *  nome fatto di soli saluti. */
    expect(r[0].to).toMatch(/gallette/i);
  });
});

