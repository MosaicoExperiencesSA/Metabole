import {
  apreFrase,
  contropropostaDaTesto,
  testoContropropostaAllergene,
  testoContropropostaEsclusa,
  testoContropropostaNonPrevista,
  testoContropropostaOk,
  unitaPerSostituto,
  sceltaDopoIlNo,
  sensoDelNo,
  testoAltroSostituto,
  testoChiediPercheNo,
  testoNienteAltroSostituto,
  testoRifiutoNonCapito,
  testoAnnullato,
  soloNomeProprio,
  conNome,
  appellativo,
  MOTIVI,
  combaciaAlimento,
  condividonoAlimento,
  correggiGrammatura,
  etichettaSlot,
  grammaturaAmmessa,
  nelloSlot,
  radice,
  riconosciConferma,
  riconosciMotivo,
  rilevaIntentoSostituzione,
  terminiCandidati,
  testoChiediCibo,
  testoChiediMotivo,
  testoConferma,
  testoFatto,
} from './sostituzione-chat';
import { SUBSTITUTION_MAP, sostitutoSicuro } from './sostituzioni-sicure';

describe('sostituzione in chat — riconoscimento intenzione', () => {
  it.each([
    'vorrei sostituire le carote',
    'posso sostituire il farro?',
    'come faccio a cambiare un ingrediente',
    'vorrei cambiare un alimento del pranzo',
    'cosa posso mettere al posto della pasta?',
  ])('riconosce «%s»', (testo) => {
    expect(rilevaIntentoSostituzione(testo)).toBe(true);
  });

  // Il riconoscimento è volutamente NARROW: dirottare una conversazione normale dentro un
  // dialogo a domande chiuse è un danno peggiore del non averla riconosciuta.
  it.each([
    'ciao come stai?',
    'quando arriva il nuovo menu?',
    'oggi non ho fame',
    'ho cambiato lavoro questa settimana',
    'sono cambiata molto in questi mesi',
    'quanta acqua devo bere?',
    // Un resoconto, non una richiesta: «al posto di» da solo non deve aprire un dialogo a
    // domande chiuse sopra una frase che raccontava una cosa già fatta.
    'ho mangiato una banana al posto della mela, va bene?',
    'ieri ho preso il treno al posto della macchina',
  ])('non si attiva su «%s»', (testo) => {
    expect(rilevaIntentoSostituzione(testo)).toBe(false);
  });

  it('riconosce «levare», che una regex sbagliata non prendeva', () => {
    expect(rilevaIntentoSostituzione('vorrei levare la cipolla')).toBe(true);
  });
});

describe('sostituzione in chat — riconoscere l\'alimento per PAROLA e non per sottostringa', () => {
  it('riconosce singolare e plurale senza elencare i plurali', () => {
    expect(combaciaAlimento('carote', 'carote')).toBe(true);
    expect(combaciaAlimento('carote', 'carota')).toBe(true);
    expect(radice('carote')).toBe(radice('carota'));
  });

  it('riconosce l\'alimento dentro un nome composto', () => {
    expect(combaciaAlimento('petto di pollo', 'pollo')).toBe(true);
    expect(combaciaAlimento('yogurt greco', 'yogurt')).toBe(true);
    expect(combaciaAlimento('yogurt greco', 'yogurt greco')).toBe(true);
    expect(combaciaAlimento('olio evo', 'olio')).toBe(true);
  });

  /**
   * Il difetto peggiore trovato in revisione, e vale la pena fissarlo per sempre in un test.
   * Con `nome.includes(termine)`, «pepe» combaciava con «peperoni»: il cancello delle spezie
   * viene interrogato sul nome TROVATO, e «peperoni» non è una spezia, quindi non scattava. La
   * cliente che voleva togliere il pepe si vedeva sostituire i peperoni e — rispondendo «non mi
   * piace», che sul pepe era vero — escluderli per sempre dai suoi menu.
   * `spezie.ts` lo dice a chiare lettere: «"pepe" è una spezia, "peperoni" sono una verdura».
   */
  it.each([
    ['peperoni', 'pepe'],
    ['melanzane', 'mela'],
    ['pancetta', 'pane'],
    ['finocchi', 'fino'],
    ['salmone', 'sale'],
  ])('«%s» NON combacia con «%s»', (ingrediente, termine) => {
    expect(combaciaAlimento(ingrediente, termine)).toBe(false);
  });

  it('non combacia su stringhe vuote', () => {
    expect(combaciaAlimento('', 'carote')).toBe(false);
    expect(combaciaAlimento('carote', '')).toBe(false);
  });
});

