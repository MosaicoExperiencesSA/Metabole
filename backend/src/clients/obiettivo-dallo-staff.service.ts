import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { giornoLocale } from '../common/date-only';
import { ConfigParamsService } from '../config-params/config-params.service';
import { KcalNeedService } from '../menu/kcal-need.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';
import { testoNotaObiettivo, valutaObiettivoDalloStaff } from './obiettivo-dallo-staff';

export interface ObiettivoDalloStaffInput {
  targetWeightKg: number;
  targetDate: string;
  /** `undefined` = non toccato; `null` = tolto. */
  targetWaistCm?: number | null;
  targetHipsCm?: number | null;
  motivo: string;
  conferma?: boolean;
}

/**
 * ⛔ **LO STAFF CAMBIA L'OBIETTIVO DI UNA CLIENTE** (Simone, 15/9). La porta è
 * `PATCH /clients/:id/objective`, sotto la chiave `change_objective` (di default solo admin).
 *
 * ⚠️ **Il perimetro è quello della scheda** (`ClientsService.assertClientAccess`), non una copia:
 * due risposte alla domanda «questa cliente è tua?» divergono, e qui una divergenza vuol dire
 * cambiare l'obiettivo alla cliente di un'altra.
 *
 * ⚠️ **Cosa cambia dopo il salvataggio, nell'ordine in cui conta:**
 * 1. l'obiettivo, con lo **stato «confermato»** — lo ha deciso lo staff, non va riconfermato — e la
 *    riga `updated_by_staff` nello storico (`history`), con prima, dopo, chi e perché;
 * 2. i **menu futuri già erogati**, rifatti con la stessa strada del cambio calorie
 *    (`redeliverFutureDays`): il deficit viene dall'obiettivo, e senza questo passo la cliente
 *    mangerebbe per giorni le calorie di prima. Le giornate scritte a mano restano, e se lei ne
 *    aveva già aperte la strada la avvisa da sola.
 *    ⛔ **Solo se le calorie sono cambiate davvero** (revisione del 15/9): rifare sette giorni per
 *    una circonferenza, o con un deficit imposto a mano che rende l'obiettivo muto, le cambia i
 *    piatti — e magari le manda l'avviso «menu cambiato» — per niente;
 * 3. una **nota in scheda** e l'**audit** — best-effort la prima, come per le calorie: se non nasce,
 *    l'obiettivo è già cambiato e far fallire tutto rimetterebbe in discussione una scrittura
 *    avvenuta. Ma non in silenzio.
 */
@Injectable()
export class ObiettivoDalloStaffService {
  private readonly logger = new Logger(ObiettivoDalloStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly audit: AuditService,
    private readonly configParams: ConfigParamsService,
    private readonly kcalNeed: KcalNeedService,
    private readonly menu: MenuService,
  ) {}

