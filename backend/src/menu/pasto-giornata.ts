/**
 * Forma del JSON `MenuDay.meals`: lo snapshot dei pasti di una giornata erogata.
 *
 * Sta in un file condiviso perché ora ci scrivono in due — il motore
 * (`menu.service.ts`) e la sostituzione concordata in chat con Gaia
 * (`sostituzione-chat.service.ts`) — e due definizioni della stessa struttura
 * divergono in silenzio: il giorno scritto da una diventa illeggibile all'altra.
 *
 * Nessuna dipendenza da Nest né da Prisma.
 */

/**
 * Una sostituzione annotata su un pasto. `from`/`to`/`reason` sono i tre campi storici e
 * restano obbligatori: i giorni già scritti in produzione hanno solo quelli e devono
 * continuare a leggersi senza migrazioni.
 *
 * Tutto il resto è opzionale e lo valorizza SOLO la sostituzione concordata in chat: serve
 * al nutrizionista per verificare i grammi dalla scheda cliente senza rileggere le chat
 * (`stato: 'da_verificare'` è ciò che rende la verifica una cosa che si può davvero fare).
 */
/**
 * ⛔ **QUANDO UN INGREDIENTE SI TOGLIE E BASTA.** Una sostituzione con questo `to` non è un
 * alimento: è l'assenza di un alimento — nasce dai solfiti (Simone, 24/8: «dove è previsto vino
 * semplicemente togliamo il vino»), e la riga si legge «vino bianco → si toglie (niente al suo
 * posto)».
 *
 * ⚠️ **Sta qui e non in `menu/solfiti.ts`** perché non la legge solo chi la scrive: la deve
 * riconoscere **chiunque trasformi una sostituzione in un ingrediente**. Senza,
 * `ingredientiEffettivi` la scriveva nel piatto come se fosse un cibo, e la cliente si ritrovava
 * nella lista della spesa una riga «si toglie (niente al suo posto) — 150 ml» e nella scheda
 * ricetta la stessa frase scalata ×1,8. È lo stesso difetto del 18/8 («Riso e lenticchie» nel
 * carrello), rientrato da una porta nuova — e l'ha trovato la revisione del 24/8.
 */
export const SOSTITUTO_ASSENTE = 'si toglie (niente al suo posto)';

export interface Substitution {
  from: string;
  to: string;
  reason: string;
  /** Quantità di partenza, come sta nella ricetta di catalogo. */
  fromQty?: number;
  /** Quantità del sostituto, quella che la cliente deve usare davvero. */
  toQty?: number;
  /** Unità della quantità di PARTENZA (g, ml, pz…). */
  unit?: string;
  /**
   * Unità del SOSTITUTO, quando è diversa da quella di partenza. Nasce da un difetto visto in una
   * conversazione vera dell'8/8: «70 ml di burro al posto di 70 ml di panna fresca». Il burro in
   * millilitri non esiste, e l'unità veniva copiata dall'ingrediente sostituito. Assente = la
   * stessa di `unit`, che è il caso normale.
   */
  unitA?: string;
  /**
   * Chi ha deciso il cambio. **Assente = il motore**, come è sempre stato — ed è la distinzione che
   * conta: le sostituzioni senza origine sono di sicurezza (allergeni, intolleranze, esclusioni) e
   * non sono scelte della cliente.
   *  - `chat`: concordata con Gaia;
   *  - `app`: chiesta col pulsante «Sostituisci» dentro il menu (12/8). Prima non si marcava, e
   *    quel cambio era indistinguibile da uno del motore.
   */
  origine?: 'chat' | 'app';
  /** Il motivo DICHIARATO dalla cliente (vedi `MOTIVI` in `sostituzione-chat.ts`). */
  motivo?: string;
  /**
   * Verifica del nutrizionista. Ogni cambio nato in chat parte `da_verificare`: senza
   * questo, verificare vorrebbe dire rileggere tutte le conversazioni.
   */
  stato?: 'da_verificare' | 'verificata' | 'corretta';
  /** Quando la nutrizionista l'ha guardata (ISO), e chi era. */
  verificataIl?: string;
  verificataDa?: string;
  /**
   * La nota della nutrizionista, quando corregge. La legge la cliente: è la differenza fra «il tuo
   * cambio è stato modificato» e «ho messo 30 g invece di 70 perché a pari grammatura le calorie
   * raddoppiavano». Senza la nota, una correzione è solo una cosa cambiata alle sue spalle.
   */
  nota?: string;
  /** Quando è stata concordata in chat (ISO). */
  concordataIl?: string;
  /** Il messaggio di chat in cui la cliente ha confermato: la conversazione è la prova. */
  messageId?: string;
  /**
   * Vero se la grammatura proposta era fuori scala ed è stata riportata a pari
   * grammatura dal controllo di plausibilità. Va mostrato al nutrizionista.
   */
  grammaturaCorretta?: boolean;
}

