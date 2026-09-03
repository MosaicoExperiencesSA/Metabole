import { Role } from '../common/roles';

/**
 * Sezioni del backoffice. La matrice ruolo × pagina vive nella tabella
 * role_page_permission (default dal seed, modificabile dall'admin a runtime).
 */
/**
 * ⚠️ Una chiave qui dentro è una **promessa**: compare nella matrice dei permessi come interruttore, e
 * chi la accende crede di aver abilitato qualcosa. Perciò una chiave si aggiunge **insieme** alla
 * guardia che la legge (`@RequirePage`), non prima.
 *
 * Il 13/8 sono state togliete `engine_reviews` e `assignments`: dichiarate, con i loro valori di
 * default e la loro etichetta nel backoffice, e **senza nessuna guardia** che le leggesse. `assignments`
 * era la più insidiosa — l'assegnazione di una cliente passa da `POST /admin/assignments`, che è
 * `@Roles('admin')` e ignora la matrice: concedere «assignments» a una coordinatrice non le dava niente,
 * e nessun errore lo diceva. Se un domani si vuole che siano le coordinatrici ad assegnare, la chiave si
 * riaggiunge **e** si aggancia a quell'endpoint: è una decisione di prodotto, non una riga di elenco.
 *
 * Le righe già scritte in `role_page_permission` per quelle due chiavi restano a database e non fanno
 * niente: la guardia cerca per `pageKey`, e nessuno chiede più quei due.
 */
