import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
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
        where: { status: 'open', ricette: { lte: 0 } } as never,
        orderBy: [{ times: 'desc' }, { lastAskedAt: 'desc' }] as never,
        take: TETTO,
      } as never),
      this.prisma.nutrientLookupMiss.count({ where: { status: 'open', ricette: { lte: 0 } } as never }),
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