describe('sostituzione in chat — un sostituto non può essere una variante dello stesso cibo', () => {
  /**
   * `SUBSTITUTION_MAP` nasce per rendere un piatto sicuro con un'intolleranza, non per
   * accontentare un gusto. Senza questo controllo Gaia rispondeva «metti 150 g di yogurt senza
   * lattosio al posto di 150 g di yogurt greco» a chi lo yogurt non piace: una presa in giro.
   */
  it.each([
    ['yogurt greco', 'yogurt senza lattosio'],
    ['pane integrale', 'pane senza glutine'],
    ['pasta integrale', 'pasta senza glutine'],
    ['formaggio grattugiato', 'formaggio senza lattosio'],
    ['panna', 'panna vegetale'],
  ])('«%s» → «%s» va scartato', (da, a) => {
    expect(condividonoAlimento(da, a)).toBe(true);
  });

  it.each([
    ['carote', 'biete'],
    ['farro', 'riso'],
    ['cipolla', 'porro'],
    ['funghi', 'cavolfiore'],
    ['burro', 'olio evo'],
    ['latte', 'bevanda vegetale'],
  ])('«%s» → «%s» è un sostituto vero', (da, a) => {
    expect(condividonoAlimento(da, a)).toBe(false);
  });
});

describe('sostituzione in chat — il motivo', () => {
  it('accetta la risposta col numero', () => {
    expect(riconosciMotivo('1')?.key).toBe('non_disponibile');
    expect(riconosciMotivo('2')?.key).toBe('non_piace');
    expect(riconosciMotivo('(3)')?.key).toBe('digestione');
    expect(riconosciMotivo('4.')?.key).toBe('no_tempo');
    expect(riconosciMotivo('5')).toBeNull();
  });

  it.each([
    ['non ce l\'ho in casa', 'non_disponibile'],
    ['l\'ho finito ieri', 'non_disponibile'],
    ['mi sono dimenticata di comprarlo', 'non_disponibile'],
    ['non mi piace per niente', 'non_piace'],
    ['lo detesto', 'non_piace'],
    ['mi resta sullo stomaco', 'digestione'],
    ['mi gonfia la pancia', 'digestione'],
    ['non lo digerisco bene', 'digestione'],
    ['non ho tempo di cucinarlo', 'no_tempo'],
    ['è troppo elaborato per me', 'no_tempo'],
  ])('«%s» → %s', (testo, atteso) => {
    expect(riconosciMotivo(testo)?.key).toBe(atteso);
  });

  it('non indovina quando non capisce', () => {
    expect(riconosciMotivo('boh')).toBeNull();
    expect(riconosciMotivo('perché sì')).toBeNull();
  });

  /**
   * Il difetto che questo progetto nasce per chiudere, e che il primo giro di codice aveva
   * reintrodotto: scorrendo i motivi nell'ordine dei numeri, «non mi piace, mi resta sullo
   * stomaco» vinceva su «non mi piace» — cioè un segnale clinico finiva nella casella dei
   * gusti, senza segnalazione alla nutrizionista e con un'esclusione permanente in regalo.
   */
  it.each([
    'non mi piace, mi resta sullo stomaco',
    'non lo mangio più, mi gonfia',
    'non mi va e poi mi resta sullo stomaco',
  ])('«%s» è un segnale CLINICO, non un gusto', (testo) => {
    const m = riconosciMotivo(testo);
    expect(m?.key).toBe('digestione');
    expect(m?.clinico).toBe(true);
    expect(m?.gusto).toBe(false);
  });

  it('il numero vince comunque sulle parole', () => {
    expect(riconosciMotivo('2')?.key).toBe('non_piace');
  });

  /**
   * La regola che tiene in piedi tutto il progetto: la DURATA è la conseguenza del motivo,
   * non una scelta della cliente. E solo un motivo di GUSTO autorizza a restringere i menu
   * futuri: «non ce l'ho in casa» non dice niente sui suoi gusti, e trattarlo come un rifiuto
   * le impoverirebbe il menu per una spesa saltata.
   */
  it('solo «non mi piace» vale per sempre ed è un segnale di gusto', () => {
    const perSempre = MOTIVI.filter((m) => m.durata === 'sempre').map((m) => m.key);
    expect(perSempre).toEqual(['non_piace']);
    const diGusto = MOTIVI.filter((m) => m.gusto).map((m) => m.key);
    expect(diGusto).toEqual(['non_piace']);
  });

  it('solo «mi resta sullo stomaco» è un segnale clinico', () => {
    expect(MOTIVI.filter((m) => m.clinico).map((m) => m.key)).toEqual(['digestione']);
  });

  it('i quattro motivi hanno numeri distinti da 1 a 4', () => {
    expect(MOTIVI.map((m) => m.numero)).toEqual([1, 2, 3, 4]);
  });
});

