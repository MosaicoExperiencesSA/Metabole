import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { avvisaCapiNutrizionisti } from '../common/avvisa-nutrizionista';
import { chiaveAlimento } from '../common/nomi-alimento';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AggiornaSostituzioneDto, CreaSostituzioneDto } from './dto/food-swaps.dto';
import { decidiPromozione, nomeGruppoDaSostituzione, type GruppoCandidato } from './promuovi-a-regola';
import { chiaveSostituzione } from './registra-sostituzione';

const STATI = ['da_verificare', 'verificata', 'corretta', 'annullata'];

/**
 * LA TABELLA DELLE SOSTITUZIONI (§16.9) vista dal nutrizionista.
 *
 * Tre mestieri, e sono tre mestieri diversi:
 *  - **guardare**: cosa hanno chiesto le clienti, quante volte, e cosa non ha ancora guardato
 *    nessuno. È la coda `da_verificare`;
 *  - **decidere**: validare, correggere il sostituto, annullare — o scrivere a mano una riga che
 *    nessuna conversazione ha prodotto («a Giulia il pomodoro crudo lo sostituiamo sempre»);
 *  - **promuovere**: portare una riga validata nei gruppi di equivalenza, che è l'unico posto in
 *    cui il motore la userà per tutte. Un caso per volta, con una persona che decide: vedi
 *    `promuovi-a-regola.ts`.
 *
 * ⚠️ Quello che questo servizio NON fa: toccare il menu. La riga qui è memoria, il piatto di oggi
 * sta in `menu_day.meals` e lo corregge `SostituzioneChatService.correggiCambioInChat`. Se un
 * giorno le due cose si confondono, il primo bug sarà una nutrizionista che «annulla» una riga
 * vecchia e si ritrova cambiato il pranzo di domani.
 */
