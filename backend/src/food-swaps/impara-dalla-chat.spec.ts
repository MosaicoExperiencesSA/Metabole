/**
 * «Gaia dovrebbe leggere anche le chat del nutrizionista ed apprendere anche da lì le
 * sostituzioni» (Simone, 12/8).
 *
 * Il primo blocco è quello che conta: in italiano le due forme dicono la stessa cosa con i pezzi
 * invertiti, e capirla al contrario produce una regola perfettamente formata e rovesciata.
 */
import { daScartare, nomeAlimento, nomeTroncatoSuCongiunzione, sostituzioniNelMessaggio } from './impara-dalla-chat';

const una = (t: string) => {
  const r = sostituzioniNelMessaggio(t);
  expect(r).toHaveLength(1);
  return r[0];
};
const nessuna = (t: string) => expect(sostituzioniNelMessaggio(t)).toEqual([]);

describe('⚠️ la direzione', () => {
  it('«sostituisci il pollo con il tacchino» → esce il pollo, entra il tacchino', () => {
    const s = una('Sostituisci il pollo con il tacchino.');
    expect(s.from).toMatch(/pollo/i);
    expect(s.to).toMatch(/tacchino/i);
  });

  it('⚠️ «il tacchino al posto del pollo» dice la STESSA cosa, coi pezzi invertiti', () => {
    // Se questo test cade al contrario, la regola imparata è rovesciata — e una regola rovesciata
    // non sembra sbagliata a nessuno finché non arriva nel piatto di qualcuno.
    const s = una('Puoi mangiare il tacchino al posto del pollo.');
    expect(s.from).toMatch(/pollo/i);
    expect(s.to).toMatch(/tacchino/i);
  });

  it('«invece di» si comporta come «al posto di»', () => {
    const s = una('Prendi le gallette invece del pane.');
    expect(s.from).toMatch(/pane/i);
    expect(s.to).toMatch(/gallette/i);
  });

  it('«in alternativa a» pure', () => {
    const s = una('Il tofu in alternativa alla ricotta.');
    expect(s.from).toMatch(/ricotta/i);
    expect(s.to).toMatch(/tofu/i);
  });

  it('«sostituire X con Y» all\'infinito', () => {
    const s = una('Puoi sostituire il latte vaccino con la bevanda di soia.');
    expect(s.from).toMatch(/latte/i);
    expect(s.to).toMatch(/soia/i);
  });

  it('«cambia X con Y»', () => {
    const s = una('Cambia la pasta con il riso.');
    expect(s.from).toMatch(/pasta/i);
    expect(s.to).toMatch(/riso/i);
  });
});

describe('⚠️ quello che NON si impara', () => {
  it('una domanda non è un\'istruzione', () => {
    // La stessa frase, col punto di domanda, vuol dire il contrario: è la CLIENTE che chiede.
    nessuna('Posso sostituire il pane con le gallette?');
    nessuna('Vuoi il tacchino al posto del pollo?');
  });

  it('⚠️ una negazione è l\'esatto rovescio', () => {
    nessuna('Non sostituire il pane con le gallette.');
    nessuna('Mai il tacchino al posto del pollo.');
    nessuna('Evita di sostituire il riso con la pasta.');
  });

  it('un\'ipotesi non è una decisione', () => {
    nessuna('Se volessi potresti sostituire il pane con le gallette.');
    nessuna('Magari il tofu al posto della ricotta, ne parliamo.');
  });

  it('⚠️ i pasti e i giorni non sono alimenti', () => {
    // «Al posto della cena mangia solo frutta» parla di come organizzare la giornata.
    nessuna('Al posto della cena prendi solo frutta.');
    nessuna('Facciamo la visita giovedì al posto di domani.');
  });

  it('⚠️ un pronome non dice niente a chi legge dopo', () => {
    nessuna('Puoi usare il tacchino al posto di quello.');
    nessuna('Sostituisci quella con questa.');
  });

  it('lo stesso alimento da tutte e due le parti non è una sostituzione', () => {
    nessuna('Sostituisci le carote con le carote.');
    // Anche al singolare/plurale: la chiave è la stessa.
    nessuna('La carota al posto delle carote.');
  });

  it('un messaggio normale non contiene sostituzioni', () => {
    nessuna('Ciao Patrizia, ho visto le misure di questa settimana: stai andando bene. Continua così! 💚');
    nessuna('Ci vediamo martedì alle 10 per la visita di controllo.');
  });

  it('il messaggio vuoto non fa cadere niente', () => {
    nessuna('');
    expect(sostituzioniNelMessaggio(undefined as never)).toEqual([]);
  });
});