describe('sostituzione in chat — conferma e annullamento', () => {
  it.each(['sì', 'si', 'Sì!', 'ok', 'va bene', 'confermo', 'certo', 'perfetto', 'procedi'])(
    '«%s» conferma',
    (testo) => {
      expect(riconosciConferma(testo)).toBe('si');
    },
  );

  it.each(['no', 'No', 'annulla', 'lascia stare', 'meglio no'])('«%s» annulla', (testo) => {
    expect(riconosciConferma(testo)).toBe('no');
  });

  /**
   * Il caso che sembra un dettaglio e non lo è: «non mi piace» comincia per "no" ma è un
   * MOTIVO, non un rifiuto. Confonderli butterebbe via la conversazione proprio nel punto in
   * cui sta arrivando alla risposta che conta.
   */
  it.each(['non mi piace', 'non lo mangio', 'non ho tempo', 'non ce l\'ho in casa'])(
    '«%s» non è un annullamento',
    (testo) => {
      expect(riconosciConferma(testo)).not.toBe('no');
      expect(riconosciMotivo(testo)).not.toBeNull();
    },
  );

  it('non inventa una risposta quando è ambigua', () => {
    expect(riconosciConferma('forse')).toBeNull();
    expect(riconosciConferma('e se invece cambiassi la cena?')).toBeNull();
  });
});

describe('sostituzione in chat — termini candidati', () => {
  it('prova prima le coppie di parole, perché gli ingredienti veri sono composti', () => {
    const t = terminiCandidati('vorrei cambiare il petto di pollo');
    expect(t[0]).toBe('petto pollo');
    expect(t).toContain('petto');
    expect(t).toContain('pollo');
  });

  it('scarta le parole di servizio e i verbi della richiesta', () => {
    const t = terminiCandidati('vorrei sostituire le carote del pranzo di oggi');
    expect(t).toContain('carote');
    expect(t).not.toContain('vorrei');
    expect(t).not.toContain('pranzo');
    expect(t).not.toContain('oggi');
  });

  it('regge la risposta minima', () => {
    expect(terminiCandidati('le carote')).toEqual(['carote']);
  });
});

describe('sostituzione in chat — controllo di plausibilità dei grammi', () => {
  // Protezione richiesta dal progetto: un errore di battitura non deve diventare una
  // porzione tripla.
  it('ammette la stessa grammatura e le variazioni ragionevoli', () => {
    expect(grammaturaAmmessa(100, 100)).toBe(true);
    expect(grammaturaAmmessa(100, 130)).toBe(true);
    expect(grammaturaAmmessa(100, 60)).toBe(true);
  });

  it('rifiuta sotto un terzo e sopra il triplo', () => {
    expect(grammaturaAmmessa(100, 33)).toBe(false);
    expect(grammaturaAmmessa(100, 301)).toBe(false);
    expect(grammaturaAmmessa(100, 1000)).toBe(false);
  });

  it('accetta esattamente il terzo e il triplo (i bordi restano dentro)', () => {
    expect(grammaturaAmmessa(90, 30)).toBe(true);
    expect(grammaturaAmmessa(90, 270)).toBe(true);
  });

  it('rifiuta valori non sensati', () => {
    expect(grammaturaAmmessa(0, 100)).toBe(false);
    expect(grammaturaAmmessa(100, 0)).toBe(false);
    expect(grammaturaAmmessa(Number.NaN, 100)).toBe(false);
  });

  it('fuori scala si ripiega su pari grammatura e lo segnala', () => {
    expect(correggiGrammatura(100, 900)).toEqual({ qta: 100, corretta: true });
    expect(correggiGrammatura(100, 130)).toEqual({ qta: 130, corretta: false });
  });

  it('senza una quantità proposta tiene quella di partenza, senza segnalare niente', () => {
    expect(correggiGrammatura(80, undefined)).toEqual({ qta: 80, corretta: false });
  });

  it('senza una quantità di partenza non inventa un numero', () => {
    expect(correggiGrammatura(undefined, 120)).toEqual({ qta: undefined, corretta: false });
  });
});

