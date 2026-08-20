import { fraseAmbiguita, scegliPerStato, statoNelTesto, fraseSoloCotto, scegliPerRicetta, normalizzaStato } from './stato-alimento';

const riga = (state: string | null, name = 'x') => ({ state, name });

describe('statoNelTesto', () => {
  it.each([
    ['quante calorie ha il riso bollito?', 'bollito'],
    ['80 g di farro crudo', 'crudo'],
    ['la pasta cotta quanto pesa', 'cotto'],
    ['fagioli secchi', 'secco'],
    ['lenticchie lessate', 'bollito'],
  ])('«%s» → %s', (testo, atteso) => expect(statoNelTesto(testo)).toBe(atteso));

  it('quando non lo dice, torna null — e non si indovina', () => {
    expect(statoNelTesto('quante calorie ha il riso?')).toBeNull();
    expect(statoNelTesto('')).toBeNull();
  });

  /**
   * ⚠️ Il confronto è per PAROLA. «crudo» dentro «crudité» non è uno stato, e un confronto per
   * sottostringa avrebbe risposto con sicurezza a domande che non lo dicevano — cioè avrebbe
   * trasformato una guardia in una fonte di errori.
   */
  it('⚠️ una parola di stato dentro un\'altra parola non conta', () => {
    expect(statoNelTesto('un piatto di crudité')).toBeNull();
    expect(statoNelTesto('il biscotto')).toBeNull();
  });
});

describe('scegliPerStato', () => {
  it('una riga sola: è quella', () => {
    expect(scegliPerStato([riga('crudo')], 'riso')).toMatchObject({ tipo: 'unica' });
  });

  it('nessuna riga: niente', () => {
    expect(scegliPerStato([], 'riso')).toEqual({ tipo: 'niente' });
  });

  /**
   * ⚠️ IL CASO CHE VALE. Due righe «riso bianco», una crudo e una bollito: prima rispondeva la
   * prima che il database restituiva. Dalla tabella del 18/8, il farro va da 353 kcal a 127 —
   * rispondere con quella sbagliata non è un'imprecisione, è un altro pasto.
   */
  it('⚠️ due stati e la domanda non lo dice: NON si sceglie', () => {
    const e = scegliPerStato([riga('crudo'), riga('bollito')], 'quante calorie ha il riso?');
    expect(e.tipo).toBe('ambiguo');
    if (e.tipo === 'ambiguo') expect(e.stati.sort()).toEqual(['bollito', 'crudo']);
  });

  it('ma se la domanda lo dice, si sceglie quella riga', () => {
    const e = scegliPerStato([riga('crudo'), riga('bollito')], 'il riso bollito quante calorie ha');
    expect(e).toMatchObject({ tipo: 'per_stato', stato: 'bollito' });
    if (e.tipo === 'per_stato') expect(e.riga.state).toBe('bollito');
  });

  it('lo stato chiesto non c\'è in tabella: si resta sull\'ambiguità invece di ripiegare', () => {
    const e = scegliPerStato([riga('crudo'), riga('bollito')], 'riso al forno cotto in padella secco');
    // «secco» è il primo riconosciuto, e in tabella non c'è: meglio chiedere che dare il crudo.
    expect(e.tipo).toBe('ambiguo');
  });

  /**
   * ⚠️ Due righe con lo STESSO stato non sono ambigue: sono duplicati, e la differenza che conta
   * non c'è. Trattarle come ambigue avrebbe fatto rispondere «dipende» a una domanda che non
   * dipende da niente — cioè avrebbe reso la guardia rumore.
   */
  it('⚠️ righe con lo stesso stato (o tutte senza) non sono ambigue', () => {
    expect(scegliPerStato([riga('crudo'), riga('crudo')], 'riso').tipo).toBe('unica');
    expect(scegliPerStato([riga(null), riga(null)], 'riso').tipo).toBe('unica');
  });
});

describe('fraseAmbiguita — è un\'ISTRUZIONE, non un dato', () => {
  it('dice quali stati abbiamo, quanto cambia, e di NON dire numeri', () => {
    const f = fraseAmbiguita('riso bianco', ['crudo', 'bollito']);
    expect(f).toContain('crudo o bollito');
    expect(f).toContain('NON dire nessun numero');
    expect(f).toContain('chiedi prima');
  });

  /**
   * ⚠️ Dice anche QUANTO cambia. «Dipende dallo stato» suona come una pignoleria; «le kcal possono
   * ridursi di quasi tre volte» spiega perché la domanda vale la pena di essere fatta.
   */
  it('⚠️ e dice quanto cambia, non solo che cambia', () => {
    expect(fraseAmbiguita('farro', ['crudo', 'bollito'])).toContain('quasi tre volte');
  });
});

