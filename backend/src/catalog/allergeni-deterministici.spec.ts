import {
  Dizionario, deduci, differenza, indicizza, riconosce, sembraPreparazione,
} from './allergeni-deterministici';

/**
 * ⚠️ **Metà di queste righe sono prese dalla tabella vera** (`prisma/dati-alimenti*.ts`), e la
 * revisione del 31/8 ha spiegato perché conta: la prima stesura inventava `zucchine`, `gamberi`,
 * `riso` e `insalata` — che nella tabella vera **non ci sono**, e sono proprio i nomi che in
 * produzione fermano più ricette. Una tabella finta in cui il criterio funziona non dice niente su
 * un criterio che deve girare su quella vera.
 */
const TABELLA = [
  { name: 'zucchine', synonyms: [], state: 'crudo' },
  { name: 'petto di pollo', synonyms: ['pollo'], state: 'crudo' },
  { name: 'ricotta vaccina', synonyms: ['ricotta'], state: 'crudo' },
  { name: 'olio extravergine di oliva', synonyms: ['olio evo'], state: 'crudo' },
  { name: 'gamberi', synonyms: [], state: 'crudo' },
  { name: 'pesto pronto', synonyms: [], state: 'crudo' },
  { name: 'riso', synonyms: [], state: 'crudo' },
  { name: 'insalata', synonyms: [], state: 'crudo' },
  // ── righe prese dalla tabella vera ──
  { name: 'insalata mista', synonyms: [], state: 'crudo' },
  { name: 'aceto di riso', synonyms: [], state: 'secco' },
  { name: 'baccalà', synonyms: [], state: 'crudo' },
];

const ing = (...nomi: string[]) => nomi.map((name) => ({ name, qty: 100, unit: 'g' }));

