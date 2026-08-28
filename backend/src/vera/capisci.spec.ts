import { capisci, esempioCorrezioneKcal, IntentoCorrezioneKcal, IntentoRestrizione, IntentoSostituzione, separaCitazione } from './capisci';

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

  it('«inseriamo una ricetta per il menu keto» → una ricetta, non una restrizione', () => {
    // Fino al 13/8 era «fuori portata»: adesso le ricette si sanno scrivere, e questo caso vive
    // insieme agli altri più sotto. Qui resta perché la cosa da non fare è sempre la stessa —
    // leggere «keto» come il nome di una cliente.
    expect(capisci('inserisci una ricetta per il menu keto')?.tipo).toBe('ricetta');
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

/**
 * ⚠️ Il caso che conta è la differenza fra «crea» e «cambia».
 *
 * Una modifica letta come ricetta nuova lascia in catalogo la vecchia — che continua ad andare nei
 * piatti — accanto a una copia corretta che non sostituisce niente. È un difetto che non produce
 * nessun errore: produce due ricette, e una delle due è sbagliata.
 */
describe('capisci — le ricette', () => {
  it('«inseriamo una ricetta per il menu keto» → ricetta nuova, con lo stile', () => {
    const i = capisci('inseriamo una ricetta per il menu keto');
    expect(i).toEqual({ tipo: 'ricetta', modo: 'nuova', nome: null, stile: 'keto' });
  });

  it('«voglio cambiare la ricetta tonno alle olive» → modifica, col nome del piatto', () => {
    const i = capisci('voglio cambiare la ricetta tonno alle olive');
    expect(i).toMatchObject({ tipo: 'ricetta', modo: 'modifica', nome: 'tonno alle olive' });
  });

  it('⚠️ con tutti e due i verbi vince la MODIFICA', () => {
    // «cambia la ricetta e scrivine una nuova» parla comunque di una ricetta che esiste: trattarla
    // come nuova la lascerebbe viva accanto alla copia.
    expect(capisci('cambia la ricetta tonno alle olive e scrivine una nuova')).toMatchObject({ modo: 'modifica' });
  });

  it('nominare una ricetta senza chiedere niente NON è un intento', () => {
    // «questa ricetta è buona» non è un'istruzione: nel dubbio non si capisce.
    expect(capisci('questa ricetta è buona')).toBeNull();
  });

  it('una restrizione che nomina un piatto resta una restrizione', () => {
    const i = capisci('a Giulia Rossi niente tonno');
    expect(i?.tipo).toBe('restrizione');
  });
});

describe('capisci — i pasti (azione 3, Decisioni 13/8 §14)', () => {
  it('«togli lo spuntino» è uno SLOT, non un alimento da vietare', () => {
    expect(capisci('a Giulia Rossi togli lo spuntino')).toEqual({
      tipo: 'pasti', cliente: 'Giulia Rossi', azione: 'togli', slots: null,
    });
  });

  it('con lo slot detto, lo slot è quello', () => {
    expect(capisci('togli la merenda a Giulia')).toEqual({
      tipo: 'pasti', cliente: 'Giulia', azione: 'togli', slots: ['afternoon_snack'],
    });
    expect(capisci('rimetti lo spuntino del mattino a Giulia')).toEqual({
      tipo: 'pasti', cliente: 'Giulia', azione: 'rimetti', slots: ['morning_snack'],
    });
  });

  it('«togli il tonno» resta un divieto alimentare', () => {
    const i = capisci('a Giulia togli il tonno');
    expect(i?.tipo).toBe('restrizione');
  });

  it('e il contenuto dello spuntino resta cibo: «togli lo yogurt dallo spuntino»', () => {
    const i = capisci('a Giulia togli lo yogurt dallo spuntino');
    expect(i?.tipo).toBe('restrizione');
  });
});

describe('capisci — la famiglia chiesta a secco (Nocanty, 13/8 17:47)', () => {
  it('«hai la lista dei formaggi molli?» è una consultazione, non una regola', () => {
    expect(capisci('hai la lista dei formaggi molli?')).toEqual({ tipo: 'famiglia', azione: 'mostra', nome: 'formaggi molli' });
  });

  it('«crea la lista dei formaggi molli» apre l\'apprendimento', () => {
    expect(capisci('crea la lista dei formaggi molli')).toEqual({ tipo: 'famiglia', azione: 'crea', nome: 'formaggi molli' });
  });

  it('la regola su una cliente resta una regola', () => {
    expect(capisci('a Giulia Rossi niente formaggi molli')?.tipo).toBe('restrizione');
  });
});

describe('capisci — il saluto davanti non spiazza (Nocanty, 13/8 18:05)', () => {
  it('«Ciao Vera, hai la lista…?» è la stessa domanda senza il ciao', () => {
    expect(capisci('Ciao Vera, hai la lista dei formaggi stagionati?')).toEqual({
      tipo: 'famiglia', azione: 'mostra', nome: 'formaggi stagionati',
    });
  });

  it('vale per le azioni: «Buongiorno Vera, togli la merenda a Giulia»', () => {
    expect(capisci('Buongiorno Vera, togli la merenda a Giulia')).toEqual({
      tipo: 'pasti', cliente: 'Giulia', azione: 'togli', slots: ['afternoon_snack'],
    });
  });

  it('ma il nome della CLIENTE non si mangia: «Senti Giulia non deve mangiare tonno»', () => {
    const i = capisci('Senti, a Giulia niente tonno');
    expect(i?.tipo).toBe('restrizione');
    expect((i as { cliente?: string }).cliente).toBe('Giulia');
  });
});

describe('capisci — «hai segnalazioni per me?»: la guida della giornata (Simone, 14/8)', () => {
  it.each([
    'hai segnalazioni per me?',
    'Ciao hai segnalazioni per me?',
    'ci sono novità?',
    'novità?',
    'avvisi?',
    'hai notifiche per me?',
    'cosa mi aspetta oggi?',
    "che c'è per me?",
    'da dove comincio?',
    'guidami',
  ])('«%s» chiede il quadro della giornata', (frase) => {
    expect(capisci(frase)?.tipo).toBe('segnalazioni');
  });

  /**
   * ⚠️ DUE DI QUESTE FRASI HANNO CAMBIATO RISPOSTA IL 19/8, ed è una decisione, non un incidente.
   *
   * «Cosa devo fare oggi?» e «cosa c'è da fare?» portavano il **quadro in conteggi** — «3
   * segnalazioni, 2 proposte» — che risponde a «quanto lavoro c'è», non a «quale». Simone ha
   * chiesto la lista numerata: si può dire «faccio la 3», si vede il nome di chi aspetta, e si
   * depenna. Un conteggio dice solo che sei indietro.
   *
   * ⚠️ E la lista **non dice meno** del quadro che sostituisce: le due cose che non si numerano —
   * le approvazioni del catalogo e la campanella — restano in fondo come righe. Un miglioramento
   * che perde pezzi non è un miglioramento.
   */
  it.each([
    "cosa c'è da fare?",
    'cosa devo fare oggi?',
    'fammi la lista',
    'lista delle cose da fare',
    'cose da fare',
  ])('⚠️ «%s» chiede la LISTA numerata, non il quadro', (frase) => {
    expect(capisci(frase)?.tipo).toBe('lista');
  });

  /** ⚠️ Ma «hai la lista dei formaggi molli?» resta la famiglia: la parola «lista» non basta. */
  it('⚠️ «lista» con un nome dietro resta la famiglia del dizionario', () => {
    expect(capisci('hai la lista dei formaggi molli?')?.tipo).toBe('famiglia');
  });

  it('⚠️ «avvisi Giulia che salta il controllo» resta un\'istruzione (non capita), non la domanda', () => {
    // Le forme sono ancorate all'intera frase: una frase che CONTIENE «avvisi» non è la domanda.
    expect(capisci('avvisi Giulia che salta il controllo')?.tipo).not.toBe('segnalazioni');
  });

  it('⚠️ «hai la lista dei formaggi molli?» resta la famiglia, non le segnalazioni', () => {
    expect(capisci('hai la lista dei formaggi molli?')?.tipo).toBe('famiglia');
  });

  it('⚠️ «a Giulia niente tonno» resta una restrizione', () => {
    expect(capisci('a Giulia niente tonno')?.tipo).toBe('restrizione');
  });
});

describe('capisci — «verifichiamo i cambi»: la coda delle sostituzioni (voce 245, Simone 14/8)', () => {
  it.each([
    'verifichiamo i cambi',
    'ci sono cambi da verificare?',
    'sostituzioni da verificare?',
    'hai sostituzioni da verificare?',
    'fammi vedere le sostituzioni da verificare',
    'i cambi concordati in chat',
  ])('«%s» apre la coda delle sostituzioni', (frase) => {
    expect(capisci(frase)?.tipo).toBe('sostituzioni');
  });

  it('⚠️ va letta PRIMA della lista: «fammi vedere la lista delle sostituzioni» non è una famiglia', () => {
    // `MOSTRA_FAMIGLIA` prende «hai la lista dei X?» e catturerebbe «sostituzioni» come nome di
    // famiglia — cioè una lista di dizionario che non esiste, invece della coda che esiste.
    expect(capisci('fammi vedere la lista delle sostituzioni')?.tipo).toBe('sostituzioni');
  });

  it('⚠️ «hai la lista dei formaggi molli?» resta la famiglia', () => {
    expect(capisci('hai la lista dei formaggi molli?')?.tipo).toBe('famiglia');
  });

  it('⚠️ «hai segnalazioni per me?» resta il quadro della giornata', () => {
    expect(capisci('hai segnalazioni per me?')?.tipo).toBe('segnalazioni');
  });

  it('⚠️ «a Giulia sostituisci la panna con il latte» NON è la coda: è un\'istruzione', () => {
    // Le forme sono ancorate all'intera frase. Una frase che CONTIENE «sostitu» non è la domanda,
    // e aprire la coda al posto di eseguire sarebbe capire male con l'aria di aver capito.
    expect(capisci('a Giulia sostituisci la panna con il latte')?.tipo).not.toBe('sostituzioni');
  });
});

describe('capisci — «spostala sulla keto»: il cambio di dieta (azione 3, Simone 14/8)', () => {
  it('«sposta Giulia Rossi sulla keto»', () => {
    expect(capisci('sposta Giulia Rossi sulla keto')).toEqual({
      tipo: 'cambio_dieta', cliente: 'Giulia Rossi', dieta: 'keto',
    });
  });

  it('«metti Giulia sulla dieta mediterranea»', () => {
    const i = capisci('metti Giulia sulla dieta mediterranea');
    expect(i?.tipo).toBe('cambio_dieta');
    expect((i as { dieta?: string }).dieta).toBe('mediterranea');
    expect((i as { cliente?: string }).cliente).toBe('Giulia');
  });

  it('«Giulia passa alla vegetariana»', () => {
    const i = capisci('Giulia passa alla vegetariana');
    expect(i?.tipo).toBe('cambio_dieta');
    expect((i as { dieta?: string }).dieta).toBe('vegetariana');
  });

  it('«cambia la dieta a Giulia» senza dire quale: la dieta si chiede, non si indovina', () => {
    const i = capisci('cambia la dieta a Giulia');
    expect(i?.tipo).toBe('cambio_dieta');
    expect((i as { dieta?: string | null }).dieta).toBeNull();
    expect((i as { cliente?: string }).cliente).toBe('Giulia');
  });

  it('⚠️ «nella mediterranea niente tonno» resta la regola di dieta, non un cambio', () => {
    expect(capisci('nella mediterranea niente tonno')?.tipo).toBe('fuori_portata');
  });

  it('⚠️ «metti il tacchino al posto del pollo» resta una sostituzione', () => {
    expect(capisci('per Anna metti il tacchino al posto del pollo')?.tipo).toBe('sostituzione');
  });

  it('⚠️ una DOMANDA non è un\'istruzione: «posso spostare Giulia sulla keto?»', () => {
    expect(capisci('posso spostare Giulia sulla keto?')).toBeNull();
  });
});

describe('capisci — «riduci le kcal del 10% per 7 giorni» (Nocanty via Vera, 14/8)', () => {
  it('la frase di Nocanty, con cliente, percentuale e giorni', () => {
    expect(capisci('riduci le kcal del 10% a Giulia Rossi per 7 giorni')).toEqual({
      tipo: 'correzione_kcal', cliente: 'Giulia Rossi', pct: -10, giorni: 7,
    });
  });

  it('«a Giulia riduci le calorie del 10% per una settimana»', () => {
    const i = capisci('a Giulia riduci le calorie del 10% per una settimana');
    expect(i?.tipo).toBe('correzione_kcal');
    expect((i as { pct?: number }).pct).toBe(-10);
    expect((i as { giorni?: number }).giorni).toBe(7);
  });

  it('«aumenta le kcal del 5% a Giulia»: senza giorni la durata si chiede, non si indovina', () => {
    const i = capisci('aumenta le kcal del 5% a Giulia');
    expect(i?.tipo).toBe('correzione_kcal');
    expect((i as { pct?: number }).pct).toBe(5);
    expect((i as { giorni?: number | null }).giorni).toBeNull();
  });

  it('⚠️ «togli il 10% di formaggio a Giulia» NON è una correzione calorica', () => {
    expect(capisci('togli il 10% di formaggio a Giulia')?.tipo).not.toBe('correzione_kcal');
  });

  it('⚠️ una domanda resta una domanda: «posso ridurre le kcal del 10%?»', () => {
    expect(capisci('posso ridurre le kcal del 10% a Giulia?')).toBeNull();
  });
});

describe('capisci — «rifai con più proteine» (terza frase dell\'azione 3, 14/8)', () => {
  it('«a Giulia Rossi rifai con più proteine»: senza numero, lo scatto lo mette il servizio', () => {
    const i = capisci('a Giulia Rossi rifai con più proteine');
    expect(i?.tipo).toBe('proteine');
    expect((i as { cliente?: string }).cliente).toBe('Giulia Rossi');
    expect((i as { pct?: number | null }).pct).toBeNull();
  });

  it('«porta Giulia al 35% di proteine»: il numero detto vince', () => {
    const i = capisci('porta Giulia al 35% di proteine');
    expect(i?.tipo).toBe('proteine');
    expect((i as { pct?: number | null }).pct).toBe(0.35);
  });

  it('«più proteine a Giulia» nella forma corta', () => {
    expect(capisci('più proteine a Giulia')?.tipo).toBe('proteine');
  });

  it('⚠️ «riduci le kcal del 10% a Giulia» resta la correzione calorica', () => {
    expect(capisci('riduci le kcal del 10% a Giulia')?.tipo).toBe('correzione_kcal');
  });

  it('⚠️ «a Giulia niente proteine in polvere» resta un divieto', () => {
    expect(capisci('a Giulia niente proteine in polvere')?.tipo).toBe('restrizione');
  });
});

describe('capisci — la giornata dettata (voce 241, lettura B)', () => {
  it('due pasti o più: è una giornata, e si sa per chi', () => {
    const i = capisci('Per Giulia Rossi domani\nColazione: yogurt greco\nPranzo: pasta al pomodoro\nCena: orata');
    expect(i?.tipo).toBe('giornata');
    expect((i as { cliente?: string }).cliente).toBe('Giulia Rossi');
  });

  it('⚠️ un pasto solo NON è una giornata: somiglia troppo a un appunto', () => {
    expect(capisci('Cena: orata al forno')?.tipo).not.toBe('giornata');
  });

  it('⚠️ «a Giulia niente pasta al pomodoro» resta un divieto', () => {
    expect(capisci('a Giulia niente pasta al pomodoro')?.tipo).toBe('restrizione');
  });
});

/**
 * IL NOME CHE APRE LA FRASE — segnalato da Simone il 17/8, collaudando Vera.
 *
 * Ha scritto «Jolanda Todde non darle più i ceci» e Vera ha risposto «su quale cliente?». Il
 * divieto l'aveva capito benissimo: quello che non sapeva leggere era il nome, perché
 * `nomePersona` lo cercava **solo dopo una preposizione** («a Giulia Rossi…»). Il segnaposto
 * dell'interfaccia mostra la forma che il codice sa leggere, non quella che una persona scrive.
 *
 * ⚠️ Servono DUE parole maiuscole di fila, e all'inizio della frase. Una sola sarebbe la prima
 * parola di qualunque frase — «Togli i ceci a Jolanda» darebbe la cliente «Togli» — e attribuire
 * una regola alla persona sbagliata è il danno peggiore che questo file possa fare. Il ripiego
 * sicuro c'è comunque: il nome estratto viene cercato fra le clienti vere, e se non esiste Vera
 * dice «non trovo nessuna cliente che si chiami…» invece di scrivere su qualcuno.
 */
describe('capisci — il nome in testa alla frase, senza preposizione', () => {
  it('«Jolanda Todde non darle più i ceci»', () => {
    const i = restr('Jolanda Todde non darle più i ceci');
    expect(i.tipo).toBe('restrizione');
    expect(i.cliente).toBe('Jolanda Todde');
    expect(i.vietati).toEqual(['ceci']);
  });

  it('vale per tutte le forme di divieto, non solo per «non darle più»', () => {
    expect(restr('Anna Rossi niente formaggi molli').cliente).toBe('Anna Rossi');
    expect(restr('Anna Rossi togli il tonno').cliente).toBe('Anna Rossi');
  });

  it('l\'eccezione continua a staccarsi', () => {
    const i = restr('Anna Rossi non dare più i formaggi ma solo il grana');
    expect(i.vietati).toEqual(['formaggi']);
    expect(i.tenuti).toEqual(['grana']);
  });

  it('⚠️ UNA sola parola maiuscola in testa NON è un nome', () => {
    // «Togli» apre la frase con la maiuscola come qualsiasi verbo. Leggerlo come nome vorrebbe
    // dire cercare una cliente che si chiama «Togli» — e in un caso peggiore trovarla.
    const i = restr('Togli i ceci a Jolanda');
    expect(i.cliente).toBe('Jolanda');
  });

  it('⚠️ la preposizione vince sempre: è la forma dichiarata, e non si tocca', () => {
    expect(restr('a Simone non dare più formaggi teneri ma solo grana').cliente).toBe('Simone');
  });

  it('senza nome resta senza cliente, come prima', () => {
    expect(restr('niente formaggi molli').cliente).toBeNull();
  });

  it('⚠️ anche la preposizione MAIUSCOLA, che è come comincia una frase vera', () => {
    // «Per Giulia Rossi domani…» aveva due parole maiuscole di fila come «Jolanda Todde», e senza
    // questa riga il ripiego avrebbe letto la cliente «Per Giulia». La preposizione si riconosce
    // nelle due forme: è la strada dichiarata, e deve valere anche a inizio frase.
    expect(restr('Per Anna Rossi niente formaggi molli').cliente).toBe('Anna Rossi');
    expect(restr('A Simone non dare più il tonno').cliente).toBe('Simone');
  });
});

/**
 * «QUALE SOSTITUZIONE DEVO VERIFICARE?» — segnalata da Simone il 17/8, con lo screenshot.
 *
 * In cima alla chat c'è la pastiglia «1 sostituzioni da verificare». Lui ha fatto la domanda che
 * quella pastiglia invita a fare, e Vera ha risposto «non trovo nessuna cliente che si chiami
 * "quale sostituzione devo verificare?"».
 *
 * ⚠️ Un'interfaccia che annuncia una cosa e poi non sa rispondere quando gliela chiedi è peggio di
 * una che non l'annuncia: la pastiglia è la domanda, e le forme riconosciute non la contenevano.
 */
describe('capisci — la domanda che fa la pastiglia dei cambi', () => {
  it('«quale sostituzione devo verificare?» apre la coda', () => {
    expect(capisci('quale sostituzione devo verificare?')?.tipo).toBe('sostituzioni');
  });

  it('le forme che una persona scrive davvero', () => {
    for (const f of [
      'quali sostituzioni devo verificare',
      'quale cambio devo verificare?',
      'quali cambi devo verificare',
      'qual è la sostituzione da verificare?',
      'che sostituzioni devo controllare',
      'quale sostituzione devo guardare?',
    ]) {
      expect(capisci(f)?.tipo).toBe('sostituzioni');
    }
  });

  it('⚠️ e le forme che c\'erano già continuano a valere', () => {
    expect(capisci('verifichiamo i cambi')?.tipo).toBe('sostituzioni');
    expect(capisci('ci sono cambi da verificare?')?.tipo).toBe('sostituzioni');
  });

  it('⚠️ una FRASE che nomina una sostituzione resta un\'istruzione, non una coda', () => {
    // «a Giulia sostituisci la panna col latte» contiene «sostituisci» ed è un ordine da eseguire.
    // Aprire la coda al posto di eseguire sarebbe capire male con l'aria di aver capito.
    expect(capisci('a Giulia sostituisci la panna col latte')?.tipo).not.toBe('sostituzioni');
  });
});

/**
 * ⛔ **LA FRASE CHE VERA SUGGERISCE DEVE ESSERE UNA CHE VERA SA LEGGERE** (28/8, trovata in
 * revisione: suggeriva «aumenta del 10% per 7 giorni», che senza la parola «calorie» questo file
 * non riconosce — e chi la copiava alla lettera si sentiva rispondere «non ho capito»).
 *
 * ⚠️ Il test fa il **giro completo**: prende la stringa dal generatore e la dà al parser. È l'unico
 * modo per cui una riscrittura delle espressioni regolari, o del suggerimento, si accorga di aver
 * rotto l'altro.
 */
describe('⛔ l\'esempio della correzione kcal passa da `capisci`', () => {
  it('⛔ col nome: si capisce chi, di quanto e per quanti giorni', () => {
    const intento = capisci(esempioCorrezioneKcal('Anna')) as IntentoCorrezioneKcal | null;
    expect(intento).not.toBeNull();
    expect(intento!.tipo).toBe('correzione_kcal');
    expect(intento!.cliente).toBe('Anna');
    expect(intento!.pct).toBe(10);
    expect(intento!.giorni).toBe(7);
  });

  it('⚠️ e senza nome resta comunque una correzione leggibile', () => {
    const intento = capisci(esempioCorrezioneKcal(null)) as IntentoCorrezioneKcal | null;
    expect(intento?.tipo).toBe('correzione_kcal');
    expect(intento?.pct).toBe(10);
  });

  /** ⚠️ Il segno viene dal verbo: l'esempio è un AUMENTO, e deve restare tale. */
  it('⚠️ è un aumento, non una riduzione', () => {
    expect((capisci(esempioCorrezioneKcal('Anna')) as IntentoCorrezioneKcal).pct).toBeGreaterThan(0);
  });
});
