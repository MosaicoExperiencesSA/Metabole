/**
 * ⛔ **UNA PAGINA FIGLIA VALE QUANTO LA RIGA VERA DEL GENITORE, NON QUANTO IL SUO DEFAULT.**
 *
 * `INHERIT_DEFAULTS` promette, testualmente, che *«separare una schermata nei Permessi non toglie
 * accesso a nessuno»*. La promessa non era mantenuta, e il modo in cui non lo era vale la pena
 * scriverlo per intero.
 *
 * L'ereditarietà girava **una volta sola, all'avvio, dentro `pages.ts`**, e girava sui
 * `DEFAULT_PERMISSIONS`, cioè sui default **del codice**. Poi i tre posti che risolvono un permesso
 * — `syncDefaults` quando crea la riga, e il guardiano e `ruoloPuo` quando la riga manca — leggevano
 * quegli stessi default. Quindi una figlia valeva il **default** del genitore, mai la sua **riga**,
 * che è la cosa che l'admin ha davvero deciso.
 *
 * I due versi, e il secondo è quello che fa male:
 *
 * · Simone aveva **acceso a mano** `diets_catalog` a un ruolo dove il default è spento: la figlia
 *   valeva spenta, e la pagina **spariva** a chi doveva averla. Questo si vede subito — qualcuno
 *   scrive «non trovo più la voce di menu».
 * · ⛔ Simone aveva **spento a mano** `diets_catalog` a un ruolo dove il default è acceso: la figlia
 *   valeva **accesa**, e la pagina **tornava** a chi era stata tolta. **Questo non lo vede nessuno**:
 *   non c'è un reclamo che segnala un accesso in più, e il permesso resta lì finché qualcuno non
 *   riguarda la matrice riga per riga.
 *
 * ⛔ **E LA PRIMA STESURA DELLA CORREZIONE (2/9) NE COPRIVA UNO DEI TRE.** Correggevo la creazione
 * della riga e lasciavo il difetto vivo **lato server**, dove conta di più: `page.guard.ts` e
 * `permesso-di-ruolo.ts` risolvono la riga mancante a tempo di richiesta, e ripiegavano sui default
 * arricchiti. Non era una finestra teorica: `onModuleInit` **assorbe** l'errore di `syncDefaults`
 * con un `warn`, quindi un singhiozzo del database all'avvio lascia un'istanza viva per sempre con
 * le righe mancanti. L'ha trovata la revisione avversariale, provandolo sul guardiano vero.
 *
 * ✅ **Adesso la regola è una sola** — `catenaDeiGenitori` — e la chiamano tutti e tre. *Se più
 * punti rispondono alla stessa domanda, uno deve chiamare gli altri.*
 *
 * ⚠️ **Non ripara il passato, previene il futuro.** Le righe già scritte non si toccano — sono
 * indistinguibili da una scelta dell'admin, e riscriverle sarebbe decidere al posto suo su permessi
 * che qualcuno potrebbe aver sistemato a mano nel frattempo.
 *
 * ⚠️ **È un'eredità sulla riga MANCANTE, non un legame.** Appena la figlia ha una riga sua, quella
 * comanda: se fosse un legame permanente, separare una schermata non servirebbe a niente — che è
 * l'esatto contrario del motivo per cui esiste `INHERIT_DEFAULTS`.
 */

/** Il permesso su una pagina: le due caselle della matrice. */
export interface Permesso {
  canView: boolean;
  canManage: boolean;
}

/**
 * ⛔ **Quanti genitori si risalgono, al massimo.**
 *
 * La guardia sui già-visti da sola non basta, e la prima stesura lo ha dimostrato al contrario: la
 * prova sul ciclo, tolta la guardia, **non faceva fallire la suite — la bloccava**. Il giro è
 * sincrono, tiene l'event loop, e il timeout di Jest non arriva mai a scattare. Una prova che
 * segnala un difetto **fermando la CI** invece di diventare rossa è peggio di nessuna prova.
 *
 * ⚠️ Dodici è largo dieci volte: le catene vere sono di uno.
 */
export const SALTI_MASSIMI = 12;

/**
 * Le chiavi da provare per un ruolo, in ordine: prima la pagina stessa, poi i suoi genitori. La
 * prima che ha una riga vera comanda.
 *
 * ⛔ **Una figlia che è anche «hub» (`PAGE_GRANTS`) NON eredita**, e va passata in `nonEreditano`.
 * `diet_workspace` e `creation_validation` sono figlie di `diets_catalog` **e** concedono
 * `diets_catalog` **+ `recipes`**: ereditare la riga del genitore darebbe loro di aprire una porta
 * che il genitore non apre — cioè la frase «non toglie **e non dà** accesso a nessuno» sarebbe
 * falsa proprio sulle due chiavi in cui la matrice ha un effetto lato server. Quelle nascono dal
 * loro default, che è la scelta prudente.
 *
 * ⚠️ E se qualcuno scrive un ciclo (`a: 'b', b: 'a'`) questo non gira all'infinito: si ferma e
 * resta la sola pagina di partenza. Un errore di battitura in una tabella di costanti non deve
 * bloccare l'avvio del backoffice — lo dice già `syncDefaults` a proposito dei doppioni.
 */