export const BACKOFFICE_PAGES = [
  'dashboard',
  'notifications',
  'posta',
  'clients',
  'diets_catalog',
  'recipes',
  'engine_protocols',
  'escalations',
  'visits_agenda',
  'chat',
  'health_documents',
  'crm_leads',
  'lead_acceptance',
  'marketing',
  'accounting',
  'accounting_costs',
  'purchases',
  'shop',
  'discounts',
  'commissions',
  'compensation',
  'users',
  'assign_coach',
  'assign_nutritionist',
  'engine_config',
  'engine_rules',
  'audit_logs',
  'permissions',
  'email_templates',
  'email_log',
  'pdf_templates',
  'charts',
  'withdrawals',
  // Schermate separate per una gestione granulare dei permessi (ereditano l'accesso dalla pagina "genitore").
  // Card «Conversazioni» nella scheda cliente: i thread (Gaia compresa) e i cambi di menu
  // concordati in chat. Separata da `chat` (la pagina) perché sono due decisioni diverse: chi legge
  // le chat dell'azienda e chi legge — e verifica — quelle di UNA cliente dalla sua scheda.
  // Richiesta di Simone dell'11/8: «la visibilità e la scrittura di questa parte devo poterla
  // abilitare dai permessi». `manage` = può confermare, correggere i grammi o annullare un cambio.
  'client_conversations',
  // La banca dati nutrizionale (11/8): l'elenco dei valori che Gaia cita alle clienti, e la coda di
  // quelli da confermare. È di chi risponde di cosa mangiano le clienti, quindi sta con la
  // nutrizionista e non con l'amministrazione.
  'nutrient_facts',
  // Le sostituzioni concordate con le clienti (§16.9, 12/8): la tabella trasversale, la coda di
  // quelle che nessuno ha ancora guardato, e «promuovi a regola». Chiave PROPRIA e non ereditata da
  // `client_conversations`: quella è «i cambi di UNA cliente dalla sua scheda», questa è «cosa
  // chiedono tutte» — e chi promuove una riga a gruppo di equivalenza cambia il MOTORE, non una
  // giornata di menu. `manage` = valida, corregge, scrive a mano, promuove.
  /**
   * **I PANIERI** (Fase 7 del piano panieri, 1/9): le 38 celle famiglia × regime, con quante
   * ricette hanno per pasto e la possibilità di aggiungerne o toglierne una.
   *
   * ⚠️ Chiave PROPRIA e non `diets_catalog`, che sarebbe stata la scelta comoda. Il paniere non è
   * una dieta: è **da dove arrivano i piatti di una cliente**, e chi lo tocca cambia quello che
   * arriva nel piatto di tutte le clienti di quella famiglia in un colpo solo. Legare le due
   * chiavi vorrebbe dire che chi propone una dieta può anche spostare il pool di tutte — e non si
   * potrebbero più separare senza un rilascio.
   *
   * ⛔ `manage` = aggiunge o toglie una ricetta da un paniere. La sola vista non tocca niente.
   */
  'panieri',
  /**
   * **IL MENU SCRITTO A MANO DALLA SCHEDA CLIENTE** (3/9). Dalla scheda si sceglie una data — una per
   * volta — e per ogni pasto si cerca nel catalogo, con la ricerca già filtrata sulle sue esclusioni.
   *
   * ⚠️ Chiave PROPRIA e non `clients`, che sarebbe stata la scelta comoda: aprire la scheda di una
   * cliente e **scriverle il menu** sono due poteri diversi. Chi scrive una giornata a mano decide
   * cosa mangia una persona per un giorno intero, saltando il motore, le sue soglie e i suoi
   * controlli — e quel giorno resta **intoccabile** anche da «Rigenera menu». Legarla a `clients`
   * vorrebbe dire che chiunque possa aprire una scheda possa anche fare questo, e non si
   * potrebbero più separare senza un rilascio.
   *
   * ⛔ `manage` = scrive la giornata, ed è **anche quello che accende il pulsante**: con la sola
   * vista non si vede niente. ⚠️ È una scelta, e la prima stesura del commento diceva il contrario
   * («la sola vista mostra la schermata»): non è vero, e una schermata di sola lettura qui non
   * servirebbe a niente — non c'è niente da leggere finché non si compone. Chi ha solo `view` passa
   * le due `GET` e non trova la porta: è coerente, ma va saputo.
   */
  'menu_a_mano',
  'food_swaps',
  /**
   * L'assistente della nutrizionista (Vera): la pagina «Assistente».
   *
   * ⚠️ Chiave PROPRIA e non `food_swaps`, che era la scelta di partenza. Il motivo tecnico —
   * moltiplicare le chiavi moltiplica i posti dove qualcuno dimentica di abilitare qualcosa — resta
   * vero, ma qui perde contro una regola di prodotto di Simone del 13/8: «tutte le pagine che
   * aggiungiamo vanno gestite nei permessi, sempre». E in concreto: `Assistente` e `Sostituzioni`
   * sono due VOCI DIVERSE nel menu, quindi con una chiave sola non si può dare l'una senza l'altra.
   * Gli altri riusi del repo (`clients`, `crm_leads`) sono un altro caso: stessa pagina, più
   * schermate.
   *
   * `manage` non è un di più: parlarci **scrive** — impara una famiglia, apre una proposta, mette
   * una regola sul profilo di una persona.
   */
  'nutri_assistant',
  // La tabella della copertura (11/8). Chiave PROPRIA e non agganciata a «Creazione e validazione»:
  // quella genera il catalogo, questa dice soltanto dove siamo — e sono due decisioni diverse, perché
  // guardare lo stato serve anche a chi non deve generare niente.
  'catalog_coverage',
  'crm_lead_new',       // Inserimento lead (da crm_leads)
  'crm_import',         // Import liste (da crm_leads)
  'crm_pipeline',       // Pipeline (da crm_leads)
  'crm_calendar',       // Calendario CRM (da crm_leads)
  'testimonials',       // Testimonianze (da marketing)
  'publisher',          // Publisher social (da marketing)
  'agents',             // Registro Agenti AI (nata da marketing, ma NON è fra le figlie di INHERIT_DEFAULTS)
  'coach_tasks',        // Attività coach (task generati dal cron: prova, fine piano)
  'equivalence_groups', // Gruppi di equivalenza (da diets_catalog)
  'allergens',          // Allergeni ricette (da recipes)
  'colazioni',          // Colazioni dolci/salate (da recipes) — Decisioni 13/8 §12
  'roles',              // Ruoli (da permissions)
  'creation_validation', // Pagina guidata Creazione e validazione
  'diet_workspace',      // Gestione dieta: hub ricette/allergeni/gruppi per dieta (da diets_catalog)
  'fix_measures',        // Correzione misure del cliente dalla scheda (flag dedicato, richiesta Simone)
  // ⚠️ Dal 28/8 copre anche `pathType` e `mealsPerDay`: erano scoperti, e una coach poteva mettere
  // una cliente a digiuno intermittente pur non potendola passare da vegetariana a vegana.
  'change_diet_type',    // Cambio del TIPO DI DIETA (regime, stile, famiglia, pasti, percorso/digiuno)
  /**
   * Modifica delle ALLERGIE dalla scheda cliente e dalla scheda lead (richiesta di Simone, 13/8).
   *
   * ⚠️ Flag suo, e non «Clienti: gestisci», per una ragione precisa: un'allergia è un **blocco
   * duro** (R8) e chi la tocca decide cosa la cliente non troverà mai nel piatto — e, al contrario,
   * cosa potrebbe trovarci. Fino a oggi le scriveva **un solo punto in tutto il codice**, l'upsert
   * del questionario; aprirle alla scheda senza un permesso dedicato vorrebbe dire darle a
   * chiunque abbia accesso ai clienti, coach comprese.
   *
   * Il senso è l'opposto: darle a chi può **codificare a mano** un'allergia scritta in testo
   * libero — cioè le nutrizioniste. Di default: `nutritionist`, `head_nutritionist`, `admin`.
   *
   * Le INTOLLERANZE restano dove sono (dentro «Clienti: gestisci»): sono già modificabili oggi,
   * anche dalla coach, e restringerle sarebbe una perdita di capacità che nessuno ha chiesto.
   */
  'change_allergies',
  /**
   * IL VIA LIBERA CLINICO dalla scheda cliente: «può proseguire» / «serve una visita» (13/8).
   *
   * È la risposta alla domanda di Simone — la nutrizionista non aveva un modo per dirci che ha
   * valutato una cliente e va bene così. Chiudere la segnalazione non bastava: dopo quattordici
   * giorni si riapre, e «risolta» non dice cosa ha deciso.
   *
   * Flag suo perché è una **valutazione clinica**, non una gestione della scheda: di default
   * `nutritionist`, `head_nutritionist`, `admin`.
   */
  'clinical_clearance',
  'change_plan_start',   // Cambio della DATA DI INIZIO del piano dalla scheda cliente (flag dedicato)
  // Quali pasti salta chi fa digiuno intermittente, dalla scheda cliente. Flag dedicato perché
  // cambia gli slot che il motore eroga: chi lo tocca decide se quella cliente domani mattina
  // avrà una colazione o no (richiesta di Simone del 10/8).
  'change_fasting_window',
  'set_client_password', // Imposta una password scelta per la cliente dalla scheda (flag dedicato)
  // «Entra come»: apre l'app con gli occhi di una cliente, in SOLA LETTURA (richiesta di Simone
  // dell'11/8: «il pulsante è visibile gestito dalla tabella permessi»). Prima era `@Roles('admin')`
  // fisso: la matrice non c'entrava niente e il pulsante nel backoffice si vedeva senza alcun
  // controllo. La guardia che legge questa chiave è su `POST /admin/impersonate`.
  'impersonate',
  /**
   * ANNULLARE UN ABBONAMENTO dalla scheda cliente (il × sulla pastiglia del piano).
   *
   * ⚠️ È nato `@Roles('admin')` il 17/8, «come lo storno e la cancellazione di un acquisto, che sono
   * i suoi vicini di casa per gravità». La gravità è giusta, il cancello no: chi gestisce i piani
   * ogni giorno è il **capo nutrizionista**, e dalla sua utenza il pulsante non si vedeva nemmeno.
   * Con `@Roles` fisso l'unica strada era entrare come admin — cioè fare la cosa grave con l'utenza
   * sbagliata, e nel registro resta scritto «admin» invece del nome di chi ha deciso.
   *
   * Flag suo e non dentro `purchases`: annullare un piano non è vendere né stornare. **Di default
   * resta solo l'admin**: gli altri li abilita Simone dalla tabella dei permessi, senza un rilascio.
   */
  'cancel_subscription',
  /**
   * ⛔ **LA MODALITÀ VIAGGIO — da quando sospende, sposta soldi** (23/8).
   *
   * Fino a stamattina quella card scriveva tre campi sul profilo, e `@Roles` di classe bastava.
   * Da oggi crea una sospensione vera: ferma i menu **e allunga la scadenza del piano** dei giorni
   * sospesi, riordinando anche la fila dei piani comprati in coda (`coda-che-slitta.ts`).
   *
   * ⚠️ Spostare la data di **inizio** di un piano ha una chiave sua (`change_plan_start`) e perfino
   * una conferma obbligatoria. Spostare la **fine** non ne aveva nessuna, e lo poteva fare chiunque
   * vedesse la scheda — `sales` compreso. Il cancello mancava dove c'è l'effetto.
   *
   * **Di default solo l'admin**: gli altri li abilita Simone dalla tabella dei permessi, senza un
   * rilascio. ⚠️ Vuol dire che al deploy la card sparisce a chi la usava: è voluto, ed è la prima
   * cosa da fare in Permessi dopo la pubblicazione.
   *
   * ⛔ **E le due caselle vogliono dire due cose diverse, dal 24/8.** Fino a ieri questa chiave
   * aveva una guardia sola (`manage` sulla PATCH) e la card in scheda si mostrava solo con
   * «Gestisce»: «Vede» spuntato da solo non accendeva niente — cioè esattamente il difetto
   * raccontato in testa a questo file, dentro una chiave che quel difetto lo citava. Adesso «Vede»
   * apre l'elenco delle sospensioni in **sola lettura** (`GET :id/sospensioni`, la domanda «perché a
   * questa cliente non arriva il menu?») e «Gestisce» apre il modulo che le crea e le toglie.
   */
  'travel_mode',
  /**
   * LA PAGINA «LAVORI» — l'elenco di cosa manca, con la spunta (13/8, richiesta di Simone).
   *
   * ⚠️ Chiave della matrice e non `@Roles('admin')` scritto nel codice, per la ragione raccontata in
   * testa a questo file: `assignments` era un interruttore acceso nei permessi che non apriva
   * niente, perché l'endpoint era inchiodato all'admin. Qui la chiave nasce **insieme** alla guardia
   * che la legge (`@RequirePage('dev_backlog')` su `/admin/lavori`).
   *
   * Default: **solo admin**. Il giorno che serve a qualcun altro si accende dalla tabella, senza
   * un rilascio.
   */
  'dev_backlog',
] as const;