/**
 * Il piatto è stato CAMBIATO in chat (non un ingrediente: tutto il piatto).
 *
 * È un evento registrato, e non una semplice riscrittura di `recipeId`, per una ragione precisa
 * (requisito di Simone, 8/8): «i cambi vanno poi salvati nella scheda cliente e nel report di fine
 * mese». Se ci limitassimo a sovrascrivere il `recipeId`, in scheda e nel report non comparirebbe
 * mai niente — il piatto vecchio non lascerebbe traccia e nessuno saprebbe che c'è stato un cambio.
 *
 * Resta separato da `substitutions`, che sono gli scambi di **ingrediente**: mischiarli renderebbe
 * illeggibile l'elenco in scheda, dove la nutrizionista deve distinguere «ha cambiato l'olio» da
 * «ha cambiato la colazione».
 */
export interface CambioPiatto {
  /** Il piatto che c'era prima: senza questo il cambio è invisibile. */
  daRecipeId: string;
  daNome: string;
  daKcal: number;
  /** Che cosa aveva chiesto: proteico | leggero | veloce | diverso. */
  preferenza?: string;
  /** Chi ha deciso il cambio. Per ora solo la chat. */
  origine: 'chat';
  /** Come per le sostituzioni: nasce `da_verificare`, la nutrizionista lo ricontrolla. */
  stato: 'da_verificare' | 'verificata' | 'corretta';
  /** Quando la nutrizionista l'ha guardato (ISO), e chi era. */
  verificataIl?: string;
  verificataDa?: string;
  /** La nota della nutrizionista: la legge anche la cliente. Vedi `Substitution.nota`. */
  nota?: string;
  /** Quando è stato concordato (ISO). */
  concordataIl: string;
  /** Il messaggio in cui la cliente ha scelto: la conversazione è la prova. */
  messageId?: string;
}

export interface MealSnapshot {
  slot: string;
  recipeId: string;
  name: string;
  /**
   * ⚠️ LE KCAL SONO QUELLE CHE LA CLIENTE MANGIA, cioè **già scalate** dal moltiplicatore di
   * porzione quando ce n'è uno (voce 255, 18/8). Non è un dettaglio implementativo: l'app **non**
   * riceve il totale della giornata dal server, se lo somma da sola da queste righe
   * (`Home.tsx`, `Percorso.tsx` in due punti). Scrivere qui la porzione di catalogo e il fattore a
   * parte renderebbe sbagliati, in silenzio, tutti i totali di tre schermate — e i trenta punti che
   * leggono `m.kcal` continuerebbero a leggere un numero che non è più vero.
   */
  kcal: number;
  /**
   * Il moltiplicatore di porzione applicato a questo pasto. ⚠️ **Opzionale, assente = 1**: i giorni
   * scritti prima del 18/8 si rileggono senza migrazione, com'è già per `substitutions` e
   * `cambioPiatto`.
   */
  porzione?: number;
  /** Le kcal della porzione di catalogo, prima della scalatura. Servono a non perdere l'origine —
   *  e a poter rifare i conti quando il fabbisogno cambia. Assente = `kcal` non è stata scalata. */
  kcalBase?: number;
  substitutions?: Substitution[];
  /** Presente solo se il piatto è stato cambiato in chat. Vedi `CambioPiatto`. */
  cambioPiatto?: CambioPiatto;
  /**
   * ⛔ **IL PASTO È STATO SCELTO A MANO dalla scheda cliente** (3/9). Chi, quando, e — se la ricetta
   * era incompatibile — **perché è stata servita lo stesso**.
   *
   * ⚠️ **Dichiarato qui e non solo scritto dal servizio**, che è la correzione: finché non c'era, un
   * punto che ricostruisce un pasto tipizzato lo perdeva **senza un errore di compilazione**, ed è
   * già successo con `porzione` e `substitutions`. Un giorno che perde questo campo torna
   * cancellabile da «Rigenera menu», e il lavoro di una persona sparisce senza una parola.
   *
   * ⛔ Non è `Substitution.origine`: quello sta sulla singola sostituzione ed è `'chat' | 'app'`.
   */
  scrittaAMano?: {
    origine: 'nutrizionista';
    da: string;
    il: string;
    forzatoPerche?: string;
  };
}

/** Un ingrediente come sta in `Recipe.ingredients`. */
export interface IngredienteRicetta {
  name?: string;
  qty?: number;
  unit?: string;
}
