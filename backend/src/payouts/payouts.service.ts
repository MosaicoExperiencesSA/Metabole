import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { confineMese, giornoDelMeseLocale, giornoLocale, inizioDelGiorno, meseLocale, meseSpostato } from '../common/date-only';
import { controllaIban } from '../common/iban';
import { CATEGORIE_COMPENSO, inizioMese, mesePeriodo, tettoAttivoCents } from '../common/tetto-compensi';
import { metodiDaTesto } from '../commerce/accounting.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { decryptBuffer, deriveKey, encryptBuffer } from '../health-area/crypto.util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { motivoRifiutoPagamento, residuoDaPagare } from './pagamento-manuale';

// L'elenco sta in `common/tetto-compensi.ts`: il tetto di guadagno (§16.8) DEVE contare
// esattamente quello che questo portafoglio mostra come guadagnato, o taglia su un numero che la
// persona non vede da nessuna parte. Due liste che dicono la stessa cosa divergono sempre.
const COMMISSION_CATEGORIES = CATEGORIE_COMPENSO;
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];
const WINDOW_FROM = 1; // giorno del mese in cui si apre la richiesta
const WINDOW_TO = 7; // ...e in cui si chiude (incluso)

/** Un allegato come arriva dal backoffice o dall'app: nome, tipo e contenuto in base64. */
export interface AllegatoInput {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

/** Pagamento registrato dall'admin senza una richiesta della persona (19/10). */
export interface PagamentoManualeInput {
  staffId: string;
  amountCents: number;
  /** Giorno del bonifico, `YYYY-MM-DD`, nel fuso dell'azienda. */
  paidOn: string;
  paidWith?: string | null;
  iban?: string | null;
  note?: string | null;
  proof?: AllegatoInput;
}

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
    private readonly configParams: ConfigParamsService,
  ) {
    this.receiptKey = deriveKey(this.config.get<string>('FILE_ENCRYPTION_KEY') ?? 'dev-only-file-key');
  }

  // Stesso confine di mese che usa il tetto di guadagno (§16.8): «in maturazione» e «quanto manca
  // al tetto» devono parlare dello stesso mese, altrimenti il primo del mese uno dei due sbaglia.
  private monthStart(d = new Date()): Date {
    return inizioMese(d);
  }
  /**
   * Il giorno è quello di **Roma**, non quello del server. Con `d.getDate()` (fuso del processo,
   * su Render UTC) la finestra risultava chiusa nelle prime due ore del giorno 1 e ancora aperta
   * nelle prime due del giorno 8: «dal 1 al 7» è la frase che questa funzione deve mantenere.
   */
  private windowOpen(d = new Date()): boolean {
    const day = giornoDelMeseLocale(d);
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

  /** Tutto il maturato a registro, mesi chiusi e mese in corso insieme. */
  private async sumLedgerAll(staffId: string): Promise<number> {
    const res = await this.prisma.ledgerEntry.aggregate({
      _sum: { amountCents: true },
      where: { type: 'expense' as never, category: { in: COMMISSION_CATEGORIES }, staffId },
    });
    return res._sum.amountCents ?? 0;
  }

  /**
   * Valida e cifra un allegato (ricevuta della persona o contabile dell'admin): stessi formati,
   * stesso tetto, stessa chiave. Una funzione sola perché i due controlli non si separino.
   */
  private cifraAllegato(input: AllegatoInput, cosa: string): { data: Uint8Array; mime: string; name: string } {
    if (!RECEIPT_MIME.includes(input.mimeType)) throw new BadRequestException(`Formato ${cosa} non supportato (PDF o immagine).`);
    const plain = Buffer.from(input.contentBase64, 'base64');
    if (plain.length === 0 || plain.length > RECEIPT_MAX_BYTES) throw new BadRequestException(`Dimensione ${cosa} non valida (max 5 MB).`);
    return { data: new Uint8Array(encryptBuffer(plain, this.receiptKey)), mime: input.mimeType, name: input.fileName };
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
    const staff = (await this.prisma.staff.findUnique({
      where: { userId },
      select: { id: true, iban: true, earningsCapCents: true },
    })) as { id: string; iban: string | null; earningsCapCents: number | null } | null;
    if (!staff) return { isStaff: false };

    const [inMaturazione, earnedBefore, paid, pending] = await Promise.all([
      this.sumLedger(staff.id, false),
      this.sumLedger(staff.id, true),
      this.sumWithdrawals(staff.id, 'paid'),
      this.sumWithdrawals(staff.id, 'requested'),
    ]);
    const prelevabile = Math.max(0, earnedBefore - paid);
    const available = Math.max(0, prelevabile - pending);
    // Pagato in anticipo sul mese in corso (pagamento registrato dall'admin, 19/10): senza questo
    // numero il portafoglio direbbe «in maturazione 200» a chi quei 200 li ha già ricevuti.
    const anticipato = Math.max(0, paid - earnedBefore);

    const pendingRequest = await this.prisma.commissionWithdrawal.findFirst({
      where: { staffId: staff.id, status: 'requested' },
      orderBy: { requestedAt: 'desc' },
    });
    const recent = await this.prisma.commissionWithdrawal.findMany({
      where: { staffId: staff.id },
      orderBy: { requestedAt: 'desc' },
      take: 12,
    });

    // Tetto di guadagno mensile (§16.8): `null` per chi non ce l'ha, che è quasi tutti. Serve a
    // non lasciare che una persona veda le provvigioni smettere di crescere senza sapere perché —
    // il tetto è una regola concordata con lei, non una sorpresa di fine mese.
    const tettoMensileCents = tettoAttivoCents(staff.earningsCapCents);

    return {
      isStaff: true,
      inMaturazioneCents: inMaturazione,
      prelevabileCents: prelevabile,
      prelevatoCents: paid,
      anticipatoCents: anticipato,
      pendingRequestedCents: pending,
      availableToRequestCents: available,
      tettoMensileCents,
      tettoResiduoCents: tettoMensileCents === null ? null : Math.max(0, tettoMensileCents - inMaturazione),
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
    // Lo stesso mese sotto cui `creditStaff` scrive i compensi: qui si usa per ESCLUDERE il
    // mese in corso dallo storico, e un mese sfasato lo mostrerebbe due volte con due numeri.
    const period = mesePeriodo(now);
    const monthStart = this.monthStart(now);

    const entries = (await this.prisma.ledgerEntry.findMany({
      where: {
        staffId: staff.id,
        type: 'expense' as never,
        category: { in: COMMISSION_CATEGORIES },
        date: { gte: monthStart },
      },
      select: { amountCents: true, category: true, clientId: true, date: true, ref: true },
      orderBy: { date: 'desc' },
      take: 1000,
    })) as { amountCents: number; category: string; clientId: string | null; date: Date; ref: string | null }[];

    const totalCents = entries.reduce((a, e) => a + e.amountCents, 0);

    // Dettaglio per tipo: i compensi visita (visit_compensation) sono raggruppati per
    // TIPO DI VISITA risalendo all'appuntamento (ref → Appointment.type); le provvigioni
    // percorso (sales_commission) sotto "Quota percorsi".
    const visitRefs = entries.filter((e) => e.category === 'visit_compensation' && e.ref).map((e) => e.ref as string);
    const apptType = new Map<string, string>();
    if (visitRefs.length) {
      const appts = (await this.prisma.appointment.findMany({
        where: { id: { in: [...new Set(visitRefs)] } },
        select: { id: true, type: true },
      })) as { id: string; type: string }[];
      for (const a of appts) apptType.set(a.id, a.type);
    }
    const TYPE_LABEL: Record<string, string> = { televisit: 'Televisite', in_person: 'Visite in presenza', call: 'Chiamate' };
    const detMap = new Map<string, number>();
    for (const e of entries) {
      let label: string;
      if (e.category === 'visit_compensation') {
        const t = e.ref ? apptType.get(e.ref) : undefined;
        label = (t && TYPE_LABEL[t]) || 'Visite';
      } else if (e.category === 'sales_commission') {
        label = 'Quota percorsi';
      } else {
        label = e.category;
      }
      detMap.set(label, (detMap.get(label) ?? 0) + e.amountCents);
    }
    const byCategory = [...detMap.entries()]
      .map(([label, amountCents]) => ({ category: label, label, amountCents }))
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

    /**
     * ⚠️ **LO STORICO SI LEGGE DAL REGISTRO, come tutto il resto di questa schermata.**
     *
     * Fino al 20/8 «Storico mesi» arrivava da `StaffCompensation`, mentre il totale del mese in
     * corso qui sopra e il saldo prelevabile qui accanto arrivano dal registro contabile: **due
     * fonti, sulla stessa schermata, per la stessa domanda**. E divergono davvero.
     *
     * ⛔ Il caso che le fa divergere è ordinario — **un rimborso a cavallo di due mesi**. Lo storno
     * scrive a registro una riga negativa **datata oggi** (settembre) e insieme *decrementa il
     * contatore del mese ORIGINALE* (agosto). Da quel momento: il registro dice agosto 100 e
     * settembre −40, il contatore dice agosto 60. La coach vede «Saldo prelevabile» calcolato su
     * 100 e «Storico mesi → Agosto € 60,00» **nello stesso schermo**, e nessuno dei due è
     * sbagliato: sono due contabilità diverse messe una sotto l'altra.
     *
     * ⛔ E c'è un secondo modo: il contatore si decrementa con `Math.max(0, …)`, quindi uno storno
     * più grande del residuo del mese gli fa **perdere l'informazione** — è testualmente quello che
     * dice il commento di `quotaConsentita` in `finance.service.ts`, che per questa ragione il
     * maturato del tetto lo legge dal registro. Lo stesso motivo vale qui.
     *
     * `StaffCompensation` resta: il suo `items` è il dettaglio di **cosa** ha composto un mese, che
     * il registro non ha in quella forma. Ma la risposta a «quanto», per la persona, è una sola.
     */
    const daMese = meseSpostato(period, -6);
    const storiche = (await this.prisma.ledgerEntry.findMany({
      where: {
        staffId: staff.id,
        type: 'expense' as never,
        category: { in: COMMISSION_CATEGORIES },
        date: { gte: confineMese(daMese).gte, lt: monthStart },
      },
      select: { amountCents: true, date: true },
    })) as { amountCents: number; date: Date }[];
    const perMese = new Map<string, number>();
    for (const r of storiche) perMese.set(meseLocale(r.date), (perMese.get(meseLocale(r.date)) ?? 0) + r.amountCents);
    const history = [...perMese.entries()]
      .map(([p, amountCents]) => ({ period: p, amountCents }))
      .sort((a, b) => (a.period < b.period ? 1 : -1));

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

    /**
     * ⚠️ **La cifra di controllo, non la lunghezza.** Qui c'era `iban.length < 15 || > 34`, che
     * lascia passare qualunque refuso: una cifra sbagliata, due invertite, una `O` al posto di uno
     * `0` danno un IBAN lungo giusto. E quello che succede dopo non è un errore a schermo — è un
     * operatore che fa un bonifico. Il mod-97 (ISO 13616) esiste esattamente per questo.
     */
    const esito = controllaIban(input.iban ?? '');
    if (!esito.valido) throw new BadRequestException(esito.perche);
    const iban = esito.iban;

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
      const c = this.cifraAllegato(input.receipt, 'ricevuta');
      receiptData = c.data;
      receiptMime = c.mime;
      receiptName = c.name;
    }

    const withdrawal = await this.prisma.commissionWithdrawal.create({
      data: { staffId: staff.id, amountCents: amount, iban, status: 'requested', receiptData: receiptData as never, receiptMime, receiptName },
    });
    /**
     * L'IBAN diventa quello predefinito **dopo** che la richiesta è nata, non prima: se la
     * scrittura qui sotto fallisse, la persona si ritroverebbe sul profilo un IBAN che non ha mai
     * finito di usare — e la volta dopo il campo si presenta già compilato con quello.
     */
    await this.prisma.staff.update({ where: { id: staff.id }, data: { iban } });
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
      include: { staff: { select: { id: true, userId: true, displayName: true, user: { select: { email: true, locale: true } } } } },
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
        { amountCents: w.amountCents, iban: w.iban, date: new Date(), richiesto: true },
        w.staff.user.locale,
      );
    }
    // Notifica in app allo staff: pagamento avvenuto, fondi passati da Saldo a Prelevato.
    if (w.staff?.userId) {
      await this.prisma.notification.create({
        data: {
          userId: w.staff.userId,
          type: 'payout_paid',
          payload: {
            title: 'Prelievo pagato 💸',
            body: `Il tuo prelievo di € ${(w.amountCents / 100).toFixed(2).replace('.', ',')} è stato pagato sull'IBAN …${w.iban.slice(-4)}. Lo trovi nello storico prelievi.`,
          } as never,
          channel: 'inapp',
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
      }).catch(() => undefined);
    }
    await this.audit.log({ action: 'payout.confirm', actorId: operator.sub, entityType: 'commission_withdrawal', entityId: id, metadata: { amountCents: w.amountCents } });
    return this.publicWithdrawal(updated);
  }

  // ---------- Pagamenti registrati dall'admin (19/10) ----------

  /** Le voci della tendina «con cosa hai pagato» — le stesse dei costi, da Parametri. */
  async metodiPagamento(): Promise<string[]> {
    const testo = await this.configParams.getString('cost_payment_methods', '').catch(() => '');
    return metodiDaTesto(testo);
  }

  /**
   * Chi si può pagare: tutto lo staff che ha almeno una riga di compenso a registro, con quanto ha
   * maturato, quanto ha già ricevuto e quanto resta. È la tendina della finestra «Registra
   * pagamento», e i numeri sono gli stessi che il server userà per decidere: un tetto mostrato e
   * uno applicato diversi sono la stessa domanda con due risposte.
   */
  async listPayees() {
    const [maturato, pagato, inAttesa] = await Promise.all([
      this.prisma.ledgerEntry.groupBy({
        by: ['staffId'],
        where: { type: 'expense' as never, category: { in: COMMISSION_CATEGORIES }, staffId: { not: null } },
        _sum: { amountCents: true },
      }) as unknown as Promise<{ staffId: string; _sum: { amountCents: number | null } }[]>,
      this.prisma.commissionWithdrawal.groupBy({ by: ['staffId'], where: { status: 'paid' }, _sum: { amountCents: true } }) as unknown as Promise<{ staffId: string; _sum: { amountCents: number | null } }[]>,
      this.prisma.commissionWithdrawal.groupBy({ by: ['staffId'], where: { status: 'requested' }, _sum: { amountCents: true } }) as unknown as Promise<{ staffId: string; _sum: { amountCents: number | null } }[]>,
    ]);
    const somma = (rows: { staffId: string; _sum: { amountCents: number | null } }[]) => new Map(rows.map((r) => [r.staffId, r._sum.amountCents ?? 0]));
    const mMat = somma(maturato);
    const mPag = somma(pagato);
    const mAtt = somma(inAttesa);
    const ids = Array.from(new Set([...mMat.keys(), ...mPag.keys()]));
    const staff = (await this.prisma.staff.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, iban: true, user: { select: { email: true, role: true } } },
    })) as { id: string; displayName: string; iban: string | null; user: { email: string; role: string } | null }[];
    return staff
      .map((s) => {
        const maturatoCents = mMat.get(s.id) ?? 0;
        const pagatoCents = mPag.get(s.id) ?? 0;
        return {
          staffId: s.id,
          displayName: s.displayName,
          email: s.user?.email ?? null,
          role: s.user?.role ?? null,
          iban: s.iban,
          maturatoCents,
          pagatoCents,
          residuoCents: residuoDaPagare({ maturatoCents, pagatoCents }),
          richiestaInAttesaCents: mAtt.get(s.id) ?? 0,
        };
      })
      .sort((a, b) => b.residuoCents - a.residuoCents || a.displayName.localeCompare(b.displayName, 'it'));
  }

  /**
   * Registra un pagamento GIÀ FATTO, senza una richiesta della persona: finisce fra i «Pagati» con
   * la data del bonifico, nel prelevato del suo portafoglio e nelle «Provvigioni pagate» di
   * Contabilità del mese in cui è stato fatto. La persona riceve la stessa mail e la stessa
   * notifica della conferma di una richiesta.
   */
  async registerManualPayment(operator: AuthUser, input: PagamentoManualeInput) {
    const staff = (await this.prisma.staff.findUnique({
      where: { id: input.staffId },
      select: { id: true, userId: true, displayName: true, iban: true, user: { select: { email: true, locale: true } } },
    })) as { id: string; userId: string | null; displayName: string; iban: string | null; user: { email: string; locale: string | null } | null } | null;
    if (!staff) throw new NotFoundException('Persona non trovata.');

    const [maturatoCents, pagatoCents] = await Promise.all([this.sumLedgerAll(staff.id), this.sumWithdrawals(staff.id, 'paid')]);
    const amountCents = Math.round(input.amountCents);
    const paidOn = (input.paidOn ?? '').trim();
    const motivo = motivoRifiutoPagamento({ amountCents, pagatoIl: paidOn, oggi: giornoLocale(new Date()), situazione: { maturatoCents, pagatoCents } });
    if (motivo) throw new BadRequestException(motivo);

    // L'IBAN è facoltativo (si può pagare in contanti, o con un conto che non è un IBAN), ma se c'è
    // si controlla la cifra di controllo come nella richiesta: è il numero su cui si fa un bonifico.
    let iban = '';
    const ibanScritto = (input.iban ?? '').trim();
    if (ibanScritto) {
      const esito = controllaIban(ibanScritto);
      if (!esito.valido) throw new BadRequestException(esito.perche);
      iban = esito.iban;
    } else if (staff.iban) {
      iban = staff.iban;
    }

    const paidWith = await this.validaMetodo(input.paidWith);
    const proof = input.proof ? this.cifraAllegato(input.proof, 'contabile') : null;
    // Mezzogiorno a Roma del giorno del bonifico: lontano da ogni confine, così Contabilità lo conta
    // nel mese giusto qualunque sia l'ora legale.
    const paidAt = new Date(inizioDelGiorno(paidOn).getTime() + 12 * 3600 * 1000);
    const operatore = await this.prisma.staff.findUnique({ where: { userId: operator.sub }, select: { id: true } });
    const note = (input.note ?? '').trim() || null;

    const created = await this.prisma.commissionWithdrawal.create({
      data: {
        staffId: staff.id,
        amountCents,
        iban,
        status: 'paid',
        paidAt,
        approvedById: operatore?.id ?? null,
        note,
        paidWith,
        manual: true,
        proofData: (proof?.data ?? null) as never,
        proofMime: proof?.mime ?? null,
        proofName: proof?.name ?? null,
      },
    });

    if (staff.user?.email) {
      await this.mail
        .sendCommissionWithdrawalPaid(staff.user.email, { amountCents, iban, date: paidAt, richiesto: false }, staff.user.locale)
        .catch(() => false);
    }
    if (staff.userId) {
      const dove = iban ? ` sull'IBAN …${iban.slice(-4)}` : '';
      await this.prisma.notification.create({
        data: {
          userId: staff.userId,
          type: 'payout_paid',
          payload: {
            title: 'Pagamento provvigioni 💸',
            body: `Ti abbiamo pagato € ${(amountCents / 100).toFixed(2).replace('.', ',')}${dove}. Lo trovi nello storico prelievi.`,
          } as never,
          channel: 'inapp',
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
      }).catch(() => undefined);
    }
    await this.audit.log({
      action: 'payout.manual',
      actorId: operator.sub,
      entityType: 'commission_withdrawal',
      entityId: created.id,
      metadata: { staffId: staff.id, amountCents, paidOn, paidWith, conContabile: Boolean(proof) },
    });
    return this.publicWithdrawal(created);
  }

  /** Il metodo dev'essere una delle voci configurate (stessa regola dei costi in Contabilità). */
  private async validaMetodo(paidWith: string | null | undefined): Promise<string | null> {
    const v = paidWith?.trim();
    if (!v) return null;
    const ammessi = await this.metodiPagamento();
    if (!ammessi.includes(v)) {
      throw new BadRequestException(`«${v}» non è fra i modi di pagamento configurati. Le voci si aggiungono in Parametri → «Con cosa si paga».`);
    }
    return v;
  }

  /**
   * Carica (o sostituisce) la contabile di un pagamento già fatto — registrato a mano o confermato
   * da una richiesta. Solo sui pagati: la contabile di un bonifico che non c'è non esiste.
   */
  async uploadProof(operator: AuthUser, id: string, proofInput: AllegatoInput) {
    const w = await this.prisma.commissionWithdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Pagamento non trovato.');
    if (w.status !== 'paid') throw new BadRequestException('La contabile si carica solo su un pagamento già fatto.');
    const proof = this.cifraAllegato(proofInput, 'contabile');
    const updated = await this.prisma.commissionWithdrawal.update({
      where: { id },
      data: { proofData: proof.data as never, proofMime: proof.mime, proofName: proof.name },
    });
    await this.audit.log({ action: 'payout.proof', actorId: operator.sub, entityType: 'commission_withdrawal', entityId: id, metadata: { sostituita: Boolean(w.proofData) } });
    return this.publicWithdrawal(updated);
  }

  async downloadProof(id: string) {
    const w = await this.prisma.commissionWithdrawal.findUnique({ where: { id } });
    if (!w?.proofData) throw new NotFoundException('Contabile non presente.');
    return {
      fileName: w.proofName ?? 'contabile',
      mimeType: w.proofMime ?? 'application/octet-stream',
      contentBase64: decryptBuffer(Buffer.from(w.proofData as unknown as Uint8Array), this.receiptKey).toString('base64'),
    };
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
    // I byte degli allegati non escono mai in un elenco: solo se ci sono. Si scaricano uno per volta.
    const { receiptData, proofData, ...rest } = w;
    return { ...rest, hasReceipt: Boolean(receiptData), hasProof: Boolean(proofData) };
  }
}