describe('sostituzione in chat — sostituti sicuri', () => {
  it('trova il sostituto per parola chiave e per nome composto', () => {
    expect(sostitutoSicuro('farro')).toBe('riso');
    expect(sostitutoSicuro('pasta integrale')).toBe(SUBSTITUTION_MAP.pasta);
    expect(sostitutoSicuro('yogurt greco')).toBe(SUBSTITUTION_MAP.yogurt);
  });

  it('usa la parola chiave passata dal motore quando c\'è', () => {
    expect(sostitutoSicuro('bel pezzo di formaggio stagionato', 'formaggio')).toBe(
      SUBSTITUTION_MAP.formaggio,
    );
  });

  it('non inventa un sostituto quando non ce l\'ha', () => {
    expect(sostitutoSicuro('branzino')).toBeNull();
    expect(sostitutoSicuro('')).toBeNull();
  });
});

describe('sostituzione in chat — i testi di Gaia', () => {
  const proposta = {
    data: '2026-08-08',
    slot: 'lunch',
    recipeId: 'r1',
    piatto: 'Insalata di farro',
    da: 'carote',
    a: 'biete',
    qtaDa: 100,
    qtaA: 100,
    unita: 'g',
  };

  it('elenca i piatti di oggi quando chiede l\'alimento', () => {
    const testo = testoChiediCibo([
      { slot: 'breakfast', piatto: 'Yogurt e avena' },
      { slot: 'lunch', piatto: 'Insalata di farro' },
    ]);
    expect(testo).toContain('colazione: Yogurt e avena');
    expect(testo).toContain('pranzo: Insalata di farro');
  });

  it('senza menu di oggi non promette niente che non possa fare', () => {
    const testo = testoChiediCibo([]);
    expect(testo).toContain('non lo vedo');
    expect(testo).not.toContain('Quale alimento');
  });

  it('dice quanti grammi ci sono e offre i quattro motivi numerati', () => {
    const testo = testoChiediMotivo(proposta);
    expect(testo).toContain('100 g di carote');
    expect(testo).toContain('Insalata di farro');
    for (const m of MOTIVI) expect(testo).toContain(`${m.numero}) ${m.label}`);
  });

  it('nella conferma dice le due quantità e per quanto vale', () => {
    const oggi = testoConferma(proposta, MOTIVI[0]);
    expect(oggi).toContain('100 g di biete');
    expect(oggi).toContain('100 g di carote');
    expect(oggi).toContain('solo per oggi');

    const sempre = testoConferma(proposta, MOTIVI[1]);
    expect(sempre).toContain('non te lo propongo più');
  });

  it('a cambio fatto dice cosa troverà nel piatto', () => {
    const testo = testoFatto(proposta, MOTIVI[0]);
    expect(testo).toContain('menu di oggi è aggiornato');
    expect(testo).toContain('100 g di biete');
  });

  it('sul motivo clinico avvisa che ne parlerà una persona', () => {
    const testo = testoFatto(proposta, MOTIVI.find((m) => m.clinico)!);
    expect(testo).toContain('nutrizionista');
  });

  it('se la grammatura è stata riportata a pari, lo dice', () => {
    const testo = testoFatto({ ...proposta, grammaturaCorretta: true }, MOTIVI[0]);
    expect(testo).toContain('stessa grammatura');
  });

  it('etichetta gli slot in italiano e non si rompe su uno sconosciuto', () => {
    expect(etichettaSlot('afternoon_snack')).toBe('spuntino del pomeriggio');
    expect(etichettaSlot('brunch')).toBe('brunch');
  });

  /** «Nello colazione» è quello che veniva fuori da una regola sul genere dedotta dallo slot. */
  it('la preposizione dello slot è in tabella, non calcolata', () => {
    expect(nelloSlot('breakfast')).toBe('a colazione');
    expect(nelloSlot('lunch')).toBe('a pranzo');
    expect(nelloSlot('dinner')).toBe('a cena');
    expect(nelloSlot('morning_snack')).toBe('allo spuntino del mattino');
    expect(nelloSlot('brunch')).toBe('nel brunch');
  });

  it('nessun testo verso la cliente contiene «nello colazione»', () => {
    for (const slot of ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']) {
      const p = { ...proposta, slot };
      for (const t of [testoChiediMotivo(p), testoConferma(p, MOTIVI[0]), testoFatto(p, MOTIVI[0])]) {
        expect(t.toLowerCase()).not.toContain('nello colazione');
        expect(t.toLowerCase()).not.toContain('nello cena');
        expect(t.toLowerCase()).not.toContain('nel colazione');
      }
    }
  });
});

/**
 * IL NOME. «Gaia non potrebbe rispondere chiamando per nome la cliente?» (Simone, 8/8).
 * Sì — con tre regole, perché il modo sbagliato di farlo è peggio del non farlo: una volta per
 * messaggio, solo il nome proprio, e se il nome non c'è la frase deve restare corretta.
 */
