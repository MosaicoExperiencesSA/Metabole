import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConfigParamsService } from '../config-params/config-params.service';
import { decryptBuffer, deriveKey, encryptBuffer } from '../health-area/crypto.util';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralService } from '../referral/referral.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { CrmService } from './crm.service';
import { DiscountsService } from './discounts.service';
import { deriveSegment } from '../common/funnel-segment';
import { coachTeamScope } from '../common/coach-team';
import { FinanceService } from './finance.service';
import { StripeService } from './stripe.service';

const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

// Client di transazione: tipo canonico di Prisma.
type PrismaTx = Prisma.TransactionClient;

/**
 * Commercio col flusso BONIFICO (richiesta di Simone, 9/7/2026):
 * richiesta → email con estremi → upload contabile → APPROVAZIONE operatore →
 * solo allora: abbonamento attivo (menu erogabile), income a ledger,
 * provvigioni generate, ricevuta via email.
 */
/**
 * Calcola la data di fine abbonamento dal periodo del piano.
 * Suffissi: d=giorni, w=settimane, m=mesi, y=anni. Senza suffisso = mesi.
 * Esempi: "8d"=8 giorni, "2w"=14 giorni, "3m"=3 mesi, "1y"=1 anno. Fallback 3 mesi.
 */
export function subscriptionEnd(start: Date, period: string): Date {
  const end = new Date(start);
  // 'maintenance' = piano mensile (€29/mese, rinnovo manuale): dura 1 mese.
  if (String(period ?? '').trim().toLowerCase() === 'maintenance') {
    end.setMonth(end.getMonth() + 1);
    return end;
  }
  const m = String(period ?? '').trim().toLowerCase().match(/^(\d+)\s*([dwmy]?)$/);
  const n = m ? parseInt(m[1], 10) : NaN;
  const unit = m ? m[2] : '';
  if (!m || !Number.isFinite(n) || n <= 0) {
    end.setMonth(end.getMonth() + 3);
    return end;
  }
  if (unit === 'd') end.setDate(end.getDate() + n);
  else if (unit === 'w') end.setDate(end.getDate() + n * 7);
  else if (unit === 'y') end.setFullYear(end.getFullYear() + n);
  else end.setMonth(end.getMonth() + n);
  return end;
}