describe('il nome dell\'alimento', () => {
  it('perde l\'articolo e tiene il resto', () => {
    expect(nomeAlimento('  il pollo ')).toBe('pollo');
    expect(nomeAlimento("l'olio di oliva")).toBe('olio di oliva');
  });

  it('⚠️ si ferma alla prima congiunzione: dopo comincia un\'altra frase', () => {
    // «...con le gallette e bevi più acqua» non è un alimento che si chiama «gallette e bevi
    // più acqua».
    expect(nomeAlimento('le gallette e bevi più acqua')).toBe('gallette');
  });

  it('non si allunga oltre quattro parole', () => {
    expect(nomeAlimento('petto di pollo alla piastra ben cotto senza pelle')!.split(' ')).toHaveLength(4);
  });

  it('quello che resta troppo corto o vuoto non è un nome', () => {
    expect(nomeAlimento('')).toBeNull();
    expect(nomeAlimento('il')).toBeNull();
    expect(nomeAlimento('lo x')).toBeNull();
  });
});

describe('dentro un messaggio vero', () => {
  it('⚠️ prende la frase giusta e lascia stare il resto', () => {
    const s = una(
      'Ciao Patrizia! Ho guardato il diario di questa settimana. ' +
        'Sostituisci il latte con la bevanda di soia, che ti resta più leggera. ' +
        'Per il resto va benissimo così, ci sentiamo martedì.',
    );
    expect(s.from).toMatch(/latte/i);
    expect(s.to).toMatch(/soia/i);
    // ⚠️ La frase esatta si conserva: è quello che permette di confermare senza aprire la chat.
    expect(s.frase).toContain('Sostituisci il latte');
  });

  it('due sostituzioni in due frasi diventano due righe', () => {
    const r = sostituzioniNelMessaggio(
      'Sostituisci il pollo con il tacchino. E prendi le gallette invece del pane.',
    );
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.from.toLowerCase())).toEqual(expect.arrayContaining([
      expect.stringContaining('pollo'),
      expect.stringContaining('pane'),
    ]));
  });

  it('la stessa sostituzione ripetuta due volte resta una', () => {
    const r = sostituzioniNelMessaggio('Sostituisci il pollo con il tacchino. Ricorda: tacchino al posto del pollo.');
    expect(r).toHaveLength(1);
  });

  it('⚠️ una frase mista non contagia le altre', () => {
    // La negazione vale per la SUA frase, non per tutto il messaggio: altrimenti un «non
    // preoccuparti» in apertura cancellerebbe l'istruzione che viene dopo.
    const s = una('Non preoccuparti per il peso. Sostituisci il pollo con il tacchino.');
    expect(s.from).toMatch(/pollo/i);
  });

  it('la coda della frase rovesciata non si porta dietro il verbo', () => {
    const s = una('Ti consiglio il tacchino al posto del pollo.');
    expect(s.to.toLowerCase()).toBe('tacchino');
  });
});