export type PageKey = (typeof BACKOFFICE_PAGES)[number];

type Perm = { view?: true; manage?: true };

/**
 * ⛔ **PERCHÉ QUESTA CASELLA NON CHIUDE LA PORTA — la classificazione, nel codice.**
 *
 * `chiavi-senza-guardia.spec.ts` congela l'elenco delle chiavi che nessun `@RequirePage` legge:
 * il 3/9 erano **43 su 65**. ⚠️ Ma un elenco unico mette insieme cose diverse, e *mescolarle porta a
 * correggere quella sbagliata*: la casella «Nuovo lead» che non ha una guardia sua è una **scelta di
 * progetto** (l'API vera sta sotto `crm_leads`, che la guardia ce l'ha); la casella «Documenti
 * sanitari» che non ce l'ha è un **buco**, perché spegnerla toglie la voce di menu e lascia aperto
 * il `GET`.
 *
 * ⛔ Finché la differenza stava solo in una voce dei lavori, chi guardava la matrice non aveva modo
 * di saperla. Adesso sta qui — e la pagina Permessi la mostra, perché è l'unica informazione che
 * rende quella schermata leggibile: *una casella che sembra un cancello e non lo è va detta.*
 *
 * ⚠️ **Non è un permesso di più né di meno.** Questa tabella non cambia niente di quello che
 * succede: descrive. Il giorno che una di queste chiavi prende la sua `@RequirePage`, la riga
 * corrispondente si toglie — e la prova diventa rossa se non lo si fa.
 */
