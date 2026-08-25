import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { giornoPiu, toDateOnly } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { festivita } from './festivi';
import {
  erroreDelloSlot,
  istanteRomano,
  occorrenze,
  oraDaMinuti,
  slotInConflitto,
  type PeriodoChiuso,
  type SlotDefinito,
} from './settimana-tipo';

/** Quanto lontano si può guardare in avanti chiedendo gli orari liberi. */
const ORIZZONTE_GIORNI = 60;

interface RigaSlot {
  id: string;
  nutritionistId: string;
  weekday: number | null;
  date: Date | null;
  startMin: number;
  endMin: number;
  repeats: boolean;
  type: string;
  active: boolean;
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * §16.7 — L'AGENDA DEL NUTRIZIONISTA: la sua settimana tipo e i giorni in cui non riceve.
 *
 * Questo servizio non prenota niente: costruisce **l'offerta**. La prenotazione (lato cliente) è
 * l'altra metà, e tenerle separate non è una divisione di comodo — sono due mestieri con due
 * perimetri diversi: qui si scrive la propria agenda, là si occupa il tempo di un'altra persona.
 *
 * ## Le tre regole che decidono tutto
 *
 * 1. **Niente sovrapposizioni alla creazione** (Simone: «collisioni impossibili»). Uno slot che si
 *    accavalla a un altro non nasce. Sorvegliare le collisioni alla prenotazione vorrebbe dire
 *    scoprirle quando due clienti hanno già premuto il pulsante.
 * 2. **Un giorno con appuntamenti non si chiude** (decisione del 12/8). Se il nutrizionista mette
 *    le ferie sopra una giornata già prenotata, l'operazione viene rifiutata con l'elenco degli
 *    appuntamenti da spostare. Nessuna cliente perde una visita a sua insaputa, e a decidere è chi
 *    conosce quelle pazienti.
 * 3. **Ritirare uno slot non cancella gli appuntamenti presi.** Se ci sono visite future su quello
 *    slot, lo slot si **disattiva** (esce dagli orari prenotabili, resta a database); solo se non
 *    ne ha si cancella davvero.
 */
@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** La scheda Staff di chi sta agendo. Senza, non c'è nessuna agenda di cui parlare. */
  private async staffDi(userId: string): Promise<{ id: string; displayName: string }> {
    const s = (await this.prisma.staff.findUnique({
      where: { userId },
      select: { id: true, displayName: true },
    })) as { id: string; displayName: string } | null;
    if (!s) throw new ForbiddenException('Questa agenda è di chi riceve le clienti: il tuo account non ha una scheda staff.');
    return s;
  }

  private come(r: RigaSlot): SlotDefinito {
    return {
      id: r.id,
      weekday: r.weekday,
      data: r.date ? iso(r.date) : null,
      inizioMin: r.startMin,
      fineMin: r.endMin,
      ripete: r.repeats,
    };
  }

  // ---------- Slot ----------