  async aggiorna(clientId: string, actorId: string, input: ObiettivoDalloStaffInput) {
    await this.clients.assertClientAccess(actorId, clientId);
    // ⚠️ `deletedAt: null`, come la scheda: una cliente cancellata non ha un obiettivo da cambiare.
    const user = (await this.prisma.user.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { role: true },
    })) as { role: string } | null;
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') throw new BadRequestException("L'obiettivo si cambia solo alle clienti.");

    const motivo = String(input.motivo ?? '').trim();
    if (motivo.length < 3) {
      throw new BadRequestException('Scrivi il motivo della modifica: fra tre mesi lo leggerà qualcuno che non c’era.');
    }

    /**
     * ⚠️ **La stima NON ha un `.catch`**: un errore qui trattato come «nessun peso» farebbe passare
     * un ritmo irreale senza conferma. Meglio un 500 prima di scrivere che un obiettivo sbagliato.
     */
    const [attuale, prima, profilo, sogliaSostenibile, sogliaAmbiziosa] = await Promise.all([
      this.prisma.objective.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' } }),
      this.kcalNeed.estimate(clientId),
      this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { startWeightKg: true, objective: true, kcalDeficitOverride: true },
      }) as Promise<{ startWeightKg: number | null; objective: string | null; kcalDeficitOverride: number | null } | null>,
      this.configParams.getNumber('sustainable_rate_max_kg_week', 0.7),
      this.configParams.getNumber('ambitious_rate_max_kg_week', 1.0),
    ]);

    /**
     * Il peso del ritmo: la tendenza, se il fabbisogno la usa. Altrimenti (pesate incoerenti,
     * profilo incompleto) l'ultima pesata, e poi il peso di partenza.
     */
    const tendenza = prima && !prima.pesoIncoerente ? prima.weightKg : null;
    let pesoPerIlRitmo: number | null = tendenza;
    if (pesoPerIlRitmo == null) {
      const ultima = (await this.prisma.measurement.findFirst({
        where: { clientId },
        orderBy: { date: 'desc' },
        select: { weightKg: true },
      })) as { weightKg: number | null } | null;
      pesoPerIlRitmo = ultima?.weightKg ?? profilo?.startWeightKg ?? null;
    }

    const data = String(input.targetDate).trim();
    const dataDiPrima = attuale?.targetDate ? giornoLocale(attuale.targetDate) : null;
    const pesoNuovo = Math.round(Number(input.targetWeightKg) * 10) / 10;

    /**
     * ⛔ **Niente da cambiare, niente da scrivere.** Senza questo controllo un «Salva» a valori
     * identici rifaceva lo storico, la nota e l'audit di una modifica che non c'è stata.
     */
    if (
      attuale &&
      attuale.targetWeightKg === pesoNuovo &&
      dataDiPrima === data &&
      (input.targetWaistCm === undefined || input.targetWaistCm === attuale.targetWaistCm) &&
      (input.targetHipsCm === undefined || input.targetHipsCm === attuale.targetHipsCm)
    ) {
      throw new BadRequestException("Nessuna modifica: l'obiettivo è già questo.");
    }

    const esito = valutaObiettivoDalloStaff({
      richiesta: { targetWeightKg: input.targetWeightKg, targetDate: data, conferma: input.conferma === true },
      pesoPerIlRitmo,
      pesoDaUnaPesata: tendenza == null && pesoPerIlRitmo != null,
      oggi: giornoLocale(new Date()),
      dataDiPrima,
      deficitImposto: (profilo?.kcalDeficitOverride ?? 0) > 0,
      inMantenimento: profilo?.objective === 'mantenimento',
      sogliaSostenibile,
      sogliaAmbiziosa,
    });
    if (esito.esito === 'rifiuta') throw new BadRequestException(esito.messaggio);
    if (esito.esito === 'da_confermare') {
      throw new ConflictException({ message: esito.messaggio, daConfermare: true, ritmo: esito.ritmo });
    }

    const staff = (await this.prisma.staff.findUnique({
      where: { userId: actorId },
      select: { id: true, displayName: true },
    })) as { id: string; displayName: string | null } | null;

    const nuovo = {
      targetWeightKg: pesoNuovo,
      targetDate: new Date(`${data}T00:00:00.000Z`),
      ...(input.targetWaistCm !== undefined ? { targetWaistCm: input.targetWaistCm } : {}),
      ...(input.targetHipsCm !== undefined ? { targetHipsCm: input.targetHipsCm } : {}),
    };
    const history = Array.isArray(attuale?.history) ? [...(attuale!.history as unknown[])] : [];
    history.push({
      at: new Date().toISOString(),
      event: 'updated_by_staff',
      byStaffId: staff?.id ?? null,
      byUserId: actorId,
      motivo,
      prima: attuale
        ? {
            targetWeightKg: attuale.targetWeightKg,
            targetDate: attuale.targetDate?.toISOString() ?? null,
            targetWaistCm: attuale.targetWaistCm,
            targetHipsCm: attuale.targetHipsCm,
            status: attuale.status,
          }
        : null,
      dopo: { ...nuovo, targetDate: nuovo.targetDate.toISOString() },
      ritmo: esito.ritmo,
    });

    /**
     * ⚠️ **`updatedAt` nel `where`**: fra la lettura e la scrittura la cliente può aver cambiato
     * l'obiettivo dall'app, e scrivere sopra perderebbe la sua riga di storico senza che nessuno lo
     * sappia. Se è cambiato, si chiede di ricaricare. 412 e non 409: il 409 qui vuol dire «conferma
     * il ritmo», e la pagina lo legge così.
     */
    let scritto;
    try {
      scritto = attuale
        ? await this.prisma.objective.update({
            where: { id: attuale.id, updatedAt: attuale.updatedAt },
            data: { ...nuovo, status: 'confirmed', history: history as never },
          })
        : await this.prisma.objective.create({
            data: { clientId, ...nuovo, status: 'confirmed', history: history as never },
          });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new PreconditionFailedException(
          "L'obiettivo è appena cambiato (forse dall'app della cliente): ricarica la scheda e riprova.",
        );
      }
      throw e;
    }

    const dopo = await this.kcalNeed.estimate(clientId).catch((e) => {
      this.logger.warn(`Obiettivo cambiato per ${clientId}, ma la stima delle calorie dopo non riesce: ${String(e)}`);
      return null;
    });
    const targetPrima = prima && !prima.pesoIncoerente ? prima.target : null;
    const targetDopo = dopo && !dopo.pesoIncoerente ? dopo.target : null;
    const avvisi = [...esito.avvisi];
    // ⚠️ Il tetto taglia il deficit dedotto: il ritmo scritto non è quello che arriva nel piatto.
    if (dopo?.tettoApplicato && dopo.fonteDeficit === 'calcolato') {
      avvisi.push('Il ritmo chiesto supera il tetto del deficit: nel piatto arriva il massimo consentito, non questo ritmo.');
    }

    const notaInScheda = await this.prisma.clientNote
      .create({
        data: {
          clientId,
          authorId: staff?.id ?? null,
          body: testoNotaObiettivo({
            prima: attuale ? { targetWeightKg: attuale.targetWeightKg, targetDate: attuale.targetDate } : null,
            dopo: { targetWeightKg: nuovo.targetWeightKg, targetDate: data },
            targetPrima,
            targetDopo,
            chi: staff?.displayName?.trim() || 'staff',
            quando: new Date(),
            motivo,
          }).slice(0, 5000),
        } as never,
      })
      .then(() => true)
      .catch((e) => {
        this.logger.warn(`Obiettivo cambiato per ${clientId} ma la nota in scheda NON è stata scritta: ${String(e)}`);
        return false;
      });

    await this.audit.log({
      action: 'client.objective.update',
      actorId,
      entityType: 'objective',
      entityId: scritto.id,
      metadata: {
        clientId,
        motivo,
        prima: attuale ? { targetWeightKg: attuale.targetWeightKg, targetDate: attuale.targetDate?.toISOString() ?? null } : null,
        dopo: { targetWeightKg: nuovo.targetWeightKg, targetDate: data },
        ritmo: esito.ritmo,
        confermatoOltreSoglia: esito.ritmo?.pace === 'unreal',
        targetPrima,
        targetDopo,
        notaInScheda,
      } as never,
    });

    /**
     * ⛔ **Si rifanno solo se le calorie sono cambiate.** Con `dopo` non calcolabile (errore) non si
     * sa, e si rifanno: meglio un giro in più che le calorie vecchie nel piatto.
     *
     * ⚠️ **Il catch non è muto**: se la rierogazione salta, l'obiettivo è cambiato ma nel piatto no,
     * e chi ha premuto lo deve leggere — la pagina lo dice da `menu.errore`.
     */
    const caloriePiattoCambiate = dopo == null || targetPrima !== targetDopo;
    const menu = caloriePiattoCambiate
      ? await this.menu.redeliverFutureDays(clientId).catch((e) => {
          this.logger.warn(`Obiettivo cambiato per ${clientId} ma i menu futuri NON sono stati rifatti: ${String(e)}`);
          return { removed: 0, delivered: [] as string[], ripristinati: 0, errore: true as const };
        })
      : { removed: 0, delivered: [] as string[], ripristinati: 0, saltato: true as const };

    return {
      ok: true,
      objective: scritto,
      ritmo: esito.ritmo,
      avvisi,
      targetPrima,
      targetDopo,
      notaInScheda,
      menu,
    };
  }
}