/**
 * LA GRAMMATURA CHE GAIA DICE — quella del PIATTO SUO, non quella di catalogo (19/8, decisione di
 * Simone).
 *
 * ⚠️ Dal 18/8 le porzioni si scalano sul fabbisogno. Gaia diceva «metti 120 g di biete al posto di
 * 100 g di carote» mentre nel piatto di quella cliente ce n'erano 216: la chat è il posto dove lei
 * ha detto «sì» e dove torna a controllare, ed era l'unico numero che non poteva usare in cucina.
 */
describe('sostituzione in chat — la grammatura è quella del piatto', () => {
  const p = {
    data: '2026-08-19', slot: 'lunch', recipeId: 'r1', piatto: 'Insalata di farro',
    da: 'carote', a: 'biete', qtaDa: 100, qtaA: 100, unita: 'g',
  };

  it('⚠️ col piatto scalato dice il numero del piatto, non quello di catalogo', () => {
    const t = testoConferma({ ...p, fattore: 1.8 }, MOTIVI[0]);
    expect(t).toContain('180 g di biete');
    expect(t).toContain('180 g di carote');
    expect(t).not.toContain('100 g');
  });

  /** Un piatto non scalato non ha due numeri: si dice quello che c'è, com'è sempre stato. */
  it('senza fattore resta il numero di catalogo', () => {
    expect(testoConferma(p, MOTIVI[0])).toContain('100 g di carote');
    expect(testoConferma({ ...p, fattore: 1 }, MOTIVI[0])).toContain('100 g di carote');
  });

  /**
   * ⚠️ L'ARROTONDAMENTO È QUELLO DELLA SCHEDA RICETTA (`quantitaScalata`): a peso all'intero. Se qui
   * si arrotondasse diversamente, la chat direbbe «155 g» e la scheda «154 g» — e due numeri che
   * differiscono di uno si leggono come un errore di misura, non come una regola.
   */
  it('⚠️ arrotonda come la scheda ricetta: i grammi all\'intero', () => {
    expect(testoConferma({ ...p, qtaDa: 86, qtaA: 86, fattore: 1.8 }, MOTIVI[0])).toContain('155 g di carote');
  });

  /** ⚠️ Tutte le frasi che dicono un numero devono dire lo STESSO numero. */
  it('⚠️ vale per ogni frase che pronuncia una grammatura', () => {
    const scalata = { ...p, fattore: 1.8 };
    expect(testoChiediMotivo(scalata)).toContain('180 g di carote');
    expect(testoFatto(scalata, MOTIVI[0])).toContain('180 g di biete');
  });

  /** Un ingrediente senza quantità resta senza quantità: moltiplicare un vuoto darebbe «0 g». */
  it('senza quantità non compare un numero', () => {
    const t = testoConferma({ ...p, qtaDa: undefined, qtaA: undefined, fattore: 1.8 }, MOTIVI[0]);
    expect(t).not.toMatch(/\d+ g/);
    expect(t).toContain('biete');
  });
});

describe('Gaia chiama per nome', () => {
  it('usa solo il PRIMO nome, mai il cognome', () => {
    expect(soloNomeProprio('Maria Grazia Cerchiara')).toBe('Maria');
    expect(soloNomeProprio('  giulia  ')).toBe('Giulia');
  });

  it('senza nome non inventa niente e la frase resta corretta', () => {
    expect(appellativo(null)).toBe('');
    expect(conNome(undefined)).toBe('');
    const senza = testoAnnullato();
    expect(senza).toBe('Va bene, non cambio niente: il menu di oggi resta com\'è. Se cambi idea sono qui. 💚');
    expect(senza).not.toContain('undefined');
    expect(senza).not.toContain(', ,');
  });

  it('un «nome» che non è un nome viene ignorato', () => {
    // Capita negli import: iniziali, sigle, campi con numeri dentro.
    expect(soloNomeProprio('M')).toBeNull();
    expect(soloNomeProprio('cliente123')).toBeNull();
    expect(soloNomeProprio('')).toBeNull();
  });

  it('nei testi il nome compare UNA volta, e in testa', () => {
    const t = testoAnnullato('Giulia Rossi');
    expect(t).toBe('Va bene Giulia, non cambio niente: il menu di oggi resta com\'è. Se cambi idea sono qui. 💚');
    expect(t.match(/Giulia/g)).toHaveLength(1);
    expect(t).not.toContain('Rossi');
  });

  it('anche quando il menu non c\'è, la frase con il nome regge', () => {
    expect(testoChiediCibo([], 'Antonella')).toMatch(/^Antonella, per cambiare/);
    // E senza nome NON resta la minuscola: era il difetto che questo test ha trovato.
    expect(testoChiediCibo([])).toMatch(/^Per cambiare/);
  });

  it('apreFrase sposta la maiuscola invece di lasciare un buco', () => {
    expect(apreFrase('Giulia', 'Per oggi va bene')).toBe('Giulia, per oggi va bene');
    expect(apreFrase(null, 'Per oggi va bene')).toBe('Per oggi va bene');
  });
});

