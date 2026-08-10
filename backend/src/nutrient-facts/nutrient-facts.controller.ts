import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

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

  /** Gli alimenti che le clienti hanno chiesto e non ci sono, i più richiesti in cima. */
  @Get('mancanti')
  @RequirePage('nutrient_facts')
  async mancanti() {
    return this.prisma.nutrientLookupMiss.findMany({
      where: { status: 'open' } as never,
      orderBy: [{ times: 'desc' }, { lastAskedAt: 'desc' }],
      take: 200,
    } as never);
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
