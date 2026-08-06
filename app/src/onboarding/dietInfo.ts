/**
 * Spiegazioni dei TIPI di alimentazione, per il "?" accanto al nome in registrazione
 * (richiesta Simone 5/8, voce #5).
 *
 * Sono volutamente diverse dalla descrizione del prodotto che il nutrizionista scrive nel
 * catalogo: quella racconta *quel* percorso, questa spiega *quel modo di mangiare* — cos'è,
 * cosa cambia in pratica, cosa dice la ricerca e a chi conviene parlarne prima.
 *
 * FONTI (agosto 2026), tutte istituzionali o accademiche:
 *  - Harvard T.H. Chan School of Public Health — The Nutrition Source, "Diet Reviews"
 *    (Mediterranean Diet, Ketogenic Diet for Weight Loss), "Low-Carbohydrate Diets", "Protein".
 *  - Mayo Clinic — "Mediterranean diet for heart health", "Low-carb diet", "High-protein diets:
 *    are they safe?".
 *  - NHLBI — "DASH Eating Plan" (scheda DASH).
 *  - Klein & Kiat, "Detox diets: a critical review" (J Hum Nutr Diet 2015) e consenso BDA (scheda Detox).
 *  - National Weight Control Registry (schede estive).
 *
 * REGOLA: ogni STILE pubblicato e visibile alla cliente deve avere qui la sua scheda, altrimenti
 * il "?" accanto al nome sparisce e la cliente resta senza spiegazione (successo il 6/8 con
 * DASH, Flessibile, Detox e i due percorsi estivi). Quando il nutrizionista pubblica una dieta
 * con un codice stile nuovo, la scheda si aggiunge qui. `fonti` per scheda quando le fonti sono
 * diverse da quelle generali.
 *
 * Regole di scrittura, da rispettare se si aggiungono altri stili:
 *  - niente promesse di risultati e niente numeri di chili;
 *  - si dice sempre anche il rovescio della medaglia, non solo i pregi;
 *  - non è consulenza medica: si rimanda alla nutrizionista, che qui c'è davvero.
 */
export interface DietInfo {
  titolo: string;
  cose: string;
  inPratica: string;
  cosaDiceLaRicerca: string;
  attenzione: string;
  /** Fonti specifiche di QUESTA scheda: se assenti valgono quelle generali (DIET_INFO_FONTI). */
  fonti?: string[];
}

