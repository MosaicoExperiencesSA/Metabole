/**
 * ⛔ **SPEGNERE UNA RIGA NELLA PAGINA PERMESSI NON SEMPRE CHIUDE LA PORTA — e finora non lo diceva
 * nessuno.**
 *
 * Trovato il 2/9 dalla revisione avversariale sull'ereditarietà. Non è un difetto del codice: è il
 * progetto: `PAGE_GRANTS` esiste apposta perché «bastino poche voci di menu per gestire tutto», e
 * `INHERIT_DEFAULTS` esiste apposta perché «separare una schermata non tolga accesso a nessuno».
 * Il difetto è che la **schermata** non lo dice, e chi la usa non può indovinarlo.
 *
 * Il caso, con nomi veri: Simone spegne **Ricette** alla nutrizionista. Lei continua a chiamare le
 * API delle ricette, perché ha **Gestione dieta** (`diet_workspace`), e quell'hub concede
 * `diets_catalog` **+ `recipes`**. Dalla schermata sembra spento. Non lo è.
 *
 * ⚠️ E c'è un secondo verso, più frequente e altrettanto muto: una **figlia senza riga** vale la
 * riga del **genitore**. Nella tabella la cella appare spenta — `serverCell` rende `false` quando
 * la riga manca — mentre lato server la pagina è aperta. Chi guarda la matrice legge «no» dove il
 * guardiano risponde «sì».
 *
 * ⛔ **Questo file non cambia NIENTE di quello che succede**: risponde alla domanda «perché questa
 * cella è aperta lo stesso?» con la **stessa** regola del guardiano — riga propria, default
 * esplicito, riga del genitore, default, e infine gli hub — perché *se più punti rispondono alla
 * stessa domanda, uno deve chiamare gli altri*. Cambiare il significato di «spento» (una negazione
 * esplicita che batte l'hub) è l'altra strada, e **va decisa da Simone**: oggi «spento» vuol dire
 * «non te lo do io», non «non ce l'hai».
 */
import { catenaDeiGenitori, Permesso, permessoEffettivo, Provenienza } from './eredita-dal-genitore';

/** Il livello della domanda: le due caselle della matrice. */
export type Livello = 'view' | 'manage';

/** Da dove arriva davvero il permesso di una cella. */
export interface Via {
  provenienza: Provenienza | 'hub';
  /** La chiave di PAGINA che lo concede, quando non è la cella stessa. */
  chiave?: string;
}

export interface Effettivo {
  view: boolean;
  manage: boolean;
  viaView: Via;
  viaManage: Via;
}

/**
 * Gli hub che concedono una chiave: il rovescio di `PAGE_GRANTS`, che è scritto hub → concesse.
 *
 * ⚠️ L'ordine è quello di `PAGE_GRANTS`, e serve che sia stabile: la pagina scrive «aperta da
 * Gestione dieta» e due caricamenti non devono nominare due hub diversi per la stessa cella.
 */
export function hubCheConcedono(
  pageKey: string,
  concessioni: Readonly<Record<string, readonly string[]>>,
): string[] {
  return Object.entries(concessioni)
    .filter(([, concesse]) => concesse.includes(pageKey))
    .map(([hub]) => hub);
}

export interface Ingredienti {
  genitoreDi: Readonly<Record<string, string>>;
  concessioni: Readonly<Record<string, readonly string[]>>;
  /** Le righe che il GUARDIANO legge: quelle del ruolo di base, per un ruolo personalizzato. */
  rigaDi: (pageKey: string) => Permesso | null | undefined;
  defaultDi: (pageKey: string) => Permesso | null | undefined;
  nonEreditano?: ReadonlySet<string>;
  defaultEsplicitoDi?: (pageKey: string) => Permesso | null | undefined;
  /**
   * ⛔ **IL GUARDIANO NON LEGGE LA COLONNA CHE SI VEDE, PER UN RUOLO PERSONALIZZATO.**
   *
   * `UsersService.resolveRole` scrive nella colonna `role` dell'utente il **`baseRole`** e tiene la
   * chiave personalizzata a parte (`customRoleKey`). Quindi `page.guard.ts` cerca
   * `role_page_permission` con **«nutritionist»**, non con «nutritionist_junior»; `/me/permissions`
   * — da cui il backoffice costruisce il menu — usa invece `customRoleKey ?? role`. È scritto in
   * `common/ruoli-nutrizionista.ts` dal 22/8: *«per un ruolo personalizzato l'API si apre e la voce
   * di menu no»*.
   *
   * ⚠️ Per la pagina Permessi vuol dire che sulla colonna di un ruolo personalizzato **ogni**
   * casella può mentire: si spegne «Ricette» a «Nutrizionista junior», la voce di menu sparisce, e
   * le API restano aperte perché il guardiano guarda la riga di «Nutrizionista». Senza questo, la
   * pagina avrebbe **garantito silenzio** proprio sulla colonna dove è più facile sbagliarsi — e
   * tacere in modo credibile è peggio che tacere.
   */
  ruoloDelGuardiano?: string;
  /** Le righe che la TABELLA disegna, quando non sono quelle che il guardiano legge. */
  rigaMostrata?: (pageKey: string) => Permesso | null | undefined;
}