describe('daScartare', () => {
  it('riconosce domande, negazioni e ipotesi', () => {
    expect(daScartare('Posso sostituire il pane?')).toBe(true);
    expect(daScartare('Non sostituire il pane con altro')).toBe(true);
    expect(daScartare('Potresti sostituire il pane')).toBe(true);
    expect(daScartare('Sostituisci il pane con le gallette')).toBe(false);
  });

  it('⚠️ «non» dentro un\'altra parola non conta', () => {
    // «nonna», «annona»: senza il confine di parola, mezza lingua italiana diventa una negazione.
    expect(daScartare('Sostituisci il pane della nonna con le gallette')).toBe(false);
  });

  /**
   * ⛔ **«SENZA GLUTINE» NON È UNA NEGAZIONE** — dal messaggio vero della nutrizionista del 31/8:
   * *«a patrizia sogari sostituisci Biscotti d'Avena e Banana con Biscotti senza glutine e
   * banana»*, e Vera rispondeva «Non ci arrivo». Due volte.
   *
   * ⚠️ `senza` stava nell'elenco delle negazioni come parola secca, quindi bastava nominare mezzo
   * scaffale — senza glutine, senza lattosio, senza zucchero, senza sale — perché l'istruzione non
   * venisse eseguita. Questo prodotto ha una funzione che si chiama `senza-glutine.ts`.
   */
  describe('⛔ «senza» qualifica un alimento, non nega l\'istruzione', () => {
    it.each([
      'a patrizia sostituisci i biscotti con biscotti senza glutine',
      'sostituisci la pasta con pasta senza lattosio',
      'sostituisci il pane con le gallette senza sale',
      'sostituisci i biscotti con biscotti senza zucchero',
    ])('«%s» si esegue', (f) => {
      expect(daScartare(f)).toBe(false);
      expect(sostituzioniNelMessaggio(f)).toHaveLength(1);
    });

    /**
     * ⚠️ L'elenco dei verbi è CHIUSO apposta. La prima stesura usava una forma furba — «parola che
     * finisce in -are/-ere/-ire, o in -r più un pronome» — e su «senza **mandorle**» scattava
     * (`mando` + `r` + `le`): per coprire «senza dirglielo» avrebbe ributtato via una frase
     * normalissima sul cibo. Cioè lo stesso difetto di prima, con un'altra parola.
     */
    it('⛔ e «senza mandorle» resta cibo, non diventa un verbo', () => {
      expect(daScartare('sostituisci le noci con mandorle senza mandorle amare')).toBe(false);
    });

    it('mentre «senza» davanti al verbo dell\'azione nega ancora', () => {
      expect(daScartare('fai il menu senza sostituire il pane con le gallette')).toBe(true);
      expect(daScartare('aggiorna la dieta senza cambiare il pane con le gallette')).toBe(true);
      expect(daScartare('sostituisci il pane con le gallette senza che se ne accorga')).toBe(true);
    });

    /**
     * ⛔ **LA FORMA ROVESCIATA, ed è il caso peggiore che questo prodotto possa produrre.**
     *
     * Trovato dalla revisione del 31/8: la prima stesura dell'elenco chiuso conosceva i verbi del
     * *cambiare* e nessuno di quelli del **mettere** — che sono proprio quelli della forma «Y al
     * posto di X», la trappola numero uno dichiarata nel cappello del file. Risultato misurato:
     *
     *     «per la celiaca senza mettere il pane normale al posto del pane senza glutine»
     *       → { da: ["pane senza glutine"], a: ["pane normale"] }
     *
     * cioè, nel piatto di una celiaca, il pane senza glutine sostituito **con pane normale** —
     * scritto come regola, con un'anteprima plausibile da confermare. ⚠️ Non è un errore che si
     * nota: è un errore che si mangia.
     */
    it.each([
      'per la celiaca senza mettere il pane normale al posto del pane senza glutine',
      'mi raccomando senza mettere il latte al posto della bevanda di soia',
      'senza dare la ricotta al posto del formaggio di soia',
      'senza usare le noci al posto delle mandorle',
      'senza inserire il pane al posto delle gallette',
      'senza prendere il tonno al posto del pollo',
      'senza levare il pane al posto delle gallette',
      'senza aggiungere lo zucchero al posto del miele',
    ])('⛔ «%s» NON si esegue: la regola uscirebbe rovesciata', (f) => {
      expect(daScartare(f)).toBe(true);
      expect(sostituzioniNelMessaggio(f)).toEqual([]);
    });

    /**
     * ⚠️ Il confine di parola su `che` non è decorazione: senza, «cheddar» e «cheto» diventano
     * negazioni — cioè il difetto del 31/8 ricostruito con un'altra parola. Sopravviveva a tutte le
     * prove finché nessuna lo guardava.
     */
    it.each([
      ['sostituisci la pizza con una pizza senza cheddar', 'pizza senza cheddar'],
      ['sostituisci il pane con pane senza cheto', 'pane senza cheto'],
    ])('⛔ «%s»: `che` ha il confine di parola', (f, atteso) => {
      expect(daScartare(f)).toBe(false);
      expect(sostituzioniNelMessaggio(f)).toMatchObject([{ to: atteso }]);
    });

    /**
     * ⚠️ Ogni radice dell'elenco è coperta da una prova sua. Senza, se ne possono togliere cinque su
     * sedici e resta tutto verde — provato in revisione, ed è come un elenco chiuso smette di essere
     * chiuso: non lo tocca nessuno, e intanto non lo tiene fermo niente.
     */
    it.each([
      ['sostituir', 'fai il menu senza sostituire il pane'],
      ['cambiar', 'fai il menu senza cambiare il pane'],
      ['toglier', 'fai il menu senza togliere il pane'],
      ['rimpiazzar', 'fai il menu senza rimpiazzare il pane'],
      ['eliminar', 'fai il menu senza eliminare il pane'],
      ['modificar', 'fai il menu senza modificare il pane'],
      ['scriver', 'fai il menu senza scriverlo nella regola'],
      ['metter', 'fai il menu senza mettere il pane'],
      ['dar', 'fai il menu senza dare il pane'],
      ['usar', 'fai il menu senza usare il pane'],
      ['aggiunger', 'fai il menu senza aggiungere il pane'],
      ['inserir', 'fai il menu senza inserire il pane'],
      ['prender', 'fai il menu senza prendere il pane'],
      ['lev', 'fai il menu senza levare il pane'],
      ['mescolar', 'fai il menu senza mescolare il pane'],
    ])('la radice «%s» nega', (_, f) => {
      expect(daScartare(f)).toBe(true);
    });

    /**
     * ⚠️ Copre poco apposta: qui il «senza» non nega il cambio, dice **come** farlo. Scartarlo
     * vorrebbe dire non eseguire un'istruzione che c'è.
     */
    it('⚠️ e «senza dirglielo» resta una sostituzione: dice come, non se', () => {
      expect(daScartare('sostituisci il pane con le gallette senza dirglielo')).toBe(false);
    });
  });
});

