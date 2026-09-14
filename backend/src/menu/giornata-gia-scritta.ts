/**
 * ⛔ **QUELLO CHE C'È GIÀ SCRITTO IN UN GIORNO, RIMESSO NELLA SCHERMATA CHE LO RISCRIVE.**
 *
 * Richiesta di Simone (14/9): *«se scelgo un giorno già erogato dovrebbe comparire il menu
 * esistente, così se il nutrizionista deve modificare solo uno dei pasti non perde tutto il
 * resto»*. Fino a oggi «Scrivi il menu a mano» si apriva **vuota** anche sopra un giorno pieno: per
 * cambiare la cena bisognava ricomporre anche colazione e pranzo, cercandoli nel catalogo uno per
 * uno. ⚠️ E non è solo lavoro in più: è **lavoro che si può sbagliare**. Ricomporre a memoria una
 * giornata che il motore aveva bilanciato vuol dire rimetterci dentro un piatto diverso da quello
 * che la cliente aveva — cioè cambiarle due pasti credendo di cambiarne uno.
 *
 * ## ⛔ Si ripropone il PIATTO, non il verdetto di allora
 *
 * Dentro `meals` ci sono anche `name` e `kcal` di quando il giorno è stato scritto. Riusarli
 * sarebbe la scorciatoia sbagliata per la stessa ragione per cui il `POST` non si fida del browser:
 * **il verdetto è del server, e va rifatto adesso**. Fra la scrittura e oggi la cliente può aver
 * dichiarato un'allergia, la ricetta può aver cambiato calorie, nome o pasto, o essere sparita dal
 * catalogo. Perciò da qui esce solo **quale ricetta in quale pasto** (più il motivo di una
 * forzatura già scritta), e chi chiama la rilegge dal database.
 *
 * ⚠️ Conseguenza voluta: un piatto che **oggi** è incompatibile torna in schermata **barrato**, e
 * il salvataggio resta fermo finché non si scrive perché lo si serve lo stesso. Ricomporre la
 * giornata a mano ottiene la stessa cosa; questo modulo toglie la fatica, non i controlli.
 *
 * ## ⛔ Un pasto che non si può riproporre NON sparisce in silenzio
 *
 * È la parte che si sbaglia senza accorgersene. Se la ricetta della cena non è più in catalogo e la
 * riga semplicemente non compare, chi apre legge «Cena · da scegliere» e conclude che quel giorno
 * la cena non ce l'avesse — mentre ce l'aveva, e adesso non c'è più. Perciò ogni scarto esce con il
 * **nome** di quello che c'era e il **perché**, e la schermata lo dice.
 */

/** Un pasto come sta scritto dentro `MenuDay.meals`, ridotto a quello di cui ci si può fidare. */
export interface PastoGiaScritto {
  slot: string;
  recipeId: string;
  /**
   * ⚠️ **Il nome di allora, e serve a una cosa sola: NOMINARE quello che non si può riproporre.**
   * Non entra mai nella riga riproposta — lì il nome lo rilegge il server — ma senza di lui lo
   * scarto direbbe «un piatto non è più in catalogo», che è esattamente l'informazione inutile.
   */
  nome: string;
  /** Il motivo della forzatura scritto quando il pasto è stato salvato, se c'era. */
  forzatoPerche?: string;
}

/** Il verdetto di oggi su una ricetta, come lo rende il servizio (`valutate`). */
export interface VerdettoRicetta {
  recipeId: string;
  nome: string;
  kcal: number;
  slot: string;
  bloccata: boolean;
  motivoBlocco: string | null;
  nelPool: boolean;
  regimeAmmesso: boolean;
}

/** Una riga pronta da rimettere nella schermata, nella stessa forma di quelle della ricerca. */
export interface RigaRiproposta {
  slot: string;
  recipeId: string;
  nome: string;
  kcal: number;
  bloccata: boolean;
  motivoBlocco: string | null;
  fuoriDalPaniere: boolean;
  forzatoPerche?: string;
}

/** Un pasto che c'era e che oggi non si può rimettere: **con il nome e il perché**. */
export interface PastoNonRiproposto {
  slot: string;
  nome: string;
  perche: string;
}

const pulita = (t?: unknown): string => String(t ?? '').trim();

/**
 * I pasti scritti dentro `meals`, ridotti a `{slot, recipeId}` più il motivo di una forzatura.
 *
 * ⚠️ **Legge sia i giorni del motore sia quelli scritti a mano**, ed è voluto: Simone ha chiesto
 * «un giorno **già erogato**», che quasi sempre vuol dire composto dal motore. Le due forme
 * condividono `{slot, recipeId, name, kcal}`; `scrittaAMano` ce l'ha solo la seconda, e quando
 * manca semplicemente non c'è nessun motivo da riportare.
 */
export function pastiGiaScritti(meals: unknown): PastoGiaScritto[] {
  const righe = Array.isArray(meals) ? meals : [];
  const fuori: PastoGiaScritto[] = [];
  for (const r of righe) {
    const p = (r ?? {}) as { slot?: unknown; recipeId?: unknown; name?: unknown; scrittaAMano?: { forzatoPerche?: unknown } };
    const slot = pulita(p.slot);
    const recipeId = pulita(p.recipeId);
    /**
     * ⛔ **Un pasto senza `recipeId` non si ripropone e non si nomina come scarto.** Capita sui
     * giorni vecchi e sui pasti «liberi»: non è un piatto che si è perso, è una riga che non ha mai
     * indicato una ricetta. Dirlo come scarto vorrebbe dire allarmare su niente a ogni apertura.
     */
    if (!slot || !recipeId) continue;
    const perche = pulita(p.scrittaAMano?.forzatoPerche);
    fuori.push({
      slot,
      recipeId,
      nome: pulita(p.name) || recipeId,
      ...(perche ? { forzatoPerche: perche } : {}),
    });
  }
  return fuori;
}

