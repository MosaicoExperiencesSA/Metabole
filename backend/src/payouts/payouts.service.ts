import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { decryptBuffer, deriveKey, encryptBuffer } from '../health-area/crypto.util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const COMMISSION_CATEGORIES = ['sales_commission', 'visit_compensation'];
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];
const WINDOW_FROM = 1; // giorno del mese in cui si apre la richiesta
const WINDOW_TO = 7; // ...e in cui si chiude (incluso)

/**
 * Portafoglio provvigioni e prelievi.
 * Il portafoglio è calcolato dal ledger (nessuno stato da mantenere allineato):
 * - In maturazione = provvigioni del mese in corso;
 * - Saldo prelevabile = provvigioni dei mesi PRECEDENTI meno quanto già prelevato
 *   (il "passaggio a prelevabile" a fine mese avviene da sé per logica di data);
 * - Prelevato = somma dei prelievi pagati.
 */
@Injectable()
export class PayoutsService {
  private readonly receiptKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {
    this.receiptKey = deriveKey(this.config.get<string>('FILE_ENCRYPTION_KEY') ?? 'dev-only-file-key');
  }

  private monthStart(d = new Date()): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  private windowOpen(d = new Date()): boolean {
    const day = d.getDate();
    return day >= WINDOW_FROM && day <= WINDOW_TO;
  }

  private async sumLedger(staffId: string, before: boolean): Promise<number> {
    const monthStart = this.monthStart();
    const res = await this.prisma.ledgerEntry.aggregate({
      _sum: { amountCents: true },
      where: {
        type: 'expense' as never,
        category: { in: COMMISSION_CATEGORIES },
        staffId,
        date: before ? { lt: monthStart } : { gte: monthStart },
      },
    });
    return res._sum.amountCents ?? 0;
  }

  private async sumWithdrawals(staffId: string, status: string): Promise<number> {
    const res = await this.prisma.commissionWithdrawal.aggregate({
      _sum: { amountCents: true },
      where: { staffId, status },
    });
    return res._sum.amountCents ?? 0;
  }