@Injectable()
export class CommerceService {
  private readonly receiptKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly configParams: ConfigParamsService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly finance: FinanceService,
    private readonly crm: CrmService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
    private readonly discounts: DiscountsService,
    private readonly pdf: PdfService,
    private readonly referral: ReferralService,
    private readonly monitoring: MonitoringService,
  ) {
    this.receiptKey = deriveKey(this.config.get<string>('FILE_ENCRYPTION_KEY') ?? 'dev-only-file-key');
  }

  // ---------- Piani e prodotti ----------

  /**
   * Prezzo EFFETTIVO di vendita di un piano (handoff Prezzi lancio):
   * finché la promo è attiva (listino presente e `promoEndsAt` nel futuro o assente)
   * si vende a `priceCents` col listino barrato; scaduta la promo si torna
   * AUTOMATICAMENTE al listino pieno, senza toccare il DB.
   */
  private planPricing(plan: { priceCents: number; listPriceCents?: number | null; promoEndsAt?: Date | null }): { effectivePriceCents: number; promoActive: boolean } {
    const hasList = plan.listPriceCents != null && plan.listPriceCents > plan.priceCents;
    const promoActive = Boolean(hasList && (!plan.promoEndsAt || plan.promoEndsAt.getTime() > Date.now()));
    return { effectivePriceCents: hasList && !promoActive ? (plan.listPriceCents as number) : plan.priceCents, promoActive };
  }

  async listPlans() {
    const plans = await this.prisma.plan.findMany({ where: { active: true, hidden: false } as never, orderBy: { priceCents: 'asc' } });
    return (plans as { priceCents: number; listPriceCents?: number | null; promoEndsAt?: Date | null }[]).map((p) => ({ ...p, ...this.planPricing(p) }));
  }

  async listProducts() {
    return this.prisma.product.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  /**
   * Articoli GIÀ acquistati dal cliente (pagamento approvato): id dei piani via
   * abbonamento e id dei prodotti via righe d'ordine. Usato per nascondere gli
   * articoli non riacquistabili nello shop di quel cliente.
   */
  private async purchasedIds(clientId: string): Promise<{ plans: Set<string>; products: Set<string> }> {
    const [pays, subs] = await Promise.all([
      this.prisma.payment.findMany({
        where: { clientId, status: 'approved' as never },
        select: { subscription: { select: { planId: true } }, order: { select: { items: true } } },
      }) as Promise<{ subscription: { planId: string } | null; order: { items: unknown } | null }[]>,
      // Anche gli ABBONAMENTI consumati (attivi, in pausa o scaduti) contano come
      // "acquistato": copre gli acquisti storici (es. settimana gratuita presa col
      // vecchio flusso) dove il pagamento non risulta 'approved'. Pending escluso
      // (ordine ancora annullabile), cancelled escluso (mai goduto).
      this.prisma.subscription.findMany({
        // NB: 'paused' NON è uno stato di Subscription (l'enum è pending|active|
        // cancelled|expired; le pause vivono nella tabella pause_request). Inserirlo
        // faceva rifiutare la query da Prisma → 500 su /me/plans e /me/products.
        // Un abbonamento "in pausa" resta 'active', quindi active+expired bastano.
        where: { clientId, status: { in: ['active', 'expired'] as never } },
        select: { planId: true },
      }) as Promise<{ planId: string }[]>,
    ]);
    const plans = new Set<string>();
    const products = new Set<string>();
    for (const p of pays) {
      if (p.subscription?.planId) plans.add(p.subscription.planId);
      const items = Array.isArray(p.order?.items) ? (p.order!.items as { productId?: string }[]) : [];
      for (const it of items) if (it.productId) products.add(it.productId);
    }
    for (const sub of subs) plans.add(sub.planId);
    return { plans, products };
  }

  /** Piani visibili al CLIENTE: attivi, meno quelli non riacquistabili che ha già preso. */
  async listPlansForClient(clientId: string) {
    const [plans, bought] = await Promise.all([this.listPlans(), this.purchasedIds(clientId)]);
    return (plans as unknown as { id: string; repurchasable?: boolean }[]).filter((p) => p.repurchasable !== false || !bought.plans.has(p.id));
  }

  /** Prodotti visibili al CLIENTE: attivi, meno quelli non riacquistabili che ha già preso. */
  async listProductsForClient(clientId: string) {
    const [products, bought] = await Promise.all([this.listProducts(), this.purchasedIds(clientId)]);
    return (products as { id: string; repurchasable?: boolean }[]).filter((p) => p.repurchasable !== false || !bought.products.has(p.id));
  }

  // ---------- Metodi di pagamento abilitati (Parametri) ----------

  /** Quali metodi di pagamento sono attivi (configurabili dai Parametri del backoffice). */
  async enabledPaymentMethods(): Promise<{ card: boolean; bank_transfer: boolean }> {
    const [card, bank] = await Promise.all([
      this.configParams.getBool('payment_method_card_enabled', true),
      this.configParams.getBool('payment_method_bank_enabled', true),
    ]);
    return { card, bank_transfer: bank };
  }

  /** Blocca l'uso di un metodo disattivato dal backoffice. */
  private async assertMethodEnabled(method: 'card' | 'bank_transfer') {
    const enabled = await this.enabledPaymentMethods();
    if (!enabled[method]) {
      throw new BadRequestException(
        method === 'card'
          ? 'Il pagamento con carta non è al momento disponibile. Usa il bonifico.'
          : 'Il pagamento con bonifico non è al momento disponibile. Usa la carta.',
      );
    }
  }

  // ---------- Gestione negozio (admin) ----------

  listAllPlans() {
    return this.prisma.plan.findMany({ orderBy: { priceCents: 'asc' } });
  }
  listAllProducts() {
    return this.prisma.product.findMany({ orderBy: { name: 'asc' } });
  }

  async createProduct(actorId: string, dto: { name: string; priceCents: number; description?: string; active?: boolean; repurchasable?: boolean; commissionCoachCents?: number; commissionManagerCoachCents?: number; commissionNutritionistCents?: number; commissionHeadNutritionistCents?: number }) {
    const product = await this.prisma.product.create({ data: { ...dto, active: dto.active ?? true } as never });
    await this.audit.log({ action: 'shop.product.create', actorId, entityType: 'product', entityId: product.id });
    return product;
  }
  async updateProduct(actorId: string, id: string, dto: Record<string, unknown>) {
    const product = await this.prisma.product.update({ where: { id }, data: dto as never });
    await this.audit.log({ action: 'shop.product.update', actorId, entityType: 'product', entityId: id });
    return product;
  }
  async deleteProduct(actorId: string, id: string) {
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch {
      throw new BadRequestException('Prodotto non eliminabile: ha ordini collegati. Disattivalo invece.');
    }
    await this.audit.log({ action: 'shop.product.delete', actorId, entityType: 'product', entityId: id });
    return { deleted: true };
  }

  async createPlan(actorId: string, dto: { name: string; priceCents: number; period: string; mealsPerDay?: number; features?: string[]; active?: boolean; repurchasable?: boolean; commissionCoachCents?: number; commissionManagerCoachCents?: number; commissionNutritionistCents?: number; commissionHeadNutritionistCents?: number }) {
    const plan = await this.prisma.plan.create({ data: { ...dto, features: dto.features ?? [], active: dto.active ?? true } as never });
    await this.audit.log({ action: 'shop.plan.create', actorId, entityType: 'plan', entityId: plan.id });
    return plan;
  }
  async updatePlan(actorId: string, id: string, dto: Record<string, unknown>) {
    const plan = await this.prisma.plan.update({ where: { id }, data: dto as never });
    await this.audit.log({ action: 'shop.plan.update', actorId, entityType: 'plan', entityId: id });
    return plan;
  }
  async deletePlan(actorId: string, id: string) {
    try {
      await this.prisma.plan.delete({ where: { id } });
    } catch {
      throw new BadRequestException('Piano non eliminabile: ha abbonamenti collegati. Disattivalo invece.');
    }
    await this.audit.log({ action: 'shop.plan.delete', actorId, entityType: 'plan', entityId: id });
    return { deleted: true };
  }

  // ---------- Acquisto (bonifico) ----------

  /**
   * Sottoscrizione piano. method:
   * - bank_transfer → email con gli estremi, poi contabile + approvazione operatore;
   * - card → sessione Stripe Checkout, approvazione automatica via webhook.
   */
  async subscribe(
    clientId: string,
    planId: string,
    clientEmail: string,
    method: 'bank_transfer' | 'card' = 'bank_transfer',
  ) {
    await this.assertMethodEnabled(method === 'card' ? 'card' : 'bank_transfer');
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) throw new NotFoundException('Piano non trovato');

    // Gating dell'acquisto al consenso dati sanitari (spec sez. 11).
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { consents: true, name: true, user: { select: { locale: true } } },
    });
    const consents = (profile?.consents ?? {}) as { healthDataConsent?: { accepted?: boolean } };
    if (!consents.healthDataConsent?.accepted) {
      throw new BadRequestException(
        'Prima dell\'acquisto serve il consenso al trattamento dei dati sanitari: completa il questionario.',
      );
    }

    // Si può acquistare un nuovo abbonamento ANCHE con uno attivo: il nuovo parte in
    // coda (alla scadenza di quello attuale, impostata all'approvazione del pagamento).
    // Blocchiamo solo se c'è già una richiesta NON pagata, per non aprire due ordini insieme.
    const pending = await this.prisma.subscription.findFirst({
      where: { clientId, status: 'pending' as never },
    });
    if (pending) {
      throw new BadRequestException('Hai già una richiesta in corso: carica la contabile o attendi l\'approvazione.');
    }

    const subscription = await this.prisma.subscription.create({
      data: { clientId, planId, status: 'pending' },
    });
    const planPrice = this.planPricing(plan as never).effectivePriceCents;
    const payment = await this.prisma.payment.create({
      data: {
        clientId,
        subscriptionId: subscription.id,
        amountCents: planPrice,
        description: `Abbonamento ${plan.name}`,
        method: method as never,
        status: 'pending',
      },
    });
    await this.audit.log({
      action: 'commerce.subscribe',
      actorId: clientId,
      entityType: 'payment',
      entityId: payment.id,
      metadata: { planId, amountCents: planPrice, method },
    });

    if (method === 'card') {
      const session = await this.stripe.createCheckoutSession({
        paymentId: payment.id,
        description: payment.description,
        amountCents: payment.amountCents,
        customerEmail: clientEmail,
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { pspRef: session.sessionId },
      });
      return { subscription, payment: this.publicPayment(payment), checkoutUrl: session.url };
    }

    const bankDetails = await this.configParams.getString(
      'bank_transfer_details',
      'IBAN: da configurare in admin/config (bank_transfer_details)',
    );
    const reference = `${profile?.name ?? clientEmail} — ${payment.id.slice(0, 8).toUpperCase()}`;
    await this.mail.sendBankTransferInstructions(
      clientEmail,
      {
        description: payment.description,
        amountCents: payment.amountCents,
        bankDetails,
        reference,
      },
      profile?.user?.locale,
    );
    return { subscription, payment: this.publicPayment(payment), transferReference: reference };
  }

  /** Ordine integratori con lo stesso flusso bonifico. */
  async createOrder(clientId: string, clientEmail: string, items: { productId: string; qty: number }[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, active: true },
    });
    if (products.length !== new Set(items.map((i) => i.productId)).size) {
      throw new BadRequestException('Uno o più prodotti non esistono');
    }
    type P = { id: string; name: string; priceCents: number };
    const detailed = items.map((i) => {
      const product = (products as P[]).find((p) => p.id === i.productId)!;
      return { productId: product.id, name: product.name, priceCents: product.priceCents, qty: i.qty };
    });
    const totalCents = detailed.reduce((a, d) => a + d.priceCents * d.qty, 0);

    const order = await this.prisma.order.create({
      data: { clientId, totalCents, items: detailed as never },
    });
    const payment = await this.prisma.payment.create({
      data: {
        clientId,
        orderId: order.id,
        amountCents: totalCents,
        description: `Ordine integratori (${detailed.length} prodotti)`,
        method: 'bank_transfer',
      },
    });
    const bankDetails = await this.configParams.getString('bank_transfer_details', 'IBAN: da configurare');
    const reference = `Ordine ${order.id.slice(0, 8).toUpperCase()}`;
    const buyer = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { locale: true },
    });
    await this.mail.sendBankTransferInstructions(
      clientEmail,
      {
        description: payment.description,
        amountCents: totalCents,
        bankDetails,
        reference,
      },
      buyer?.locale,
    );
    return { order, payment: this.publicPayment(payment), transferReference: reference };
  }

  /**
   * Checkout UNIFICATO del carrello: piano (0/1) + prodotti (0..N), con buono sconto,
   * pagabile con carta (Stripe) o bonifico. Crea UN solo pagamento che collega
   * abbonamento e/o ordine; l'attivazione avviene poi via finalizeApproval (webhook/approvazione).
   */
  async checkout(
    clientId: string,
    clientEmail: string,
    input: { planId?: string; items?: { productId: string; qty: number }[]; method: 'card' | 'bank_transfer'; discountCode?: string },
  ) {
    const method: 'card' | 'bank_transfer' = input.method === 'card' ? 'card' : 'bank_transfer';
    let subtotal = 0;

    let plan: { id: string; name: string; priceCents: number; listPriceCents?: number | null; promoEndsAt?: Date | null } | null = null;
    if (input.planId) {
      plan = await this.prisma.plan.findFirst({ where: { id: input.planId, active: true }, select: { id: true, name: true, priceCents: true, listPriceCents: true, promoEndsAt: true } });
      if (!plan) throw new NotFoundException('Piano non trovato');
      const profile = await this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { consents: true } });
      const consents = (profile?.consents ?? {}) as { healthDataConsent?: { accepted?: boolean } };
      if (!consents.healthDataConsent?.accepted) {
        throw new BadRequestException("Per il piano serve il consenso ai dati sanitari: completa prima il questionario.");
      }
      // Nuovo abbonamento consentito anche con uno attivo (parte in coda). Blocca solo
      // una richiesta non ancora pagata, per non aprire due ordini insieme.
      const pending = await this.prisma.subscription.findFirst({ where: { clientId, status: 'pending' as never } });
      if (pending) {
        throw new BadRequestException('Hai già una richiesta di abbonamento in corso.');
      }
      subtotal += this.planPricing(plan).effectivePriceCents;
    }

    let detailed: { productId: string; name: string; priceCents: number; qty: number }[] = [];
    if (input.items?.length) {
      const ids = input.items.map((i) => i.productId);
      const products = await this.prisma.product.findMany({ where: { id: { in: ids }, active: true } });
      if (products.length !== new Set(ids).size) throw new BadRequestException('Uno o più prodotti non esistono');
      type P = { id: string; name: string; priceCents: number };
      detailed = input.items.map((i) => {
        const pr = (products as P[]).find((p) => p.id === i.productId)!;
        const qty = Math.max(1, Math.min(99, Math.round(i.qty) || 1));
        return { productId: pr.id, name: pr.name, priceCents: pr.priceCents, qty };
      });
      subtotal += detailed.reduce((a, d) => a + d.priceCents * d.qty, 0);
    }

    if (!plan && detailed.length === 0) throw new BadRequestException('Il carrello è vuoto.');

    let discountCents = 0;
    let discountCodeId: string | null = null;
    if (input.discountCode?.trim()) {
      const res = await this.discounts.validate(input.discountCode, clientId, subtotal, {
        planId: plan?.id ?? null,
        planPriceCents: plan ? this.planPricing(plan).effectivePriceCents : null,
      });
      discountCents = res.discountCents;
      discountCodeId = res.codeId;
    }
    const totalCents = Math.max(0, subtotal - discountCents);
    // Il metodo di pagamento serve solo se c'è un importo da pagare.
    if (totalCents > 0) await this.assertMethodEnabled(method);

    let subscriptionId: string | null = null;
    if (plan) {
      const sub = await this.prisma.subscription.create({ data: { clientId, planId: plan.id, status: 'pending' } });
      subscriptionId = sub.id;
    }
    let orderId: string | null = null;
    if (detailed.length) {
      const order = await this.prisma.order.create({
        data: { clientId, totalCents: detailed.reduce((a, d) => a + d.priceCents * d.qty, 0), items: detailed as never },
      });
      orderId = order.id;
    }

    const parts = [plan ? `Abbonamento ${plan.name}` : null, detailed.length ? `${detailed.length} prodotti` : null].filter(Boolean);
    const description = parts.join(' + ') || 'Ordine';

    // Prodotto/piano GRATUITO (totale 0): niente flusso di pagamento, attivazione diretta.
    if (totalCents === 0) {
      const freePayment = await this.prisma.payment.create({
        data: {
          clientId,
          subscriptionId,
          orderId,
          amountCents: 0,
          description,
          method: 'manual' as never,
          status: 'approved',
          approvedAt: new Date(),
          discountCodeId,
          discountCents: discountCents || null,
        },
      });
      const full = await this.prisma.payment.findUnique({
        where: { id: freePayment.id },
        include: {
          subscription: { include: { plan: { select: { period: true } } } },
          client: { select: { email: true, locale: true } },
        },
      });
      // Attivazione identica a un pagamento approvato, ma senza provvigioni (è gratuito).
      await this.finalizeApproval(full as never, clientId, 'gratuito', { skipCommissions: true });
      await this.audit.log({
        action: 'commerce.checkout_free',
        actorId: clientId,
        entityType: 'payment',
        entityId: freePayment.id,
        metadata: { planId: plan?.id, products: detailed.length },
      });
      return { free: true as const, paymentId: freePayment.id, totalCents: 0 };
    }

    const payment = await this.prisma.payment.create({
      data: {
        clientId,
        subscriptionId,
        orderId,
        amountCents: totalCents,
        description,
        method: method as never,
        status: 'pending',
        discountCodeId,
        discountCents: discountCents || null,
      },
    });
    await this.audit.log({
      action: 'commerce.checkout',
      actorId: clientId,
      entityType: 'payment',
      entityId: payment.id,
      metadata: { planId: plan?.id, products: detailed.length, method, discountCents },
    });

    if (method === 'card') {
      const session = await this.stripe.createCheckoutSession({ paymentId: payment.id, description, amountCents: totalCents, customerEmail: clientEmail });
      await this.prisma.payment.update({ where: { id: payment.id }, data: { pspRef: session.sessionId } });
      return { checkoutUrl: session.url, paymentId: payment.id, totalCents };
    }
    const bankDetails = await this.configParams.getString('bank_transfer_details', 'IBAN: da configurare');
    const reference = `Ordine ${payment.id.slice(0, 8).toUpperCase()}`;
    const buyer = await this.prisma.user.findUnique({ where: { id: clientId }, select: { locale: true } });
    await this.mail.sendBankTransferInstructions(clientEmail, { description, amountCents: totalCents, bankDetails, reference }, buyer?.locale);
    return { method: 'bank_transfer', transferReference: reference, paymentId: payment.id, totalCents };
  }

  /** La cliente carica la contabile del bonifico (cifrata). */
  async uploadReceipt(
    clientId: string,
    paymentId: string,
    input: { fileName: string; mimeType: string; contentBase64: string },
  ) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, clientId } });
    if (!payment) throw new NotFoundException('Pagamento non trovato');
    if (payment.status !== 'pending' && payment.status !== 'receipt_uploaded' && payment.status !== 'rejected') {
      throw new BadRequestException('Questo pagamento non attende una contabile');
    }
    if (!RECEIPT_MIME.includes(input.mimeType)) {
      throw new BadRequestException('Formato non supportato (PDF o immagine)');
    }
    const plain = Buffer.from(input.contentBase64, 'base64');
    if (plain.length === 0 || plain.length > RECEIPT_MAX_BYTES) {
      throw new BadRequestException('Dimensione contabile non valida (max 5 MB)');
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptData: new Uint8Array(encryptBuffer(plain, this.receiptKey)),
        receiptMime: input.mimeType,
        receiptName: input.fileName,
        status: 'receipt_uploaded',
        rejectReason: null,
      },
    });
    await this.audit.log({
      action: 'commerce.receipt_uploaded',
      actorId: clientId,
      entityType: 'payment',
      entityId: paymentId,
    });
    return this.publicPayment(updated);
  }

  /**
   * La COACH carica la contabile PER CONTO della cliente (utile per le clienti in
   * difficoltà con l'app). Separazione dei poteri garantita per costruzione: questo
   * porta il pagamento solo a 'receipt_uploaded' — l'approvazione resta un endpoint
   * a parte riservato ad admin/responsabile, che la coach non può chiamare.
   * Scope: la coach solo sulle SUE clienti assegnate; responsabile (sales) e admin tutte.
   * L'audit registra CHI ha caricato (lo staff, non la cliente).
   */
  async uploadReceiptByStaff(
    actorUserId: string,
    paymentId: string,
    input: { fileName: string; mimeType: string; contentBase64: string },
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pagamento non trovato');
    await this.assertStaffPaymentAccess(actorUserId, payment.clientId);
    if (payment.status !== 'pending' && payment.status !== 'receipt_uploaded' && payment.status !== 'rejected') {
      throw new BadRequestException('Questo pagamento non attende una contabile');
    }
    if (!RECEIPT_MIME.includes(input.mimeType)) {
      throw new BadRequestException('Formato non supportato (PDF o immagine)');
    }
    const plain = Buffer.from(input.contentBase64, 'base64');
    if (plain.length === 0 || plain.length > RECEIPT_MAX_BYTES) {
      throw new BadRequestException('Dimensione contabile non valida (max 5 MB)');
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptData: new Uint8Array(encryptBuffer(plain, this.receiptKey)),
        receiptMime: input.mimeType,
        receiptName: input.fileName,
        status: 'receipt_uploaded',
        rejectReason: null,
      },
    });
    await this.audit.log({
      action: 'commerce.receipt_uploaded',
      actorId: actorUserId,
      entityType: 'payment',
      entityId: paymentId,
      metadata: { byStaff: true, clientId: payment.clientId }, // tracciabile: caricata dallo staff
    });
    return this.publicPayment(updated);
  }

  /** La contabile vista dallo staff (stesso scope dell'upload: coach solo sue clienti). */
  async downloadReceiptByStaff(actorUserId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pagamento non trovato');
    await this.assertStaffPaymentAccess(actorUserId, payment.clientId);
    if (!payment.receiptData) throw new NotFoundException('Contabile non presente');
    return {
      fileName: payment.receiptName,
      mimeType: payment.receiptMime,
      contentBase64: decryptBuffer(Buffer.from(payment.receiptData as unknown as Uint8Array), this.receiptKey).toString('base64'),
    };
  }

  /** Coach → solo clienti assegnate a lei; responsabile coach (sales) e admin → tutte. */
  private async assertStaffPaymentAccess(actorUserId: string, clientId: string): Promise<void> {
    // Coach → sue clienti; coordinatrice → sue + team; sales/admin: già filtrati dal controller.
    const ids = await coachTeamScope(this.prisma, actorUserId);
    if (!ids) return;
    const prof = (await this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { assignedCoachId: true } })) as { assignedCoachId: string | null } | null;
    if (!prof?.assignedCoachId || !ids.includes(prof.assignedCoachId)) {
      throw new ForbiddenException('Questa cliente non è assegnata a te.');
    }
  }

  async myPayments(clientId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    // Cast via unknown: publicPayment ritorna un tipo stretto ({hasReceipt}) che non
    // "sovrappone" abbastanza per un cast diretto (TS2352 → build Render rossa).
    const list = payments.map((p: Record<string, unknown>) => this.publicPayment(p)) as unknown as Array<
      Record<string, unknown> & { id: string; method: string; status: string; subscriptionId?: string | null }
    >;
    // Per i bonifici ancora da saldare (in attesa o con contabile già caricata) alleghiamo
    // i dati per pagare — IBAN e causale — così la cliente li vede anche in app (finora
    // erano solo nell'email) e può caricare la contabile dalla dashboard.
    const needsTransfer = list.some((p) => p.method === 'bank_transfer' && (p.status === 'pending' || p.status === 'receipt_uploaded'));
    if (!needsTransfer) return list;
    const bankDetails = await this.configParams.getString('bank_transfer_details', 'IBAN: da configurare in Parametri (bank_transfer_details)');
    const [profile, user] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: clientId }, select: { email: true } }),
    ]);
    const payer = profile?.name ?? user?.email ?? 'Metabole';
    return list.map((p) => {
      if (p.method !== 'bank_transfer' || (p.status !== 'pending' && p.status !== 'receipt_uploaded')) return p;
      const code = String(p.id).slice(0, 8).toUpperCase();
      const transferReference = p.subscriptionId ? `${payer} — ${code}` : `Ordine ${code}`;
      return { ...p, bankDetails, transferReference };
    });
  }

  async mySubscription(clientId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (!sub) return sub;
    // Data del PRIMO menu davvero erogato per questo abbonamento: è la "Inizio" vera
    // per la cliente (l'iscrizione/attivazione può precedere il primo menu).
    const firstMenu = await this.prisma.menuDay.findFirst({
      where: { clientId, ...(sub.startDate ? { date: { gte: sub.startDate } } : {}) },
      orderBy: { date: 'asc' },
      select: { date: true },
    });
    return { ...sub, firstMenuDate: firstMenu?.date ?? null };
  }

  /** Ricevuta PDF di un PROPRIO pagamento, solo dopo la conferma. */
  async myReceiptPdf(clientId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, clientId } });
    if (!payment) throw new NotFoundException('Pagamento non trovato');
    if (payment.status !== 'approved') {
      throw new BadRequestException('La ricevuta sarà disponibile dopo la conferma del pagamento.');
    }
    return this.generateReceiptPdf(paymentId);
  }

  // ---------- Operatore (admin/commerciale) ----------

  async listPayments(status?: string) {
    const payments = await this.prisma.payment.findMany({
      where: status ? { status: status as never } : {},
      // Più recenti in alto; col take:200 l'ordine desc garantisce di tenere gli ultimi.
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { email: true, clientProfile: { select: { name: true } } } } },
      take: 200,
    });
    return payments.map((p: Record<string, unknown>) => this.publicPayment(p));
  }

  /** L'operatore scarica la contabile per verificarla. */
  async downloadReceipt(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment?.receiptData) throw new NotFoundException('Contabile non presente');
    return {
      fileName: payment.receiptName,
      mimeType: payment.receiptMime,
      contentBase64: decryptBuffer(Buffer.from(payment.receiptData as unknown as Uint8Array), this.receiptKey).toString('base64'),
    };
  }

  /**
   * APPROVAZIONE dell'operatore (bonifico): solo con contabile caricata.
   * La catena a valle è condivisa col webhook Stripe (finalizeApproval).
   */
  async approvePayment(operator: AuthUser, paymentId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { userId: operator.sub } });
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } }, client: { select: { email: true, locale: true } } },
    });
    if (!payment) throw new NotFoundException('Pagamento non trovato');
    // Si approva un pagamento in attesa (contabile caricata o meno: l'operatore può aver
    // già visto il bonifico in banca). Non si "riapprova" un pagamento già chiuso.
    if (payment.status !== 'receipt_uploaded' && payment.status !== 'pending') {
      throw new BadRequestException('Questo pagamento non è più in attesa di approvazione');
    }

    const approved = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'approved', approvedById: staff?.id, approvedAt: new Date() },
    });
    await this.finalizeApproval(payment, operator.sub, 'bonifico');
    return this.publicPayment(approved);
  }

  /**
   * Webhook Stripe (idempotente): checkout completato → approvazione automatica.
   * Stessa catena del bonifico: attivazione, income, provvigioni, CRM, ricevuta.
   */
  async handleStripeEvent(event: { type: string; data: { object: unknown } }) {
    if (event.type !== 'checkout.session.completed') {
      return { handled: false, type: event.type };
    }
    const session = event.data.object as {
      id: string;
      payment_intent?: string | null;
      metadata?: { paymentId?: string };
    };
    const paymentId = session.metadata?.paymentId;
    if (!paymentId) return { handled: false, reason: 'metadata.paymentId assente' };

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } }, client: { select: { email: true, locale: true } } },
    });
    if (!payment) return { handled: false, reason: 'pagamento sconosciuto' };
    if (payment.status === 'approved') {
      return { handled: true, idempotent: true }; // webhook ripetuto: nessun doppio evento
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        pspRef: session.payment_intent ?? session.id,
      },
    });
    await this.finalizeApproval(payment, 'stripe-webhook', 'carta');
    return { handled: true };
  }

  /** Catena post-approvazione condivisa: attivazione, ledger, provvigioni, CRM, ricevuta. */
  /**
   * Evento di funnel del lancio (trial_started, trial_expired, …) su analytics_event.
   * Handoff punto 6: ogni evento porta anche SEGMENTO di provenienza (ex cliente /
   * lead caldo / lead freddo) e CANALE, letti dalla scheda CRM del cliente.
   */
  private async funnelEvent(userId: string, name: string, data?: Record<string, unknown>): Promise<void> {
    let segment: string | null = null;
    let channel: string | null = null;
    try {
      const rec = (await this.prisma.crmRecord.findUnique({
        where: { clientId: userId },
        select: { segment: true, channel: true, previousStatus: true, historicalPaidCents: true, stage: true } as never,
      })) as { segment: string | null; channel: string | null; previousStatus: string | null; historicalPaidCents: number | null; stage: string } | null;
      if (rec) {
        segment = deriveSegment(rec);
        channel = rec.channel ?? null;
      }
    } catch { /* l'arricchimento non deve mai bloccare l'evento */ }
    await this.prisma.analyticsEvent
      .create({ data: { eventId: randomUUID(), name, userId, phase: 'funnel', data: { ...(data ?? {}), ...(segment ? { segment } : {}), ...(channel ? { channel } : {}) } as never } as never })
      .catch(() => undefined); // il tracciamento non deve mai rompere il flusso
  }

  /** Il piano è la PROVA GRATUITA? (prezzo 0: senza carta per definizione). */
  private isTrialPlanPrice(priceCents: number | null | undefined): boolean {
    return (priceCents ?? -1) === 0;
  }

  /**
   * CRON giornaliero della prova gratuita (handoff Prezzi/Prova, punto 2):
   * 1) SCADENZA AUTOMATICA: le prove attive oltre la fine (endDate) passano a
   *    `expired` → evento `trial_expired` (una sola volta: è la transizione di stato).
   * 2) PURGE a +7 giorni: se dopo una settimana dalla scadenza il cliente NON ha
   *    convertito (nessun abbonamento attivo/in attesa e nessun pagamento vero),
   *    il profilo personalizzato che Gaia ha imparato viene CANCELLATO DAVVERO
   *    (pesi menu, valutazioni ricette, base personale, cicli, certificato) →
   *    evento `profile_purged`. "La leva di conversione più forte deve essere vera."
   *    Restano: anagrafica, misure e documenti (retention sanitaria separata).
   */
  async expireTrialsAndPurge(): Promise<{ expired: number; purged: number }> {
    const now = new Date();
    // 1) Scadenza prova.
    const dueTrials = (await this.prisma.subscription.findMany({
      where: { status: 'active', endDate: { lt: now }, plan: { priceCents: 0 } } as never,
      select: { id: true, clientId: true, endDate: true },
    })) as { id: string; clientId: string; endDate: Date | null }[];
    for (const sub of dueTrials) {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' } });
      await this.funnelEvent(sub.clientId, 'trial_expired', { subscriptionId: sub.id });
      await this.audit.log({ action: 'trial.expired', actorId: sub.clientId, entityType: 'subscription', entityId: sub.id });
    }

    // 2) Purge del profilo personalizzato a +7 giorni senza conversione.
    const cutoff = new Date(now.getTime() - 7 * 86_400_000);
    const staleTrials = (await this.prisma.subscription.findMany({
      where: { status: 'expired', endDate: { lt: cutoff }, plan: { priceCents: 0 } } as never,
      select: { clientId: true },
      distinct: ['clientId'] as never,
    })) as { clientId: string }[];
    let purged = 0;
    for (const t of staleTrials) {
      // Ha convertito? (abbonamento attivo/in attesa o un pagamento vero approvato)
      const [activeSub, paid, alreadyPurged] = await Promise.all([
        this.prisma.subscription.findFirst({ where: { clientId: t.clientId, status: { in: ['active', 'pending'] as never } }, select: { id: true } }), // 'paused' non è uno stato valido (enum), faceva 500
        this.prisma.payment.findFirst({ where: { clientId: t.clientId, status: 'approved', amountCents: { gt: 0 } } as never, select: { id: true } }),
        this.prisma.analyticsEvent.findFirst({ where: { userId: t.clientId, name: 'profile_purged' } as never, select: { id: true } }),
      ]);
      if (activeSub || paid || alreadyPurged) continue;
      await this.prisma.$transaction([
        this.prisma.menuWeight.deleteMany({ where: { clientId: t.clientId } }),
        this.prisma.recipeRating.deleteMany({ where: { clientId: t.clientId } }),
        this.prisma.clientMenuPool.deleteMany({ where: { clientId: t.clientId } }),
        this.prisma.clientCycle.deleteMany({ where: { clientId: t.clientId } }),
        this.prisma.personalizationCertificate.deleteMany({ where: { clientId: t.clientId } }),
      ] as never);
      await this.funnelEvent(t.clientId, 'profile_purged', {});
      await this.audit.log({ action: 'trial.profile_purged', actorId: t.clientId, entityType: 'user', entityId: t.clientId });
      purged++;
    }
    return { expired: dueTrials.length, purged };
  }

  private async finalizeApproval(
    payment: {
      id: string;
      clientId: string;
      subscriptionId: string | null;
      orderId: string | null;
      amountCents: number;
      description: string;
      subscription: { plan: { period: string } } | null;
      client: { email: string; locale?: string | null };
      discountCodeId?: string | null;
      discountCents?: number | null;
    },
    byUserId: string,
    methodLabel: string,
    options?: { skipCommissions?: boolean },
  ) {
    // Attivazione abbonamento (durata dal periodo del piano: es. "3m").
    if (payment.subscriptionId && payment.subscription) {
      const now = new Date();
      // CODA: se la cliente ha già un altro abbonamento attivo che termina nel futuro,
      // il nuovo NON parte subito ma alla scadenza di quello (rinnovo/secondo piano in
      // coda). Altrimenti parte oggi. Così può comprare in anticipo senza sovrapporre.
      const activeAhead = (await this.prisma.subscription.findFirst({
        where: { clientId: payment.clientId, id: { not: payment.subscriptionId }, status: 'active', endDate: { gt: now } } as never,
        orderBy: { endDate: 'desc' },
        select: { endDate: true },
      })) as { endDate: Date | null } | null;
      // Inizio effettivo: in coda dopo un piano attivo; altrimenti la DATA DI INIZIO
      // SCELTA dalla cliente nell'onboarding (planStartDate) se è nel futuro (max 60
      // giorni); altrimenti oggi. Così scheda, scadenza e menu raccontano la stessa data.
      let start = activeAhead?.endDate ?? now;
      if (!activeAhead?.endDate) {
        const prof = (await this.prisma.clientProfile.findUnique({
          where: { userId: payment.clientId },
          select: { planStartDate: true },
        })) as { planStartDate: Date | null } | null;
        const chosen = prof?.planStartDate ?? null;
        if (chosen && chosen.getTime() > now.getTime() && chosen.getTime() - now.getTime() <= 60 * 86_400_000) {
          start = chosen;
        }
      }
      const end = subscriptionEnd(start, payment.subscription.plan.period);
      await this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'active', startDate: start, endDate: end },
      });
      // "Porta un'amica": alla prima attivazione dell'invitata premia chi l'ha
      // invitata (idempotente sull'invito; non deve mai far fallire il pagamento).
      await this.referral.onConvert(payment.clientId).catch(() => undefined);
      // Monitoraggio: menu di rientro pagato → eroga gli 8 menu e riparte il mese;
      // altro piano a pagamento → l'eventuale monitoraggio in corso si converte.
      const actPlan = (await this.prisma.subscription.findUnique({
        where: { id: payment.subscriptionId },
        select: { plan: { select: { id: true, name: true, priceCents: true, period: true } } },
      })) as { plan: { id: string; name: string; priceCents: number; period: string } } | null;
      if (actPlan?.plan) await this.monitoring.onPlanActivated(payment.clientId, actPlan.plan);
    }
    if (payment.orderId) {
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: 'paid' } });
    }

    await this.finance.recordIncome({
      amountCents: payment.amountCents,
      category: payment.subscriptionId ? 'subscription' : 'order',
      ref: payment.id,
      clientId: payment.clientId,
      note: payment.description,
    });
    if (!options?.skipCommissions) {
      await this.finance.generateCommissions({
        id: payment.id,
        clientId: payment.clientId,
        amountCents: payment.amountCents,
      });
    }
    // Funnel del lancio: attivazione prova → trial_started; pagamento vero dopo
    // una prova → trial_converted (idempotente: solo se non già emesso).
    if (payment.subscriptionId) {
      if (payment.amountCents === 0) {
        await this.funnelEvent(payment.clientId, 'trial_started', { subscriptionId: payment.subscriptionId });
      } else {
        const [hadTrial, alreadyConverted] = await Promise.all([
          this.prisma.analyticsEvent.findFirst({ where: { userId: payment.clientId, name: 'trial_started' } as never, select: { id: true } }),
          this.prisma.analyticsEvent.findFirst({ where: { userId: payment.clientId, name: 'trial_converted' } as never, select: { id: true } }),
        ]);
        if (hadTrial && !alreadyConverted) {
          await this.funnelEvent(payment.clientId, 'trial_converted', { paymentId: payment.id, amountCents: payment.amountCents });
        }
        // Handoff punto 6 — anelli successivi del funnel: rinnovi e mantenimento.
        const subPlan = (await this.prisma.subscription.findUnique({
          where: { id: payment.subscriptionId },
          select: { createdAt: true, plan: { select: { period: true, priceCents: true } } },
        })) as { createdAt: Date; plan: { period: string; priceCents: number } } | null;
        if (subPlan?.plan.period === 'maintenance') {
          await this.funnelEvent(payment.clientId, 'maintenance_started', { subscriptionId: payment.subscriptionId, amountCents: payment.amountCents });
        } else if (subPlan) {
          // Rinnovo = nuovo acquisto a pagamento quando esisteva già un abbonamento
          // a pagamento precedente (qualunque stato: la prova non conta).
          const prior = await this.prisma.subscription.findFirst({
            where: {
              clientId: payment.clientId,
              id: { not: payment.subscriptionId },
              createdAt: { lt: subPlan.createdAt },
              plan: { priceCents: { gt: 0 } },
            } as never,
            select: { id: true },
          });
          if (prior) await this.funnelEvent(payment.clientId, 'plan_renewed', { subscriptionId: payment.subscriptionId, amountCents: payment.amountCents });
        }
      }
    }
    // CRM: prodotto GRATUITO (totale 0) → stato "Prova" (trial); pagamento vero →
    // "Acquisito" (key 'paid'). Chi è già Acquisito non retrocede a Prova per un omaggio.
    if (payment.amountCents > 0) {
      await this.crm.autoAdvance(payment.clientId, 'paid', byUserId, payment.amountCents);
    } else {
      const rec = await this.prisma.crmRecord
        .findUnique({ where: { clientId: payment.clientId }, select: { stage: true } })
        .catch(() => null);
      if ((rec as { stage?: string } | null)?.stage !== 'paid') {
        await this.crm.autoAdvance(payment.clientId, 'trial', byUserId);
      }
    }

    // Riscatto del buono sconto (se applicato): incrementa gli utilizzi.
    if (payment.discountCodeId) {
      await this.discounts.redeem(payment.discountCodeId, payment.clientId, payment.id, payment.discountCents ?? 0);
    }

    const receipt = await this.generateReceiptPdf(payment.id).catch(() => null);
    await this.mail.sendPaymentReceipt(
      payment.client.email,
      {
        description: payment.description,
        amountCents: payment.amountCents,
        paymentId: payment.id,
        date: new Date(),
      },
      payment.client.locale,
      receipt ? [{ name: receipt.fileName, content: receipt.contentBase64 }] : undefined,
    );
    await this.notifications.notifyOncePerDay({
      userId: payment.clientId,
      type: 'payment_approved',
      messageKey: payment.subscriptionId ? 'payment_approved_subscription' : 'payment_approved_order',
      payload: { method: methodLabel },
    });
    // Notifica alla coach della struttura: una sua cliente ha pagato.
    await this.notifyCoachOfPayment(payment.clientId, payment.amountCents).catch(() => undefined);
    await this.audit.log({
      action: 'commerce.payment.approve',
      actorId: byUserId,
      entityType: 'payment',
      entityId: payment.id,
      metadata: { amountCents: payment.amountCents, method: methodLabel },
    });
  }

  async rejectPayment(operator: AuthUser, paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { client: { select: { email: true, locale: true } } },
    });
    if (!payment) throw new NotFoundException('Pagamento non trovato');
    if (payment.status !== 'receipt_uploaded' && payment.status !== 'pending') {
      throw new BadRequestException('Questo pagamento non è più in attesa di approvazione');
    }
    const rejected = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'rejected', rejectReason: reason },
    });
    await this.notifications.notifyOncePerDay({
      userId: payment.clientId,
      type: 'payment_rejected',
      messageKey: 'payment_rejected',
      params: { reason },
    });
    await this.audit.log({
      action: 'commerce.payment.reject',
      actorId: operator.sub,
      entityType: 'payment',
      entityId: paymentId,
      metadata: { reason },
    });
    return this.publicPayment(rejected);
  }

  /**
   * Annulla un pagamento/ordine in attesa (non ancora approvato). Usato da:
   * - l'operatore dal backoffice ("Elimina": annulla ma resta nello storico);
   * - la cliente dalla sua area (annulla l'ordine se non lo vuole più);
   * - il cron (auto-annullo dei bonifici in attesa oltre la soglia di giorni).
   * L'annullo NON cancella lo storico: imposta lo stato `cancelled` e chiude
   * eventuale abbonamento/ordine ancora in sospeso. Un pagamento già approvato
   * non si annulla da qui (serve una nota di credito, fuori da questo flusso).
   */
  async cancelPayment(actorId: string, paymentId: string, opts: { byClient: boolean; reason?: string }) {
    const where = opts.byClient ? { id: paymentId, clientId: actorId } : { id: paymentId };
    const payment = await this.prisma.payment.findFirst({ where });
    if (!payment) throw new NotFoundException('Pagamento non trovato');
    if (payment.status === 'cancelled') return this.publicPayment(payment as unknown as Record<string, unknown>);
    if (payment.status === 'approved') {
      throw new BadRequestException('Un pagamento già approvato non può essere annullato.');
    }
    if (payment.status !== 'pending' && payment.status !== 'receipt_uploaded') {
      throw new BadRequestException('Questo pagamento non è annullabile.');
    }

    const reason = opts.reason ?? (opts.byClient ? 'Annullato dalla cliente' : 'Annullato dall\'operatore');
    const cancelled = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'cancelled', rejectReason: reason },
    });
    // Chiude l'eventuale abbonamento/ordine ancora in sospeso.
    if (payment.subscriptionId) {
      await this.prisma.subscription.updateMany({
        where: { id: payment.subscriptionId, status: 'pending' },
        data: { status: 'cancelled' },
      });
    }
    if (payment.orderId) {
      await this.prisma.order.updateMany({
        where: { id: payment.orderId, status: 'pending' },
        data: { status: 'cancelled' },
      });
    }
    await this.audit.log({
      action: 'commerce.payment.cancel',
      actorId,
      entityType: 'payment',
      entityId: paymentId,
      metadata: { reason, byClient: opts.byClient },
    });
    return this.publicPayment(cancelled as unknown as Record<string, unknown>);
  }

  /**
   * Cron: annulla i bonifici rimasti "in attesa contabile" (pending) oltre la soglia
   * di giorni (config_param `payment_pending_auto_cancel_days`, default 10).
   * I pagamenti con contabile già caricata (receipt_uploaded) NON si toccano: aspettano
   * la verifica dell'operatore.
   */
  async autoCancelStalePayments(): Promise<{ cancelled: number; days: number }> {
    const days = await this.configParams.getNumber('payment_pending_auto_cancel_days', 10);
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const stale = await this.prisma.payment.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      select: { id: true },
    });
    let cancelled = 0;
    for (const p of stale) {
      try {
        await this.cancelPayment('system-cron', p.id, {
          byClient: false,
          reason: `Annullato automaticamente: nessuna contabile entro ${days} giorni`,
        });
        cancelled++;
      } catch {
        /* non bloccare il batch per un singolo record */
      }
    }
    return { cancelled, days };
  }

  /** Mai esporre i byte della contabile nelle liste. */
  private publicPayment(payment: Record<string, unknown>) {
    const { receiptData, ...rest } = payment;
    return { ...rest, hasReceipt: Boolean(receiptData) };
  }

  // ---------- Acquisti (operatore) ----------

  /**
   * Acquisto inserito a mano dall'operatore: attiva sempre il piano; genera le
   * provvigioni solo se richiesto. Utile per omaggi, regolarizzazioni, vendite
   * fuori piattaforma.
   */
  async createManualPurchase(operator: AuthUser, input: { clientId: string; planId: string; generateCommissions: boolean; discountCode?: string | null }) {
    const plan = await this.prisma.plan.findFirst({ where: { id: input.planId } });
    if (!plan) throw new NotFoundException('Piano non trovato');
    const client = await this.prisma.user.findFirst({
      where: { id: input.clientId, role: 'client', deletedAt: null },
      select: { id: true, email: true, locale: true },
    });
    if (!client) throw new NotFoundException('Cliente non trovato');

    // Prezzo effettivo (promo/listino) + buono sconto (facoltativo).
    const manualPlanPrice = this.planPricing(plan as never).effectivePriceCents;
    let amountCents = manualPlanPrice;
    let discount: { codeId: string; discountCents: number } | null = null;
    if (input.discountCode && input.discountCode.trim()) {
      const d = await this.discounts.validate(input.discountCode, client.id, manualPlanPrice, { planId: plan.id, planPriceCents: manualPlanPrice });
      discount = { codeId: d.codeId, discountCents: d.discountCents };
      amountCents = d.finalCents;
    }

    const staff = await this.prisma.staff.findUnique({ where: { userId: operator.sub }, select: { id: true } });
    const subscription = await this.prisma.subscription.create({
      data: { clientId: client.id, planId: plan.id, status: 'pending' },
    });
    const payment = await this.prisma.payment.create({
      data: {
        clientId: client.id,
        subscriptionId: subscription.id,
        amountCents,
        description: `Abbonamento ${plan.name}`,
        method: 'manual' as never,
        status: 'approved',
        approvedById: staff?.id,
        approvedAt: new Date(),
        discountCodeId: discount?.codeId ?? null,
        discountCents: discount?.discountCents ?? null,
      },
    });

    await this.finalizeApproval(
      {
        id: payment.id,
        clientId: client.id,
        subscriptionId: subscription.id,
        orderId: null,
        amountCents: payment.amountCents,
        description: payment.description,
        subscription: { plan: { period: plan.period } },
        client: { email: client.email, locale: client.locale },
        discountCodeId: discount?.codeId ?? null,
        discountCents: discount?.discountCents ?? null,
      },
      operator.sub,
      'manuale',
      { skipCommissions: !input.generateCommissions },
    );
    await this.audit.log({
      action: 'commerce.purchase.manual',
      actorId: operator.sub,
      entityType: 'payment',
      entityId: payment.id,
      metadata: { planId: plan.id, amountCents, generateCommissions: input.generateCommissions },
    });
    return this.publicPayment(payment);
  }

  /** Ricevuta PDF di un pagamento (numero, data, cliente, prodotto, importo). */
  async generateReceiptPdf(paymentId: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        client: {
          select: {
            email: true, firstName: true, lastName: true,
            addressLine: true, postalCode: true, city: true, province: true, codiceFiscale: true,
            clientProfile: { select: { name: true } },
            crmRecord: { select: { codiceFiscale: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Pagamento non trovato');

    const p = payment as unknown as {
      id: string; amountCents: number; description: string; method: string; status: string;
      createdAt: Date; approvedAt: Date | null;
      client: {
        email: string; firstName: string | null; lastName: string | null;
        addressLine: string | null; postalCode: string | null; city: string | null; province: string | null;
        codiceFiscale: string | null;
        clientProfile: { name: string | null } | null;
        crmRecord: { codiceFiscale: string | null } | null;
      } | null;
    };
    const date = p.approvedAt ?? p.createdAt;
    const number = `RIC-${date.getUTCFullYear()}-${p.id.slice(0, 8).toUpperCase()}`;
    const fullName = [p.client?.firstName, p.client?.lastName].filter(Boolean).join(' ').trim();
    const clientName = fullName || p.client?.clientProfile?.name || p.client?.email || 'Cliente';
    // Indirizzo su una riga ("Via X 1, 20100 Milano (MI)") e codice fiscale (User → scheda CRM).
    const addressParts = [
      p.client?.addressLine?.trim(),
      [p.client?.postalCode, p.client?.city].filter(Boolean).join(' ').trim() || null,
      p.client?.province ? `(${p.client.province})` : null,
    ].filter(Boolean) as string[];
    const address = addressParts.join(', ');
    const taxCode = (p.client?.codiceFiscale ?? p.client?.crmRecord?.codiceFiscale ?? '').trim().toUpperCase();
    // Righe opzionali: stringa vuota se il dato manca (il template le ingloba così com'è).
    const optRow = (label: string, value: string) =>
      value ? `<tr><td class="k">${label}</td><td>${value}</td></tr>` : '';
    const methodLabel = p.method === 'card' ? 'Carta' : p.method === 'manual' ? 'Manuale' : 'Bonifico';
    const statusLabel = p.status === 'approved' ? 'Pagato' : p.status === 'rejected' ? 'Rifiutato' : 'In attesa';
    const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
    const fileName = `${number}.pdf`;

    // Preferisci il template HTML modificabile (Chromium); in caso di problemi, ripiega su pdfkit.
    try {
      const htmlPdf = await this.pdf.renderTemplatePdf('receipt', {
        number,
        date: date.toLocaleDateString('it-IT'),
        clientName,
        email: p.client?.email ?? '',
        address,
        taxCode,
        addressRow: optRow('Indirizzo', address),
        taxCodeRow: optRow('Codice fiscale', taxCode),
        description: p.description,
        method: methodLabel,
        status: statusLabel,
        total: euro(p.amountCents),
      });
      return { fileName, mimeType: 'application/pdf', contentBase64: htmlPdf.toString('base64') };
    } catch {
      /* Chromium non disponibile: uso il generatore storico (pdfkit) qui sotto. */
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor('#10403a').fontSize(24).text('Metabole', { continued: false });
      doc.moveDown(0.2);
      doc.fillColor('#7c8c88').fontSize(11).text('Ricevuta di pagamento');
      doc.moveDown(1.2);

      doc.fillColor('#111').fontSize(11);
      const row = (label: string, value: string) => {
        doc.font('Helvetica-Bold').text(label, { continued: true }).font('Helvetica').text('   ' + value);
        doc.moveDown(0.5);
      };
      row('Numero ricevuta:', number);
      row('Data:', date.toLocaleDateString('it-IT'));
      row('Cliente:', clientName);
      if (p.client?.email) row('Email:', p.client.email);
      row('Descrizione:', p.description);
      row('Metodo:', methodLabel);
      row('Stato:', statusLabel);

      doc.moveDown(0.8);
      doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#e6e2d8').stroke();
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fillColor('#10403a').fontSize(16).text('Totale: ' + euro(p.amountCents), { align: 'right' });

      doc.moveDown(3);
      doc.font('Helvetica').fillColor('#9aa39f').fontSize(9).text(
        'Documento generato automaticamente da Metabole. Non costituisce fattura fiscale.',
        { align: 'center' },
      );
      doc.end();
    });

    return {
      fileName: `${number}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: buffer.toString('base64'),
    };
  }

  /**
   * Elimina un acquisto ANNULLANDONE gli effetti: provvigioni (ledger +
   * compensi aggregati), incasso, accantonamenti, utilizzo del buono sconto,
   * e annulla l'abbonamento collegato. Solo admin (controllato dal controller).
   */
  async deletePurchase(paymentId: string, actorId: string) {
    const payment = (await this.prisma.payment.findUnique({ where: { id: paymentId } })) as
      | { id: string; subscriptionId: string | null; discountCodeId: string | null; clientId: string }
      | null;
    if (!payment) throw new NotFoundException('Acquisto non trovato');

    await this.prisma.$transaction(async (tx: PrismaTx) => {
      // 1) Storno delle provvigioni pagate su questo acquisto (ledger + compensi).
      const commissions = (await tx.ledgerEntry.findMany({
        where: { category: 'sales_commission', ref: paymentId },
      })) as { id: string; amountCents: number; staffId: string | null; ref: string | null; date: Date }[];
      for (const c of commissions) {
        await tx.ledgerEntry.delete({ where: { id: c.id } });
        if (c.staffId) {
          const period = c.date.toISOString().slice(0, 7);
          const comp = (await tx.staffCompensation.findUnique({
            where: { staffId_period: { staffId: c.staffId, period } },
          })) as { amountCents: number; items: unknown } | null;
          if (comp) {
            const items = (Array.isArray(comp.items) ? comp.items : []) as { kind?: string; amountCents?: number; ref?: string }[];
            const idx = items.findIndex((it) => it.kind === 'sales_commission' && it.amountCents === c.amountCents && it.ref === c.ref);
            if (idx >= 0) items.splice(idx, 1);
            await tx.staffCompensation.update({
              where: { staffId_period: { staffId: c.staffId, period } },
              data: { amountCents: Math.max(0, comp.amountCents - c.amountCents), items: items as never },
            });
          }
        }
      }

      // 2) Storno dell'incasso a ledger.
      await tx.ledgerEntry.deleteMany({ where: { ref: paymentId, category: { in: ['subscription', 'order'] } } });

      // 3) Provvigioni accantonate legate all'acquisto.
      await tx.pendingCommission.deleteMany({ where: { paymentId } });

      // 4) Storno dell'utilizzo del buono sconto.
      if (payment.discountCodeId) {
        const used = await tx.discountRedemption.count({ where: { paymentId } });
        if (used > 0) {
          await tx.discountRedemption.deleteMany({ where: { paymentId } });
          await tx.discountCode.update({ where: { id: payment.discountCodeId }, data: { usedCount: { decrement: used } } });
        }
      }

      // 5) Annulla l'abbonamento collegato.
      if (payment.subscriptionId) {
        await tx.subscription.update({ where: { id: payment.subscriptionId }, data: { status: 'cancelled' as never } });
      }

      // 6) Elimina il pagamento.
      await tx.payment.delete({ where: { id: paymentId } });
    });

    await this.audit.log({ action: 'commerce.purchase.delete', actorId, entityType: 'payment', entityId: paymentId });
    return { removed: paymentId };
  }

  /**
   * STORNO di un acquisto pagato: registra il rimborso deciso dall'operatore
   * (l'esecuzione del rimborso su Stripe/bonifico resta manuale), BLOCCA
   * l'erogazione dei menu annullando l'abbonamento collegato, netta l'incasso in
   * contabilità e storna le provvigioni IN PROPORZIONE all'importo rimborsato.
   * Alla cliente parte l'email con la ricevuta di rimborso in allegato.
   */
  async refundPurchase(paymentId: string, actorId: string, input: { amountCents: number; note?: string | null }) {
    const payment = (await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { client: { select: { email: true, locale: true } } },
    })) as
      | {
          id: string; clientId: string; subscriptionId: string | null; amountCents: number;
          description: string; status: string; refundedAt: Date | null;
          client: { email: string; locale: string | null } | null;
        }
      | null;
    if (!payment) throw new NotFoundException('Acquisto non trovato');
    if (payment.status !== 'approved') throw new BadRequestException('Si può stornare solo un acquisto pagato');
    if (payment.refundedAt) throw new BadRequestException('Acquisto già stornato');
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > payment.amountCents) {
      throw new BadRequestException("L'importo del rimborso deve essere maggiore di zero e non superiore all'importo pagato");
    }
    const fraction = input.amountCents / payment.amountCents;

    await this.prisma.$transaction(async (tx: PrismaTx) => {
      // 1) Registra lo storno sul pagamento (resta nello storico, non si elimina).
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          refundCents: input.amountCents,
          refundedAt: new Date(),
          refundNote: input.note ?? null,
          refundById: actorId,
        } as never,
      });

      // 2) Blocco dell'erogazione dei menu: l'abbonamento collegato viene annullato
      //    (deliverIfEligible eroga solo con abbonamento 'active').
      if (payment.subscriptionId) {
        await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'cancelled' as never },
        });
      }

      // 3) Contabilità: incasso NEGATIVO nella stessa categoria dell'entrata
      //    originale, così totali e report mensile si nettano da soli.
      await tx.ledgerEntry.create({
        data: {
          type: 'income',
          amountCents: -input.amountCents,
          category: payment.subscriptionId ? 'subscription' : 'order',
          ref: paymentId,
          clientId: payment.clientId,
          note: `Storno rimborso${input.note ? ': ' + input.note : ''}`,
        } as never,
      });

      // 4) Provvigioni: storno proporzionale di ogni provvigione generata da
      //    questo acquisto (ledger negativo + compenso del periodo ridotto).
      const commissions = (await tx.ledgerEntry.findMany({
        where: { category: 'sales_commission', ref: paymentId, amountCents: { gt: 0 } },
      })) as { id: string; amountCents: number; staffId: string | null; date: Date }[];
      for (const c of commissions) {
        const share = Math.round(c.amountCents * fraction);
        if (share <= 0) continue;
        await tx.ledgerEntry.create({
          data: {
            type: 'expense',
            amountCents: -share,
            category: 'sales_commission',
            ref: paymentId,
            staffId: c.staffId,
            clientId: payment.clientId,
            note: 'Storno provvigione (rimborso acquisto)',
          } as never,
        });
        if (c.staffId) {
          const period = new Date(c.date).toISOString().slice(0, 7);
          const comp = (await tx.staffCompensation.findUnique({
            where: { staffId_period: { staffId: c.staffId, period } },
          })) as { amountCents: number; items: unknown } | null;
          if (comp) {
            const items = (Array.isArray(comp.items) ? comp.items : []) as Record<string, unknown>[];
            items.push({ kind: 'sales_commission_refund', amountCents: -share, ref: paymentId });
            await tx.staffCompensation.update({
              where: { staffId_period: { staffId: c.staffId, period } },
              data: { amountCents: Math.max(0, comp.amountCents - share), items: items as never },
            });
          }
        }
      }

      // 5) Provvigioni ACCANTONATE non ancora risolte: ridotte in proporzione.
      const pendings = (await tx.pendingCommission.findMany({
        where: { paymentId, status: 'pending' },
      })) as { id: string; amountCents: number }[];
      for (const pc of pendings) {
        const share = Math.round(pc.amountCents * fraction);
        if (share <= 0) continue;
        await tx.pendingCommission.update({
          where: { id: pc.id },
          data: { amountCents: Math.max(0, pc.amountCents - share) },
        });
      }
    });

    await this.audit.log({
      action: 'commerce.purchase.refund',
      actorId,
      entityType: 'payment',
      entityId: paymentId,
      metadata: { refundCents: input.amountCents, note: input.note ?? undefined },
    });

    // Ricevuta di rimborso alla cliente (mail con PDF in allegato; eventuali
    // errori di invio non annullano lo storno già registrato).
    if (payment.client?.email) {
      const receipt = await this.generateRefundReceiptPdf(paymentId).catch(() => null);
      await this.mail
        .sendRefundReceipt(
          payment.client.email,
          {
            description: payment.description,
            amountCents: input.amountCents,
            paymentId,
            date: new Date(),
          },
          payment.client.locale,
          receipt ? [{ name: receipt.fileName, content: receipt.contentBase64 }] : undefined,
        )
        .catch(() => undefined);
    }

    const updated = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { client: { select: { email: true, clientProfile: { select: { name: true } } } } },
    });
    return this.publicPayment(updated as Record<string, unknown>);
  }

  /** Ricevuta di RIMBORSO in PDF (per la cliente e scaricabile dal backoffice). */
  async generateRefundReceiptPdf(paymentId: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { client: { select: { email: true, clientProfile: { select: { name: true } } } } },
    });
    if (!payment) throw new NotFoundException('Pagamento non trovato');

    const p = payment as unknown as {
      id: string; amountCents: number; refundCents: number | null; refundedAt: Date | null;
      refundNote: string | null; description: string; method: string;
      client: { email: string; clientProfile: { name: string | null } | null } | null;
    };
    if (!p.refundedAt || !p.refundCents) throw new NotFoundException('Questo acquisto non è stato stornato');

    const refundCents = p.refundCents; // narrowed a number dopo il guard (evita null nella closure del PDF)
    const date = p.refundedAt;
    const number = `RMB-${date.getUTCFullYear()}-${p.id.slice(0, 8).toUpperCase()}`;
    const clientName = p.client?.clientProfile?.name ?? p.client?.email ?? 'Cliente';
    const methodLabel = p.method === 'card' ? 'Carta' : p.method === 'manual' ? 'Manuale' : 'Bonifico';
    const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor('#10403a').fontSize(24).text('Metabole', { continued: false });
      doc.moveDown(0.2);
      doc.fillColor('#7c8c88').fontSize(11).text('Ricevuta di rimborso');
      doc.moveDown(1.2);

      doc.fillColor('#111').fontSize(11);
      const row = (label: string, value: string) => {
        doc.font('Helvetica-Bold').text(label, { continued: true }).font('Helvetica').text('   ' + value);
        doc.moveDown(0.5);
      };
      row('Numero ricevuta:', number);
      row('Data:', date.toLocaleDateString('it-IT'));
      row('Cliente:', clientName);
      if (p.client?.email) row('Email:', p.client.email);
      row('Descrizione:', p.description);
      row('Metodo originale:', methodLabel);
      row('Importo pagato:', euro(p.amountCents));
      if (p.refundNote) row('Nota:', p.refundNote);

      doc.moveDown(0.8);
      doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#e6e2d8').stroke();
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fillColor('#10403a').fontSize(16).text('Totale rimborsato: ' + euro(refundCents), { align: 'right' });

      doc.moveDown(3);
      doc.font('Helvetica').fillColor('#9aa39f').fontSize(9).text(
        'Documento generato automaticamente da Metabole. Non costituisce fattura fiscale.',
        { align: 'center' },
      );
      doc.end();
    });

    return {
      fileName: `${number}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: buffer.toString('base64'),
    };
  }

  /** Avvisa la coach assegnata quando una sua cliente effettua un pagamento. */
  private async notifyCoachOfPayment(clientId: string, amountCents: number): Promise<void> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { name: true, assignedCoachId: true },
    });
    if (!profile?.assignedCoachId) return;
    const coach = await this.prisma.staff.findUnique({
      where: { id: profile.assignedCoachId },
      select: { userId: true },
    });
    if (!coach) return;
    const euro = (amountCents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await this.notifications
      .notify({
        userId: coach.userId,
        type: 'payment_in_structure',
        title: 'Pagamento nella tua struttura',
        body: `${profile.name ?? 'Una tua cliente'} ha effettuato un pagamento di € ${euro}.`,
        payload: { clientId },
      })
      .catch(() => undefined);
  }
}