/**
 * IL «NO» ALLA PROPOSTA — richiesta di Simone dell'8/8, la sera, guardando una conversazione vera:
 * Gaia proponeva «70 ml di burro al posto di 70 ml di panna fresca», la cliente rispondeva «no
 * perché non voglio 70 gr di burro» e Gaia chiudeva con «va bene, non cambio niente».
 *
 * «Quando la cliente dice no non si deve fermare, deve indagare sul perché.» La distinzione che
 * regge tutto il resto è una sola: un no al SOSTITUTO non è un no al CAMBIO. Sbagliarla in un
 * verso lascia la cliente col piatto che non vuole; sbagliarla nell'altro le rimette in mano una
 * proposta quando aveva detto di lasciar perdere.
 */
describe('il «no» alla proposta: capire di che no si tratta', () => {
  it('un «no» che nomina il sostituto proposto riguarda il sostituto', () => {
    expect(sensoDelNo('no perchè non voglio 70 gr di burro', 'burro')).toBe('sostituto');
    expect(sensoDelNo('no, il burro no', 'burro')).toBe('sostituto');
    // Anche al plurale/singolare: il confronto è per radice, come tutto il resto del file.
    expect(sensoDelNo('no, le biete non le mangio', 'bieta')).toBe('sostituto');
  });

  it('un motivo spiegato a parole riguarda il sostituto, anche senza nominarlo', () => {
    expect(sensoDelNo('no, non mi piace', 'burro')).toBe('sostituto');
    expect(sensoDelNo('no, non ce l\'ho in casa', 'burro')).toBe('sostituto');
  });

  it('«lascia stare» e «ho cambiato idea» sono un ripensamento, non una critica alla proposta', () => {
    expect(sensoDelNo('no, lascia stare', 'burro')).toBe('ripensata');
    expect(sensoDelNo('ho cambiato idea', 'burro')).toBe('ripensata');
    expect(sensoDelNo('no, va bene così', 'burro')).toBe('ripensata');
  });

  it('un «no» secco non si interpreta: va chiesto', () => {
    expect(sensoDelNo('no', 'burro')).toBeNull();
    expect(sensoDelNo('No.', 'burro')).toBeNull();
    expect(sensoDelNo('no grazie', 'burro')).toBeNull();
  });

  it('senza sapere cosa era stato proposto non si indovina', () => {
    expect(sensoDelNo('no, il burro no')).toBeNull();
  });

  it('le tre strade si riconoscono dal numero e dalle parole', () => {
    expect(sceltaDopoIlNo('1')).toBe('altro_sostituto');
    expect(sceltaDopoIlNo('2')).toBe('altro_piatto');
    expect(sceltaDopoIlNo('3')).toBe('annulla');
    expect(sceltaDopoIlNo('proponimi un\'altra cosa')).toBe('altro_sostituto');
    expect(sceltaDopoIlNo('preferisco cambiare tutto il piatto')).toBe('altro_piatto');
    expect(sceltaDopoIlNo('lascia perdere')).toBe('annulla');
    expect(sceltaDopoIlNo('boh')).toBeNull();
  });

  it('la domanda dopo il «no» nomina l\'alimento che resta nel piatto e mette prima l\'alternativa', () => {
    const p = { data: '2026-08-08', slot: 'dinner', recipeId: 'r', piatto: 'Pasta alla panna', da: 'panna fresca', a: 'burro', qtaDa: 70, qtaA: 70, unita: 'ml' };
    const t = testoChiediPercheNo(p, 'Giusy');
    expect(t).toMatch(/^Giusy, /);
    expect(t).toContain('panna fresca');
    expect(t).toContain('1) non mi va bene questo sostituto');
    // Non chiude: chiede.
    expect(t).not.toContain('non cambio niente');
  });

  it('la seconda proposta dice perché è cambiata e chiede di nuovo conferma', () => {
    const p = { data: '2026-08-08', slot: 'dinner', recipeId: 'r', piatto: 'Pasta alla panna', da: 'panna fresca', a: 'olio evo', qtaDa: 70, qtaA: 70, unita: 'ml' };
    const t = testoAltroSostituto(p, MOTIVI[1], 'burro', 'Giusy');
    expect(t).toContain('niente burro');
    expect(t).toContain('olio evo');
    expect(t).toMatch(/sì \/ no/);
  });

  it('quando le alternative finiscono lo dice, e passa alla nutrizionista', () => {
    const t = testoNienteAltroSostituto('panna fresca', ['burro', 'mascarpone'], 'Giusy');
    expect(t).toMatch(/^Giusy, /);
    expect(t).toContain('nutrizionista');
    // Niente colpa alla cliente per aver detto no due volte.
    expect(t.toLowerCase()).toContain('hai ragione');
    expect(t).toContain('«burro» e «mascarpone»');
  });

  it('arrendersi è l\'ultima cosa, e passa da una persona', () => {
    expect(testoRifiutoNonCapito(false)).toContain('1)');
    expect(testoRifiutoNonCapito(true)).toContain('coach');
  });
});