  /** Portafoglio dell'utente staff corrente (null se non è staff). */
  async myWallet(userId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { userId }, select: { id: true, iban: true } });
    if (!staff) return { isStaff: false };

    const [inMaturazione, earnedBefore, paid, pending] = await Promise.all([
      this.sumLedger(staff.id, false),
      this.sumLedger(staff.id, true),
      this.sumWithdrawals(staff.id, 'paid'),
      this.sumWithdrawals(staff.id, 'requested'),
    ]);
    const prelevabile = Math.max(0, earnedBefore - paid);
    const available = Math.max(0, prelevabile - pending);

    const pendingRequest = await this.prisma.commissionWithdrawal.findFirst({
      where: { staffId: staff.id, status: 'requested' },
      orderBy: { requestedAt: 'desc' },
    });
    const recent = await this.prisma.commissionWithdrawal.findMany({
      where: { staffId: staff.id },
      orderBy: { requestedAt: 'desc' },
      take: 12,
    });

    return {
      isStaff: true,
      inMaturazioneCents: inMaturazione,
      prelevabileCents: prelevabile,
      prelevatoCents: paid,
      pendingRequestedCents: pending,
      availableToRequestCents: available,
      iban: staff.iban,
      windowOpen: this.windowOpen(),
      canRequest: this.windowOpen() && available > 0 && !pendingRequest,
      pendingRequest: pendingRequest ? this.publicWithdrawal(pendingRequest) : null,
      recent: (recent as Record<string, unknown>[]).map((w) => this.publicWithdrawal(w)),
    };
  }

  /**
   * Rendicontazione guadagni dello staff (per la schermata Guadagni, layout prototipo):
   * totale del mese corrente + dettaglio (per cliente e per categoria) + storico mesi.
   */
  async myEarnings(userId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { userId }, select: { id: true } });
    if (!staff) return { isStaff: false };

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = this.monthStart(now);

    const entries = (await this.prisma.ledgerEntry.findMany({
      where: {
        staffId: staff.id,
        type: 'expense' as never,
        category: { in: COMMISSION_CATEGORIES },
        date: { gte: monthStart },
      },
      select: { amountCents: true, category: true, clientId: true, date: true },
      orderBy: { date: 'desc' },
      take: 1000,
    })) as { amountCents: number; category: string; clientId: string | null; date: Date }[];

    const totalCents = entries.reduce((a, e) => a + e.amountCents, 0);

    // Dettaglio per categoria (per il nutrizionista: Visite / Quota percorsi).
    const CAT_LABEL: Record<string, string> = { visit_compensation: 'Visite', sales_commission: 'Quota percorsi' };
    const catMap = new Map<string, number>();
    for (const e of entries) catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amountCents);
    const byCategory = [...catMap.entries()]
      .map(([category, amountCents]) => ({ category, label: CAT_LABEL[category] ?? category, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents);

    // Dettaglio per cliente (per la coach).
    const cliMap = new Map<string, { amountCents: number; lastDate: Date }>();
    for (const e of entries) {
      if (!e.clientId) continue;
      const cur = cliMap.get(e.clientId);
      if (cur) {
        cur.amountCents += e.amountCents;
        if (e.date > cur.lastDate) cur.lastDate = e.date;
      } else {
        cliMap.set(e.clientId, { amountCents: e.amountCents, lastDate: e.date });
      }
    }
    const clientIds = [...cliMap.keys()];
    const profiles = clientIds.length
      ? ((await this.prisma.clientProfile.findMany({
          where: { userId: { in: clientIds } },
          select: { userId: true, name: true },
        })) as { userId: string; name: string | null }[])
      : [];
    const nameOf = new Map(profiles.map((p) => [p.userId, p.name]));
    const byClient = [...cliMap.entries()]
      .map(([clientId, v]) => ({
        clientId,
        name: nameOf.get(clientId) ?? null,
        amountCents: v.amountCents,
        lastDate: v.lastDate.toISOString().slice(0, 10),
      }))
      .sort((a, b) => b.amountCents - a.amountCents);

    // Storico mesi (mesi precedenti) dalle compensazioni già aggregate per periodo.
    const comps = (await this.prisma.staffCompensation.findMany({
      where: { staffId: staff.id, period: { not: period } },
      orderBy: { period: 'desc' },
      take: 6,
      select: { period: true, amountCents: true },
    })) as { period: string; amountCents: number }[];
    const history = comps.map((c) => ({ period: c.period, amountCents: c.amountCents }));

    return { isStaff: true, period, totalCents, byCategory, byClient, history };
  }

  /** Richiesta di prelievo (staff): finestra giorni 1–7, importo ≤ prelevabile disponibile. */
  async requestWithdrawal(
    userId: string,
    input: { amountCents: number; iban: string; receipt?: { fileName: string; mimeType: string; contentBase64: string } },
  ) {
    const staff = await this.prisma.staff.findUnique({ where: { userId }, select: { id: true } });
    if (!staff) throw new ForbiddenException('Solo lo staff può richiedere prelievi.');
    if (!this.windowOpen()) {
      throw new BadRequestException(`Le richieste di prelievo sono possibili solo dal giorno ${WINDOW_FROM} al ${WINDOW_TO} del mese.`);
    }
    const existing = await this.prisma.commissionWithdrawal.findFirst({ where: { staffId: staff.id, status: 'requested' } });
    if (existing) throw new BadRequestException('Hai già una richiesta di prelievo in corso.');

    const iban = (input.iban ?? '').replace(/\s+/g, '').toUpperCase();
    if (iban.length < 15 || iban.length > 34) throw new BadRequestException('IBAN non valido.');

    const [earnedBefore, paid, pending] = await Promise.all([
      this.sumLedger(staff.id, true),
      this.sumWithdrawals(staff.id, 'paid'),
      this.sumWithdrawals(staff.id, 'requested'),
    ]);
    const available = Math.max(0, earnedBefore - paid - pending);
    const amount = Math.round(input.amountCents);
    if (amount <= 0) throw new BadRequestException('Importo non valido.');
    if (amount > available) throw new BadRequestException('Importo superiore al saldo prelevabile disponibile.');

    let receiptData: Uint8Array | null = null;
    let receiptMime: string | null = null;
    let receiptName: string | null = null;
    if (input.receipt) {
      if (!RECEIPT_MIME.includes(input.receipt.mimeType)) throw new BadRequestException('Formato ricevuta non supportato (PDF o immagine).');
      const plain = Buffer.from(input.receipt.contentBase64, 'base64');
      if (plain.length === 0 || plain.length > RECEIPT_MAX_BYTES) throw new BadRequestException('Dimensione ricevuta non valida (max 5 MB).');
      receiptData = new Uint8Array(encryptBuffer(plain, this.receiptKey));
      receiptMime = input.receipt.mimeType;
      receiptName = input.receipt.fileName;
    }

    // Salva l'IBAN sul profilo staff per le prossime volte.
    await this.prisma.staff.update({ where: { id: staff.id }, data: { iban } });

    const withdrawal = await this.prisma.commissionWithdrawal.create({
      data: { staffId: staff.id, amountCents: amount, iban, status: 'requested', receiptData: receiptData as never, receiptMime, receiptName },
    });
    await this.audit.log({ action: 'payout.request', actorId: userId, entityType: 'commission_withdrawal', entityId: withdrawal.id, metadata: { amountCents: amount } });
    return this.publicWithdrawal(withdrawal);
  }

  // ---------- Operatore (admin) ----------

  async listWithdrawals(status?: string) {
    type WRow = {
      id: string; staffId: string; amountCents: number; iban: string; status: string;
      receiptData: unknown; requestedAt: Date; paidAt: Date | null;
      staff: { displayName: string; iban: string | null; user: { email: string } | null } | null;
    };
    const rows = (await this.prisma.commissionWithdrawal.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
      include: { staff: { select: { displayName: true, iban: true, user: { select: { email: true } } } } },
      take: 300,
    })) as unknown as WRow[];
    // Saldo prelevabile corrente per ciascuno staff coinvolto (per la verifica di congruità).
    const staffIds = Array.from(new Set(rows.map((r) => r.staffId)));
    const balances = new Map<string, number>();
    for (const sid of staffIds) {
      const [earnedBefore, paid] = await Promise.all([this.sumLedger(sid, true), this.sumWithdrawals(sid, 'paid')]);
      balances.set(sid, Math.max(0, earnedBefore - paid));
    }
    return rows.map((r) => ({
      ...this.publicWithdrawal(r),
      staffName: r.staff?.displayName ?? '—',
      staffEmail: r.staff?.user?.email ?? null,
      withdrawableCents: balances.get(r.staffId) ?? 0,
      congruent: r.amountCents <= (balances.get(r.staffId) ?? 0),
    }));
  }

  async downloadReceipt(id: string) {
    const w = await this.prisma.commissionWithdrawal.findUnique({ where: { id } });
    if (!w?.receiptData) throw new NotFoundException('Ricevuta non presente.');
    return {
      fileName: w.receiptName ?? 'ricevuta',
      mimeType: w.receiptMime ?? 'application/octet-stream',
      contentBase64: decryptBuffer(Buffer.from(w.receiptData as unknown as Uint8Array), this.receiptKey).toString('base64'),
    };
  }

  /** Conferma pagamento: registra il prelevato e invia l'email di conferma. */
  async confirmWithdrawal(operator: AuthUser, id: string) {
    const w = await this.prisma.commissionWithdrawal.findUnique({
      where: { id },
      include: { staff: { select: { id: true, displayName: true, user: { select: { email: true, locale: true } } } } },
    });
    if (!w) throw new NotFoundException('Richiesta non trovata.');
    if (w.status !== 'requested') throw new BadRequestException('Questa richiesta non è in attesa.');

    // Verifica di congruità: non pagare più di quanto è effettivamente prelevabile.
    const [earnedBefore, paid] = await Promise.all([this.sumLedger(w.staffId, true), this.sumWithdrawals(w.staffId, 'paid')]);
    const prelevabile = Math.max(0, earnedBefore - paid);
    if (w.amountCents > prelevabile) {
      throw new BadRequestException(`Importo (${(w.amountCents / 100).toFixed(2)}€) superiore al prelevabile attuale (${(prelevabile / 100).toFixed(2)}€).`);
    }

    const staffMember = await this.prisma.staff.findUnique({ where: { userId: operator.sub }, select: { id: true } });
    const updated = await this.prisma.commissionWithdrawal.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date(), approvedById: staffMember?.id ?? null },
    });
    if (w.staff?.user?.email) {
      await this.mail.sendCommissionWithdrawalPaid(
        w.staff.user.email,
        { amountCents: w.amountCents, iban: w.iban, date: new Date() },
        w.staff.user.locale,
      );
    }
    await this.audit.log({ action: 'payout.confirm', actorId: operator.sub, entityType: 'commission_withdrawal', entityId: id, metadata: { amountCents: w.amountCents } });
    return this.publicWithdrawal(updated);
  }

  async rejectWithdrawal(operator: AuthUser, id: string, reason: string) {
    const w = await this.prisma.commissionWithdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Richiesta non trovata.');
    if (w.status !== 'requested') throw new BadRequestException('Questa richiesta non è in attesa.');
    const updated = await this.prisma.commissionWithdrawal.update({ where: { id }, data: { status: 'rejected', note: reason } });
    await this.audit.log({ action: 'payout.reject', actorId: operator.sub, entityType: 'commission_withdrawal', entityId: id, metadata: { reason } });
    return this.publicWithdrawal(updated);
  }

  private publicWithdrawal(w: Record<string, unknown>) {
    const { receiptData, ...rest } = w;
    return { ...rest, hasReceipt: Boolean(receiptData) };
  }
}
