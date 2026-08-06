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
};

/** Fonti citate nel popup: mostrarle è parte del punto, non un dettaglio legale. */
export const DIET_INFO_FONTI = [
  'Harvard T.H. Chan School of Public Health — The Nutrition Source',
  'Mayo Clinic',
];
