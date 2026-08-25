import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { avvisaCapiNutrizionisti } from '../common/avvisa-nutrizionista';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEquivalenceGroupDto,
  UpdateEquivalenceGroupDto,
} from './dto/equivalence.dto';

/**
 * Gruppi di equivalenza (R4/R8): materia prima delle sostituzioni, di proprietà del
 * nutrizionista (workflow draft→approved, versionato). Safety-critical: la logica del
 * motore (E1) userà SOLO i gruppi `approved`. Qui è solo gestione dal backoffice.
 */
/** Quante righe di peso può avere un gruppo. La tabella di Nocanty ne ha 13: il tetto è largo. */
const MAX_PESI = 300;
/** Quanto può essere lungo il nome di una riga. «olio extravergine di oliva» sta in 26 caratteri. */
const MAX_NOME_PESO = 120;
/** Il peso più alto ammesso: grammi per 100 g di riferimento. La panna fresca sta a 285. */
const MAX_PESO = 100_000;

@Injectable()
export class EquivalenceService {
  private readonly logger = new Logger(EquivalenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Membri salvati come `{ items, note?, fattori? }` sul campo Json `members`.
   *
   * ⛔ **`fattori`** — i pesi dei grassi, aggiunti il 25/8 con la risposta di Nocanty: nome →
   * **grammi equivalenti a 100 g del riferimento**. Servono a Gaia per non proporre più i cambi di
   * grasso a pari grammatura (70 ml di panna → 70 g di olio portavano un piatto da 500 kcal a ~890).
   *
   * ⚠️ **Un peso illeggibile si scarta invece di diventare zero**: `Number('')` è 0, e un peso a zero
   * farebbe una divisione per zero dentro la conversione — cioè un numero assurdo nel piatto di una
   * persona. È la stessa regola di `menu/grassi-equivalenti.ts`, che li rilegge dall'altra parte.
   *
   * ⚠️ **`fattori: null` li cancella, `undefined` li lascia**: sono due cose diverse — «togli i pesi
   * da questo gruppo» e «sto salvando altro» — e confonderle vorrebbe dire perdere il lavoro di
   * Nocanty ogni volta che qualcuno corregge una nota.
   */
  private membersFrom(
    items?: string[],
    note?: string,
    prev?: { items?: string[]; note?: string; fattori?: unknown },
    fattori?: { riferimento?: string; pesi?: Record<string, unknown>; fonte?: string } | null,
  ) {
    const nextItems = items ?? prev?.items ?? [];
    const nextNote = note !== undefined ? note : prev?.note;
    const nextFattori = fattori === undefined ? prev?.fattori : this.puliscoFattori(fattori);
    return {
      items: nextItems,
      ...(nextNote ? { note: nextNote } : {}),
      ...(nextFattori ? { fattori: nextFattori } : {}),
    };
  }

  /**
   * Tiene solo i pesi che sono numeri finiti e positivi. Il resto è come non scritto.
   *
   * ⚠️ **E ci sono dei tetti**, aggiunti in revisione il 25/8. `@IsObject()` sul DTO valida che
   * `pesi` sia un oggetto e **nient'altro**: non quante chiavi ha, non quanto sono lunghe, non
   * quanto sono grandi i numeri. È un campo `Json` che finisce dritto nel database e che poi ogni
   * proposta di Gaia rilegge — cioè il posto sbagliato dove lasciare entrare diecimila chiavi da
   * un carattere. I tetti sono larghi apposta: nessuna tabella vera li tocca, e servono a fermare
   * quello che tabella non è.
   */
  private puliscoFattori(f: { riferimento?: string; pesi?: Record<string, unknown>; fonte?: string } | null) {
    if (!f || !f.riferimento?.trim()) return undefined;
    const pesi: Record<string, number> = {};
    let scartati = 0;
    for (const [nome, valore] of Object.entries(f.pesi ?? {})) {
      if (Object.keys(pesi).length >= MAX_PESI) {
        scartati += 1;
        continue;
      }
      const chiave = typeof nome === 'string' ? nome.trim() : '';
      if (!chiave || chiave.length > MAX_NOME_PESO) {
        scartati += 1;
        continue;
      }
      const n = typeof valore === 'number' ? valore : Number(valore);
      // ⚠️ Un peso è «grammi per cento grammi di riferimento»: sopra il tetto non è un alimento, è
      // un errore di battitura o qualcosa che non è un peso. Meglio niente che un numero assurdo.
      if (!Number.isFinite(n) || n <= 0 || n > MAX_PESO) {
        scartati += 1;
        continue;
      }
      pesi[chiave] = n;
    }
    /**
     * ⚠️ **Niente troncamenti silenziosi.** Scartare una riga e rispondere «salvato» lascia chi ha
     * scritto quel numero convinto di averlo scritto: fra sei mesi Gaia passa la mano su un cambio e
     * nessuno saprà che il peso è stato buttato al salvataggio. Il conto si scrive.
     */
    if (scartati) {
      this.logger.warn(
        `Gruppo di equivalenza: ${scartati} pesi scartati perché illeggibili, con il nome troppo ` +
          `lungo (oltre ${MAX_NOME_PESO}), fuori scala (oltre ${MAX_PESO}) o oltre il tetto di ${MAX_PESI} righe.`,
      );
    }
    if (!Object.keys(pesi).length) return undefined;
    return { riferimento: f.riferimento.trim(), pesi, ...(f.fonte?.trim() ? { fonte: f.fonte.trim() } : {}) };
  }

  list(filter: { status?: string; productId?: string }) {
    return this.prisma.equivalenceGroup.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.productId ? { productId: filter.productId } : {}),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async get(id: string) {
    const g = await this.prisma.equivalenceGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Gruppo di equivalenza non trovato');
    return g;
  }

  async create(userId: string, dto: CreateEquivalenceGroupDto) {
    const created = await this.prisma.equivalenceGroup.create({
      data: {
        name: dto.name,
        productId: dto.productId ?? null,
        members: this.membersFrom(dto.items, dto.note, undefined, dto.fattori) as never,
        status: dto.status ?? 'draft',
        version: 1,
      },
    });
    await this.audit.log({ action: 'equivalence.create', actorId: userId, entityType: 'equivalence_group', entityId: created.id });
    /**
     * L'AVVISO AL CAPO NUTRIZIONISTA (richiesta di Simone dell'11/8: «quando si creano sostituzioni
     * nuove o equivalenze nuove mandiamo una notifica al nutrizionista»).
     *
     * Un gruppo nuovo nasce in bozza e il motore **non lo usa** finché non è approvato: quindi
     * finché nessuno lo guarda, il lavoro di chi l'ha scritto non serve a niente e nessuno lo sa.
     * L'avviso non va a chi l'ha appena creato: dire a qualcuno quello che ha fatto lui trenta
     * secondi prima è il modo più rapido per insegnargli a ignorare le notifiche.
     */
    const items = ((created.members as unknown as { items?: string[] } | null)?.items ?? []).length;
    await avvisaCapiNutrizionisti(
      this.prisma,
      this.notifications,
      {
        type: 'equivalence_group_new',
        title: created.status === 'approved' ? 'Nuovo gruppo di equivalenza' : 'Gruppo di equivalenza da approvare',
        body:
          `«${created.name}» (${items} aliment${items === 1 ? 'o' : 'i'})` +
          (created.status === 'approved'
            ? ' è stato creato già approvato: il motore lo userà dal prossimo menu.'
            : ' è in bozza: il motore non lo usa finché non lo approvi.'),
        payload: { kind: 'equivalence_group_new', groupId: created.id, status: created.status },
      },
      userId,
    );
    return created;
  }

  async update(userId: string, id: string, dto: UpdateEquivalenceGroupDto) {
    const existing = await this.get(id);
    const prev = (existing.members as unknown as { items?: string[]; note?: string; fattori?: unknown } | null) ?? {};
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.productId !== undefined) data.productId = dto.productId;
    if (dto.status !== undefined) data.status = dto.status;
    // ⚠️ `fattori` nella condizione: senza, salvare **solo** i pesi non scriveva niente — il ramo
    // non si apriva e la risposta diceva «salvato». Un salvataggio che non salva è il difetto
    // peggiore di questa pagina, perché chi ha scritto i numeri se ne accorge fra tre mesi.
    if (dto.items !== undefined || dto.note !== undefined || dto.fattori !== undefined) {
      data.members = this.membersFrom(dto.items, dto.note, prev, dto.fattori);
    }
    const updated = await this.prisma.equivalenceGroup.update({ where: { id }, data: data as never });
    await this.audit.log({ action: 'equivalence.update', actorId: userId, entityType: 'equivalence_group', entityId: id });
    return updated;
  }

  /** Approvazione: il gruppo diventa utilizzabile dal motore. Bump di versione. */
  async approve(userId: string, id: string) {
    const existing = await this.get(id);
    const updated = await this.prisma.equivalenceGroup.update({
      where: { id },
      data: { status: 'approved', version: (existing.version ?? 1) + 1 } as never,
    });
    await this.audit.log({ action: 'equivalence.approve', actorId: userId, entityType: 'equivalence_group', entityId: id });
    return updated;
  }

  /** Riporta in bozza (es. per revisione). */
  async unapprove(userId: string, id: string) {
    await this.get(id);
    const updated = await this.prisma.equivalenceGroup.update({ where: { id }, data: { status: 'draft' } as never });
    await this.audit.log({ action: 'equivalence.unapprove', actorId: userId, entityType: 'equivalence_group', entityId: id });
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.get(id);
    await this.prisma.equivalenceGroup.delete({ where: { id } });
    await this.audit.log({ action: 'equivalence.delete', actorId: userId, entityType: 'equivalence_group', entityId: id });
    return { ok: true };
  }
}