/**
 * L'UNITÀ DEL SOSTITUTO. Nella conversazione dell'8/8 Gaia ha detto «70 ml di burro al posto di 70
 * ml di panna fresca»: il burro in millilitri non esiste, e la cliente l'ha notato prima di noi
 * («non voglio 70 gr di burro»). L'unità veniva copiata dall'ingrediente sostituito.
 *
 * La conversione è volutamente timida: solo da `ml`, dove 1 ml ≈ 1 g per questi alimenti. Su `cl`,
 * `dl` e `l` tenere lo stesso numero cambiando unità moltiplicherebbe la porzione per dieci o cento
 * — meglio un'unità strana che una porzione sbagliata.
 */
describe('unità del sostituto', () => {
  it('da ml a un solido diventa g', () => {
    expect(unitaPerSostituto('ml', 'burro')).toBe('g');
    expect(unitaPerSostituto('ml', 'mascarpone')).toBe('g');
  });

  it('fra due liquidi l\'unità resta ml', () => {
    expect(unitaPerSostituto('ml', 'latte di mandorla')).toBe('ml');
    expect(unitaPerSostituto('ml', 'panna vegetale')).toBe('ml');
    expect(unitaPerSostituto('ml', 'olio evo')).toBe('ml');
  });

  it('i grammi e i pezzi non si toccano', () => {
    expect(unitaPerSostituto('g', 'latte')).toBe('g');
    expect(unitaPerSostituto('pz', 'burro')).toBe('pz');
    expect(unitaPerSostituto(undefined, 'burro')).toBeUndefined();
  });

  it('cl, dl e l restano come sono: convertirli cambierebbe la porzione', () => {
    expect(unitaPerSostituto('cl', 'burro')).toBe('cl');
    expect(unitaPerSostituto('l', 'burro')).toBe('l');
  });

  it('nel testo della conferma le due unità convivono, ognuna al suo posto', () => {
    const p = {
      data: '2026-08-08', slot: 'dinner', recipeId: 'r', piatto: 'Pasta alla panna',
      da: 'panna fresca', a: 'burro', qtaDa: 70, qtaA: 70, unita: 'ml', unitaA: 'g',
    };
    const t = testoConferma(p, MOTIVI[1], 'Giusy');
    expect(t).toContain('70 g di burro');
    expect(t).toContain('70 ml di panna fresca');
    expect(t).not.toContain('70 ml di burro');
  });
});

/**
 * L'ARTICOLO SCRITTO A MANO — difetto visto in schermata nel collaudo dell'OTA 2.1.3 (9/8):
 * «non voglio lasciarti con **il panna fresca** nel piatto».
 *
 * Il ricettario ha alimenti di ogni genere e numero e nessuna tabella ci dice il genere di
 * «panna fresca», «uova», «yogurt». La regola del file è: il nome fra virgolette, mai un articolo
 * davanti. Questo test la tiene ferma su tutti i testi che nominano un alimento, perché l'errore
 * costa un secondo a scriverlo e lo legge la cliente.
 */
