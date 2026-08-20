import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { eAroma } from './aromi';
import { scegliPerRicetta } from './stato-alimento';
import { normalizzaNome } from './valori-nutrizionali.service';

/**
 * LA BANCA DATI NUTRIZIONALE VISTA DALLA NUTRIZIONISTA (11/8).
 *
 * Il senso di questa pagina non è consultare una tabella: è **correggerla**. I valori arrivano da
 * fonti pubbliche (CREA, International Tables) e alcuni sono dichiaratamente deboli — l'indice
 * glicemico delle patate va da 73 a 111 secondo la fonte. Chi risponde di quello che le clienti
 * mangiano deve poter dire «questo numero non va bene» e correggerlo, e da quel momento nessun deploy
 * gliela sovrascrive più (il seed salta le righe confermate).
 *
 * L'altra metà è la lista degli **alimenti chiesti e mancanti**, con quante volte: è il modo in cui
 * la tabella cresce guidata dalle domande vere delle clienti invece che da un elenco deciso a
 * tavolino. «Tempeh chiesto 40 volte» è la prossima riga da scrivere, e non serve indovinarlo.
 */
@Controller('nutrient-facts')
@Roles('admin', 'nutritionist', 'head_nutritionist')
export class NutrientFactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Tutti i valori. `daConfermare=1` per la coda di chi deve ancora guardarli. */
  @Get()
  @RequirePage('nutrient_facts')
  async list(@Query('daConfermare') daConfermare?: string) {
    return this.prisma.nutrientFact.findMany({
      where: daConfermare === '1' ? { verifiedAt: null } : {},
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { verifiedBy: { select: { displayName: true } } },
    } as never);
  }

  /**
   * GLI ALIMENTI CHE MANCANO — chiesti dalle clienti **e** usati dalle ricette, in un elenco solo.
   *
   * ⚠️ Dal 19/8 sera questa non è più «la lista dei termini chiesti a Gaia»: è **l'elenco di lavoro**
   * (richiesta di Simone: «crea una tabella dove possiamo correggere a mano»). La stessa riga porta
   * due numeri che **non si sommano** — `times` = quante volte una cliente l'ha chiesto, `ricette` =
   * quante ricette attive lo usano — perché sono unità diverse e un totale inventato farebbe
   * ordinare l'elenco su un numero che non vuol dire niente.
   *
   * ⚠️ **Il tetto si dichiara.** Prima c'era `take: 200` e basta: chi guardava la pagina non poteva
   * sapere se erano tutti. Ora si torna anche quanti sono davvero.
   */
  @Get('mancanti')
  @RequirePage('nutrient_facts')
  async mancanti() {
    const TETTO = 100;
    /**
     * ⚠️ **DUE ELENCHI, NON UNO ORDINATO SU DUE UNITÀ** — corretto il 19/8 sera dopo la revisione
     * avversariale, ed era un difetto che aveva sepolto la ragione per cui questa tabella esiste.
     *
     * Per mezza giornata qui c'era un `orderBy: [{ricette:'desc'}, {times:'desc'}]` con un tetto
     * unico. ⛔ Ma il passo notturno scrive **trecento** righe con `ricette ≥ 1`: le prime duecento
     * erano quindi **sempre e solo** ingredienti di ricette, e **nessun termine chiesto da una
     * cliente** poteva più comparire. «Tempeh chiesto 40 volte è la prossima riga da scrivere» —
     * la frase con cui questa tabella è nata, ancora scritta qui sopra — da quel momento non era
     * più vera, e nessun errore lo diceva.
     *
     * ⚠️ È lo stesso motivo per cui i due numeri non si sommano: **sono unità diverse**. Ordinarle
     * insieme è sommarle di nascosto. Quindi due domande, due elenchi, due tetti.
     */
    const [daRicette, quanteRicette, chieste, quanteChieste] = await Promise.all([
      this.prisma.nutrientLookupMiss.findMany({
        where: { status: 'open', ricette: { gt: 0 } } as never,
        orderBy: [{ ricette: 'desc' }, { term: 'asc' }] as never,
        take: TETTO,
      } as never),
      this.prisma.nutrientLookupMiss.count({ where: { status: 'open', ricette: { gt: 0 } } as never }),
      this.prisma.nutrientLookupMiss.findMany({
        /**
         * ⚠️ **`times > 0`, non solo «senza ricette»** — 20/8. Questo elenco si chiama «chiesti dalle
         * clienti»: una riga che nessuna cliente ha chiesto **non ci va**, per definizione. Senza
         * questo filtro ci finiva dentro qualunque termine con `ricette: 0` — cioè, dal giorno che
         * l'elenco ha imparato a calare, tutte le cose appena risolte.
         */
        where: { status: 'open', ricette: { lte: 0 }, times: { gt: 0 } } as never,
        orderBy: [{ times: 'desc' }, { lastAskedAt: 'desc' }] as never,
        take: TETTO,
      } as never),
      this.prisma.nutrientLookupMiss.count({ where: { status: 'open', ricette: { lte: 0 }, times: { gt: 0 } } as never }),
    ]);
    return {
      daRicette: { righe: daRicette, quanti: quanteRicette },
      chieste: { righe: chieste, quanti: quanteChieste },
    };
  }

  /**
   * «QUESTO NOME È UN ALTRO MODO DI DIRE QUELLA RIGA»: lo aggiunge come **sinonimo**.
   *
   * ⚠️ È l'azione che fa risparmiare il lavoro vero: «olio extravergine» scritto in tre modi sono
   * 6494 ricette, e si chiudono con tre sinonimi invece che con tre righe nuove — righe nuove che,
   * fra l'altro, sarebbero **lo stesso alimento contato due volte** con numeri che prima o poi
   * divergono.
   *
   * ⛔ **Lo decide una persona, non l'abbinamento automatico.** L'elenco suggerisce la riga
   * (`suggerito`), ma finché nessuno clicca non succede niente: è la stessa prudenza per cui
   * l'abbinamento ha un elenco chiuso di qualificatori e non «tutto quello che somiglia».
   */
  @Post('mancanti/:id/sinonimo')
  @RequirePage('nutrient_facts', 'manage')
  async aggiungiSinonimo(
    @Param('id') id: string,
    @Body() body: { rigaId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const miss = (await this.prisma.nutrientLookupMiss.findUnique({ where: { id } })) as
      | { id: string; term: string; suggerito: string | null }
      | null;
    if (!miss) throw new NotFoundException('Questo termine non è più in elenco.');

    const riga = (await (body?.rigaId
      ? this.prisma.nutrientFact.findUnique({ where: { id: body.rigaId } })
      : miss.suggerito
        ? this.prisma.nutrientFact.findFirst({ where: { name: miss.suggerito } })
        : Promise.resolve(null))) as { id: string; name: string; synonyms: string[] } | null;
    if (!riga) throw new BadRequestException('Serve la riga a cui attaccare il sinonimo.');

    /**
     * ⚠️ **NON SI ATTACCA UN SINONIMO A UNA RIGA CHE NON SI PUÒ USARE** — 19/8 sera, revisione
     * avversariale, ed era il difetto più subdolo dei due pulsanti.
     *
     * `suggerito` viene dall'abbinamento, che dice *quale riga* ma non *se quella riga serve*.
     * Caso vero: «lenticchie bio» → riga «lenticchie», che in tabella è **bollita**. Un clic, e il
     * termine usciva dall'elenco come risolto. ⛔ Da lì in poi nessun numero sbagliato — la
     * convenzione del crudo blocca — ma **il lavoro vero spariva**: manca la riga a crudo, che vale
     * 325 kcal contro 93, e il passo notturno non riapre una riga chiusa a mano. Una scorciatoia che
     * *nasconde* un buco è peggio del buco.
     */
    const stessoNome = (await this.prisma.nutrientFact.findMany({
      where: { name: riga.name },
      select: { name: true, state: true } as never,
    })) as { name: string; state: string | null }[];
    const scelta = scegliPerRicetta(stessoNome);
    if (scelta.tipo === 'solo_cotto') {
      throw new BadRequestException(
        `«${riga.name}» in tabella c'è solo da cotto (${scelta.stati.join(', ')}), e nelle ricette le ` +
          'grammature sono a crudo: attaccarci questo nome lo toglierebbe dall\'elenco senza risolvere ' +
          'niente. Serve prima la riga a crudo.',
      );
    }

    /**
     * ⚠️ **`push` e non riscrittura dell'array.** Due operatrici che chiudono due termini diversi
     * sulla stessa riga nella stessa finestra — ed è il caso da 6494 ricette dell'olio, dove i
     * termini da attaccare sono tre — con un leggi-modifica-scrivi si sovrascrivono a vicenda:
     * l'ultima vince e il primo sinonimo sparisce **senza errore**. Postgres sa aggiungere in fondo
     * a un array da solo.
     *
     * ⚠️ E il confronto «c'è già» usa `normalizzaNome`, come **ogni** confronto di nomi in questo
     * dominio: `trim().toLowerCase()` non toglie apostrofi e accenti, e «olio extravergine d'oliva»
     * non risultava uguale a «olio extravergine d oliva» — due risposte alla stessa domanda a
     * quattro righe di distanza.
     */
    const gia = (riga.synonyms ?? []).some((x) => normalizzaNome(x) === normalizzaNome(miss.term));
    if (!gia) {
      await this.prisma.nutrientFact.update({
        where: { id: riga.id },
        data: { synonyms: { push: miss.term } } as never,
      });
    }
    /**
     * ⚠️ Il termine esce dall'elenco come **`filled`** e non `ignored`: «l'abbiamo risolto» e
     * «non è un alimento» sono due fatti diversi, e confonderli vorrebbe dire non poter più
     * rispondere a «quanti ne abbiamo chiusi davvero?».
     */
    await this.prisma.nutrientLookupMiss.update({ where: { id }, data: { status: 'filled' } as never });
    await this.audit.log({
      action: 'nutrient_fact.synonym_added',
      actorId: user.sub,
      entityType: 'nutrient_fact',
      entityId: riga.id,
      metadata: { termine: miss.term, riga: riga.name, giaPresente: gia },
    });
    return { ok: true, riga: riga.name, termine: miss.term };
  }

  /**
   * GLI AROMI DA TOGLIERE IN BLOCCO — **prima si guardano, poi si scrivono** (Simone, 20/8).
   *
   * Metà dei primi venti posti dell'elenco sono aglio, sale, pepe, acqua, prezzemolo, basilico:
   * pesano zero nel conto delle calorie e la tabella non li avrà mai tutti, ma occupano lo spazio
   * delle righe che servono davvero. Toglierli uno alla volta è un centinaio di clic.
   *
   * ⚠️ **Sono due endpoint e non uno**, e la separazione è la richiesta di Simone: questo dice
   * *cosa* toglierebbe, e non tocca niente. Una scrittura in blocco che nessuno ha visto prima è la
   * cosa che in questo progetto non si fa — è la stessa forma della conferma allergeni in blocco.
   */
  @Get('mancanti/aromi')
  @RequirePage('nutrient_facts')
  async aromiDaTogliere() {
    const aperti = (await this.prisma.nutrientLookupMiss.findMany({
      where: { status: 'open' } as never,
      orderBy: [{ ricette: 'desc' }, { times: 'desc' }] as never,
    })) as unknown as { id: string; term: string; ricette: number; times: number }[];
    const righe = aperti.filter((m) => eAroma(m.term));
    return { righe, quanti: righe.length };
  }

  /**
   * E questo li toglie. ⚠️ **Riceve gli id che l'operatrice ha visto, ma ricontrolla ognuno**: quello
   * che si approva è quello che succede, e niente fuori dall'elenco chiuso degli aromi può uscire
   * dalla lista nemmeno se la pagina lo chiede. ⛔ Fidarsi degli id e basta vorrebbe dire che un
   * bottone sbagliato — o una pagina rimasta aperta da ieri — può cancellare dall'elenco un
   * alimento vero, e nessuno lo rimette: il passo notturno non riapre una riga chiusa a mano.
   */
  @Post('mancanti/aromi')
  @RequirePage('nutrient_facts', 'manage')
  async togliAromi(@Body() body: { ids?: string[] }, @CurrentUser() user: AuthUser) {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x) => typeof x === 'string') : [];
    if (!ids.length) return { tolti: 0, saltati: 0 };

    const righe = (await this.prisma.nutrientLookupMiss.findMany({
      where: { id: { in: ids }, status: 'open' } as never,
    })) as { id: string; term: string }[];
    const aromi = righe.filter((m) => eAroma(m.term));
    const saltati = righe.length - aromi.length;

    if (aromi.length) {
      await this.prisma.nutrientLookupMiss.updateMany({
        where: { id: { in: aromi.map((m) => m.id) } },
        data: { status: 'ignored' } as never,
      });
      await this.audit.log({
        action: 'nutrient_fact.aromi_ignored',
        actorId: user.sub,
        entityType: 'nutrient_lookup_miss',
        /** ⚠️ I TERMINI, non solo il numero: «ho tolto 87 righe» non si può verificare a posteriori. */
        metadata: { quanti: aromi.length, termini: aromi.map((m) => m.term), saltati },
      });
    }
    return { tolti: aromi.length, saltati };
  }

  /**
   * L'ALIMENTO CHE MANCA, SCRITTO DA QUI — richiesta di Simone (20/8): «oltre al pulsante togli
   * mettimi anche associa o dettaglio, per inserirti i campi che ti servono».
   *
   * ⚠️ **I due pulsanti rispondono a due domande diverse, e tenerle separate è il punto.**
   * «Associa» dice *«questo nome è un altro modo di chiamare una riga che c'è già»* — l'olio
   * extravergine scritto in tre modi, 6494 ricette. «Dettaglio» dice *«questo alimento in tabella
   * non c'è e lo scrivo adesso»* — le melanzane, i fagiolini, la coda di pescatrice. Un solo
   * pulsante che facesse tutt'e due obbligherebbe chi guarda a decidere **dopo** aver cliccato, e
   * la scelta sbagliata qui non è un fastidio: un sinonimo messo dove serviva una riga fa sparire
   * il buco senza chiuderlo.
   *
   * ⚠️ **Il nome nasce dal termine** e non si può cambiare qui: se il nome fosse libero, questa
   * schermata diventerebbe un secondo modo di creare alimenti — e il termine resterebbe in elenco,
   * scollegato da quello che si è appena scritto. Per un alimento che non viene da un mancante c'è
   * già `POST /nutrient-facts`.
   *
   * ⚠️ Nasce **confermato**, come ogni riga scritta a mano: l'ha scritta una persona che sa, e
   * rimetterla nella coda «da guardare» sarebbe farle rifare il lavoro che ha appena fatto.
   */
  @Post('mancanti/:id/crea')
  @RequirePage('nutrient_facts', 'manage')
  async creaDaMancante(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthUser,
  ) {
    const miss = (await this.prisma.nutrientLookupMiss.findUnique({ where: { id } })) as
      | { id: string; term: string; status: string }
      | null;
    if (!miss) throw new NotFoundException('Questo termine non è più in elenco.');

    /**
     * ⚠️ Se una riga con quel nome c'è già, **non se ne fa una seconda**: si dice di associare. Due
     * righe con lo stesso nome sono precisamente l'ambiguità che fa rispondere Gaia a caso — ed è
     * la ragione per cui `name` è `@unique` in banca dati. Meglio un errore che si legge che un
     * vincolo che scatta e lascia chi ha cliccato senza sapere cosa fare.
     */
    /**
     * ⚠️ **QUALCUN ALTRO PUÒ AVERLO GIÀ CHIUSO** — trovato dalla revisione avversariale del 20/8.
     * `miss.status` veniva letto e mai guardato: una pagina aperta da ieri poteva creare una riga
     * per un termine che nel frattempo era già stato associato a un'altra. Il risultato del punto
     * sotto — due righe che rispondono allo stesso nome — nasceva proprio così.
     */
    if (miss.status !== 'open') {
      throw new BadRequestException(
        `«${miss.term}» l'ha già chiuso qualcun altro: ricarica la pagina prima di scrivere.`,
      );
    }

    /**
     * ⚠️ **SI GUARDANO ANCHE I SINONIMI, NON SOLO I NOMI** — revisione avversariale del 20/8, ed è
     * il difetto che rimetteva in piedi la voce 228.
     *
     * Il controllo era `findFirst({ name: miss.term })`, e `name` è `@unique`: sembrava blindato.
     * ⛔ Ma la collisione vera è **nome contro sinonimo**: se qualcuno ha già associato «olio
     * extravergine» come sinonimo di «olio extravergine di oliva», creare una riga *chiamata* «olio
     * extravergine» non viola nessun vincolo — e da lì in poi due righe rispondono a quel nome. Con
     * lo stesso stato, `scegliPerStato` prende la prima che restituisce Postgres: **quale delle due
     * risponde lo decide l'ordine di lettura del database**, che è testualmente il difetto da cui è
     * nata tutta questa storia.
     */
    const gia = (await this.prisma.nutrientFact.findFirst({
      where: { OR: [{ name: miss.term }, { synonyms: { has: miss.term } }] } as never,
      select: { id: true, name: true } as never,
    })) as { id: string; name: string } | null;
    if (gia) {
      throw new BadRequestException(
        `«${miss.term}» in tabella c'è già${gia.name === miss.term ? '' : `, come altro nome di «${gia.name}»`}: ` +
          'usa «associa» invece di crearne una seconda, o correggi quella riga.',
      );
    }

    const staff = (await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } })) as { id: string } | null;
    /**
     * ⚠️ **«NON LO SO» E «ILLEGGIBILE» NON SONO LA STESSA COSA** — revisione avversariale del 20/8.
     *
     * Prima qualunque cosa non numerica diventava `null`, in silenzio. ⛔ Caso vero: si scrive `8OO`
     * (la O maiuscola al posto dello zero) nelle kcal delle melanzane, e nasce una riga **senza
     * calorie**, confermata, con lo stato a crudo. Da quel momento il termine non è più «scoperto»
     * — la riga c'è ed è usabile — quindi **sparisce dalla lista di lavoro**, mentre il conto della
     * ricetta continua a saltarlo. Una scorciatoia che *nasconde* un buco è peggio del buco, ed è la
     * stessa frase scritta venti righe sopra, sull'altro pulsante.
     *
     * ⚠️ E i valori assurdi passavano: `kcal: -500` **sottrae** dal totale di una ricetta, e la
     * guardia in uscita ammette quel numero perché viene dalla tabella. Un limite si può discutere;
     * nessun limite no.
     */
    const LIMITI: Record<string, number> = {
      kcal: 900, protein: 100, carbs: 100, sugars: 100, fat: 100, fiber: 100,
      glycemicIndex: 150, glycemicIndexMin: 150, glycemicIndexMax: 150,
    };
    const numero = (k: string): number | null => {
      const v = body[k];
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(String(v).replace(',', '.').trim());
      if (!Number.isFinite(n)) {
        throw new BadRequestException(`«${String(v)}» non è un numero: controlla il campo ${k}.`);
      }
      if (n < 0) throw new BadRequestException(`${k} non può essere negativo (${n}).`);
      const max = LIMITI[k];
      if (max !== undefined && n > max) {
        throw new BadRequestException(`${k} = ${n} è fuori scala: per 100 g il massimo sensato è ${max}.`);
      }
      return n;
    };
    const testo = (k: string): string | null => {
      const v = body[k];
      const t = typeof v === 'string' ? v.trim() : '';
      return t ? t : null;
    };

    const kcal = numero('kcal');
    const creato = (await this.prisma.nutrientFact.create({
      data: {
        name: miss.term,
        synonyms: [],
        category: testo('category'),
        state: testo('state'),
        kcal,
        protein: numero('protein'),
        carbs: numero('carbs'),
        sugars: numero('sugars'),
        fat: numero('fat'),
        fiber: numero('fiber'),
        glycemicIndex: numero('glycemicIndex'),
        glycemicIndexMin: numero('glycemicIndexMin'),
        glycemicIndexMax: numero('glycemicIndexMax'),
        glycemicIndexReliability: testo('glycemicIndexReliability'),
        source: testo('source'),
        note: testo('note'),
        /**
         * ⚠️ **SENZA CALORIE NON È CONFERMATA.** Una riga nasce confermata perché l'ha scritta una
         * persona che sa — ma se le kcal mancano, quella riga **non serve al conto** e insieme
         * **toglie il termine dalla lista di lavoro**: il buco resta e nessuno lo vede più. Senza
         * kcal resta «da confermare», che è il solo posto da cui può tornare sotto gli occhi.
         */
        verifiedAt: kcal === null ? null : new Date(),
        verifiedById: kcal === null ? null : (staff?.id ?? null),
      } as never,
    })) as { id: string; name: string };

    await this.prisma.nutrientLookupMiss.update({ where: { id }, data: { status: 'filled' } as never });
    await this.audit.log({
      action: 'nutrient_fact.created_from_miss',
      actorId: user.sub,
      entityType: 'nutrient_fact',
      entityId: creato.id,
      metadata: { termine: miss.term },
    });
    return { ok: true, id: creato.id, nome: creato.name };
  }

  /**
   * Correggere un valore. Correggere **è** confermare: se una nutrizionista mette le mani su un
   * numero, quel numero è suo — segnarlo come «ancora da guardare» sarebbe una bugia, e lo
   * ributterebbe nella coda che ha appena svuotato.
   */
  @Patch(':id')
  @RequirePage('nutrient_facts', 'manage')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    const campi = [
      'glycemicIndex', 'glycemicIndexMin', 'glycemicIndexMax', 'glycemicIndexReliability',
      'kcal', 'protein', 'carbs', 'sugars', 'fat', 'fiber', 'state', 'note', 'synonyms', 'source',
    ];
    const data: Record<string, unknown> = {};
    for (const c of campi) if (body[c] !== undefined) data[c] = body[c] === '' ? null : body[c];

    const staff = (await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } })) as { id: string } | null;
    data.verifiedAt = new Date();
    data.verifiedById = staff?.id ?? null;

    const updated = await this.prisma.nutrientFact.update({ where: { id }, data: data as never });
    await this.audit.log({
      action: 'nutrient_fact.update',
      actorId: user.sub,
      entityType: 'nutrient_fact',
      entityId: id,
      metadata: data,
    });
    return updated;
  }

  /** «Il valore va bene così»: svuota la coda senza toccare i numeri. */
  @Post(':id/conferma')
  @RequirePage('nutrient_facts', 'manage')
  async conferma(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const staff = (await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } })) as { id: string } | null;
    const updated = await this.prisma.nutrientFact.update({
      where: { id },
      data: { verifiedAt: new Date(), verifiedById: staff?.id ?? null } as never,
    });
    await this.audit.log({ action: 'nutrient_fact.confirm', actorId: user.sub, entityType: 'nutrient_fact', entityId: id });
    return updated;
  }

  /** Un alimento nuovo, scritto a mano: nasce già confermato, perché l'ha scritto lei. */
  @Post()
  @RequirePage('nutrient_facts', 'manage')
  async create(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    const staff = (await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } })) as { id: string } | null;
    const creato = await this.prisma.nutrientFact.create({
      data: {
        name: String(body.name ?? '').trim().toLowerCase(),
        synonyms: Array.isArray(body.synonyms) ? (body.synonyms as string[]) : [],
        category: (body.category as string) ?? null,
        state: (body.state as string) ?? null,
        glycemicIndex: (body.glycemicIndex as number) ?? null,
        glycemicIndexMin: (body.glycemicIndexMin as number) ?? null,
        glycemicIndexMax: (body.glycemicIndexMax as number) ?? null,
        glycemicIndexReliability: (body.glycemicIndexReliability as string) ?? null,
        kcal: (body.kcal as number) ?? null,
        protein: (body.protein as number) ?? null,
        carbs: (body.carbs as number) ?? null,
        sugars: (body.sugars as number) ?? null,
        fat: (body.fat as number) ?? null,
        fiber: (body.fiber as number) ?? null,
        source: (body.source as string) ?? 'inserito dalla nutrizionista',
        note: (body.note as string) ?? null,
        verifiedAt: new Date(),
        verifiedById: staff?.id ?? null,
      } as never,
    });
    // Se l'alimento era nella lista dei mancanti, quella riga si chiude da sé: la domanda ha avuto
    // risposta, e lasciarla aperta farebbe sembrare che il lavoro sia ancora da fare.
    await this.prisma.nutrientLookupMiss
      .updateMany({ where: { term: String(body.name ?? '').trim().toLowerCase() }, data: { status: 'filled' } as never })
      .catch(() => undefined);
    await this.audit.log({ action: 'nutrient_fact.create', actorId: user.sub, entityType: 'nutrient_fact', entityId: creato.id });
    return creato;
  }

  /** «Questo non è un alimento»: toglie un termine dalla lista dei mancanti senza aggiungere righe. */
  @Patch('mancanti/:id')
  @RequirePage('nutrient_facts', 'manage')
  async ignoraMancante(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const updated = await this.prisma.nutrientLookupMiss.update({
      where: { id },
      data: { status: 'ignored' } as never,
    });
    await this.audit.log({ action: 'nutrient_fact.miss_ignored', actorId: user.sub, entityType: 'nutrient_lookup_miss', entityId: id });
    return updated;
  }
}