/**
 * ⚠️ NELLE RICETTE SI PESA A CRUDO — convenzione di Simone (19/8): «diamo per assodato che gli
 * ingredienti siano a crudo in tutte le ricette, come si fa nei libri».
 *
 * ⚠️ È diversa da `scegliPerStato`, che serve a rispondere a una DOMANDA: lì lo stato lo dice chi
 * chiede, e se non lo dice la risposta onesta è «dipende». Qui lo stato lo dice la convenzione, e
 * quando la tabella ha solo il cotto la risposta onesta è «questo numero non lo so».
 */
describe('scegliPerRicetta', () => {
  const r = (state: string | null) => ({ state, nome: state ?? 'senza' });

  it('prende la riga a crudo, o a secco', () => {
    expect(scegliPerRicetta([r('bollito'), r('crudo')])).toEqual({ tipo: 'va_bene', riga: r('crudo') });
    expect(scegliPerRicetta([r('cotto'), r('secco')])).toEqual({ tipo: 'va_bene', riga: r('secco') });
  });

  /**
   * ⚠️ IL CASO CHE VALE LA CONVENZIONE. Nella tabella verificata 37 righe su 96 sono solo da cotto:
   * pasta, riso, quinoa, cuscus, orzo, farro, tutti i legumi, le patate. Contare «80 g di quinoa»
   * con la riga bollita (120 kcal/100 g) scrive 96 kcal dove ce ne sono ~284 — tre volte meno,
   * sull'ingrediente più pesante del piatto, e il numero sembra buono.
   */
  it('⚠️ con SOLO il cotto non sceglie: quel numero non si può usare su una grammatura a crudo', () => {
    expect(scegliPerRicetta([r('bollito')])).toEqual({ tipo: 'solo_cotto', stati: ['bollito'] });
    expect(scegliPerRicetta([r('bollito'), r('cotto')])).toEqual({ tipo: 'solo_cotto', stati: ['bollito', 'cotto'] });
  });

  /**
   * ⚠️ «SENZA STATO» NON È «COTTO», È «NON LO SO». Rifiutare anche quelle bloccherebbe quasi ogni
   * ricetta — le righe arrivate da fonti diverse dall'import verificato lo stato non ce l'hanno.
   * Si contano, e si dichiara: un'approssimazione dichiarata è un dato, una nascosta è un errore.
   */
  it('⚠️ senza stato si conta, ma si dichiara', () => {
    expect(scegliPerRicetta([r(null)])).toEqual({ tipo: 'stato_ignoto', riga: r(null) });
    expect(scegliPerRicetta([r('')])).toEqual({ tipo: 'stato_ignoto', riga: r('') });
  });

  /** ⚠️ E il crudo vince sul senza-stato: se la riga giusta c'è, si usa quella. */
  it('⚠️ fra «crudo» e «senza stato» vince il crudo', () => {
    expect(scegliPerRicetta([r(null), r('crudo')])).toEqual({ tipo: 'va_bene', riga: r('crudo') });
  });

  /**
   * ⚠️ IL CASO CHE HA BOCCIATO LA QUINOA — primo giro in produzione, 19/8. In tabella lo stato è
   * scritto al femminile e al plurale («cruda», «crude»), e il confronto andava con ['crudo']:
   * quinoa, patata dolce e patate risultavano «solo da cotto» — cioè il codice si sarebbe rifiutato
   * di scrivere una ricetta con la quinoa **proprio perché il dato era giusto**.
   */
  it('⚠️ «cruda» e «crude» sono «crudo»: genere e numero non cambiano lo stato', () => {
    expect(scegliPerRicetta([r('cruda')])).toEqual({ tipo: 'va_bene', riga: r('cruda') });
    expect(scegliPerRicetta([r('crude')])).toEqual({ tipo: 'va_bene', riga: r('crude') });
    expect(scegliPerRicetta([r('secca')])).toEqual({ tipo: 'va_bene', riga: r('secca') });
    // Il caso vero dalla produzione: «pasta integrale (cruda, bollito)» risultava da bloccare.
    expect(scegliPerRicetta([r('cruda'), r('bollito')])).toEqual({ tipo: 'va_bene', riga: r('cruda') });
  });

  it('e lo stesso vale per il cotto: «bollita», «cotta»', () => {
    expect(scegliPerRicetta([r('bollita')]).tipo).toBe('solo_cotto');
    expect(scegliPerRicetta([r('cotta')]).tipo).toBe('solo_cotto');
  });

  /**
   * ⚠️ E LA SECONDA COSA CHE HA MOSTRATO LA PRODUZIONE: in tabella ci sono stati che **non parlano
   * di cottura** — liquido (i latti), fresco (ricotta, yogurt), viscoso (sciroppo), tostato
   * (anacardi). Trattarli come «cotto» bloccava il latte, che crudo o cotto non è: per il latte
   * quella domanda non esiste. Diventano «non lo so»: si contano e si dichiarano.
   */
  it('⚠️ «liquido», «fresco», «viscoso» descrivono il prodotto: si pesa com\'è, e va bene', () => {
    expect(scegliPerRicetta([r('liquido')])).toEqual({ tipo: 'va_bene', riga: r('liquido') });
    expect(scegliPerRicetta([r('fresco')])).toEqual({ tipo: 'va_bene', riga: r('fresco') });
    expect(scegliPerRicetta([r('viscoso')])).toEqual({ tipo: 'va_bene', riga: r('viscoso') });
  });

  /**
   * ⚠️ IL LATTE, CORRETTO DA SIMONE (19/8): «fresco e freddo sono crudi, caldo o tiepido sono cotti,
   * e il latte è sempre liquido». L'ultima è quella che decide: se **ogni** latte è liquido, quella
   * parola non può essere un avviso — è come scrivere «solido» sul pane.
   */
  it('⚠️ il latte: fresco e freddo sono crudi, caldo e tiepido sono cotti', () => {
    expect(scegliPerRicetta([r('freddo')]).tipo).toBe('va_bene');
    expect(scegliPerRicetta([r('caldo')]).tipo).toBe('solo_cotto');
    expect(scegliPerRicetta([r('tiepido')]).tipo).toBe('solo_cotto');
  });

  /**
   * ⚠️ MA «TOSTATO» NON STA CON GLI ALTRI, e la differenza conta: tostare cambia peso e calorie —
   * mandorle crude e mandorle tostate non sono la stessa cosa. Resta «non lo so», che è la risposta
   * onesta finché la nutrizionista non dice quale dei due valori è in tabella.
   */
  it('⚠️ «tostato» è una lavorazione, non una consistenza: resta «non lo so»', () => {
    expect(scegliPerRicetta([r('tostato')])).toEqual({ tipo: 'stato_ignoto', riga: r('tostato') });
  });

  it('senza righe non c\'è niente da scegliere', () => {
    expect(scegliPerRicetta([])).toEqual({ tipo: 'niente' });
  });

  /** La frase dice cosa fare, non solo che c'è un problema. */
  it('la frase del «solo cotto» dice dove si aggiunge la riga', () => {
    const f = fraseSoloCotto(['quinoa']);
    expect(f).toContain('solo il valore da cotto');
    expect(f).toContain('a crudo');
    expect(f).toContain('Alimenti');
  });
});