export type MotivoSenzaGuardia =
  /**
   * ⛔ **BUCO**: la casella sembra un cancello e non lo è, e dietro ci sono dati o poteri veri.
   * Spegnerla toglie la voce di menu e **non** chiude l'API, che è protetta dal solo `@Roles` — o da
   * niente. È il difetto di `assignments`, che `CLAUDE.md` racconta come chiuso.
   */
  | 'buco'
  /**
   * ⚠️ **FIGLIA**: l'API vera sta sotto la chiave del **genitore**, che una guardia ce l'ha. Qui la
   * casella è di interfaccia **per progetto** — serve a separare una schermata, non una porta.
   */
  | 'figlia'
  /**
   * ⚠️ **GRANTOR**: nessuna guardia sua, ma un effetto lato server ce l'ha lo stesso — è una chiave
   * di `PAGE_GRANTS`, e chi ce l'ha entra nelle API che concede. Spegnerla **chiude** qualcosa.
   */
  | 'grantor'
  /**
   * ⚠️ **INNOCUA**: schermata di sola lettura del proprio perimetro. Non c'è una porta da chiudere.
   */
  | 'innocua';

/**
 * ⚠️ **Una riga per ogni chiave senza guardia, e nessuna per quelle che ce l'hanno.** Le due
 * condizioni le tiene ferme `chiavi-senza-guardia.spec.ts`: una chiave che prende la sua guardia e
 * resta qui direbbe «è decorativa» di una casella che adesso comanda.
 */
export const MOTIVO_SENZA_GUARDIA: Readonly<Record<string, MotivoSenzaGuardia>> = {
  // ⛔ I BUCHI SU DATI SENSIBILI O POTERI FORTI. Sono quelli da chiudere per primi, uno per uno.
  audit_logs: 'buco',
  users: 'buco',
  permissions: 'buco',
  roles: 'buco',
  engine_config: 'buco',
  engine_protocols: 'buco',
  engine_rules: 'buco',
  health_documents: 'buco',
  escalations: 'buco',
  clinical_clearance: 'buco',
  chat: 'buco',
  posta: 'buco',
  accounting: 'buco',
  accounting_costs: 'buco',
  compensation: 'buco',
  commissions: 'buco',
  withdrawals: 'buco',
  discounts: 'buco',
  shop: 'buco',
  email_log: 'buco',
  email_templates: 'buco',
  pdf_templates: 'buco',
  // ⛔ Questi tre **cambiano dati clinici** e la casella non li ferma: la rotta è protetta dal solo
  //    elenco dei ruoli. `change_diet_type` in particolare è quella che il 28/8 è stata trovata
  //    accesa su `sales` senza che il codice l'avesse mai data.
  change_allergies: 'buco',
  change_diet_type: 'buco',
  change_fasting_window: 'buco',
  assign_coach: 'buco',
  assign_nutritionist: 'buco',
  lead_acceptance: 'buco',
  crm_leads: 'buco',

  // ⚠️ LE FIGLIE: l'API sta sotto la chiave del genitore, che la guardia ce l'ha.
  crm_lead_new: 'figlia',
  crm_import: 'figlia',
  crm_pipeline: 'figlia',
  crm_calendar: 'figlia',
  testimonials: 'figlia',
  publisher: 'figlia',
  allergens: 'figlia',
  colazioni: 'figlia',
  equivalence_groups: 'figlia',

  // ⚠️ I GRANTOR: nessuna guardia, ma spegnerli chiude le API che concedono.
  diet_workspace: 'grantor',
  creation_validation: 'grantor',

  // ⚠️ LE INNOCUE: sola lettura del proprio perimetro.
  dashboard: 'innocua',
  notifications: 'innocua',
  charts: 'innocua',
};

