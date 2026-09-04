import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { esclusioniDi, valutaRicetta, type EsclusioniCliente, type ProfiloConEsclusioni } from './esclusioni-della-cliente';
import { perimetroClienti } from '../common/perimetro-clienti';
import { REGIME_PIU_STRETTO, regimeConosciuto, regimiCompatibili } from '../common/regimi';
import { slotEsclusiTotali } from './finestre-digiuno';
import { RULE_CODE_ESCLUSIONI, terminiVietati } from '../vera/regola-dieta';
import { slotDaComporre } from './struttura-della-giornata';
import { controllaGiornata, pastiDaScrivere, type PastoAMano } from './giornata-scritta-a-mano';
import { KcalNeedService } from './kcal-need.service';
import { scrittaAMano } from '../vera/menu-da-rifare';
import { laClienteLHaAperto, nonSappiamoSeLHaAperto } from '../vera/menu-da-rifare';

/**
 * ⛔ **IL MENU SCRITTO A MANO DALLA SCHEDA CLIENTE** — la via d'uscita che il 31/8 non c'era.
 *
 * Il giudizio non sta qui: sta in `giornata-scritta-a-mano.ts`, che è puro e si prova. Qui c'è
 * quello che tocca la banca dati — leggere il pool, leggere il fabbisogno, scrivere la giornata.
 *
 * ## ⚠️ Le incompatibili si MOSTRANO, non si nascondono
 *
 * `poolDellaCliente` di Vera scarta le ricette che violano un'esclusione, e per lei è giusto: sta
 * abbinando una frase e non deve poter scegliere un piatto vietato. Qui no. Chi compone a mano deve
 * **vederle barrate col motivo**, perché a volte la ragione per servirle esiste — e in quel caso
 * deve scriverla. Nascondere una riga e nascondere un motivo sono la stessa cosa: chi non sa perché
 * un piatto non c'è, lo cerca.
 */
/**
 * ⚠️ **Quante ricette torna al massimo una ricerca.** Dentro il paniere non si tocca mai (sono
 * decine); fuori scatta a ogni ricerca corta, e per questo la risposta porta `troncato` **e** il
 * numero, così la schermata può dire quante ne ha in mano invece di lasciarlo intuire.
 */
const TETTO_RICERCA = 200;