/**
 * ⛔ **La risposta vera del guardiano, livello per livello.**
 *
 * `page.guard.ts` prova prima la chiave (con la sua catena di genitori e i default), e **solo se
 * quella dice no** prova gli hub — separatamente per `view` e per `manage`. Qui si fa lo stesso: un
 * hub che concede `view` ma non `manage` deve comparire su una casella sola, altrimenti la pagina
 * direbbe a Simone che la nutrizionista può *modificare* le ricette quando può solo vederle.
 */
export function permessoDavvero(pageKey: string, ing: Ingredienti): Effettivo {
  const opzioni = { nonEreditano: ing.nonEreditano, defaultEsplicitoDi: ing.defaultEsplicitoDi };
  /**
   * ⛔ **Il ruolo NON è un parametro di questa funzione**, ed è una correzione, non una svista.
   * C'era, e serviva solo come etichetta dentro la `Decisione` che poi si butta: una mutazione che
   * lo sostituiva con una costante **sopravviveva a tutte le prove**. Il ruolo entra da dove deve —
   * dentro `rigaDi` e `defaultDi`, che il chiamante costruisce già legati a un ruolo — e così quella
   * mutazione non si può nemmeno scrivere. È la stessa nota che `eredita-dal-genitore` si era già
   * dato: *un parametro che non cambia nessuna risposta è un invito a sbagliarsi.*
   */
  const diretto = permessoEffettivo('', pageKey, ing.genitoreDi, ing.rigaDi, ing.defaultDi, opzioni);
  const via: Via = diretto.genitore
    ? { provenienza: diretto.provenienza, chiave: diretto.genitore }
    : { provenienza: diretto.provenienza };

  const perLivello = (livello: Livello): { aperto: boolean; via: Via } => {
    const acceso = livello === 'view' ? diretto.canView : diretto.canManage;
    if (acceso) return { aperto: true, via };
    /**
     * ⛔ **L'admin non passa di qui.** Nel guardiano `role === 'admin'` risponde sì prima di
     * qualunque lettura: dirgli «aperta da Gestione dieta» sarebbe una spiegazione sbagliata di un
     * accesso che ha per un altro motivo. Chi chiama questo modulo tratta l'admin a parte.
     */
    for (const hub of hubCheConcedono(pageKey, ing.concessioni)) {
      const suHub = permessoEffettivo('', hub, ing.genitoreDi, ing.rigaDi, ing.defaultDi, opzioni);
      const apertoDaHub = livello === 'view' ? suHub.canView : suHub.canManage;
      if (apertoDaHub) return { aperto: true, via: { provenienza: 'hub', chiave: hub } };
    }
    return { aperto: false, via };
  };

  const v = perLivello('view');
  const m = perLivello('manage');
  return { view: v.aperto, manage: m.aperto, viaView: v.via, viaManage: m.via };
}

/**
 * ⛔ **LA SOLA COSA CHE LA PAGINA DEVE MOSTRARE: le celle in cui l'interruttore dice una cosa e il
 * server ne fa un'altra.**
 *
 * Non tutte le celle: un avviso su ogni riga non è un avviso. Solo quelle dove la casella che si
 * **vede** è spenta — riga spenta, o riga assente, che nella tabella si disegnano uguali — e il
 * guardiano risponde **sì**.
 *
 * ⛔ **I casi sono TRE, non due**, e il commento che ne dichiarava due è stato corretto in
 * revisione: l'**hub**, la **figlia che eredita**, e il **ruolo di base** che il guardiano legge al
 * posto di quello personalizzato.
 *
 * ⚠️ **Il quarto — la riga che non è mai stata creata — si conta ma non si segnala cella per
 * cella.** `syncDefaults` crea le righe all'avvio, quindi è uno stato transitorio; ma se
 * l'avvio è andato storto (`onModuleInit` assorbe il proprio errore con un `warn`) sono **decine**
 * per ruolo — misurate in revisione: 52 per la nutrizionista, 33 per la coach. Riempire la tabella
 * di badge gialli spegnerebbe l'unico segnale che la pagina ha; e in quel caso il badge non
 * saprebbe nemmeno cosa consigliare, perché il valore che vale sta **nel codice** e non c'è nessun
 * permesso su cui agire da questa schermata. Si dice una volta, con un numero, in cima.
 */