/**
 * Default della specifica (sez. 4):
 * - la coach NON vede note cliniche né documenti sanitari;
 * - il nutrizionista gestisce cartelle, protocolli, verifiche, televisite;
 * - il capo approva le diete nel catalogo e supervisiona il team;
 * - il commerciale vede CRM e incassi, mai dati sanitari clinici;
 * - l'admin gestisce utenti/parametri/contabilità ma NON i dati clinici.
 */
export const DEFAULT_PERMISSIONS: Record<Role, Partial<Record<PageKey, Perm>>> = {
  client: {},
  coach: {
    coach_tasks: { view: true, manage: true },
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    // `manage` sulla scheda cliente (9/8, richiesta delle coach): la coach cambia dieta,
    // numero di pasti e il resto dell'anagrafica delle SUE clienti. Prima poteva solo
    // guardare, e per spostare una cliente da 3 a 5 pasti doveva chiedere a qualcun altro —
    // cioè per fare il suo lavoro dipendeva da una persona che non conosce quella cliente.
    // La portata («solo le mie») è applicata nei servizi, non qui.
    clients: { view: true, manage: true },
    // Regime, stile, dieta — e dal 28/8 anche **pasti e percorso/digiuno**, che erano fuori dalla
    // guardia: è lo stesso motivo scritto qui sopra («per spostare una cliente da 3 a 5 pasti doveva
    // chiedere a qualcun altro»), quindi il default resta acceso. ⚠️ Chi invece questa casella non ce
    // l'ha, da oggi quei due campi non li tocca più — ed è il buco che si chiude.
    change_diet_type: { view: true, manage: true },
    // I pasti del digiuno: la coach li vede e li corregge, come il resto della scheda.
    change_fasting_window: { view: true, manage: true },
    crm_leads: { view: true, manage: true }, // pipeline: la coach sposta i clienti tra gli stati
    lead_acceptance: { view: true, manage: true }, // casella dei lead da accettare
    escalations: { view: true, manage: true },
    chat: { view: true, manage: true },
    // Le conversazioni di UNA cliente dalla sua scheda (thread + cambi concordati in chat). La coach
    // le LEGGE — le servono per capire come sta andando — ma di default non le verifica: la
    // grammatura di un piatto è materia clinica. Da qui in poi la decisione è di Simone in pagina
    // Permessi, non di un elenco di ruoli scritto nel codice (richiesta dell'11/8).
    client_conversations: { view: true },
    // I valori nutrizionali in sola lettura: le serve per sapere su che dato Gaia ha risposto a una
    // sua cliente. Correggerli no: è materia clinica.
    nutrient_facts: { view: true },
    // Le sostituzioni concordate: le LEGGE (sapere cosa chiedono le sue clienti è il suo lavoro),
    // non le valida e non le promuove — una regola che entra nel motore è materia clinica.
    food_swaps: { view: true },
    visits_agenda: { view: true },
    // Acquisti delle SUE clienti (11/8): il perimetro lo applica il servizio, non questa matrice —
    // qui c'è solo «può entrare nella pagina». Le azioni sui soldi restano admin.
    purchases: { view: true },
  },
  // Coordinatrice Coach: come una coach (le SUE clienti) + visibilità sul suo team
  // (la portata "propria + team" è applicata nei servizi, non qui).
  coach_coordinator: {
    coach_tasks: { view: true, manage: true },
    assign_coach: { view: true, manage: true }, // assegna i lead del SUO perimetro alle SUE coach

    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    clients: { view: true, manage: true },
    change_diet_type: { view: true, manage: true },
    change_fasting_window: { view: true, manage: true },
    crm_leads: { view: true, manage: true },
    lead_acceptance: { view: true, manage: true },
    escalations: { view: true, manage: true },
    chat: { view: true, manage: true },
    client_conversations: { view: true }, // legge, come la coach; la verifica resta clinica
    visits_agenda: { view: true },
    purchases: { view: true }, // gli acquisti del suo perimetro: lei + le coach del suo team
  },
  nutritionist: {
    /**
     * ⛔ **LE ATTIVITÀ CHE SOLO LEI PUÒ CHIUDERE** (22/8). Quattro tipi nascono addosso alla
     * nutrizionista — digiuno estremo, finestra non traducibile, pasti non serviti, calorie corte —
     * e dal 21/8 le arriva la push, con scritto «la trovi in Dashboard». Questa riga era spenta:
     * cliccava e prendeva 403. ⚠️ Vede **solo i suoi quattro tipi**, non l'elenco della coach: il
     * filtro è in `coach-tasks.service.ts`, non qui.
     */
    coach_tasks: { view: true, manage: true },
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    clients: { view: true, manage: true },
    fix_measures: { view: true, manage: true }, // corregge le misure inserite male dal cliente
    change_diet_type: { view: true, manage: true }, // cambia il tipo di dieta (regime/stile)
    // Legge e corregge le allergie: è l'unica che può tradurre un testo libero in codice UE.
    change_allergies: { view: true, manage: true },
    clinical_clearance: { view: true, manage: true }, // dice «può proseguire» o «serve la visita»
    change_fasting_window: { view: true, manage: true }, // e quali pasti salta nel digiuno
    diets_catalog: { view: true, manage: true }, // propone (l'approvazione resta al capo)
    /**
     * ⛔ **SCRITTE, non dedotte** (2/9). `diet_workspace` e `creation_validation` sono figlie di
     * `diets_catalog` in `INHERIT_DEFAULTS`, e fino a oggi il loro default nasceva dal ciclo che
     * arricchisce questa tabella. Ma sono anche **hub** (`PAGE_GRANTS`): concedono `diets_catalog`
     * **+ `recipes`**, cioè più di quello che il loro genitore concede, e per questo non ereditano
     * più la riga del genitore. Perché «non eredita» valga anche per il default — altrimenti la
     * regola sarebbe chiusa da una porta e aperta dall'altra — il default va scritto qui. ⚠️ È
     * esattamente quello che il ciclo produceva: nessun ruolo cambia permesso.
     */
    diet_workspace: { view: true, manage: true },
    creation_validation: { view: true, manage: true },
    // ⚠️ Vede i panieri ma non li tocca: proporre una dieta e spostare il pool di TUTTE le
    // clienti di una famiglia sono due poteri diversi. `manage` sta col capo.
    panieri: { view: true },
    recipes: { view: true, manage: true },
    engine_protocols: { view: true, manage: true },
    escalations: { view: true, manage: true },
    visits_agenda: { view: true, manage: true },
    chat: { view: true, manage: true },
    // `manage` = verifica i cambi concordati in chat: conferma, corregge i grammi, annulla.
    client_conversations: { view: true, manage: true },
    // I valori nutrizionali: li vede e li corregge. È il senso della pagina.
    nutrient_facts: { view: true, manage: true },
    // Le sostituzioni concordate con le clienti: è la SUA tabella. Valida, corregge, scrive righe a
    // mano e promuove a gruppo di equivalenza — che nasce comunque in bozza.
    food_swaps: { view: true, manage: true },
    // Stessi ruoli che l'assistente aveva via `food_swaps`: nessuno perde niente il giorno del rilascio.
    nutri_assistant: { view: true, manage: true },
    catalog_coverage: { view: true },
    health_documents: { view: true, manage: true },
    // ⚠️ È il suo mestiere: è lei che il 31/8 sarebbe uscita in cinque minuti da una cliente senza menu.
    menu_a_mano: { view: true, manage: true },
  },
  head_nutritionist: {
    // Come per la nutrizionista: le attività dei suoi quattro tipi. Vedi la nota qui sopra.
    coach_tasks: { view: true, manage: true },
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    clients: { view: true, manage: true },
    fix_measures: { view: true, manage: true },
    change_diet_type: { view: true, manage: true },
    change_allergies: { view: true, manage: true },
    clinical_clearance: { view: true, manage: true },
    change_fasting_window: { view: true, manage: true },
    diets_catalog: { view: true, manage: true }, // approvazione nel catalogo
    diet_workspace: { view: true, manage: true },
    creation_validation: { view: true, manage: true },
    panieri: { view: true, manage: true },
    recipes: { view: true, manage: true },
    engine_protocols: { view: true, manage: true },
    escalations: { view: true, manage: true },
    visits_agenda: { view: true, manage: true },
    chat: { view: true, manage: true },
    client_conversations: { view: true, manage: true },
    nutrient_facts: { view: true, manage: true },
    food_swaps: { view: true, manage: true },
    // Stessi ruoli che l'assistente aveva via `food_swaps`: nessuno perde niente il giorno del rilascio.
    nutri_assistant: { view: true, manage: true },
    catalog_coverage: { view: true },
    health_documents: { view: true, manage: true },
    menu_a_mano: { view: true, manage: true },
    assign_nutritionist: { view: true, manage: true }, // il capo nutrizionisti assegna il nutrizionista
    engine_config: { view: true },
    engine_rules: { view: true, manage: true }, // regole del motore: le gestisce SOLO il capo nutrizionista
    lead_acceptance: { view: true },
  },
  sales: {
    coach_tasks: { view: true, manage: true },
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    crm_leads: { view: true, manage: true },
    lead_acceptance: { view: true },
    accounting: { view: true }, // dashboard incassi/conversioni
    purchases: { view: true },
    assign_coach: { view: true, manage: true }, // Resp. Coach Team: assegna le coach
  },
  // Reparto Marketing (nessun accesso a dati sanitari): campagne, segmenti, KPI, consensi.
  marketing: {
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    crm_leads: { view: true }, // vede i lead (fonte/canale/campagna), non gestisce la pipeline clinica
    marketing: { view: true, manage: true },
    agents: { view: true },
  },
  head_marketing: {
    dashboard: { view: true },
    notifications: { view: true },
    posta: { view: true },
    charts: { view: true },
    crm_leads: { view: true, manage: true },
    marketing: { view: true, manage: true },
    agents: { view: true, manage: true },
    accounting: { view: true }, // budget/spesa marketing (dashboard incassi/conversioni)
    email_templates: { view: true, manage: true },
    email_log: { view: true },
  },
  admin: {
    dashboard: { view: true, manage: true },
    notifications: { view: true },
    posta: { view: true },
    clients: { view: true },
    diets_catalog: { view: true, manage: true },
    diet_workspace: { view: true, manage: true },
    creation_validation: { view: true, manage: true },
    panieri: { view: true, manage: true },
    recipes: { view: true, manage: true },
    engine_protocols: { view: true },
    escalations: { view: true, manage: true },
    visits_agenda: { view: true },
    chat: { view: true },
    // health_documents: nessun accesso di default (note cliniche riservate)
    crm_leads: { view: true, manage: true },
    lead_acceptance: { view: true },
    accounting: { view: true, manage: true },
    accounting_costs: { view: true, manage: true },
    purchases: { view: true, manage: true },
    shop: { view: true, manage: true },
    discounts: { view: true, manage: true },
    commissions: { view: true, manage: true },
    compensation: { view: true, manage: true },
    users: { view: true, manage: true },
    assign_coach: { view: true, manage: true },
    assign_nutritionist: { view: true, manage: true },
    engine_config: { view: true, manage: true },
    engine_rules: { view: true, manage: true }, // l'admin gestisce le regole del motore (oltre al capo nutrizionista)
    audit_logs: { view: true },
    permissions: { view: true, manage: true },
    email_templates: { view: true, manage: true },
    email_log: { view: true, manage: true },
    pdf_templates: { view: true, manage: true },
    charts: { view: true, manage: true },
    withdrawals: { view: true, manage: true },
    fix_measures: { view: true, manage: true },
    change_diet_type: { view: true, manage: true },
    change_allergies: { view: true, manage: true },
    clinical_clearance: { view: true, manage: true },
    change_fasting_window: { view: true, manage: true },
    change_plan_start: { view: true, manage: true }, // di default solo admin: gli altri li abilita Simone
    set_client_password: { view: true, manage: true }, // di default solo admin: gli altri li abilita Simone
    // Solo admin di default. Entrare nell'account di una cliente vuol dire vedere i suoi dati
    // sanitari: si concede a mano, a chi serve, dalla tabella dei permessi.
    impersonate: { view: true, manage: true },
    // Annullare un abbonamento: di default solo admin. Il capo nutrizionista lo abilita Simone
    // dalla tabella, ed è il motivo per cui questa chiave esiste (prima era `@Roles('admin')`).
    cancel_subscription: { view: true, manage: true },
    // La modalità viaggio: da quando sospende e allunga il piano, chiave sua. Solo admin di default.
    travel_mode: { view: true, manage: true },
    // La pagina «Lavori»: di default solo admin, come ha chiesto Simone.
    dev_backlog: { view: true, manage: true },
    menu_a_mano: { view: true, manage: true },
  },
};