/**
 * I REFUSI SUL VERBO — segnalazione di Simone, 17/8.
 *
 * Ha scritto «a jolanda **sostitusci** ceci con fagioli» e Vera ha risposto «non ci arrivo». Con la
 * parola scritta giusta la stessa frase veniva capita: a farla cadere è stata **una lettera**.
 *
 * ⚠️ Chi detta a un assistente scrive di corsa. Un riconoscitore che pretende l'ortografia perfetta
 * del verbo non sta chiedendo precisione: sta chiedendo di essere trattato come un modulo, e la
 * persona dall'altra parte impara che «non funziona» invece che «ho sbagliato a scrivere».
 *
 * ⚠️ Ma la radice si ferma prima di `sostituzione`: «la sostituzione di X con Y» è un RESOCONTO, non
 * un ordine, e leggerlo come istruzione vorrebbe dire scrivere nel piatto di qualcuno una cosa che
 * nessuno ha chiesto adesso.
 */
describe('sostituzioniNelMessaggio — i refusi sul verbo', () => {
  it('«sostitusci» (la i mangiata) si capisce', () => {
    expect(sostituzioniNelMessaggio('sostitusci i ceci con i fagioli')).toMatchObject([{ from: 'ceci', to: 'fagioli' }]);
  });

  it('«sostituisi» (la c mangiata) si capisce', () => {
    expect(sostituzioniNelMessaggio('sostituisi i ceci con i fagioli')).toMatchObject([{ from: 'ceci', to: 'fagioli' }]);
  });

  it('le forme giuste continuano a valere', () => {
    for (const v of ['sostituisci', 'sostituire', 'sostituiscilo']) {
      expect(sostituzioniNelMessaggio(`${v} i ceci con i fagioli`)).toMatchObject([{ from: 'ceci', to: 'fagioli' }]);
    }
  });

  it('⚠️ «la sostituzione di X con Y» NON è un ordine: è un resoconto', () => {
    expect(sostituzioniNelMessaggio('la sostituzione dei ceci con i fagioli è andata bene')).toEqual([]);
  });
});