/**
 * ⛔ **Le righe da rimettere in schermata, e quelle che oggi non si possono rimettere.**
 *
 * Il criterio è uno solo, e non è «cosa c'era»: **una riga si ripropone solo se il salvataggio la
 * accetterebbe**. Precompilare la schermata con un piatto che il `POST` poi rifiuta sarebbe il
 * difetto che questa schermata ha già avuto una volta — la casella «tutto il catalogo» che
 * prometteva una scelta e il server che rispondeva 400 sul salvataggio — solo peggiorato, perché
 * qui la riga non l'ha scelta nessuno: ce l'ha messa il programma, e chi salva scoprirebbe di
 * doverla togliere senza sapere perché c'era.
 *
 * ⚠️ Perciò gli scarti sono **gli stessi cancelli di `scrivi` e `controllaGiornata`**, letti in
 * anticipo: ricetta sparita, pasto cambiato in catalogo, pasto che la sua giornata non ha più,
 * regime non ammesso fuori dal paniere, due piatti sullo stesso pasto.
 */
export function riproponiGiornata(
  esistenti: readonly PastoGiaScritto[],
  verdetti: ReadonlyMap<string, VerdettoRicetta>,
  slotAttesi: readonly string[],
): { righe: RigaRiproposta[]; nonRiproposti: PastoNonRiproposto[] } {
  const righe: RigaRiproposta[] = [];
  const nonRiproposti: PastoNonRiproposto[] = [];
  const attesi = new Set(slotAttesi ?? []);
  const slotPresi = new Set<string>();

  for (const p of esistenti ?? []) {
    const v = verdetti.get(p.recipeId);
    /** ⛔ Spenta, cancellata, o un id che non esiste più: `scrivi` risponderebbe 400. */
    if (!v) {
      nonRiproposti.push({ slot: p.slot, nome: p.nome, perche: 'non è più in catalogo' });
      continue;
    }
    /**
     * ⛔ **La giornata di questa cliente può essere cambiata sotto.** Un digiuno acceso, una dieta
     * cambiata, uno spuntino tolto: lo slot che allora c'era oggi non è fra quelli attesi, e
     * `controllaGiornata` direbbe «"morning_snack" non è un pasto della sua giornata».
     */
    if (!attesi.has(p.slot)) {
      nonRiproposti.push({ slot: p.slot, nome: v.nome, perche: 'la giornata di questa cliente non ha più questo pasto' });
      continue;
    }
    /** ⚠️ In catalogo la ricetta può essere stata spostata di pasto: il server rifiuterebbe. */
    if (v.slot !== p.slot) {
      nonRiproposti.push({ slot: p.slot, nome: v.nome, perche: `in catalogo adesso è un piatto da ${v.slot}` });
      continue;
    }
    /**
     * ⛔ **Il regime, e solo fuori dal paniere** — è lo stesso cancello di `scrivi`, con la stessa
     * eccezione: dentro al pool non si richiede, perché quelle ricette sono già state scelte per
     * lei. Ripeterlo qui più stretto vorrebbe dire far sparire dalla riproposta un piatto che il
     * salvataggio accetterebbe.
     */
    if (!v.nelPool && !v.regimeAmmesso) {
      nonRiproposti.push({ slot: p.slot, nome: v.nome, perche: 'è di un regime che questa cliente non mangia' });
      continue;
    }
    /**
     * ⚠️ **Due piatti sullo stesso pasto.** È un difetto del giorno di prima, non di questa
     * lettura; ma riproposto tale e quale darebbe una schermata che **non si può salvare**
     * («lunch ha 2 piatti: uno per pasto») senza che si capisca da dove arriva. Si tiene il primo e
     * si dice del secondo.
     *
     * ⛔ **E l'altro doppione di `controllaGiornata` — lo stesso piatto due volte nella giornata —
     * qui non ha bisogno di un controllo suo, e scriverlo sarebbe un ramo morto**: in catalogo una
     * ricetta ha **un solo** `mealSlot`, quindi la seconda comparsa o cade sullo stesso slot (e la
     * ferma la riga qui sotto) o cade su un altro (e l'ha già fermata il controllo dello slot).
     * Una prima stesura ce l'aveva, e nessuna prova poteva renderlo rosso.
     */
    if (slotPresi.has(p.slot)) {
      nonRiproposti.push({ slot: p.slot, nome: v.nome, perche: 'questo pasto aveva due piatti: si tiene il primo' });
      continue;
    }
    slotPresi.add(p.slot);
    righe.push({
      slot: p.slot,
      recipeId: v.recipeId,
      /** ⛔ Nome, kcal e verdetto sono quelli di **oggi**, non quelli scritti dentro `meals`. */
      nome: v.nome,
      kcal: v.kcal,
      bloccata: v.bloccata,
      motivoBlocco: v.motivoBlocco,
      fuoriDalPaniere: !v.nelPool,
      /**
       * ⚠️ **Il motivo della forzatura si riporta** — se non tornasse, chi riapre un giorno con un
       * piatto forzato dovrebbe riscriverlo da capo per poter salvare, e il secondo motivo non
       * sarebbe più quello che era stato deciso: sarebbe quello che si ricorda oggi.
       *
       * ⛔ Ma vale solo se il piatto è **ancora** bloccato: un motivo scritto sotto un piatto che
       * oggi non ha più niente contro sarebbe una forzatura raccontata e mai avvenuta, e finirebbe
       * nel registro come tale.
       */
      ...(v.bloccata && p.forzatoPerche ? { forzatoPerche: p.forzatoPerche } : {}),
    });
  }

  return { righe, nonRiproposti };
}