/**
 * Le schermate "figlie" ereditano l'accesso della loro pagina "genitore", così separare una
 * schermata nei Permessi non toglie — e non **dà** — accesso a nessuno. L'admin può poi
 * differenziarle a runtime dalla UI Permessi.
 *
 * ⛔ **DUE EREDITARIETÀ, e il ciclo qui sotto è solo la prima.** Questo ciclo arricchisce i
 * `DEFAULT_PERMISSIONS` una volta sola, all'avvio, e riguarda i **default del codice**: serve
 * perché una figlia nuova abbia un default sensato quando il genitore non ha ancora una riga in
 * banca dati (il primo avvio, un ruolo appena creato).
 *
 * ⚠️ **Quella che conta la fa `syncDefaults`** (`permissions.service.ts`, modulo
 * `eredita-dal-genitore.ts`): quando crea la riga mancante di una figlia legge la **riga vera** del
 * genitore, cioè quello che l'admin ha davvero deciso, e ripiega su questi default solo se quella
 * riga non c'è.
 *
 * ⛔ Fino al 2/9 esisteva solo questo ciclo, e la promessa qui sopra era falsa nei due versi: a chi
 * aveva la pagina accesa **a mano** la figlia nasceva spenta, e — il verso che non si vede — a chi
 * l'aveva **spenta** a mano la figlia nasceva **accesa**, cioè la pagina tornava a chi era stata
 * tolta. Un accesso in più non lo segnala nessuno.
 */
