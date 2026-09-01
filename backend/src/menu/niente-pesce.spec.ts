/**
 * ⛔ **«NIENTE PESCE» DEVE VOLER DIRE NIENTE PESCE — il caso Lorena Polidoro, 23/8.**
 *
 * Regola «niente pesce» sulla cliente, e le arrivano prima un branzino e poi un tonno. Il suo
 * problema vero era a monte (la regola non era arrivata al profilo), ma guardando l'elenco del
 * motore con la tabella delle specie davanti mancavano **trenta pesci** che nei menu si scrivono
 * col loro nome: un'aringa, un nasello, una spigola passavano il filtro di chiunque avesse escluso
 * «pesce» — e nessuno se ne sarebbe accorto finché non lo raccontava una cliente.
 *
 * ⚠️ Questi test passano da `hitsExclusion`, che è **la porta da cui passa il motore vero**
 * (`una-porta-per-le-esclusioni.spec.ts` tiene fermo che sia l'unica): provare l'elenco con un
 * `includes` scritto qui sarebbe l'ottava copia del confronto, quella che i difetti li nasconde.
 */
import { exclusionKeys, expandExclusion, hitsExclusion, recipeHaystack } from './exclusions';

/** Il filtro esattamente come lo monta il motore per chi ha escluso «pesce». */
const CHIAVI = exclusionKeys(['pesce']);
const colpisce = (piatto: string): string | null => hitsExclusion(recipeHaystack(piatto, []), CHIAVI);

describe('⛔ «pesce» prende i pesci che si chiamano col loro nome', () => {
  /** ⛔ I due arrivati a Lorena. Erano già in elenco: questo test è la pietra sopra. */
  it('⛔ branzino e tonno: il caso da cui è nato tutto', () => {
    expect(colpisce('Branzino al forno con patate')).toBeTruthy();
    expect(colpisce('Insalata di riso con tonno')).toBeTruthy();
  });

  it.each([
    'Filetto di aringa marinata',
    'Nasello al vapore con zucchine',
    'Cernia in umido',
    'Spigola alla griglia',
    'Trancio di verdesca ai ferri',
    'Spiedini di palamita',
    'Dentice al sale',
    'Scorfano in guazzetto',
    'Triglia alla livornese',
    'Anguilla alla brace',
    'Filetto di persico dorato',
    'Vitello tonnato',
    'Sushi misto',
    'Tilapia al forno con erbe',
    'Frittura di paranza',
    'Burro all\'acciuga su crostini',
    'Storione affumicato',
    'Filetto di platessa impanato',
    'Pangasio al limone',
    'Carpa in porchetta',
  ])('⛔ «%s» viene fermato', (piatto) => {
    expect(colpisce(piatto)).toBeTruthy();
  });

  /** ⚠️ E i plurali, che passano dalla radice: la lezione di «mandorla/mandorle» (20/8). */
  it('⚠️ anche al plurale: sardine, triglie, aringhe', () => {
    expect(colpisce('Sardine a beccafico')).toBeTruthy();
    expect(colpisce('Triglie al pomodoro')).toBeTruthy();
    expect(colpisce('Aringhe affumicate')).toBeTruthy();
  });

  /** ⛔ Il pesce che non si chiama pesce: conserve e derivati. */
  it('⛔ stoccafisso, bottarga, surimi e colatura sono pesce', () => {
    expect(colpisce('Stoccafisso alla vicentina')).toBeTruthy();
    expect(colpisce('Spaghetti alla bottarga')).toBeTruthy();
    expect(colpisce('Insalata con surimi')).toBeTruthy();
    expect(colpisce('Linguine con colatura di alici')).toBeTruthy();
  });

  /** ⚠️ I composti «pesce X» li prende la parola stessa: spada, gatto, san pietro, azzurro. */
  it('⚠️ «pesce spada» e «zuppa di pesce» cadono sulla parola «pesce»', () => {
    expect(colpisce('Pesce spada alla siciliana')).toBe('pesce');
    expect(colpisce('Zuppa di pesce')).toBe('pesce');
  });
});