describe('allergeni dedotti dagli ingredienti, con arresto sull\'ignoto', () => {
  let dz: Dizionario;
  beforeEach(() => { dz = indicizza(TABELLA); });

  describe('riconoscere è la PRIMA domanda', () => {
    it('col suo nome', () => {
      expect(riconosce('zucchine', dz)).toBe('nome');
    });

    it('con un sinonimo', () => {
      expect(riconosce('ricotta', dz)).toBe('nome');
    });

    it('per somiglianza, e si dice che è per somiglianza', () => {
      // ⚠️ `abbina` è un'euristica: chi legge il numero deve poter separare i due casi.
      expect(riconosce('zucchine fresche', dz)).toBe('abbinamento');
    });

    it('⛔ e quello che non c\'è resta ignoto, non «senza allergeni»', () => {
      expect(riconosce('preparato per brodo', dz)).toBeNull();
      expect(riconosce('trancio misto', dz)).toBeNull();
    });

    it('un nome vuoto non è riconosciuto', () => {
      expect(riconosce('   ', dz)).toBeNull();
    });
  });

  describe('la deduzione', () => {
    it('⛔ tutti riconosciuti → gli allergeni si scrivono da soli', () => {
      const e = deduci(ing('petto di pollo', 'zucchine', 'olio extravergine di oliva'), dz);
      expect(e.ignoti).toEqual([]);
      expect(e.allergeni).toEqual([]);
    });

    /**
     * ⛔ Mutazione M1 della revisione del 31/8, sopravvissuta alla prima stesura: passare a
     * `suggestAllergens` i nomi **normalizzati** invece di quelli grezzi. Sembra innocuo e non lo è:
     * la normalizzazione toglie gli accenti, e le chiavi dei solfiti sono accentate — «baccalà»
     * perdeva `solfiti` e `pesce` restava. Un allergene perso, in silenzio.
     */
    it('⛔ gli allergeni si leggono dal nome GREZZO: «baccalà» senza accento perde i solfiti', () => {
      const e = deduci(ing('baccalà'), dz);
      expect(e.allergeni).toContain('solfiti');
      expect(e.allergeni).toContain('pesce');
    });

    it('e li trova davvero, quando ci sono', () => {
      const e = deduci(ing('ricotta', 'zucchine'), dz);
      expect(e.allergeni).toContain('latte');
    });

    it('⛔ UN SOLO ingrediente ignoto ferma la ricetta — e `null` non è «nessun allergene»', () => {
      const e = deduci(ing('petto di pollo', 'preparato per brodo'), dz);
      expect(e.ignoti).toEqual(['preparato per brodo']);
      expect(e.allergeni).toBeNull();
      // ⚠️ La differenza che questa consegna esiste per tenere: `null` ≠ `[]`.
      expect(e.allergeni).not.toEqual([]);
    });

    /**
     * ⚠️ La prova prima guardava solo che gli elenchi fossero VUOTI, e così non si accorgeva se il
     * `Set` spariva: un ingrediente riconosciuto col suo nome non finisce in nessun elenco comunque.
     * Serve un nome che negli elenchi ci FINISCE — se no la prova passa anche col difetto (M34).
     */
    it('⚠️ un ingrediente ripetuto è UNO, non due — negli ignoti e negli altri elenchi', () => {
      const e = deduci(ing('Zucchine fresche', 'zucchine fresche', 'trancio misto', 'Trancio misto'), dz);
      expect(e.ignoti).toEqual(['trancio misto']);
      expect(e.perAbbinamento).toEqual(['zucchine fresche']);
    });

    it('e lo stesso per le preparazioni', () => {
      const e = deduci(ing('pesto pronto', 'PESTO PRONTO'), dz);
      expect(e.preparazioni).toEqual(['pesto pronto']);
    });

    it('conta a parte quelli riconosciuti solo per somiglianza', () => {
      const e = deduci(ing('zucchine fresche', 'ricotta'), dz);
      expect(e.perAbbinamento).toEqual(['zucchine fresche']);
      expect(e.ignoti).toEqual([]);
    });

    it('⚠️ e segnala le preparazioni: riconosciute, ma il nome non dice cosa contengono', () => {
      const e = deduci(ing('pesto pronto', 'zucchine'), dz);
      expect(e.ignoti).toEqual([]);
      expect(e.preparazioni).toEqual(['pesto pronto']);
      // ⛔ Ed è il limite dichiarato: la deduzione qui dice «niente» senza saperlo.
      expect(e.allergeni).toEqual([]);
    });

    /**
     * ⛔ Trovato scrivendo questa stessa prova, e nella prima stesura l'avevo pure asserito al
     * contrario: `ingredients` è una colonna Json, e una ricetta con l'elenco vuoto o malformato
     * usciva con `allergeni: []`, cioè «non contiene niente» su una ricetta di cui non si è letto
     * niente. **Zero ingredienti riconosciuti non è zero allergeni.**
     */
    it.each([[null], [[]], [42], [{ items: [] }]])(
      '⛔ una ricetta senza nessun elenco di ingredienti (%p) SI FERMA', (ingredienti) => {
        const e = deduci(ingredienti, dz);
        expect(e.allergeni).toBeNull();
        expect(e.motivoArresto).toBe('senza_ingredienti');
      },
    );

    /**
     * ⛔ **IL CASO PARZIALE, trovato dalla revisione del 31/8 e non da me.**
     *
     * `ingredientNames` scarta in silenzio gli elementi senza `name` leggibile. Finché l'arresto
     * guardava solo «ne ho letti zero», bastava **un** ingrediente buono perché la ricetta passasse
     * e dichiarasse `[]` — cioè «non contiene niente» — con dentro i gamberi.
     */
    it.each([
      ['un elemento col nome in un altro campo', [{ name: 'zucchine' }, { nome: 'gamberi' }]],
      ['un elemento annidato', [{ name: 'zucchine' }, [{ name: 'gamberi' }]]],
      ['un nome vuoto', [{ name: 'zucchine' }, { name: '' }]],
      ['un nome che non è una stringa', [{ name: 'zucchine' }, { name: [] }]],
    ])('⛔ %s ferma la ricetta: uno scarto silenzioso non è «non contiene niente»', (_, ingredienti) => {
      const e = deduci(ingredienti, dz);
      expect(e.motivoArresto).toBe('elementi_illeggibili');
      expect(e.allergeni).toBeNull();
    });

    /**
     * ⛔ **Dal 2/9 si ferma dalla porta GIUSTA**, e il cambio vale la pena raccontarlo.
     *
     * Fino al 2/9 `ingredientNames` faceva `String(i)` sui non-oggetti e — siccome in JS
     * `typeof null === 'object'` ma `null && …` è falso — un elemento `null` diventava il **nome
     * «null»**. Nessuna tabella conosce un alimento chiamato «null», quindi la ricetta si fermava
     * sugli **ignoti**: l'arresto giusto per il motivo sbagliato. Ora la lettura è una sola
     * (`catalog/elenco-ingredienti.ts`), il `null` viene scartato come illeggibile, e il conto
     * «quanti ce n'erano contro quanti se ne sono letti» lo vede.
     *
     * ⚠️ In tutte e due le versioni `allergeni` è `null` e la ricetta non passa: cambia il motivo
     * scritto, non la sicurezza. Ma il motivo è quello che qualcuno legge per capire cosa
     * aggiustare, e «c'è un elemento che non so leggere» manda nel posto giusto, «c'è un
     * ingrediente che non conosco» no.
     */
    it('⛔ un elemento nullo è un elemento ILLEGGIBILE, non un ingrediente ignoto', () => {
      const e = deduci([{ name: 'zucchine' }, null], dz);
      expect(e.allergeni).toBeNull();
      expect(e.motivoArresto).toBe('elementi_illeggibili');
      /** ⚠️ E nessun alimento inventato: «null» non compare fra gli ignoti. */
      expect(e.ignoti).toEqual([]);
    });

    it('⚠️ e due ingredienti uguali non sembrano uno scarto', () => {
      // Il confronto è con l'elenco NON deduplicato: se no ogni ripetizione sarebbe un arresto.
      expect(deduci(ing('zucchine', 'zucchine'), dz).motivoArresto).toBeNull();
    });

    it('e chi si ferma per un ingrediente ignoto lo dice con l\'altro motivo', () => {
      expect(deduci(ing('preparato per brodo'), dz).motivoArresto).toBe('ignoti');
      expect(deduci(ing('zucchine'), dz).motivoArresto).toBeNull();
    });
  });

  /**
   * ⛔ **Il criterio largo misura un tetto, non decide se servire un piatto.** Queste prove esistono
   * per tenere ferma quella differenza: la prima dice a cosa serve, la seconda dice perché non ci si
   * può decidere sopra.
   */
  describe('il criterio largo', () => {
    it('riconosce un nome fatto di parole note che la tabella non ha', () => {
      // «merluzzo» non è in questa tabella, ma è una delle 67 parole del pesce: il sistema sa cos'è.
      expect(riconosce('merluzzo', dz)).toBeNull();
      expect(riconosce('merluzzo', dz, 'largo')).toBe('parole');
      // …e un qualificatore innocuo non lo ferma: si leggono gli elenchi dell'abbinamento.
      expect(riconosce('merluzzo fresco', dz, 'largo')).toBe('parole');
    });

    it('⚠️ ma una parola che nessun elenco conosce lo ferma lo stesso — anche qui il numero è un minimo', () => {
      // «rosse» non è né un alimento né un qualificatore innocuo: il largo si ferma, e va detto,
      // perché vuol dire che nemmeno lui è il numero vero — la verità sta fra i due.
      expect(riconosce('lenticchie rosse', dz, 'largo')).toBeNull();
    });

    it('e resta fermo su una parola che non conosce nessun elenco', () => {
      expect(riconosce('trancio misto', dz, 'largo')).toBeNull();
      expect(riconosce('preparato per brodo', dz, 'largo')).toBeNull();
    });

    /**
     * ⛔ Mutazione M5, sopravvissuta: spostare il ramo degli aromi PRIMA della guardia del criterio
     * stretto. Il criterio che decide se un piatto si serve comincerebbe ad accettare tutto quello
     * che `eAroma` chiama aroma — e si allargherebbe in silenzio.
     */
    it('⛔ un aroma è riconosciuto SOLO dal largo: lo stretto non si allarga di nascosto', () => {
      expect(riconosce('sale e pepe', dz, 'largo')).toBe('aroma');
      expect(riconosce('sale e pepe', dz)).toBeNull();
    });

    it('⛔ ma non sa cosa c\'è dentro: «insalata di riso» passa e risulta SENZA allergeni', () => {
      // Due parole note, nessuna nell'elenco di un allergene → «non contiene niente». E un'insalata
      // di riso vera ha dentro tonno, uova e formaggio. È la ragione per cui il largo non decide.
      const e = deduci(ing('insalata di riso'), dz, 'largo');
      expect(e.ignoti).toEqual([]);
      expect(e.allergeni).toEqual([]);
    });

    it('e il criterio stretto, che è quello che decide, su quel nome si ferma', () => {
      expect(deduci(ing('insalata di riso'), dz).allergeni).toBeNull();
    });
  });

  describe('cosa cambierebbe rispetto a oggi', () => {
    it('⚠️ «guadagnati» sono gli allergeni che il piatto oggi NON dichiara', () => {
      expect(differenza(['glutine'], ['glutine', 'latte'])).toEqual({ guadagnati: ['latte'], persi: [] });
    });

    it('«persi» sono quelli dichiarati che dagli ingredienti non risultano', () => {
      expect(differenza(['latte', 'uova'], ['latte'])).toEqual({ guadagnati: [], persi: ['uova'] });
    });

    it('e su elenchi uguali non cambia niente, in qualunque ordine', () => {
      expect(differenza(['uova', 'latte'], ['latte', 'uova'])).toEqual({ guadagnati: [], persi: [] });
    });
  });

  describe('l\'indizio delle preparazioni', () => {
    it.each(['pesto pronto', 'Dado da brodo', 'sugo al ragù', 'petto di pollo impanato', 'tonno in scatola'])(
      '«%s» sembra una preparazione', (n) => expect(sembraPreparazione(n)).toBe(true),
    );

    /**
     * ⛔ Mutazione M2, sopravvissuta: togliere `normalizzaNome` dal confronto. I casi qui sopra non
     * se ne accorgevano, perché in «Dado da brodo» e «sugo al ragù» c'è **un'altra** parola
     * minuscola e senza accento che fa scattare la regex lo stesso. Servono i nomi in cui l'unica
     * parola che conta è quella con la maiuscola o l'accento.
     */
    it.each(['Ragù di manzo', 'Petto di pollo IMPANATO', 'RAGU alla bolognese'])(
      '⛔ «%s» — maiuscole e accenti non fanno sparire l\'indizio', (n) => expect(sembraPreparazione(n)).toBe(true),
    );

    it.each(['zucchine', 'petto di pollo', 'olio extravergine di oliva', 'ricotta'])(
      '«%s» no', (n) => expect(sembraPreparazione(n)).toBe(false),
    );
  });
});