describe('normalizzaStato', () => {
  it('porta genere, numero e accenti alla stessa radice', () => {
    expect(['crudo', 'cruda', 'crudi', 'crude'].map(normalizzaStato)).toEqual(['crudo', 'crudo', 'crudo', 'crudo']);
    expect(['secco', 'secca', 'essiccato', 'disidratate'].map(normalizzaStato)).toEqual(['secco', 'secco', 'secco', 'secco']);
    expect(['bollito', 'bollite', 'lessa'].map(normalizzaStato)).toEqual(['bollito', 'bollito', 'bollito']);
    expect(['cotto', 'cotta', 'arrostito'].map(normalizzaStato)).toEqual(['cotto', 'cotto', 'cotto']);
  });

  /** ⚠️ Quello che non parla di cottura si chiama «altro», e «altro» non è «cotto». */
  it('⚠️ quello che descrive il prodotto vale come crudo; una lavorazione no', () => {
    expect(['liquido', 'fresco', 'freddo', 'viscoso'].map(normalizzaStato)).toEqual(['crudo', 'crudo', 'crudo', 'crudo']);
    expect(['caldo', 'tiepido'].map(normalizzaStato)).toEqual(['cotto', 'cotto']);
    // ⚠️ `tostato` cambia peso e calorie: non è né l'uno né l'altro, e non si finge di saperlo.
    expect(normalizzaStato('tostato')).toBe('altro');
    expect(normalizzaStato('')).toBe('');
    expect(normalizzaStato(null)).toBe('');
  });
});