describe('⛔ e NON porta via i piatti innocenti', () => {
  /**
   * ⛔ **«carpa» sta dentro «carpaccio»**, e il carpaccio di manzo non è pesce. È il primo uso vero
   * delle omonime (`PAROLE_CHE_NON_SONO`) su una chiave nuova: la chiave e la sua omonima sono nate
   * insieme, così il falso non è mai esistito. ⚠️ E il carpaccio DI pesce resta fermato lo stesso,
   * perché si chiama sempre col nome del pesce.
   */
  it('⛔ il carpaccio di manzo passa, quello di branzino no', () => {
    expect(colpisce('Carpaccio di manzo con rucola e grana')).toBeNull();
    expect(colpisce('Carpaccio di branzino agli agrumi')).toBeTruthy();
  });

  /** ⛔ E le omonime non aprono buchi: l'orata VERA resta fermata, come la carpa vera. */
  it('⛔ «orata alla griglia» e «filetto di carpa» restano fermati', () => {
    expect(colpisce('Orata alla griglia con limone')).toBe('orata');
    expect(colpisce('Filetto di carpa in porchetta')).toBe('carpa');
  });

  it.each([
    // «fragolino» (il pagello) è rimasto FUORI apposta: la radice avrebbe preso le fragoline.
    'Fragoline di bosco con panna',
    // «cappone» è rimasto fuori: è anche il pollo di Natale.
    'Cappone ripieno alle castagne',
    // «sarda» è rimasta fuori: sta dentro «alla sarda». Restano «sarde» e «sardine».
    'Malloreddus alla sarda',
    // «carpione» è rimasto fuori: «in carpione» è anche una marinatura di verdure.
    'Zucchine in carpione',
    // «rombo» ha l'omonima «stromboli».
    'Pizza stromboli con salame',
    /**
     * ⛔ **«razza» e «sarde» sono state TOLTE dall'elenco in revisione**, con lo stesso criterio con
     * cui erano già rimasti fuori «cappone» e «carpione»: «razza chianina» e «razza piemontese» sono
     * carne, e «sarde» è un prefisso di «Sardegna». ⚠️ Contro questi due le omonime non potevano
     * niente — non sono parole che *contengono* la chiave, sono la chiave con un altro significato —
     * e nemmeno l'inizio di parola. La razza di mare resta scoperta: è il prezzo, ed è il verso
     * giusto (un pesce raro in meno vale meno di una bistecca tolta a tutti). Le sardine restano.
     */
    'Tagliata di razza piemontese',
    'Pane carasau della Sardegna',
    'Culurgiones di Sardegna',
    // ⚠️ Le omonime della RADICE, che prima del 23/8 erano impossibili da dichiarare.
    'Palombacci alla ghiotta',
    'Trigliceridi a catena media nell\'olio MCT',
    'Insalata di gallinelle e songino',
    'Pesca persica sciroppata',
    'Scolatura di verdure grigliate',
    /**
     * ⛔ **«orata» sta dentro OGNI participio femminile in «-orata»**, ed era in elenco da prima del
     * 23/8: un falso positivo in produzione da settimane. La prima correzione fu un elenco di otto
     * omonime, e la revisione l'ha smontato con «insaporata» — la famiglia è **aperta**, un elenco
     * chiuso non la chiuderà mai. Ora vale la regola giusta: `SOLO_A_INIZIO_PAROLA`.
     */
    'Torta decorata con frutta',
    'Cipolla dorata in agrodolce',
    'Vellutata colorata di verdure',
    'Ricotta insaporata al limone',
    'Carne marinata e insaporata con erbe',
    'Zuppa ristoratrice della nonna',
  ])('⚠️ «%s» resta nel piatto', (piatto) => {
    expect(colpisce(piatto)).toBeNull();
  });

  /**
   * ✅ **IL COSTO NOTO È STATO PAGATO — 1/9.** Questa prova fissava il contrario: la radice di
   * «ricciola» (`ricciol`) prendeva anche i «riccioli» — la pasta, i riccioli di burro — e il
   * commento diceva *«se questo test un giorno dà fastidio, la strada è insegnare le omonime anche
   * alla radice, non togliere la ricciola»*.
   *
   * ⛔ **Il giorno è arrivato, e non da un fastidio: da un danno.** «Torta di Riso Integrale con
   * Ricotta e Cicoria Amara Cruda (ricciolina)» stava per essere riscritta **pescetariana** dentro
   * un blocco di 549 correzioni automatiche di `regime:contenuto`. Il costo non era più un piatto
   * tolto a chi esclude il pesce: era un'etichetta sbagliata scritta in catalogo per sempre.
   *
   * ⚠️ **La strada è quella che il commento indicava**, non un'altra: le omonime dichiarate sulla
   * chiave `ricciola`. La ricciola vera non si è mossa, ed è la seconda metà di questa prova —
   * senza, questa sarebbe una prova che toglie soltanto.
   */
  it('✅ i «riccioli» non sono più fermati, e la ricciola sì', () => {
    expect(colpisce('Riccioli di pasta al pomodoro')).toBeNull();
    expect(colpisce('Insalata ricciolina')).toBeNull();
    expect(colpisce('Ricciola alla griglia')).toBeTruthy();
    expect(colpisce('Filetto di ricciola')).toBeTruthy();
  });

  /**
   * ⛔ **E LA VIA D'USCITA ADESSO ESISTE DAVVERO.** Il commento qui sopra, nella prima stesura,
   * diceva «la strada è insegnare le omonime anche alla radice» — e quella strada **non esisteva**:
   * il giro della radice non guardava `PAROLE_CHE_NON_SONO`, quindi per ogni chiave con una radice
   * viva le omonime erano strutturalmente impossibili. Un'istruzione che manda a sbattere chi la
   * segue è peggio di nessuna istruzione. L'ha trovato la revisione; questo test tiene ferma la
   * strada, così la prossima persona che la legge la trova aperta.
   */
  it('⛔ le omonime valgono anche per la RADICE, non solo per la parola intera', () => {
    // `palombo` → radice `palomb`, che comincia «palombaccio»: senza le omonime sulla radice, un
    // piatto di palombacci sarebbe pesce.
    expect(colpisce('Palombacci alla ghiotta')).toBeNull();
    // E il palombo vero resta fermato, radice compresa: «palombi» non è in elenco, ci arriva da lì.
    expect(colpisce('Palombo in umido')).toBe('palombo');
    expect(colpisce('Palombi in guazzetto')).toBe('palombo');
  });
});

describe('⚠️ le forme con cui «pesce» arriva scritto', () => {
  it('⚠️ «pesci», «pesce azzurro» e «fish» espandono come «pesce»', () => {
    for (const forma of ['pesci', 'pesce azzurro', 'fish']) {
      expect(expandExclusion(forma)).toEqual(expect.arrayContaining(['tonno', 'nasello', 'aringa']));
    }
  });

  /**
   * ⚠️ **Il conto delle voci, perché un pezzo d'elenco non sparisca in un merge senza che nessuno
   * se ne accorga** — è già successo oggi, su altri file. Non pinna le parole una per una (le
   * aggiunte legittime non devono far rosso qui): tiene fermo l'ordine di grandezza.
   */
  it('⚠️ l\'elenco del pesce ha almeno 60 voci', () => {
    expect(expandExclusion('pesce').length).toBeGreaterThanOrEqual(60);
  });
});