describe('nessun articolo appiccicato al nome di un alimento', () => {
  const PROPOSTA = {
    data: '2026-08-09', slot: 'dinner', recipeId: 'r', piatto: 'Pasta alla panna',
    da: 'panna fresca', a: 'uova', qtaDa: 70, qtaA: 70, unita: 'ml', unitaA: 'g',
  };
  /** Articolo + nome femminile/plurale: se compare, la frase è sgrammaticata. */
  const SGRAMMATICATO = /\b(il|lo|un)\s+(panna|uova|biete|carote|patate|mandorle|acqua)\b/i;

  it.each([
    ['testoChiediPercheNo', testoChiediPercheNo(PROPOSTA, 'Giulia')],
    ['testoChiediMotivo', testoChiediMotivo(PROPOSTA)],
    ['testoConferma', testoConferma(PROPOSTA, MOTIVI[1], 'Giulia')],
    ['testoAltroSostituto', testoAltroSostituto(PROPOSTA, MOTIVI[1], 'burro', 'Giulia')],
    ['testoNienteAltroSostituto', testoNienteAltroSostituto('panna fresca', ['burro'], 'Giulia')],
    ['testoContropropostaOk', testoContropropostaOk(PROPOSTA, MOTIVI[1], 'Giulia')],
    ['testoContropropostaAllergene', testoContropropostaAllergene('uova', 'Giulia')],
    ['testoContropropostaEsclusa', testoContropropostaEsclusa('panna fresca', 'Giulia')],
    ['testoContropropostaNonPrevista', testoContropropostaNonPrevista('panna fresca', 'Giulia')],
  ])('%s', (_nome, testo) => {
    expect(testo).not.toMatch(SGRAMMATICATO);
  });

  it('la domanda dopo il «no» nomina l\'alimento fra virgolette', () => {
    expect(testoChiediPercheNo(PROPOSTA, 'Giulia')).toContain('«panna fresca»');
  });
});

/**
 * LA CONTROPROPOSTA (difetto 2 del collaudo del 9/8). Qui si verifica solo la **lettura**: se
 * quel nome è un alimento ammissibile lo decide il servizio contro i gruppi approvati.
 *
 * `esplicita` è il campo che evita il danno peggiore: con un verbo di proposta un nome che non
 * riconosciamo va comunque chiesto alla nutrizionista; senza verbo — «boh» — no, altrimenti ogni
 * esitazione aprirebbe una richiesta che nessuno ha fatto.
 */
describe('contropropostaDaTesto', () => {
  it('la frase del collaudo: legge il burro vegetale, non l\'olio rifiutato', () => {
    const letto = contropropostaDaTesto("l'olio mi fa peso posso usare il burro vegetale?", ['panna fresca', 'olio evo']);
    expect(letto?.esplicita).toBe(true);
    expect(letto?.termini).toContain('burro vegetale');
    // L'olio è quello che ha appena rifiutato: se sopravvivesse a questa lettura glielo
    // riproporremmo come se fosse una sua idea.
    expect(letto?.termini.some((t) => t.includes('olio'))).toBe(false);
  });

  it('un nome secco vale come proposta, senza bisogno del verbo', () => {
    const letto = contropropostaDaTesto('gli spinaci', ['carote', 'biete']);
    expect(letto?.termini).toContain('spinaci');
    expect(letto?.esplicita).toBe(false);
  });

  it.each(['boh', 'mah', 'non so'])('«%s» non contiene nessun alimento da proporre', (testo) => {
    // Devono restare fuori: erano esitazioni che, lette come proposte, aprivano una richiesta alla
    // nutrizionista che nessuno aveva fatto (due test rossi in `sostituzione-chat.service.spec`).
    expect(contropropostaDaTesto(testo, [])).toBeNull();
  });

  it('una frase lunga senza verbo di proposta non è una controproposta', () => {
    expect(contropropostaDaTesto('oggi sono stata tutto il giorno fuori casa a correre', [])).toBeNull();
  });

  it('non riporta l\'alimento da cambiare né quello che abbiamo proposto noi', () => {
    expect(contropropostaDaTesto('posso usare le carote?', ['carote'])).toBeNull();
    expect(contropropostaDaTesto('non voglio le biete', ['carote', 'biete'])).toBeNull();
  });
});

/**
 * L'ELISIONE — difetto trovato mentre si scriveva la controproposta, e più vecchio di lei.
 *
 * `terminiCandidati` teneva l'apostrofo dentro la parola, quindi «l'olio» era un token a sé e non
 * combaciava con «olio evo»: chi scriveva «vorrei togliere l'olio» si sentiva rispondere che non lo
 * trovava fra gli ingredienti di oggi, e al secondo tentativo il dialogo passava alla coach. In
 * italiano l'elisione è la norma, non un caso limite.
 */
describe('l\'apostrofo non nasconde l\'alimento', () => {
  it.each([
    ["vorrei togliere l'olio", 'olio'],
    ["non voglio l'uovo", 'uovo'],
    ["posso cambiare l'avena?", 'avena'],
    ["togli il sale all'aglio", 'aglio'],
    ["mi da fastidio dell'olio", 'olio'],
  ])('«%s» → riconosce «%s»', (frase, atteso) => {
    expect(terminiCandidati(frase)).toContain(atteso);
  });

  it('e l\'abbinamento con l\'ingrediente vero funziona', () => {
    expect(terminiCandidati("vorrei togliere l'olio").some((t) => combaciaAlimento('olio evo', t))).toBe(true);
  });
});