/**
 * ⚠️ GLI STATI CHE MANCAVANO — trovati dalla revisione avversariale del 19/8 sera.
 *
 * L'elenco dei modi di dire «cotto» copriva `cott/arrost/al forno/cald/tiepid` e lasciava fuori **al
 * vapore, grigliato, fritto, saltato, stufato, brasato, scottato, in umido, affumicato**. Quelle
 * righe finivano in «non lo so» — cioè **si contavano** — con la frase «la tabella non dice se il
 * valore è a crudo o a cotto», che è falsa: lo dice benissimo. Una riga «zucchine al vapore» faceva
 * scrivere la ricetta, dove «zucchine bollite» la bloccava: stesso danno, porta diversa.
 */
describe('normalizzaStato — i modi di dire «cotto» che mancavano', () => {
  it('⚠️ al vapore, grigliato, fritto, saltato, stufato, in umido sono cotti', () => {
    for (const s of ['al vapore', 'a vapore', 'grigliato', 'alla griglia', 'fritto', 'saltato', 'stufato', 'brasato', 'scottato', 'in umido', 'precotto', 'affumicato', 'gratinato']) {
      expect(normalizzaStato(s)).toBe('cotto');
    }
  });

  it('sbollentato è bollito', () => {
    expect(normalizzaStato('sbollentato')).toBe('bollito');
  });

  /** ⚠️ «a crudo» con la preposizione: `statoNelTesto` la conosceva, questa no. */
  it('⚠️ «a crudo» è crudo', () => {
    expect(normalizzaStato('a crudo')).toBe('crudo');
  });

  /**
   * ⚠️ E UNA RIGA CHE DICHIARA LA PROPRIA AMBIGUITÀ NON È CRUDA. «crudo o cotto» passava per
   * `startsWith('crud')` e veniva presa per buona — cioè si contava un valore che la riga stessa
   * dichiara incerto.
   */
  it('⚠️ «crudo o cotto» non è crudo: è «non lo so»', () => {
    expect(normalizzaStato('crudo o cotto')).toBe('altro');
    expect(normalizzaStato('crudo/cotto')).toBe('altro');
  });
});
/**
 * ⚠️ «NON SI APPLICA» NON È «NON LO SO» — 20/8, e non è una sfumatura.
 *
 * All'olio, al sale, al miele lo stato **non si applica**: crudi o cotti sono la stessa cosa. Ma in
 * tabella quelle righe hanno `state` vuoto, cioè finiscono in «non lo so» — e da lì si portano
 * dietro per sempre la frase «la tabella non dice se il valore è a crudo» attaccata a 3025 ricette
 * d'olio, più un posto fisso in cima all'elenco da correggere, dove nascondono le righe vere.
 *
 * ⚠️ Stesso patto già in uso su `glycemicIndexReliability`: *vuoto = nessuno l'ha guardato; «non si
 * applica» = qualcuno l'ha guardato e ha detto che non c'è.*
 */
describe('lo stato che non si applica', () => {
  it('si riconosce, scritto nei modi in cui lo scriverebbe una persona', () => {
    for (const v of ['non_applicabile', 'non applicabile', 'Non si applica', 'non si applica a questo alimento']) {
      expect([v, normalizzaStato(v)]).toEqual([v, 'non_applicabile']);
    }
  });

  /** ✅ Per una ricetta va bene, e **senza dichiarazione**: non c'è niente da avvertire. */
  it('⚠️ per la ricetta è «va bene», non «non lo so»', () => {
    expect(scegliPerRicetta([{ state: 'non_applicabile' }]).tipo).toBe('va_bene');
  });

  /**
   * ⚠️ IL CONFRONTO CHE DÀ SENSO AL VALORE: la riga **vuota** resta «non lo so» — si conta, ma
   * dichiarando. Se le due cose finissero nello stesso posto, il campo nuovo non servirebbe a
   * niente e sarebbe solo un modo in più di scrivere «boh».
   */
  it('⚠️ mentre lo stato VUOTO resta «non lo so»', () => {
    expect(scegliPerRicetta([{ state: null }]).tipo).toBe('stato_ignoto');
    expect(scegliPerRicetta([{ state: '' }]).tipo).toBe('stato_ignoto');
  });

  /** ⛔ E non salva una riga cotta: «non si applica» si dichiara, non si deduce. */
  it('⚠️ una riga BOLLITA resta «solo da cotto», qualunque cosa ci sia accanto', () => {
    expect(scegliPerRicetta([{ state: 'bollito' }]).tipo).toBe('solo_cotto');
  });
});