export function catenaDeiGenitori(
  pageKey: string,
  genitoreDi: Readonly<Record<string, string>>,
  nonEreditano: ReadonlySet<string> = new Set(),
): string[] {
  const catena = [pageKey];
  if (nonEreditano.has(pageKey)) return catena;
  const visti = new Set<string>([pageKey]);
  let corrente = genitoreDi[pageKey];
  let salti = 0;
  while (corrente && !visti.has(corrente) && salti < SALTI_MASSIMI) {
    visti.add(corrente);
    catena.push(corrente);
    salti += 1;
    /** ⚠️ Anche un genitore che è hub chiude la catena: da lì in su non si eredita più. */
    if (nonEreditano.has(corrente)) break;
    corrente = genitoreDi[corrente];
  }
  return catena;
}

/** Da dove è uscito quel permesso — serve al log, al registro e alle prove. */
export type Provenienza = 'riga propria' | 'riga del genitore' | 'default';

export interface Decisione extends Permesso {
  role: string;
  pageKey: string;
  provenienza: Provenienza;
  /** La chiave da cui si è ereditato, quando è successo. */
  genitore?: string;
}

/**
 * Il permesso EFFETTIVO di un ruolo su una pagina, con la stessa regola in tutti e tre i punti.
 *
 * `rigaDi` rende la riga in banca dati, o `null`. `defaultDi` rende il default del codice.
 *
 * ⛔ **Il default della FIGLIA vince sull'eredità, quando è scritto apposta.** È la precedenza che
 * il ciclo di `pages.ts` ha sempre avuto (`if (p && !perms[child])`), e la prima stesura la
 * rovesciava senza dirlo: guardava il genitore per primo, sempre. Oggi non si vedeva perché nessuna
 * delle dodici figlie ha un default suo — ma l'unico motivo per scriverne uno è renderlo **più
 * stretto** del genitore, e quella scelta sarebbe stata ignorata in silenzio. `defaultEsplicitoDi`
 * rende SOLO i default scritti a mano nel codice, non quelli sintetizzati dall'eredità.
 */
export function permessoEffettivo(
  role: string,
  pageKey: string,
  genitoreDi: Readonly<Record<string, string>>,
  rigaDi: (pageKey: string) => Permesso | null | undefined,
  defaultDi: (pageKey: string) => Permesso | null | undefined,
  opzioni: {
    nonEreditano?: ReadonlySet<string>;
    defaultEsplicitoDi?: (pageKey: string) => Permesso | null | undefined;
  } = {},
): Decisione {
  const propria = rigaDi(pageKey);
  if (propria) {
    return { role, pageKey, canView: !!propria.canView, canManage: !!propria.canManage, provenienza: 'riga propria' };
  }
  const esplicito = opzioni.defaultEsplicitoDi?.(pageKey);
  if (esplicito) {
    return { role, pageKey, canView: !!esplicito.canView, canManage: !!esplicito.canManage, provenienza: 'default' };
  }
  for (const chiave of catenaDeiGenitori(pageKey, genitoreDi, opzioni.nonEreditano).slice(1)) {
    const riga = rigaDi(chiave);
    if (riga) {
      return {
        role, pageKey, canView: !!riga.canView, canManage: !!riga.canManage,
        provenienza: 'riga del genitore', genitore: chiave,
      };
    }
    /**
     * ⚠️ **Il genitore senza riga non è «spento»: è «non ancora creato»**, e capita di continuo —
     * al primo avvio la banca dati è vuota. Fermarsi qui darebbe alla figlia un permesso più
     * stretto del genitore per un ordine di creazione, che è un difetto che dipende da come gira
     * il ciclo.
     */
  }
  const def = defaultDi(pageKey);
  return { role, pageKey, canView: !!def?.canView, canManage: !!def?.canManage, provenienza: 'default' };
}

/**
 * Le righe da creare per un ruolo, date le pagine che gli mancano.
 *
 * ⚠️ **L'ordine delle pagine non conta**: ogni riga si decide dalle righe **esistenti**, mai da
 * quelle appena messe in coda. Se contasse, due avvii con `BACKOFFICE_PAGES` in ordine diverso
 * darebbero due matrici diverse — e nessuno saprebbe quale delle due è quella giusta.
 */
export function righeDaCreare(
  role: string,
  pagineMancanti: readonly string[],
  genitoreDi: Readonly<Record<string, string>>,
  rigaDi: (pageKey: string) => Permesso | null | undefined,
  defaultDi: (pageKey: string) => Permesso | null | undefined,
  opzioni: {
    nonEreditano?: ReadonlySet<string>;
    defaultEsplicitoDi?: (pageKey: string) => Permesso | null | undefined;
  } = {},
): Decisione[] {
  return (pagineMancanti ?? []).map((pageKey) =>
    permessoEffettivo(role, pageKey, genitoreDi, rigaDi, defaultDi, opzioni));
}