/**
 * Pagine "hub": chi ha il permesso su di esse può usare anche le API dei domini
 * collegati, così un ruolo può gestire tutto da poche voci di menu senza vedere
 * le pagine dei singoli cataloghi. Es.: dando SOLO "Gestione dieta" +
 * "Creazione e validazione" al nutrizionista, gli editor diete/ricette/allergeni
 * dentro quegli hub funzionano lo stesso. (I gruppi di equivalenza non hanno
 * @RequirePage, bastano già col ruolo.)
 */
export const PAGE_GRANTS: Record<string, PageKey[]> = {
  diet_workspace: ['diets_catalog', 'recipes'],
  creation_validation: ['diets_catalog', 'recipes'],
};

/**
 * ⚠️ **Figlia e genitore sono tutti e due `PageKey`**: con la figlia `string` un errore di battitura
 * (`crm_pipelin: 'crm_leads'`) compilava, non ereditava niente e non lo diceva nessuno. Prima
 * costava un default, adesso costa un permesso.
 */
export const INHERIT_DEFAULTS: Partial<Record<PageKey, PageKey>> = {
  crm_lead_new: 'crm_leads',
  crm_import: 'crm_leads',
  crm_pipeline: 'crm_leads',
  crm_calendar: 'crm_leads',
  testimonials: 'marketing',
  publisher: 'marketing',
  equivalence_groups: 'diets_catalog',
  allergens: 'recipes',
  colazioni: 'recipes',
  roles: 'permissions',
  creation_validation: 'diets_catalog',
  diet_workspace: 'diets_catalog',
};

