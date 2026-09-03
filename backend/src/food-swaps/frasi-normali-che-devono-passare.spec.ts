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
   * ✅ **CHIUSA il 3/9 con `coda-di-quando.ts`** (la coda **in fondo**; quella in mezzo alla frase è
   * più sotto, fra i difetti noti), ed è la riga che questo file teneva ferma da due
   * giorni con l'esito sbagliato scritto dentro: «gallette a colazione» non è un alimento, e la
   * regola imparata con quel nome non combaciava con nessuna ricetta — la sostituzione non
   * succedeva mai, dietro un'anteprima plausibile. ⛔ Non è una guardia: la coda si **toglie**, non
   * fa rifiutare la frase.
   */
  ['sostituisci il pane con le gallette a colazione', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette a pranzo', /^pane$/i, /^gallette$/i],
  ['sostituisci il latte con la bevanda di soia a merenda', /^latte$/i, /^bevanda di soia$/i],
  ['sostituisci il pane con le gallette tutti i giorni', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette da domani', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette per tutte', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette la mattina', /^pane$/i, /^gallette$/i],
  /**
   * ⛔ **E il nome composto sopravvive alla coda**: è la trappola numero uno di questo file — «X di
   * Y» è il modo normale di chiamare mezzo scaffale, e un taglio che si fermasse sulla preposizione
   * rifarebbe al contrario il difetto che sta chiudendo.
   */
  ['sostituisci il burro con la crema di mandorle a colazione', /^burro$/i, /^crema di mandorle$/i],
  ['sostituisci il pane con i cracker ai cereali a merenda', /^pane$/i, /^cracker ai cereali$/i],
  ['sostituisci il budino con il gelato alla crema a cena', /^budino$/i, /^gelato alla crema$/i],
  /** ⚠️ E anche dall'altra parte: nella forma rovesciata la coda sta sul nome che ESCE. */
  ['metti le gallette al posto del pane a colazione', /^pane$/i, /^gallette$/i],
  ['metti la crema di mandorle al posto del burro a colazione', /^burro$/i, /^crema di mandorle$/i],

  /**
   * ⛔ **LA CODA PRIMA DEL «CON», e prima del «al posto di».** La prima stesura tagliava solo il
   * pezzo di destra, e il commento nel codice affermava che il pezzo di sinistra «è delimitato da
   * "con", quindi contiene il nome e nient'altro» — ⚠️ **falso**, e falso proprio dal lato che
   * decide **cosa esce dal piatto**, dove una regola più larga toglie cibo a qualcuno. L'ha trovato
   * una revisione avversariale eseguendo il riconoscitore, non rileggendolo.
   */
  ['sostituisci il pane a colazione con le gallette', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane tutti i giorni con le gallette', /^pane$/i, /^gallette$/i],
  ['metti le gallette a colazione al posto del pane', /^pane$/i, /^gallette$/i],
  ['metti la bevanda di soia a merenda al posto del latte', /^latte$/i, /^bevanda di soia$/i],

  /**
   * ⛔ **LE FREQUENZE SONO IL MODO IN CUI SI SCRIVE UNA PRESCRIZIONE.** La prima stesura tagliava
   * «a settimana» e lasciava «le gallette due», che non è un alimento: il taglio partiva e si
   * fermava a metà, cioè il difetto restava con un nome diverso.
   */
  ['sostituisci il pane con le gallette due volte a settimana', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette una volta al giorno', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette solo a colazione', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette a colazione e a merenda', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette nei prossimi giorni', /^pane$/i, /^gallette$/i],
  ['sostituisci il pane con le gallette per tutte le clienti', /^pane$/i, /^gallette$/i],

  /**
   * ⛔ **I NOMI DI PRODOTTO CHE FINISCONO COME UN ORARIO, e la prima stesura li mangiava.**
   * «**da** colazione» è una categoria merceologica, non un quando; «zuppa **del** giorno» e
   * «arrosto **della** domenica» sono piatti. ⚠️ Tagliarli non faceva un silenzio: faceva una regola
   * **più larga di quanto chiesto** — «togli i biscotti da colazione» diventava «togli tutti i
   * biscotti», merenda compresa. È il verso caro in cui sbagliare, ed è quello che questo prodotto
   * dichiara di non voler mai fare.
   */
  ['sostituisci le merendine con i biscotti da colazione', /^merendine$/i, /^biscotti da colazione$/i],
  ['sostituisci il pane con i cereali da colazione', /^pane$/i, /^cereali da colazione$/i],
  ['metti lo yogurt al posto dei biscotti da colazione', /^biscotti da colazione$/i, /^yogurt$/i],
  ['sostituisci la pasta con la zuppa del giorno', /^pasta$/i, /^zuppa del giorno$/i],
  ['metti il pesce al posto del pollo della domenica', /^pollo della domenica$/i, /^pesce$/i],
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
   * ⛔ **IL SILENZIO NUOVO CHE HA PORTATO IL TAGLIO DELLA CODA** (3/9, trovato in revisione).
   *
   * «sostituisci le gallette con le gallette a colazione» chiede una cosa che questo riconoscitore
   * non sa esprimere: **lo stesso piatto a un altro orario**. Tolta la coda, i due lati combaciano
   * e `sostituzioniNelMessaggio` scarta la frase come una ripetizione.
   *
   * ⚠️ Prima imparava una regola con un nome che non combaciava con nessuna ricetta — innocua e
   * inutile; adesso non impara niente. ⛔ E su `impara-dal-nutrizionista.ts` «niente» è un `return 0`
   * **senza notifica**: la nutrizionista scrive, non viene registrato niente, e nessuno le chiede
   * niente. Il costo di sbagliare qui non è simmetrico, ed è scritto in testa a questo file.
   *
   * ⚠️ **La cura non è rimettere la coda dentro al nome**: è saper dire «questa è una regola di
   * orario, non di sostituzione». Finché non si sa, la riga sta qui — verde finché il difetto c'è,
   * **rossa il giorno che qualcuno lo corregge**.
   */
  it.failing('⛔ oggi «lo stesso piatto a un altro orario» diventa un silenzio', () => {
    const r = sostituzioniNelMessaggio('sostituisci le gallette con le gallette a colazione');
    expect(r).toHaveLength(1);
  });

  /**
   * ⚠️ **E un nome di due lettere cade sotto il minimo di `nomeAlimento`.** «il tè» è un alimento
   * vero; la regola dei tre caratteri è di là e nasce contro i resti di parsing. Prima il nome
   * arrivava lungo («tè a colazione») e passava — ma passava sbagliato. ⛔ Non è un difetto che
   * questa consegna ha creato: è uno che ha **scoperto**, ed è il posto giusto per scriverlo.
   */
  /**
   * ⛔ **«DEL MATTINO» / «DELLA MATTINA»: non si sa se è un quando o un nome, quindi non si taglia.**
   *
   * «il latte **della mattina**» è un orario; «la brioche **del mattino**» è un prodotto. La
   * differenza non sta nella preposizione né nella parola: sta in cosa è il piatto, e questo
   * riconoscitore non lo sa. ⚠️ `coda-di-quando.ts` taglia «**la** mattina» e **non** «**della**
   * mattina», di proposito: quello che non si è capito resta dentro al nome, che è il verso in cui
   * il difetto rimane dov'era invece di nascerne uno nuovo (una regola più larga di quanto chiesto).
   *
   * Il prezzo è questa riga: la frase impara «latte della mattina», che non combacia con niente.
   */
  it.failing('⛔ oggi «il latte della mattina» si porta dentro il quando', () => {
    const r = sostituzioniNelMessaggio('cambia il latte della mattina con la bevanda di soia');
    expect(r).toHaveLength(1);
    expect(r[0].from).toMatch(/^latte$/i);
  });

  /**
   * ⚠️ **«il tè» cade sotto il minimo di tre caratteri di `nomeAlimento`**, che è una regola di là e
   * nasce contro i resti di parsing. ✅ La frase **non va più in silenzio** — il ripiego di
   * `nomeSenzaIlQuando` la riporta a com'era prima di questa consegna — ⛔ ma il nome imparato si
   * porta ancora dentro l'orario. È un difetto **vecchio**, che questa consegna ha scoperto e non
   * creato, e sta scritto qui invece che in un commento.
   */
  it('⚠️ «il tè a colazione» almeno non diventa un silenzio', () => {
    expect(sostituzioniNelMessaggio('sostituisci il latte con il tè a colazione')).toHaveLength(1);
  });

  it.failing('⛔ ma il nome imparato è ancora «tè a colazione»', () => {
    const r = sostituzioniNelMessaggio('sostituisci il latte con il tè a colazione');
    expect(r).toHaveLength(1);
    expect(r[0].to).toMatch(/^tè$/i);
  });

  /**
   * ⛔ **LA CODA IN MEZZO ALLA FRASE SOPRAVVIVE**, e la riga qui sopra che dice «CHIUSA il 3/9» vale
   * per la coda **in fondo**: `senzaIlQuando` guarda la fine del pezzo, e `nomeAlimento` si ferma
   * sulla congiunzione, quindi in «...con le gallette **a colazione** o i cracker» l'orario resta
   * dentro al primo nome. ⚠️ Il ramo a elenchi lo gestisce, ma `capisci` ci arriva solo quando la
   * forma combacia, e su questa frase no. Trovato dalla seconda revisione.
   */
  it.failing('⛔ oggi la coda in mezzo alla frase resta dentro al nome', () => {
    const r = sostituzioniNelMessaggio('sostituisci il pane con le gallette a colazione o i cracker');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].to).toMatch(/^gallette$/i);
  });

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