export interface CellaApertaLoStesso {
  role: string;
  pageKey: string;
  livello: Livello;
  /**
   * ⚠️ **Il tipo è largo quanto `Via`, `'riga propria'` compresa, anche se lì non ci arriva mai**:
   * una cella con una riga propria si disegna accesa, quindi non passa il cancello sopra.
   * Restringerlo qui costava un secondo `continue` che diceva la stessa cosa del primo — e i due
   * insieme facevano **sopravvivere** una prova di mutazione. Meglio un tipo largo e un cancello
   * solo che due cancelli e un tipo stretto: chi legge sa qual è la regola.
   */
  provenienza: Via['provenienza'] | 'ruolo di base';
  /** La chiave di PAGINA che concede (hub, o genitore). */
  chiave?: string;
  /** La chiave di RUOLO che il guardiano legge davvero, quando non è quella della colonna. */
  ruolo?: string;
}

export interface ConteggioPorte {
  celle: CellaApertaLoStesso[];
  /**
   * Quante caselle sono aperte solo perché **la riga non esiste** e il default del ruolo è acceso.
   * Non stanno in `celle`: si dicono con un numero (vedi sopra).
   */
  senzaRiga: number;
}

export function celleApertePurEssendoSpente(
  role: string,
  pagine: readonly string[],
  ing: Ingredienti,
): ConteggioPorte {
  const celle: CellaApertaLoStesso[] = [];
  let senzaRiga = 0;
  const disegna = ing.rigaMostrata ?? ing.rigaDi;
  /** ⚠️ Vero solo per un ruolo personalizzato: per i ruoli di sistema `baseRole` coincide con la chiave. */
  const altroRuolo = !!ing.ruoloDelGuardiano && ing.ruoloDelGuardiano !== role;

  for (const pageKey of pagine) {
    const riga = disegna(pageKey);
    const eff = permessoDavvero(pageKey, ing);
    for (const livello of ['view', 'manage'] as Livello[]) {
      /**
       * ⚠️ **Quello che la casella MOSTRA**, non quello che la riga vale: la pagina disegna `false`
       * anche quando la riga non c'è. Se qui si guardasse il permesso e non il disegno, la figlia
       * senza riga — il caso più frequente — non comparirebbe mai.
       */
      const disegnata = livello === 'view' ? !!riga?.canView : !!riga?.canManage;
      const davvero = livello === 'view' ? eff.view : eff.manage;
      if (disegnata || !davvero) continue;
      /**
       * ⛔ **UN CANCELLO SOLO, e la mutazione l'ha dimostrato.** Qui c'era anche
       * `if (via.provenienza === 'riga propria') continue`, e una prova di mutazione — «segnala
       * anche le celle già accese» — è **sopravvissuta**: non perché la prova fosse debole, ma
       * perché i due controlli dicevano la stessa cosa. Due cancelli ridondanti misurati insieme
       * nascondono che uno dei due non serve.
       */
      const via = livello === 'view' ? eff.viaView : eff.viaManage;

      /**
       * ⛔ **Il default si conta PRIMA di tutto il resto, ruolo personalizzato compreso.** Se la
       * porta è aperta solo perché la riga non esiste, non c'è niente su cui agire — né su questa
       * colonna né su quella di base — e un ruolo personalizzato senza righe produrrebbe da solo
       * cinquanta badge. La regola è la stessa per tutte le colonne: *un avviso su ogni riga non è
       * un avviso.*
       */
      if (via.provenienza === 'default') { senzaRiga += 1; continue; }
      /**
       * ⛔ **Il ruolo diverso spiega tutto il resto, quindi viene subito dopo.** Se il guardiano
       * legge un'altra riga, dire «aperta da Gestione dieta» sarebbe vero a metà e manderebbe a
       * spegnere l'hub sulla colonna sbagliata: quello che va detto è *quale riga sta leggendo*.
       */
      if (altroRuolo) {
        celle.push({ role, pageKey, livello, provenienza: 'ruolo di base', ruolo: ing.ruoloDelGuardiano });
        continue;
      }
      celle.push({ role, pageKey, livello, provenienza: via.provenienza, chiave: via.chiave });
    }
  }
  return { celle, senzaRiga };
}

/** Riesportata perché la pagina disegna anche il verso diretto: «questa riga apre anche…». */
export { catenaDeiGenitori };