export const DIET_INFO: Record<string, DietInfo> = {
  mediterranean: {
    titolo: 'Mediterranea',
    cose:
      'Il modo di mangiare tradizionale dei paesi che si affacciano sul Mediterraneo. Non è una dieta "da fare per un periodo": è uno schema alimentare, e infatti è quello su cui esiste più ricerca al mondo.',
    inPratica:
      'Tanta verdura, frutta, legumi, cereali integrali, frutta secca. Olio d\'oliva come grasso principale. Pesce e pollame con regolarità, carne rossa e dolci di rado. Latticini in quantità moderate.',
    cosaDiceLaRicerca:
      'È associata a un rischio più basso di malattie cardiovascolari e di diabete di tipo 2. È anche lo schema che le persone abbandonano meno spesso, perché non elimina interi gruppi di alimenti: la sostenibilità nel tempo conta quanto la composizione.',
    attenzione:
      'Poche controindicazioni. Attenzione solo alle porzioni dei grassi, olio compreso: sono sani ma calorici, e in un percorso di dimagrimento la quantità conta.',
  },
  protein: {
    titolo: 'Proteica',
    cose:
      'Uno schema in cui la quota di proteine è più alta della media, a scapito soprattutto dei carboidrati raffinati. Non significa mangiare solo carne: le proteine arrivano anche da pesce, uova, legumi, latticini.',
    inPratica:
      'Una fonte proteica a ogni pasto, verdura in abbondanza, carboidrati presenti ma controllati e possibilmente integrali.',
    cosaDiceLaRicerca:
      'Le proteine saziano più di carboidrati e grassi, e questo aiuta a mangiare meno senza contare le calorie. Durante un dimagrimento aiutano a difendere la massa muscolare, che è la parte che non si vorrebbe perdere. Conta anche da dove arrivano: le fonti vegetali e il pesce hanno un profilo migliore rispetto alle carni lavorate.',
    attenzione:
      'Se hai problemi ai reni o al fegato parlane con la nutrizionista prima di iniziare. Non è un invito a eliminare i carboidrati: servono, soprattutto se ti alleni.',
  },
  low_carb: {
    titolo: 'Low-carb',
    cose:
      'Una riduzione dei carboidrati rispetto a un\'alimentazione media, compensata da più proteine e più grassi. È una famiglia di schemi, non una regola unica: "poco" può voler dire cose molto diverse.',
    inPratica:
      'Si riducono pane, pasta, riso, patate e zuccheri; restano verdura, proteine e grassi buoni. I carboidrati non spariscono, si scelgono meglio e in quantità minori.',
    cosaDiceLaRicerca:
      'Nei primi mesi il calo di peso è spesso più rapido rispetto a una dieta a basso contenuto di grassi, ma a distanza di un anno o due le differenze tendono ad assottigliarsi: quello che pesa davvero è quanto si riesce a mantenere lo schema. Anche qui la qualità conta più della quantità: una low-carb costruita su verdure, pesce, frutta secca e olio d\'oliva è un\'altra cosa rispetto a una costruita su salumi e formaggi.',
    attenzione:
      'Le prime settimane possono portare stanchezza o mal di testa mentre il corpo si adatta. Se prendi farmaci per il diabete o per la pressione, la terapia potrebbe aver bisogno di aggiustamenti: parlane col medico prima di cominciare.',
  },
  keto: {
    titolo: 'Keto (chetogenica)',
    cose:
      'La versione più estrema della riduzione dei carboidrati: si scende così in basso che il corpo cambia carburante e comincia a usare i grassi producendo i "corpi chetonici". È uno schema terapeutico nato in ambito medico, non una moda alimentare.',
    inPratica:
      'Carboidrati ridotti al minimo, grassi come fonte principale di energia, proteine moderate. Pane, pasta, riso, patate, frutta zuccherina e dolci restano fuori. La verdura resta, scelta fra quelle meno zuccherine.',
    cosaDiceLaRicerca:
      'Nel breve periodo può produrre un calo di peso marcato e migliorare alcuni parametri metabolici. Sul lungo periodo gli studi di qualità sono pochi, ed è uno schema che molte persone faticano a mantenere. Se si sceglie, la qualità dei grassi fa una differenza grande: meglio olio d\'oliva, frutta secca, pesce e avocado che burro e insaccati.',
    attenzione:
      'Va fatta seguiti, e da noi lo sei. Non è indicata in gravidanza e allattamento, e va valutata con attenzione se hai problemi a reni, fegato, pancreas o cuore, o se prendi farmaci per il diabete. Nei primi giorni sono comuni stanchezza, mal di testa e irritabilità. Può inoltre risultare povera di fibre e di alcuni micronutrienti: è uno dei motivi per cui il percorso è supervisionato.',
  },
  dash: {
    titolo: 'DASH',
    cose:
      'Uno schema nato negli Stati Uniti per abbassare la pressione arteriosa (DASH sta per "approccio alimentare per fermare l\'ipertensione"). Non è una dieta dimagrante di suo: è un modo di mangiare studiato su un obiettivo preciso, e il calo di peso arriva se le porzioni sono calibrate.',
    inPratica:
      'Molta frutta e verdura, cereali integrali, latticini magri, legumi e frutta secca. Sale ridotto: è il punto centrale, e comprende il sale nascosto di salumi, formaggi stagionati, dadi, salse e cibi confezionati. Carne rossa, dolci e bibite zuccherate poco.',
    cosaDiceLaRicerca:
      'È uno degli schemi con più prove dirette su un esito misurabile: nei trial abbassa la pressione, e l\'effetto è maggiore quando si riduce anche il sodio. Assomiglia molto alla mediterranea, con più attenzione a sale e latticini magri.',
    attenzione:
      'Se prendi farmaci per la pressione, riducendo il sale la terapia potrebbe aver bisogno di un aggiustamento: parlane col medico. Se hai problemi renali, la quota di potassio va valutata da chi ti segue.',
    fonti: ['NHLBI — DASH Eating Plan', 'Harvard T.H. Chan School of Public Health — The Nutrition Source'],
  },
  flexible: {
    titolo: 'Flessibile',
    cose:
      'Uno schema bilanciato che non vieta nessun alimento: conta soprattutto il totale della giornata, non il singolo piatto. È pensato per chi ha già provato regimi rigidi e li ha abbandonati.',
    inPratica:
      'Pasti normali con una fonte proteica, verdura e una quota di carboidrati. Nessun cibo è "proibito": quello che di solito si toglie dalle diete qui si mette in conto e si sistema nel resto della giornata.',
    cosaDiceLaRicerca:
      'A parità di calorie, la composizione conta meno di quanto si pensi: quello che fa la differenza sul lungo periodo è la costanza. Gli schemi permissivi vengono abbandonati meno spesso, ed è il motivo principale per cui funzionano.',
    attenzione:
      '"Nessun divieto" non vuol dire "tutto uguale": se la maggior parte delle calorie arriva da cibi molto lavorati, sazi meno e la qualità della dieta si abbassa anche restando nei conti. La libertà chiede un po\' più di attenzione, non meno.',
  },
  detox: {
    titolo: 'Detossinante',
    cose:
      'Un reset breve, di una o due settimane, che sostiene il lavoro che fegato, reni e intestino fanno già da soli. Diciamolo chiaro: il corpo si depura per conto suo, e nessun alimento "elimina le tossine". Qui si tolgono i carichi inutili e si aggiungono verdura, fibra e acqua.',
    inPratica:
      'Tanta verdura, con crucifere (broccoli, cavoli) e foglie amare ogni giorno; fibra alta; molta acqua e tisane non zuccherate; alcol zero per tutta la durata; pochi zuccheri, poco sale, niente cibi ultra-processati e fritti. Le proteine restano adeguate. Poi si passa a uno schema di lungo periodo.',
    cosaDiceLaRicerca:
      'Le detox commerciali — succhi, digiuni, integratori "depurativi" — non hanno prove cliniche a sostegno: la revisione più citata sul tema è netta. Quello che ha prove è ciò che c\'è qui dentro: più fibra e verdura, più acqua, meno alcol e meno ultra-processati. È il motivo per cui questo percorso è costruito così e non come le detox che si leggono in giro.',
    attenzione:
      'È un periodo breve, non uno stile di vita, e non è mai un digiuno né una dieta di soli liquidi. Non è indicato in gravidanza e allattamento, con problemi di fegato o reni, o se hai avuto un disturbo del comportamento alimentare: in questi casi decide la nutrizionista.',
    fonti: ['Klein & Kiat — Detox diets: a critical review (J Hum Nutr Diet, 2015)', 'British Dietetic Association'],
  },
  summer_holiday: {
    titolo: 'Vacanza estiva',
    cose:
      'Non è una dieta dimagrante: è un piano di mantenimento pensato per il periodo in cui si è fuori casa. L\'obiettivo è difendere quello che hai ottenuto, senza restrizioni e senza sensi di colpa per una cena al ristorante.',
    inPratica:
      'Piatti freschi, freddi e trasportabili — spiaggia, viaggio, casa altrui. Molta acqua e alimenti ricchi d\'acqua. Porzioni consapevoli invece di tagli: le calorie restano attorno al fabbisogno, non sotto.',
    cosaDiceLaRicerca:
      'Chi mantiene il peso nel tempo, secondo i registri che seguono queste persone per anni, non lo fa con periodi di rigore alternati a sbandate: lo fa continuando a monitorarsi anche nei periodi facili. Le vacanze sono uno dei momenti in cui si riprende peso più spesso, e un piano leggero fa la differenza.',
    attenzione:
      'Non è pensato per farti dimagrire in vacanza: se è quello che cerchi, parlane con la nutrizionista e valutate un altro percorso. E se il peso sale, non è un fallimento: si rientra dopo, con calma.',
    fonti: ['National Weight Control Registry', 'Harvard T.H. Chan School of Public Health — The Nutrition Source'],
  },
  summer_return: {
    titolo: 'Rientro estivo',
    cose:
      'La ripartenza dopo le vacanze, fatta in due tempi: la prima settimana rimette ordine (sgonfiare, reidratare, sistemare gli orari di sonno e pasti), la seconda torna al ritmo pieno verso l\'obiettivo. Non è una dieta lampo per rimediare.',
    inPratica:
      'Settimana 1: verdure e fibra, meno sale, più acqua, movimento leggero, misure senza ansia. Settimana 2: porzioni standard e spinta piena. Mai digiuni né tagli drastici.',
    cosaDiceLaRicerca:
      'Buona parte di quello che segna la bilancia dopo una vacanza è acqua trattenuta, non grasso: ridurre il sodio e reidratare la fa rientrare in pochi giorni. Le ripartenze aggressive, invece, sono quelle che si abbandonano prima.',
    attenzione:
      'Se il rientro coincide con un periodo di stress o sonno scarso, dillo alla coach: il piano si adatta. Nessun percorso deve iniziare con la fame.',
    fonti: ['National Weight Control Registry', 'Harvard T.H. Chan School of Public Health — The Nutrition Source'],
  },
  keto_mediterranean: {
    titolo: 'Keto-Mediterranea',
    cose:
      'Una chetogenica costruita con la dispensa mediterranea: stessa riduzione drastica dei carboidrati, ma i grassi arrivano da olio d\'oliva, pesce azzurro, frutta secca e olive invece che da burro e insaccati. Non è un compromesso di marketing: in letteratura è studiata, anche su pazienti italiani con prediabete e diabete di tipo 2.',
    inPratica:
      'Verdure a basso contenuto di carboidrati in abbondanza, pesce e uova come proteine principali, olio d\'oliva come grasso di riferimento, formaggi e frutta secca con misura. Pane, pasta, riso, patate, legumi e frutta zuccherina restano fuori. Tutti ingredienti da supermercato: niente farine speciali, dolcificanti particolari o prodotti confezionati "keto".',
    cosaDiceLaRicerca:
      'Sulla chetogenica in generale vale quanto detto per la Keto: calo marcato nel breve periodo, pochi studi di qualità sul lungo. La differenza qui è la QUALITÀ dei grassi, che secondo la ricerca è ciò che più cambia gli esiti a parità di schema. E la reperibilità degli ingredienti, che non è un dettaglio: uno schema che si riesce a mantenere batte uno schema perfetto che si abbandona dopo tre settimane.',
    attenzione:
      'Resta una chetogenica: non è indicata in gravidanza e allattamento, e va valutata con attenzione con problemi a reni, fegato, pancreas o cuore, o se prendi farmaci per il diabete. Nei primi giorni sono comuni stanchezza e mal di testa. Essere seguita da una nutrizionista, in questo schema, non è un di più.',
  },
};

/** Fonti citate nel popup: mostrarle è parte del punto, non un dettaglio legale. */
export const DIET_INFO_FONTI = [
  'Harvard T.H. Chan School of Public Health — The Nutrition Source',
  'Mayo Clinic',
];