@Injectable()
export class FoodSwapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Lo `Staff.id` di chi sta agendo (null se non ha una scheda staff: non è un errore). */
  private async staffDi(userId: string): Promise<string | null> {
    const s = (await this.prisma.staff.findUnique({ where: { userId }, select: { id: true } })) as { id: string } | null;
    return s?.id ?? null;
  }

  /**
   * L'elenco. `stato=da_verificare` è la coda, `alimento=carote` cerca per RADICE — «carota» e
   * «Carote» rispondono alla stessa ricerca, che è tutto il motivo per cui `fromKey` esiste.
   */
  async list(filtri: { stato?: string; clientId?: string; alimento?: string; take?: number }) {
    const alimento = filtri.alimento?.trim();
    const chiave = alimento ? chiaveAlimento(alimento) : null;
    return this.prisma.foodSwap.findMany({
      where: {
        ...(filtri.stato ? { stato: filtri.stato } : {}),
        ...(filtri.clientId ? { clientId: filtri.clientId } : {}),
        // `startsWith` e non uguaglianza: «yogurt» deve trovare anche «yogurt greco». Il confronto
        // fine per parola resta a `combaciaAlimento`; qui serve restringere, non decidere.
        ...(chiave ? { OR: [{ fromKey: { startsWith: chiave } }, { toKey: { startsWith: chiave } }] } : {}),
      } as never,
      orderBy: [{ stato: 'asc' }, { ultimaVoltaIl: 'desc' }],
      take: Math.min(filtri.take ?? 500, 1000),
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        validataDa: { select: { displayName: true } },
        creataDa: { select: { displayName: true } },
        promossaGruppo: { select: { id: true, name: true, status: true } },
      },
    } as never);
  }

  /**
   * Riga scritta a mano dal nutrizionista.
   *
   * Nasce già `verificata`: l'ha scritta chi avrebbe dovuto verificarla, e farla comparire nella
   * propria coda «da guardare» sarebbe una presa in giro. La differenza con una riga da chat resta
   * leggibile in `origine`.
   */
  async crea(userId: string, dto: CreaSostituzioneDto) {
    const from = dto.from.trim();
    const to = dto.to.trim();
    const chiave = chiaveSostituzione({ clientId: dto.clientId, recipeId: dto.recipeId, from, to });
    const staffId = await this.staffDi(userId);
    const adesso = new Date();

    const esistente = (await this.prisma.foodSwap.findUnique({ where: { chiave }, select: { id: true } })) as { id: string } | null;
    if (esistente) {
      // Non è un errore da mostrare come tale: la richiesta esiste già, e quello che il
      // nutrizionista voleva ottenere — che sia scritta e valida — glielo diamo lo stesso.
      throw new BadRequestException('Questa sostituzione è già in tabella per questa cliente e questo piatto: aprila e validala da lì.');
    }

    const creata = await this.prisma.foodSwap.create({
      data: {
        chiave,
        clientId: dto.clientId,
        recipeId: dto.recipeId ?? null,
        dishName: dto.dishName ?? null,
        mealSlot: dto.mealSlot ?? null,
        tipo: dto.tipo ?? 'ingrediente',
        fromFood: from,
        toFood: to,
        fromKey: chiaveAlimento(from),
        toKey: chiaveAlimento(to),
        fromQty: dto.fromQty ?? null,
        toQty: dto.toQty ?? null,
        unit: dto.unit ?? null,
        motivo: dto.motivo ?? null,
        dietId: dto.dietId ?? null,
        origine: 'manuale',
        stato: 'verificata',
        nota: dto.nota ?? null,
        creataDaId: staffId,
        validataDaId: staffId,
        validataIl: adesso,
        primaVoltaIl: adesso,
        ultimaVoltaIl: adesso,
      } as never,
    });
    await this.audit.log({
      action: 'food_swap.create',
      actorId: userId,
      entityType: 'food_swap',
      entityId: (creata as { id: string }).id,
      metadata: { clientId: dto.clientId, from, to, origine: 'manuale' },
    });
    return creata;
  }

  /** Validare, correggere il sostituto, annullare, o solo lasciare una nota. */
  async aggiorna(userId: string, id: string, dto: AggiornaSostituzioneDto) {
    const riga = (await this.prisma.foodSwap.findUnique({ where: { id } })) as
      | { id: string; clientId: string; fromFood: string; toFood: string; stato: string }
      | null;
    if (!riga) throw new NotFoundException('Sostituzione non trovata.');
    if (dto.stato && !STATI.includes(dto.stato)) throw new BadRequestException('Stato non valido.');

    const data: Record<string, unknown> = {};
    if (dto.to !== undefined) {
      const to = dto.to.trim();
      data.toFood = to;
      data.toKey = chiaveAlimento(to);
      // ⚠️ La `chiave` NON si ricalcola: è l'identità della riga, e cambiandola due righe diverse
      // potrebbero collidere sull'indice unico — un errore 500 in faccia a chi stava solo
      // correggendo una parola. Il prezzo è che una riga corretta non si accorpa più con la
      // richiesta identica che arriverà domani, e va bene così: una collisione a caso è peggio.
    }
    if (dto.toQty !== undefined) data.toQty = dto.toQty;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.nota !== undefined) data.nota = dto.nota;
    if (dto.stato !== undefined) {
      data.stato = dto.stato;
      data.validataDaId = await this.staffDi(userId);
      data.validataIl = new Date();
    }
    if (!Object.keys(data).length) return riga;

    const aggiornata = await this.prisma.foodSwap.update({ where: { id }, data: data as never });
    await this.audit.log({
      action: 'food_swap.update',
      actorId: userId,
      entityType: 'food_swap',
      entityId: id,
      metadata: { clientId: riga.clientId, da: riga.fromFood, statoPrima: riga.stato, ...dto },
    });
    return aggiornata;
  }

  /**
   * «PROMUOVI A REGOLA»: la riga validata diventa (o entra in) un gruppo di equivalenza.
   *
   * Due cancelli prima di toccare qualsiasi cosa, e sono i due modi in cui questa funzione farebbe
   * danno: promuovere una riga che nessuno ha guardato, e promuovere due volte la stessa.
   */
  async promuovi(userId: string, id: string) {
    const riga = (await this.prisma.foodSwap.findUnique({
      where: { id },
      include: { client: { select: { firstName: true, lastName: true, email: true } } },
    })) as
      | {
          id: string;
          stato: string;
          fromFood: string;
          toFood: string;
          dietId: string | null;
          dishName: string | null;
          promossaGruppoId: string | null;
          client: { firstName: string | null; lastName: string | null; email: string } | null;
        }
      | null;
    if (!riga) throw new NotFoundException('Sostituzione non trovata.');
    if (riga.promossaGruppoId) throw new BadRequestException('Questa sostituzione è già stata promossa a regola.');
    if (riga.stato !== 'verificata' && riga.stato !== 'corretta') {
      throw new BadRequestException(
        'Si promuove solo una sostituzione già validata: prima guardala e confermala (o correggila), poi portala nei gruppi.',
      );
    }

    // I gruppi che potrebbero già coprirla: i globali e quelli della dieta di questa giornata.
    // Non tutti: un gruppo scritto per la chetogenica non dice niente su una mediterranea.
    const gruppi = (await this.prisma.equivalenceGroup.findMany({
      where: { OR: [{ productId: null }, ...(riga.dietId ? [{ productId: riga.dietId }] : [])] } as never,
      select: { id: true, name: true, status: true, productId: true, members: true },
    })) as { id: string; name: string; status: string; productId: string | null; members: unknown }[];

    const candidati: GruppoCandidato[] = gruppi.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
      productId: g.productId,
      items: ((g.members as { items?: string[] } | null)?.items ?? []).filter((i) => typeof i === 'string'),
    }));

    const scelta = decidiPromozione(riga.fromFood, riga.toFood, candidati);
    const nomeCliente = [riga.client?.firstName, riga.client?.lastName].filter(Boolean).join(' ') || riga.client?.email || 'una cliente';
    // Il contesto va SCRITTO nel gruppo: senza, fra sei mesi «pane ↔ gallette» è una regola senza
    // storia, e chi la rilegge non sa se nasce da un'allergia, da un gusto o da un errore.
    const provenienza =
      `Da una sostituzione concordata con ${nomeCliente}` +
      (riga.dishName ? ` su «${riga.dishName}»` : '') +
      ' e validata in tabella sostituzioni.';

    let gruppoId: string;
    let messaggio: string;

    if (scelta.azione === 'gia_regola') {
      gruppoId = scelta.gruppoId;
      messaggio = `Il motore lo sa già: «${scelta.nomeGruppo}» è un gruppo approvato che contiene tutti e due gli alimenti. Non ho creato niente.`;
    } else if (scelta.azione === 'aggiungi') {
      gruppoId = scelta.gruppoId;
      const attuale = candidati.find((g) => g.id === scelta.gruppoId)!;
      const items = [...attuale.items, ...scelta.daAggiungere];
      /**
       * ⛔ **QUELLO CHE C'ERA DENTRO `members` NON SI PERDE** — corretto in revisione, 25/8.
       *
       * `members` è un JSON e ci vive più di una cosa: gli `items`, la `note` con la provenienza e —
       * dal 25/8 — i **`fattori`**, cioè i pesi dei grassi firmati dal capo nutrizionista. Questa
       * riga li riscriveva tutti da capo tenendo solo `items` e `note`: promuovere una sostituzione
       * qualsiasi dentro il gruppo dei condimenti ne avrebbe **cancellato la tabella**, e da lì in
       * poi Gaia sarebbe tornata alla pari grammatura senza che nessuno l'avesse deciso.
       *
       * ⚠️ Si copia il resto e si sovrascrivono solo gli `items`: chi scrive un campo di un oggetto
       * condiviso deve partire da quello che c'è, non da quello che si ricorda.
       */
      const prev = (gruppi.find((g) => g.id === scelta.gruppoId)?.members ?? {}) as Record<string, unknown>;
      await this.prisma.equivalenceGroup.update({
        where: { id: scelta.gruppoId },
        data: { members: { ...prev, items, ...(prev.note ? { note: prev.note } : {}) } as never },
      });
      messaggio = scelta.daAggiungere.length
        ? `Aggiunto ${scelta.daAggiungere.map((s) => `«${s}»`).join(' e ')} al gruppo in bozza «${scelta.nomeGruppo}».`
        : `La bozza «${scelta.nomeGruppo}» li conteneva già tutti e due: ho collegato la riga senza toccarla.`;
    } else {
      const creato = (await this.prisma.equivalenceGroup.create({
        data: {
          name: nomeGruppoDaSostituzione(riga.fromFood, riga.toFood),
          productId: riga.dietId ?? null,
          members: { items: scelta.items, note: provenienza } as never,
          // ⚠️ Sempre in BOZZA. Il motore usa solo i gruppi approvati: una scelta fatta per una
          // cliente non deve cambiare i menu di tutte perché qualcuno ha premuto un pulsante.
          status: 'draft',
          version: 1,
        } as never,
      })) as { id: string; name: string };
      gruppoId = creato.id;
      messaggio = `Creato il gruppo in bozza «${creato.name}»: il motore lo userà solo dopo che qualcuno lo approva.`;
    }

    await this.prisma.foodSwap.update({
      where: { id },
      data: { promossaGruppoId: gruppoId, promossaIl: new Date() } as never,
    });
    await this.audit.log({
      action: 'food_swap.promossa_a_regola',
      actorId: userId,
      entityType: 'food_swap',
      entityId: id,
      metadata: { azione: scelta.azione, gruppoId, da: riga.fromFood, a: riga.toFood, dietId: riga.dietId },
    });

    // Avviso ai capi nutrizionisti solo quando c'è qualcosa da approvare. Su `gia_regola` non è
    // successo niente: mandare una notifica per dire «non ho fatto niente» è il modo di insegnare a
    // ignorarle.
    if (scelta.azione !== 'gia_regola') {
      await avvisaCapiNutrizionisti(
        this.prisma,
        this.notifications,
        {
          type: 'equivalence_group_new',
          title: 'Gruppo di equivalenza da approvare',
          body: `«${riga.fromFood}» ↔ «${riga.toFood}» arriva dalle sostituzioni concordate con le clienti ed è in bozza: il motore non lo usa finché non lo approvi.`,
          payload: { kind: 'equivalence_group_new', groupId: gruppoId, status: 'draft', foodSwapId: id },
        },
        userId,
      );
    }

    return { gruppoId, azione: scelta.azione, messaggio };
  }

  async elimina(userId: string, id: string) {
    const riga = (await this.prisma.foodSwap.findUnique({ where: { id }, select: { id: true, clientId: true, fromFood: true, toFood: true } })) as
      | { id: string; clientId: string; fromFood: string; toFood: string }
      | null;
    if (!riga) throw new NotFoundException('Sostituzione non trovata.');
    await this.prisma.foodSwap.delete({ where: { id } });
    await this.audit.log({
      action: 'food_swap.delete',
      actorId: userId,
      entityType: 'food_swap',
      entityId: id,
      metadata: { clientId: riga.clientId, da: riga.fromFood, a: riga.toFood },
    });
    return { ok: true };
  }
}