  async miaSettimana(userId: string) {
    const staff = await this.staffDi(userId);
    const slots = (await this.prisma.visitSlot.findMany({
      where: { nutritionistId: staff.id },
      orderBy: [{ repeats: 'desc' }, { weekday: 'asc' }, { date: 'asc' }, { startMin: 'asc' }],
    })) as RigaSlot[];
    return slots.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      data: s.date ? iso(s.date) : null,
      inizio: oraDaMinuti(s.startMin),
      fine: oraDaMinuti(s.endMin),
      ripete: s.repeats,
      tipo: s.type,
      attivo: s.active,
    }));
  }

  async creaSlot(
    userId: string,
    dto: { inizio: string; fine: string; ripete: boolean; weekday?: number | null; data?: string | null; tipo?: string },
  ) {
    const staff = await this.staffDi(userId);
    const inizioMin = this.minuti(dto.inizio, 'inizio');
    const fineMin = this.minuti(dto.fine, 'fine');

    const errore = erroreDelloSlot({
      inizioMin,
      fineMin,
      ripete: dto.ripete,
      weekday: dto.ripete ? dto.weekday ?? null : null,
      data: dto.ripete ? null : dto.data ?? null,
    });
    if (errore) throw new BadRequestException(errore);

    // Una giornata straordinaria nel passato non serve a nessuno: nessuno può prenotarla.
    if (!dto.ripete && dto.data && dto.data < iso(toDateOnly())) {
      throw new BadRequestException('Quella data è già passata: nessuno potrebbe prenotarla.');
    }

    const nuovo: SlotDefinito = {
      id: 'nuovo',
      weekday: dto.ripete ? dto.weekday ?? null : null,
      data: dto.ripete ? null : dto.data ?? null,
      inizioMin,
      fineMin,
      ripete: dto.ripete,
    };
    const esistenti = (await this.prisma.visitSlot.findMany({
      where: { nutritionistId: staff.id, active: true },
    })) as RigaSlot[];
    const collide = slotInConflitto(nuovo, esistenti.map((e) => this.come(e)));
    if (collide) {
      // L'errore dice CON QUALE si accavalla: «si sovrappone a uno esistente» costringe a cercarlo
      // a mano in mezzo a trenta righe.
      throw new BadRequestException(
        `Questo orario si accavalla con ${oraDaMinuti(collide.inizioMin)}–${oraDaMinuti(collide.fineMin)}` +
          `${collide.ripete ? ' (che si ripete ogni settimana)' : ` del ${collide.data}`}. Cambia l'orario o togli l'altro.`,
      );
    }

    const creato = await this.prisma.visitSlot.create({
      data: {
        nutritionistId: staff.id,
        weekday: dto.ripete ? dto.weekday ?? null : null,
        date: dto.ripete ? null : toDateOnly(dto.data ?? undefined),
        startMin: inizioMin,
        endMin: fineMin,
        repeats: dto.ripete,
        type: dto.tipo === 'televisit' ? 'televisit' : 'in_person',
      } as never,
    });
    await this.audit.log({
      action: 'agenda.slot.create',
      actorId: userId,
      entityType: 'visit_slot',
      entityId: (creato as { id: string }).id,
      metadata: { ...dto, nutritionistId: staff.id },
    });
    return creato;
  }

  /**
   * Ritira uno slot. Se ci sono visite FUTURE che lo occupano non si cancella: si disattiva.
   *
   * Cancellarlo lascerebbe quelle visite senza lo slot da cui vengono (il `SET NULL` della
   * migrazione le protegge dal cadere, non dal perdere il contesto), e soprattutto suonerebbe come
   * «tolgo l'orario» quando invece c'è già una persona che ha preso quel posto.
   */
  async eliminaSlot(userId: string, id: string) {
    const staff = await this.staffDi(userId);
    const slot = (await this.prisma.visitSlot.findUnique({ where: { id } })) as RigaSlot | null;
    if (!slot) throw new NotFoundException('Orario non trovato.');
    if (slot.nutritionistId !== staff.id) throw new ForbiddenException('Questo orario è di un\'altra persona.');

    const prenotate = await this.prisma.visit.count({
      where: { slotId: id, datetime: { gte: new Date() }, status: 'scheduled' as never },
    });
    if (prenotate > 0) {
      await this.prisma.visitSlot.update({ where: { id }, data: { active: false } });
      await this.audit.log({ action: 'agenda.slot.disattivato', actorId: userId, entityType: 'visit_slot', entityId: id, metadata: { prenotate } });
      return {
        ok: true,
        disattivato: true,
        messaggio: `Orario tolto dalla prenotazione. ⚠️ ${prenotate} appuntament${prenotate === 1 ? 'o' : 'i'} già fissat${prenotate === 1 ? 'o resta' : 'i restano'} in agenda: quelli vanno spostati a mano.`,
      };
    }
    await this.prisma.visitSlot.delete({ where: { id } });
    await this.audit.log({ action: 'agenda.slot.delete', actorId: userId, entityType: 'visit_slot', entityId: id });
    return { ok: true, disattivato: false, messaggio: 'Orario tolto.' };
  }

  // ---------- Ferie ----------

  async mieFerie(userId: string) {
    const staff = await this.staffDi(userId);
    const righe = (await this.prisma.staffTimeOff.findMany({
      where: { staffId: staff.id, al: { gte: toDateOnly() } },
      orderBy: { dal: 'asc' },
    })) as { id: string; dal: Date; al: Date; motivo: string | null }[];
    return righe.map((r) => ({ id: r.id, dal: iso(r.dal), al: iso(r.al), motivo: r.motivo }));
  }

  /**
   * ⚠️ Un giorno con appuntamenti NON si chiude.
   *
   * Decisione del 12/8, ed è la regola più importante di tutto il file: le ferie non annullano le
   * visite. Se nel periodo ci sono appuntamenti fissati, l'operazione viene rifiutata dicendo
   * quali sono — così li sposta lui, che sa chi sono quelle pazienti, invece di scoprirlo la
   * cliente trovandosi la visita sparita.
   */
  async creaFerie(userId: string, dto: { dal: string; al: string; motivo?: string | null }) {
    const staff = await this.staffDi(userId);
    const dal = toDateOnly(dto.dal);
    const al = toDateOnly(dto.al);
    if (al.getTime() < dal.getTime()) throw new BadRequestException('La data di fine viene prima di quella di inizio.');
    if (iso(al) < iso(toDateOnly())) throw new BadRequestException('Quel periodo è già passato.');

    /**
     * Le visite del periodo, ESTREMI COMPRESI.
     *
     * ⚠️ Il confine di destra è la mezzanotte del giorno DOPO `al`: `al` è una giornata intera, e
     * fermarsi alla sua mezzanotte vorrebbe dire non vedere l'appuntamento delle 18 dell'ultimo
     * giorno — cioè chiudere per ferie proprio il giorno che aveva un appuntamento.
     */
    /**
     * ⚠️ **`+ 86_400_000`, non `setDate`** (24/8): `al` è una mezzanotte UTC scritta da `toDateOnly`,
     * e `setDate` somma il giorno nel fuso del **processo** conservando l'ora di parete. Su Render
     * `TZ` non è impostata e i due conti coincidono; con `TZ=Europe/Rome` — cioè su ogni portatile
     * del team — il **28 marzo 2027** `setDate` su `2027-03-28T00:00:00Z` rende ancora il 28, non il
     * 29: la finestra si accorcia di un giorno e l'ultimo giorno di ferie smette di essere guardato.
     * Misurato il 24/8 in revisione, un giorno all'anno, per sempre. Su una mezzanotte UTC la somma
     * in millisecondi è esatta perché UTC non ha cambi d'ora.
     */
    const fineInclusa = new Date(al.getTime() + 86_400_000);
    const tutte = (await this.prisma.visit.findMany({
      where: {
        nutritionistId: staff.id,
        status: 'scheduled' as never,
        datetime: { gte: istanteRomano(iso(dal), 0), lt: istanteRomano(iso(fineInclusa), 0) },
      },
      orderBy: { datetime: 'asc' },
      take: 20,
      select: { id: true, datetime: true, client: { select: { firstName: true, lastName: true, email: true } } },
    })) as { id: string; datetime: Date; client: { firstName: string | null; lastName: string | null; email: string } | null }[];

    if (tutte.length) {
      const elenco = tutte
        .slice(0, 5)
        .map((v) => {
          const nome = [v.client?.firstName, v.client?.lastName].filter(Boolean).join(' ') || v.client?.email || 'una cliente';
          return `${new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(v.datetime)} · ${nome}`;
        })
        .join(' · ');
      throw new BadRequestException(
        `In quel periodo hai ${tutte.length} appuntament${tutte.length === 1 ? 'o' : 'i'} già fissat${tutte.length === 1 ? 'o' : 'i'}: ` +
          `${elenco}${tutte.length > 5 ? ' …' : ''}. Spostali o annullali prima di chiudere i giorni.`,
      );
    }

    const creato = await this.prisma.staffTimeOff.create({
      data: { staffId: staff.id, dal, al, motivo: dto.motivo?.trim() || null } as never,
    });
    await this.audit.log({
      action: 'agenda.ferie.create',
      actorId: userId,
      entityType: 'staff_time_off',
      entityId: (creato as { id: string }).id,
      metadata: { dal: dto.dal, al: dto.al },
    });
    return creato;
  }

  async eliminaFerie(userId: string, id: string) {
    const staff = await this.staffDi(userId);
    const riga = (await this.prisma.staffTimeOff.findUnique({ where: { id } })) as { id: string; staffId: string } | null;
    if (!riga) throw new NotFoundException('Periodo non trovato.');
    if (riga.staffId !== staff.id) throw new ForbiddenException('Quel periodo è di un\'altra persona.');
    await this.prisma.staffTimeOff.delete({ where: { id } });
    await this.audit.log({ action: 'agenda.ferie.delete', actorId: userId, entityType: 'staff_time_off', entityId: id });
    return { ok: true };
  }

  // ---------- Cosa si vedrà ----------

  /**
   * Gli orari **prenotabili** di un nutrizionista fra due date: la settimana tipo srotolata, meno
   * le ferie, meno i festivi, meno quelli già presi.
   *
   * È la stessa funzione che userà la cliente per scegliere e che il nutrizionista usa per
   * controllare com'è venuta la sua settimana. Averne una sola è quello che impedisce che
   * l'anteprima mostri una cosa e la prenotazione ne offra un'altra.
   */
  async orariLiberi(nutritionistId: string, dalIso: string, alIso: string) {
    const oggi = iso(toDateOnly());
    const dal = dalIso < oggi ? oggi : dalIso;
    /**
     * ⚠️ **`giornoPiu`, non `setDate`** (25/8): stessa ragione già scritta per `+ 86_400_000` in
     * `creaFerie`, settanta righe più su — questa ne era la **copia non corretta**. `setDate` somma
     * il giorno nel fuso del processo: con `TZ=Europe/Rome`, il 28 marzo 2027 l'orizzonte si accorcia
     * di un giorno. Due punti che rispondono alla stessa domanda: adesso chiamano la stessa funzione.
     */
    const limite = giornoPiu(toDateOnly(dal), ORIZZONTE_GIORNI);
    const al = alIso > iso(limite) ? iso(limite) : alIso;

    const [slots, chiusure, prese] = await Promise.all([
      this.prisma.visitSlot.findMany({ where: { nutritionistId, active: true } }) as Promise<RigaSlot[]>,
      this.prisma.staffTimeOff.findMany({ where: { staffId: nutritionistId } }) as Promise<{ dal: Date; al: Date }[]>,
      this.prisma.visit.findMany({
        where: {
          nutritionistId,
          status: 'scheduled' as never,
          datetime: { gte: istanteRomano(dal, 0) },
        },
        select: { slotId: true, datetime: true },
      }) as Promise<{ slotId: string | null; datetime: Date }[]>,
    ]);

    const ferie: PeriodoChiuso[] = chiusure.map((c) => ({ dal: iso(c.dal), al: iso(c.al) }));
    // Chiave «slot + giorno»: è così che uno slot ricorrente risulta occupato SOLO il giorno in cui
    // qualcuno l'ha preso, e resta libero tutte le altre settimane.
    const occupati = new Set(
      prese
        .filter((p) => p.slotId)
        .map((p) => `${p.slotId}|${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(p.datetime)}`),
    );

    return occorrenze(slots.map((s) => this.come(s)), ferie, dal, al)
      .filter((o) => !occupati.has(`${o.slotId}|${o.data}`))
      .map((o) => ({
        slotId: o.slotId,
        data: o.data,
        inizio: oraDaMinuti(o.inizioMin),
        fine: oraDaMinuti(o.fineMin),
        inizioIso: istanteRomano(o.data, o.inizioMin).toISOString(),
        tipo: slots.find((s) => s.id === o.slotId)?.type ?? 'in_person',
        festivita: festivita(o.data),
      }));
  }

  /** L'anteprima della PROPRIA settimana, per il backoffice. */
  async mieiOrariLiberi(userId: string, dal: string, al: string) {
    const staff = await this.staffDi(userId);
    return this.orariLiberi(staff.id, dal, al);
  }

  private minuti(ora: string, quale: 'inizio' | 'fine'): number {
    const m = /^(\d{1,2}):(\d{2})$/.exec((ora ?? '').trim());
    if (!m) throw new BadRequestException(`L'ora di ${quale} non è valida: scrivila come 09:30.`);
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) throw new BadRequestException(`L'ora di ${quale} non esiste.`);
    return h * 60 + min;
  }
}