/**
 * ⛔ **I DEFAULT SCRITTI A MANO, PRIMA CHE L'EREDITÀ LI MESCOLI.**
 *
 * Il ciclo qui sotto arricchisce `DEFAULT_PERMISSIONS` con i default del genitore, e da lì in poi
 * «default della figlia» e «default del genitore» sono la stessa cosa e non si distinguono più.
 * Ma la precedenza che quel ciclo ha sempre avuto (`if (p && !perms[child])`) è che **il default
 * scritto apposta per la figlia vince**: l'unico motivo per scriverne uno è renderlo più stretto
 * del genitore, e senza questa copia quella scelta verrebbe ignorata in silenzio dall'eredità sulle
 * righe. Oggi nessuna delle dodici figlie ne ha uno — questa copia serve al giorno che ne avrà.
 */
export const DEFAULT_ESPLICITI: Record<string, Partial<Record<PageKey, Perm>>> =
  Object.fromEntries(
    (Object.keys(DEFAULT_PERMISSIONS) as Role[]).map((role) => [role, { ...DEFAULT_PERMISSIONS[role] }]),
  );

for (const role of Object.keys(DEFAULT_PERMISSIONS) as Role[]) {
  const perms = DEFAULT_PERMISSIONS[role];
  for (const [child, parent] of Object.entries(INHERIT_DEFAULTS) as [PageKey, PageKey][]) {
    const p = perms[parent];
    if (p && !perms[child]) perms[child] = { ...p };
  }
}

/**
 * ⛔ **Le pagine «hub» non ereditano**: concedono più di quello che il loro genitore concede.
 * `diet_workspace` e `creation_validation` sono figlie di `diets_catalog` e grantor di
 * `diets_catalog` **+ `recipes`** — ereditare la riga del genitore darebbe loro di aprire una porta
 * che il genitore non apre. Nascono dal loro default, che è la scelta prudente.
 */
export const NON_EREDITANO: ReadonlySet<string> = new Set(Object.keys(PAGE_GRANTS));