@Injectable()
export class MenuAManoService {
  private readonly logger = new Logger(MenuAManoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kcalNeed: KcalNeedService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * ⛔ **IL PERIMETRO: si scrive il menu SOLO alle clienti proprie.**
   *
   * Il pulsante gemello sulla stessa card — «Rigenera menu» — passa da `assertClientAccess` in
   * prima riga. Questa rotta non lo faceva, e con `menu_a_mano: manage` (che è il **default** della
   * nutrizionista) si scriveva il menu di qualunque cliente del sistema — e si leggevano le sue
   * esclusioni, perché i motivi sono frasi come «contiene Crostacei (allergene dichiarato)».
   * `CLAUDE.md`: *«dati sanitari accessibili solo a cliente e suo nutrizionista»*. L'ha trovato una
   * revisione avversariale.
   *
   * ⚠️ Si passa da `perimetroClienti`, che è **la** regola del perimetro: una seconda copia qui
   * vorrebbe dire una coach che vede le clienti di un'altra il giorno che quella cambia.
   */
  private async perimetro(attoreId: string, clientId: string): Promise<void> {
    const scope = await perimetroClienti(this.prisma, attoreId);
    if (!scope) return;
    const prof = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;
    const assegnata = prof?.[scope.field] ?? null;
    if (!assegnata || !scope.staffIds.includes(assegnata)) {
      throw new ForbiddenException('Questa cliente non è assegnata a te.');
    }
  }

  /**
   * ⛔ **IL VERDETTO SU UNA RICETTA LO DÀ IL SERVER, SEMPRE.**
   *
   * La prima stesura leggeva `bloccata` e `motivoBlocco` **dal corpo del `POST`**, cioè dal
   * browser. Bastava mandare `{"bloccata": false}` su una ricetta vietata perché il piatto con
   * l'allergene finisse nel menu, senza avvisi, senza conferma e **senza traccia nel registro** —
   * che filtra le forzature proprio su quel campo. E `name` e `kcal` erano anch'essi del client:
   * `kcal` è il numero che l'app somma da sola in tre schermate.
   *
   * ⚠️ Il commento sopra `scrivi` diceva «il giudizio gira anche qui». Era vero per la struttura e
   * **falso sulla sicurezza**: il server non giudicava, ripeteva. L'ha trovato una revisione
   * avversariale, ed è il difetto che rendeva questa schermata più pericolosa dell'assenza che
   * voleva colmare. *Il client può proporre; non può certificare.*
   */
  private async valutate(clientId: string, recipeIds: readonly string[]) {
    const { esclusioni, ids, regimiAmmessi } = await this.contestoDi(clientId);
    const dentroIlPool = new Set(ids);
    const ricette = (await this.prisma.recipe.findMany({
      where: { id: { in: [...new Set(recipeIds)] }, active: true } as never,
      select: { id: true, name: true, kcal: true, mealSlot: true, ingredients: true, allergens: true, regime: true },
    })) as { id: string; name: string; kcal: number; mealSlot: string; ingredients: unknown; allergens?: string[]; regime?: string }[];
    return new Map(ricette.map((r) => [r.id, {
      ...this.giudica(r, esclusioni),
      nelPool: dentroIlPool.has(r.id),
      /**
       * ⛔ **Il cancello che sostituisce «dev'essere nel pool»** — e vale **solo fuori dal pool.**
       *
       * Fuori dal paniere si può servire — è la richiesta del 4/9 — ma non un piatto di un regime
       * che questa cliente non mangia: il pool non è più il confine, il regime sì, e si rilegge qui
       * invece di fidarsi di quello che la ricerca aveva mostrato.
       *
       * ⚠️ **Dentro al pool non si chiede niente**, ed è voluto: quelle ricette sono già state
       * scelte per lei quando la base è stata composta. Chiederglielo di nuovo vorrebbe dire che una
       * ricetta col regime scritto male in catalogo smetterebbe di essere salvabile per tutte le
       * clienti che ce l'hanno nel paniere — cioè una consegna che rompe quello che funzionava per
       * riparare quello che ancora non esisteva.
       */
      regimeAmmesso: (regimiAmmessi as readonly string[]).includes(String(r.regime ?? '').trim()),
    }]));
  }

  /** Il pool della cliente e le sue esclusioni: la coppia che serve a ogni domanda di questo file. */
  private async contestoDi(clientId: string): Promise<{ esclusioni: EsclusioniCliente; ids: string[]; dietIdDelPool: string | null; regimiAmmessi: readonly string[]; regimeCliente: string | null }> {
    const [pool, profilo] = await Promise.all([
      this.prisma.clientMenuPool.findFirst({
        where: { clientId } as never,
        orderBy: { version: 'desc' } as never,
        select: { recipeIds: true, dietId: true },
      }) as unknown as Promise<{ recipeIds: string[]; dietId: string } | null>,
      this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { allergies: true, intolerances: true, dislikedFoods: true },
      }) as unknown as Promise<ProfiloConEsclusioni | null>,
    ]);
    /**
     * ⛔ **I DIVIETI DELLA DIETA, che non venivano applicati.** «Nella mediterranea niente tonno»
     * (Vera §6.2) vive in `ProductRule` e il motore lo legge a parte da `esclusioniDi`. Qui non lo
     * leggeva nessuno: la schermata proponeva il tonno a una mediterranea che lo ha vietato.
     * ⚠️ Entrano come `extraDisliked`, cioè **non bloccanti**: sono una regola di prodotto, non
     * un'allergia, e chi compone deve poterli servire scrivendo perché — come per tutto il resto.
     */
    const vietatiDieta = pool?.dietId
      ? terminiVietati((await this.prisma.productRule.findMany({
        where: { dietId: pool.dietId, ruleCode: RULE_CODE_ESCLUSIONI } as never,
        select: { ruleCode: true, enabled: true, params: true },
      })) as { ruleCode: string; enabled: boolean; params: unknown }[])
      : [];
    /**
     * ⛔ **I REGIMI CHE QUESTA CLIENTE PUÒ RICEVERE — e la risposta non è mai «tutti».**
     *
     * ⚠️ Trovato da una revisione avversariale il 4/9, prima della consegna. La prima stesura
     * filtrava sul regime **solo se** riusciva a leggerlo: `dietIdDelPool ? {regime: …} : {}`. Ma
     * `dietIdDelPool` è nullo esattamente per la cliente che non ha ancora un pool — che è **la**
     * cliente per cui si esce dal paniere. Cioè: cliente vegana appena inserita, si alza «tutto il
     * catalogo», e in elenco compare lo spezzatino di manzo **non barrato**, perché il manzo non è
     * fra le sue esclusioni.
     *
     * ⛔ Il ripiego di `regimiCompatibili` va verso il **più stretto** (`common/regimi.ts`, che
     * esiste per un rovesciamento identico): regime ignoto → vegano. Sbagliato per difetto, cioè
     * meno scelta e qualcuno se ne accorge, invece che carne nel piatto.
     */
    const regimeCliente = pool?.dietId
      ? ((await this.prisma.diet.findUnique({ where: { id: pool.dietId }, select: { regime: true } })) as { regime: string } | null)?.regime ?? null
      : null;
    if (!regimeConosciuto(regimeCliente)) {
      this.logger.warn(
        `Regime non leggibile per la cliente ${clientId} (dieta ${pool?.dietId ?? 'nessuna'}): fuori dal paniere si mostra solo ${REGIME_PIU_STRETTO}.`,
      );
    }
    return {
      esclusioni: esclusioniDi(profilo, vietatiDieta),
      ids: (pool?.recipeIds ?? []).filter(Boolean),
      dietIdDelPool: pool?.dietId ?? null,
      regimiAmmessi: regimiCompatibili(regimeCliente),
      /** ⚠️ Quello VERO, non il ripiego: `null` quando non lo sappiamo. Vedi `ricette`. */
      regimeCliente: regimeConosciuto(regimeCliente) ? String(regimeCliente) : null,
    };
  }

  /**
   * ⛔ **Il nome entra come ingrediente**, come fanno il motore e Vera: su una ricetta con l'elenco
   * vuoto o povero `valutaRicetta` non vedrebbe niente, e «Insalata di gamberi e avocado»
   * comparirebbe pulita nella schermata di un'allergica ai crostacei.
   */
  private giudica(
    r: { id: string; name: string; kcal: number; mealSlot: string; ingredients: unknown; allergens?: string[] },
    esclusioni: EsclusioniCliente,
  ) {
    const { violations, subs } = valutaRicetta(
      {
        id: r.id,
        name: r.name,
        ingredients: [...(((r.ingredients as { name?: string }[]) ?? []).filter((i) => i?.name)), { name: r.name }],
        allergens: r.allergens ?? [],
      } as never,
      esclusioni,
    );
    return {
      recipeId: r.id,
      nome: r.name,
      kcal: r.kcal,
      slot: r.mealSlot,
      /** ⚠️ Barrata, non tolta: chi compone deve poter decidere sapendo. */
      bloccata: violations.length > 0,
      motivoBlocco: violations[0] ?? null,
      /**
       * ⛔ **LE SOSTITUZIONI VIAGGIANO FINO ALLA SCRITTURA** — è la voce 953, rientrata da questa
       * porta nuova e trovata dalla revisione. `valutaRicetta` alza una violation **solo se non c'è
       * un sostituto**: un piatto col latte per un'intollerante al lattosio esce **non barrato**,
       * con dentro «latte → latte delattosato». Perderla vuol dire scriverle la giornata **senza la
       * riga che le dice cosa non mettere**, e lei beve il latte.
       *
       * ⚠️ La sostituzione sul nome finto si butta: le regole non sanno che il nome è finto e
       * produrrebbero «al posto di *Ricotta con albicocche secche* metti *albicocche essiccate*».
       */
      sostituzioni: subs.filter((x) => String((x as { from?: unknown })?.from ?? '') !== r.name),
    };
  }

  /**
   * Le ricette che si possono mettere in un pasto di questa cliente, col verdetto per ognuna.
   *
   * ⚠️ **Si parte dal SUO pool** (`ClientMenuPool`), che è la stessa porta da cui pescano il cambio
   * di piatto in chat e la giornata dettata a Vera. ⛔ **Non è il pool del motore**, e va detto: il
   * motore compone da `pool-del-paniere.ts`, mentre questo è uno **scatto versionato**, aggiornato
   * quando qualcuno rifà la base personale. Una ricetta entrata in catalogo dopo l'ultimo
   * rifacimento qui non compare — e il pulsante «Rifai base ricette» è lì accanto, sulla stessa
   * card, apposta.
   */
  /**
   * Le ricette fra cui scegliere, già giudicate sulle esclusioni di questa cliente.
   *
   * ⛔ **`tuttoIlCatalogo` è una richiesta di Simone del 4/9**, e nasce da un fatto: la
   * nutrizionista i menu li mandava **in chat**, perché da qui poteva pescare **solo dal paniere**
   * della cliente. Un paniere è un pool, non il catalogo: se il piatto giusto sta fuori, la
   * schermata non lo trovava e lei usava un altro strumento.
   *
   * ⚠️ **Ma fuori dal paniere il regime torna a essere una domanda.** Dentro no — il pool nasce dal
   * suo paniere, quindi è già del regime giusto. Fuori il catalogo ha anche la carne, e servire uno
   * spezzatino a una vegana perché «non era fra le sue esclusioni» sarebbe il modo più veloce di
   * perdere una cliente. Perciò si filtra sui regimi **compatibili col suo**, con la stessa
   * funzione che usa la base personalizzata.
   *
   * ⚠️ E ogni riga dice se è **fuori dal paniere**: chi sceglie deve sapere che sta facendo
   * un'eccezione, non credere che quel piatto le arrivasse comunque.
   */
  async ricette(attoreId: string, clientId: string, slot?: string, q?: string, tuttoIlCatalogo = false) {
    await this.perimetro(attoreId, clientId);
    const { esclusioni, ids, regimiAmmessi, regimeCliente } = await this.contestoDi(clientId);
    /**
     * ⛔ **Anche l'uscita anticipata porta i regimi** — corretto il 4/9 dopo una revisione.
     *
     * Questa riga esce **prima** della risposta piena, e la cliente che ci passa è quella **senza
     * pool**: cioè esattamente quella per cui la ricerca in tutto il catalogo esiste. Senza i due
     * campi la schermata proponeva «onnivoro» per scrivere una ricetta nuova a una vegana — che è
     * l'errore che il commento due riquadri più sotto dichiara di aver corretto.
     */
    if (!ids.length && !tuttoIlCatalogo) {
      return { righe: [], poolVuoto: true, regimiAmmessi: [...regimiAmmessi], regimeCliente };
    }

    const cerca = (q ?? '').trim();
    const nelPaniere = new Set(ids);
    /**
     * ⛔ **Fuori dal paniere il filtro sul regime NON è facoltativo.** Dentro la domanda non si
     * pone — il pool nasce dal suo paniere, quindi è già del regime giusto. Fuori il catalogo ha
     * anche la carne, e `regimiAmmessi` risponde sempre: su regime ignoto è `['vegan']`, mai
     * «tutti». Il perché sta su `contestoDi`, ed è un difetto che questa riga ha davvero avuto.
     */
    const dovePescare = tuttoIlCatalogo
      ? { regime: { in: [...regimiAmmessi] } }
      : { id: { in: ids } };
    const ricette = (await this.prisma.recipe.findMany({
      where: {
        ...dovePescare,
        active: true,
        ...(slot ? { mealSlot: slot } : {}),
        ...(cerca ? { name: { contains: cerca, mode: 'insensitive' } } : {}),
      } as never,
      orderBy: { name: 'asc' },
      take: TETTO_RICERCA,
      select: { id: true, name: true, kcal: true, mealSlot: true, ingredients: true, allergens: true },
    })) as { id: string; name: string; kcal: number; mealSlot: string; ingredients: unknown; allergens?: string[] }[];

    return {
      righe: ricette.map((r) => ({ ...this.giudica(r, esclusioni), fuoriDalPaniere: !nelPaniere.has(r.id) })),
      poolVuoto: !ids.length,
      /**
       * ⚠️ I regimi su cui si filtra uscendo dal paniere: la schermata lo dice invece di farlo
       * indovinare — «non trovo il pollo» ha una risposta, ed è che questa cliente non lo mangia.
       *
       * ⛔ **Tornano SEMPRE, non solo con `tuttoIlCatalogo`** — corretto il 4/9 dopo una revisione.
       * Prima uscivano solo se la casella era alzata, e la schermata li usa per proporre il regime
       * di una **ricetta nuova**: chi scriveva un piatto senza aver mai alzato la casella si vedeva
       * proporre «onnivoro» per una cliente vegana, e l'errore si scopriva dopo il salvataggio.
       */
      regimiAmmessi: [...regimiAmmessi],
      /**
       * ⛔ **Il regime VERO di questa cliente, o `null` se non si riesce a leggere** — e i due campi
       * non sono lo stesso dato.
       *
       * `regimiAmmessi` su regime ignoto vale `['vegan']`: è un **ripiego di sicurezza**, e come
       * filtro è innocuo (sbaglia per difetto, esce meno roba). Ma la schermata lo userebbe per
       * scrivere il regime di una ricetta nuova, e lì «vegana» non è un filtro stretto: è
       * un'affermazione falsa su un piatto che resta in catalogo. Chi non lo sa deve **chiederlo**,
       * non ereditare il ripiego.
       */
      regimeCliente,
      /**
       * ⛔ **Il taglio si dice, e da oggi scatta davvero.** Dentro il paniere sono decine di
       * ricette e il tetto non si toccava mai; fuori sono ventimila, e con la casella di ricerca
       * vuota arrivano **sempre** i primi duecento nomi in ordine alfabetico. Una lista troncata in
       * silenzio fa credere che il resto non esista — e chi cerca «zuppa» scorrendo conclude che
       * non ce ne siano.
       *
       * ⚠️ Perciò la schermata lo **legge**: il campo c'era già e non lo guardava nessuno, il che
       * è lo stesso silenzio con un campo in più.
       */
      troncato: ricette.length >= TETTO_RICERCA,
      tetto: TETTO_RICERCA,
    };
  }

  /** La cornice della giornata: che pasti ha, che fabbisogno, e cosa c'è già scritto. */
  async giornata(attoreId: string, clientId: string, dataISO: string) {
    await this.perimetro(attoreId, clientId);
    return this.corniceDi(clientId, dataISO);
  }

  private async corniceDi(clientId: string, dataISO: string) {
    const date = this.giornoValido(dataISO);
    const [esistente, target, dieta] = await Promise.all([
      this.prisma.menuDay.findFirst({
        where: { clientId, date } as never,
        select: { id: true, meals: true, apertoDallaClienteIl: true, apertureTracciate: true } as never,
      }) as Promise<{ id: string; meals: unknown; apertoDallaClienteIl?: Date | null; apertureTracciate?: boolean } | null>,
      this.kcalNeed.computeTargetKcal(clientId),
      this.dietaDellaCliente(clientId),
    ]);

    /**
     * ⛔ **La banda è quella della SUA dieta, non solo quella globale.**
     * `menu_kcal_balance_tolerance_pct` è `perDiet: true`, e il motore legge l'override
     * (`pickNumOverride`). Mostrare il globale a una dieta che ne ha uno suo vuol dire darle **un
     * metro sbagliato** — cioè esattamente il difetto che allargare `contaGiornata` doveva chiudere.
     */
    const globale = await this.configParams.getNumber('menu_kcal_balance_tolerance_pct', 15);
    const tolleranza = dieta ? await this.tolleranzaDellaDieta(dieta.dietId, globale) : globale;

    const slotAttesi = await this.slotDellaSuaGiornata(clientId, dieta);

    return {
      data: dataISO,
      slotAttesi,
      targetKcal: target,
      tolleranzaPct: tolleranza,
      esistente: esistente
        ? {
          meals: esistente.meals,
          scrittaAMano: scrittaAMano(esistente.meals),
          /** ⛔ Se la cliente l'ha già aperto, quello resta suo: la schermata deve dirlo prima. */
          giaAperto: laClienteLHaAperto(esistente as never),
          nonSappiamo: nonSappiamoSeLHaAperto(esistente as never),
        }
        : null,
    };
  }

  /**
   * Scrive la giornata.
   *
   * ⛔ **Il client manda `slot`, `recipeId` e il motivo della forzatura. Tutto il resto lo decide
   * qui**: il nome, le kcal, se la ricetta è vietata e perché, e le sostituzioni da scrivere sul
   * pasto. Una schermata che valida e un server che si fida sono un cancello solo, dalla parte
   * sbagliata — e su questa porta «la parte sbagliata» vuol dire un allergene nel piatto di
   * qualcuno.
   */
  async scrivi(
    clientId: string,
    attore: { id: string; nome: string },
    input: { data: string; pasti: { slot: string; recipeId: string; forzatoPerche?: string }[]; conferma?: boolean },
  ) {
    await this.perimetro(attore.id, clientId);
    const date = this.giornoValido(input.data);
    const cornice = await this.corniceDi(clientId, input.data);

    /**
     * ⛔ **Un giorno che la cliente ha già aperto NON si riscrive** — la stessa regola di
     * `scriviGiornataDettata`: quello che ha in mano è suo, magari ci ha già fatto la spesa.
     */
    if (cornice.esistente?.giaAperto) {
      throw new BadRequestException('Il menu di quel giorno la cliente lo ha già aperto: quello resta suo.');
    }

    const verdetti = await this.valutate(clientId, (input.pasti ?? []).map((p) => p.recipeId));
    const pasti: PastoAMano[] = [];
    for (const p of input.pasti ?? []) {
      const v = verdetti.get(p.recipeId);
      /**
       * ⛔ Una ricetta che il server non trova — spenta, cancellata, o un id inventato — non si
       * scrive. La prima stesura non rileggeva niente: qualunque stringa finiva in `meals`.
       */
      if (!v) throw new BadRequestException(`La ricetta ${p.recipeId} non esiste o non è più attiva.`);
      /**
       * ⛔ **QUI STAVA IL DIFETTO CHE ANNULLAVA LA RICERCA FUORI DAL PANIERE**, trovato da una
       * revisione avversariale il 4/9 prima della consegna: la ricerca lasciava scegliere fuori dal
       * pool e **questa riga rifiutava di salvarlo**. Cioè si accendeva la casella, si componeva la
       * giornata intera, e il salvataggio rispondeva 400 proprio sul piatto per cui la casella
       * esiste. La schermata prometteva, il server diceva di no.
       *
       * ⚠️ Il confine però non sparisce, **si sposta**: da «è nel suo paniere» a «è di un regime
       * che questa cliente mangia». Il paniere è una scelta di comodo — una selezione fatta per lei
       * —, il regime è quello che non si può violare. `regimeAmmesso` si rilegge dal database in
       * `valutate`, non si eredita dalla ricerca: il client può proporre, non certificare.
       */
      if (!v.nelPool && !v.regimeAmmesso) {
        throw new BadRequestException(`«${v.nome}» è di un regime che questa cliente non mangia: non si può metterla nel suo menu.`);
      }
      /** ⛔ E lo slot dev'essere il suo: una cena a colazione la manda una schermata che ha sbagliato. */
      if (v.slot !== p.slot) {
        throw new BadRequestException(`«${v.nome}» è un piatto da ${v.slot}, non da ${p.slot}.`);
      }
      pasti.push({
        slot: p.slot,
        recipeId: v.recipeId,
        name: v.nome,
        kcal: v.kcal,
        bloccata: v.bloccata,
        motivoBlocco: v.motivoBlocco ?? undefined,
        forzatoPerche: p.forzatoPerche,
      });
    }

    /**
     * ⛔ **Senza sapere che pasti ha la sua giornata non si scrive, e si dice PERCHÉ.** Con
     * `slotAttesi` vuoto `controllaGiornata` risponderebbe «"breakfast" non è un pasto della sua
     * giornata» per ogni riga — vero e inutilizzabile: il problema non è il pasto, è che questa
     * cliente non ha ancora una dieta con delle giornate da cui leggere la struttura.
     */
    if (!cornice.slotAttesi.length) {
      throw new NotFoundException(
        'Non si sa quanti pasti ha la giornata di questa cliente: non ha ancora una dieta con delle giornate. '
        + 'Fai partire l\'erogazione (o guarda perché non parte) prima di scrivere a mano.',
      );
    }
    const verdetto = controllaGiornata(pasti, cornice.slotAttesi, cornice.targetKcal, cornice.tolleranzaPct);
    if (!verdetto.pronta) throw new BadRequestException(verdetto.problemi.join(' '));

    /**
     * ⚠️ **«Non si sa se l'ha aperto» AVVISA, non ferma** — ed è una differenza voluta rispetto a
     * Vera, che lì si arrende. Vera agisce da sola; qui c'è una persona che ha deciso di scrivere
     * quel giorno, e la stessa `apertureTracciate: false` la porta **la giornata che ha appena
     * scritto lei** (per una cliente che non ha mai aperto l'app, `apertureDal` è nullo — cioè
     * proprio il caso del 31/8). Fermarla vorrebbe dire che chi sbaglia un piatto non può più
     * correggerlo: la via d'uscita che non esce.
     */
    const avvisi = [...verdetto.avvisi];
    if (cornice.esistente?.nonSappiamo) {
      avvisi.push('Non si sa se la cliente ha già aperto questo giorno: la sua app non lo dice ancora.');
    }
    /**
     * ⚠️ **Gli avvisi non fermano, ma vanno CONFERMATI.** Sono le cose che chi compone deve aver
     * letto, e un `POST` che le ignora in silenzio renderebbe la schermata l'unico posto dove
     * esistono. ⛔ Chi chiama deve poter **riprovare con `conferma: true`**: la prima stesura
     * lasciava senza uscita proprio la cliente senza fabbisogno calcolabile.
     */
    if (avvisi.length && input.conferma !== true) {
      throw new BadRequestException(`Da confermare: ${avvisi.join(' ')}`);
    }

    const dieta = await this.dietaDellaCliente(clientId);
    if (!dieta) throw new NotFoundException('Questa cliente non ha ancora ricevuto nessun menu: la giornata non si può scrivere finché non si sa da quale dieta pescare.');

    const meals = pastiDaScrivere(pasti, attore.nome).map((m, i) => {
      const subs = verdetti.get(pasti[i].recipeId)?.sostituzioni ?? [];
      return subs.length ? { ...m, substitutions: subs } : m;
    });
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { apertureDal: true },
    })) as { apertureDal?: Date | null } | null;

    const oggi = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    await this.prisma.menuDay.upsert({
      where: { clientId_date: { clientId, date } } as never,
      create: {
        clientId,
        date,
        dietId: dieta.dietId,
        level: dieta.level,
        meals: meals as never,
        /**
         * ⛔ **Visibile SUBITO, non il giorno stesso.** `getMenu` filtra `visibleFrom <= oggi`: con
         * `visibleFrom: date` una giornata composta oggi per giovedì sarebbe comparsa **giovedì
         * mattina**, senza spesa e senza lista. È il contrario di quello che il progetto ripete su
         * questo punto («magari ci ha già fatto la spesa»), e il motore infatti scrive `today`.
         */
        visibleFrom: date.getTime() < oggi.getTime() ? date : oggi,
        /** ⚠️ Come per il motore: si copia adesso, non si ricalcola alla domanda. */
        apertureTracciate: !!profilo?.apertureDal,
      } as never,
      update: { meals: meals as never },
    });

    /**
     * ⚠️ **Il registro è best-effort come tutti gli altri**, e va detto invece di promettere il
     * contrario: `AuditService.log` assorbe i propri errori di proposito. Quello che **non** si
     * perde è il motivo della forzatura, che viaggia dentro `meals` insieme al pasto.
     */
    await this.audit.log({
      actorId: attore.id,
      action: 'menu.scritto_a_mano',
      entityType: 'menu_day',
      entityId: `${clientId}:${input.data}`,
      metadata: {
        pasti: meals.length,
        kcal: verdetto.conto.kcal,
        targetKcal: cornice.targetKcal,
        avvisi,
        /** ⚠️ Le forzature si contano sul verdetto del SERVER, non su quello che ha detto il client. */
        forzature: pasti.filter((p) => p.bloccata).map((p) => ({ nome: p.name, perche: p.forzatoPerche })),
      },
    } as never).catch(() => undefined);

    this.logger.log(
      `Menu scritto a mano per ${clientId} il ${input.data} da ${attore.nome}: `
      + `${meals.length} pasti, ${verdetto.conto.kcal} kcal${avvisi.length ? ` — avvisi: ${avvisi.join(' ')}` : ''}.`,
    );
    return { scritta: true, kcal: verdetto.conto.kcal, avvisi };
  }

  /** `AAAA-MM-GG` → mezzanotte UTC, come `@db.Date`. Una data storta si ferma qui. */
  private giornoValido(dataISO: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO ?? '')) throw new BadRequestException('Data non valida (AAAA-MM-GG).');
    const d = new Date(`${dataISO}T00:00:00.000Z`);
    if (!Number.isFinite(d.getTime())) throw new BadRequestException('Data non valida.');
    return d;
  }

  /**
   * ⛔ **LA BANDA DELLA SUA DIETA.** `menu_kcal_balance_tolerance_pct` è `perDiet: true`: il motore
   * legge l'override della dieta, e mostrare il globale dove ce n'è uno vuol dire dare a chi compone
   * un metro diverso da quello con cui la giornata verrà giudicata.
   */
  private async tolleranzaDellaDieta(dietId: string, globale: number): Promise<number> {
    try {
      /** ⚠️ `ProductRule`, la stessa tabella da cui `dietRuleOverrides` legge gli override del motore. */
      const riga = (await this.prisma.productRule.findFirst({
        where: { dietId, ruleCode: 'menu_kcal_balance_tolerance_pct' } as never,
        select: { params: true, enabled: true },
      })) as { params: unknown; enabled: boolean } | null;
      const n = Number((riga?.params as { value?: unknown } | null)?.value);
      return Number.isFinite(n) && n > 0 ? n : globale;
    } catch {
      /** ⚠️ Nel dubbio il globale: una banda non leggibile non deve togliere la schermata. */
      return globale;
    }
  }

  /**
   * Gli slot della giornata di questa cliente.
   *
   * ⛔ **La struttura la dettano le giornate della sua DIETA, e i pasti che la sua finestra esclude
   * NON si chiedono.** La prima stesura faceva l'unione grezza degli slot dei template e ignorava
   * il digiuno: a una cliente in 16:8 la schermata **pretendeva la colazione**, e senza non lasciava
   * salvare. Cioè le si sarebbe messo un pasto che la sua finestra esclude — il difetto
   * `menu-composti-con-un-pasto-in-piu`, citato nel commento come se fosse stato evitato. Adesso si
   * passa da `slotDaComporre`, che è la stessa funzione del motore.
   */
  private async slotDellaSuaGiornata(
    clientId: string,
    dieta: { dietId: string; level: number } | null,
  ): Promise<string[]> {
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { pathType: true, fastingWindow: true, pastiEsclusi: true } as never,
    })) as { pathType?: string | null; fastingWindow?: string | null; pastiEsclusi?: string[] } | null;
    const salta = slotEsclusiTotali(profilo?.pathType, profilo?.fastingWindow, profilo?.pastiEsclusi);

    const struttura = new Set<string>();
    if (dieta) {
      const giornate = (await this.prisma.dietDayTemplate.findMany({
        where: { dietId: dieta.dietId, level: dieta.level } as never,
        select: { meals: true },
        take: 30,
      })) as { meals: unknown }[];
      for (const g of giornate) {
        for (const m of (Array.isArray(g.meals) ? g.meals : []) as { slot?: string }[]) {
          if (m?.slot) struttura.add(m.slot);
        }
      }
    }
    if (!struttura.size) return [];
    return slotDaComporre({ strutturaDellaDieta: struttura, chiaviDelPool: struttura, salta });
  }

  /**
   * La dieta e il livello con cui scrivere la giornata.
   *
   * ⛔ **Il `dietId` del POOL vince su quello dell'ultimo menu.** Dopo un cambio di famiglia il pool
   * più recente è della dieta **nuova** e l'ultimo `MenuDay` della **vecchia**: prendendo la
   * seconda si sarebbe scritta una giornata con il `dietId` vecchio, gli slot dei template vecchi e
   * i piatti pescati dal pool nuovo — tre risposte da tre diete diverse in una scrittura sola.
   * L'ha trovato una revisione avversariale.
   */
  private async dietaDellaCliente(clientId: string): Promise<{ dietId: string; level: number } | null> {
    const [ultimo, contesto] = await Promise.all([
      this.prisma.menuDay.findFirst({
        where: { clientId } as never,
        orderBy: { date: 'desc' } as never,
        select: { dietId: true, level: true },
      }) as Promise<{ dietId: string; level: number } | null>,
      this.contestoDi(clientId),
    ]);
    if (contesto.dietIdDelPool) {
      /** ⚠️ Il livello resta quello dell'ultimo menu quando le diete combaciano; altrimenti 1. */
      return {
        dietId: contesto.dietIdDelPool,
        level: ultimo && ultimo.dietId === contesto.dietIdDelPool ? ultimo.level : 1,
      };
    }
    if (ultimo) return ultimo;
    /**
     * ⛔ **Nessun menu mai erogato — che è il caso del 31/8**, quello per cui questa schermata
     * esiste. Il profilo non porta una dieta: quella la sceglie `pickDietFor` a ogni erogazione. Qui
     * non si rifà quella scelta — sarebbe una seconda copia di una regola che tiene conto di
     * regime, pasti al giorno, finestra del digiuno e completezza del catalogo — e si dice invece
     * che manca il presupposto.
     *
     * ⚠️ **È un limite dichiarato, non una dimenticanza**: per una cliente che non ha **mai**
     * ricevuto un menu, prima si fa partire l'erogazione (o si guarda perché non parte), poi si
     * scrive a mano. La schermata lo dice con parole sue invece di far fallire un salvataggio.
     */
    return null;
  }
}