/**
 * ⛔ **«BISCOTTI D'AVENA E BANANA» DIVENTAVA «BISCOTTI D'AVENA»** — voce
 * `la-e-nel-nome-tronca-in-silenzio`, trovata **misurando** il 31/8 e chiusa il 2/9.
 *
 *     «a patrizia sostituisci Biscotti d'Avena e Banana con Gallette di riso»
 *       → { da: ["Biscotti d'Avena"], a: ["Gallette di riso"] }
 *
 * ⛔ «e Banana» spariva senza una parola, e la regola scritta non vietava quel piatto: vietava
 * **tutti** i «Biscotti d'Avena». L'anteprima mostrava una frase plausibile, quindi bastava un
 * «confermo».
 *
 * ⚠️ La strada scelta (⭐ delle due della voce) è **dire di no**: non rispondere, e far chiedere.
 * L'altra — guardare il catalogo per decidere se è un nome solo — farebbe dipendere la lettura di
 * una frase da cosa c'è in catalogo in quel momento: la stessa frase, domani, si capirebbe in un
 * altro modo.
 */
describe('⛔ il nome tagliato su una congiunzione non si legge a metà', () => {
  it('⛔ la frase vera del 31/8 non produce più una sostituzione', () => {
    const lette = sostituzioniNelMessaggio("a patrizia sostituisci Biscotti d'Avena e Banana con Gallette di riso");
    expect(lette).toEqual([]);
  });

  it('⛔ e vale per qualunque congiunzione, non solo «e»', () => {
    for (const frase of [
      'sostituisci pane e marmellata con gallette',
      'sostituisci riso o farro con quinoa',
      'cambia latte e biscotti con yogurt',
    ]) {
      expect(sostituzioniNelMessaggio(frase)).toEqual([]);
    }
  });

  /**
   * ⚠️ **E le frasi normali continuano a passare.** Il rischio di un controllo così è di chiudere
   * la porta a chi scrive bene: se «sostituisci il pane con le gallette» smettesse di funzionare,
   * il rimedio sarebbe peggio del difetto.
   */
  it('⚠️ una frase senza congiunzioni nel nome si legge come prima', () => {
    expect(sostituzioniNelMessaggio('sostituisci il pane con le gallette di riso')).toEqual([
      expect.objectContaining({ from: 'pane', to: 'gallette di riso' }),
    ]);
  });

  it('⚠️ e nemmeno la coda di contesto dopo il secondo nome dà fastidio', () => {
    const lette = sostituzioniNelMessaggio('sostituisci il pane con le gallette a colazione');
    expect(lette).toHaveLength(1);
    expect(lette[0].from).toBe('pane');
  });

  /**
   * ⛔ **La congiunzione conta solo se dopo c'è ancora qualcosa.** Una frase che finisce con una
   * parola di troppo si capisce benissimo: segnalarla vorrebbe dire chiedere per niente.
   */
  it('⛔ una congiunzione a fine pezzo non è un troncamento', () => {
    expect(nomeTroncatoSuCongiunzione('il pane e')).toBe(false);
    expect(nomeTroncatoSuCongiunzione('il pane e  ')).toBe(false);
  });

  /** ⚠️ E il limite di quattro parole non è una congiunzione: è una regola dichiarata. */
  it('⚠️ fermarsi a PAROLE_MAX non è il troncamento da segnalare', () => {
    expect(nomeTroncatoSuCongiunzione('insalata di farro con pomodorini e feta greca')).toBe(false);
  });

  it('⛔ ma «Biscotti d\'Avena e Banana» sì', () => {
    expect(nomeTroncatoSuCongiunzione("Biscotti d'Avena e Banana")).toBe(true);
  });

  it('⚠️ e un pezzo vuoto non è un troncamento', () => {
    expect(nomeTroncatoSuCongiunzione('')).toBe(false);
    expect(nomeTroncatoSuCongiunzione('   ')).toBe(false);
  });
});
