import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConfigParamsService } from '../config-params/config-params.service';
import { decryptBuffer, deriveKey, encryptBuffer } from '../health-area/crypto.util';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CrmService } from './crm.service';
import { FinanceService } from './finance.service';
import { StripeService } from './stripe.service';

const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

/**
 * Commercio col flusso BONIFICO (richiesta di Simone, 9/7/2026):
 * richiesta → email con estremi → upload contabile → APPROVAZIONE operatore →
 * solo allora: abbonamento attivo (menu erogabile), income a ledger,
 * provvigioni generate, ricevuta via email.
 */
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
  ) {
    this.receiptKey = deriveKey(this.config.get<string>('FILE_ENCRYPTION_KEY') ?? 'dev-only-file-key');
  }

  // ---------- Piani e prodotti ----------

  async listPlans() {
    return this.prisma.plan.findMany({ where: { active: true }, orderBy: { priceCents: 'asc' } });
  }

  async listProducts() {
    return this.prisma.product.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
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

    const existing = await this.prisma.subscription.findFirst({
      where: { clientId, status: { in: ['pending', 'active'] as never } },
    });
    if (existing) {
      throw new BadRequestException(
        existing.status === 'active' ? 'Hai già un abbonamento attivo.' : 'Hai già una richiesta in corso: carica la contabile o attendi l\'approvazione.',
      );
    }

    const subscription = await this.prisma.subscription.create({
      data: { clientId, planId, status: 'pending' },
    });
    const payment = await this.prisma.payment.create({
      data: {
        clientId,
        subscriptionId: subscription.id,
        amountCents: plan.priceCents,
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
      metadata: { planId, amountCents: plan.priceCents, method },
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

  async myPayments(clientId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p: Record<string, unknown>) => this.publicPayment(p));
  }

  async mySubscription(clientId: string) {
    return this.prisma.subscription.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }

  // ---------- Operatore (admin/commerciale) ----------

  async listPayments(status?: string) {
    const payments = await this.prisma.payment.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'asc' },
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
    if (payment.status !== 'receipt_uploaded') {
      throw new BadRequestException('Si approvano solo pagamenti con contabile caricata');
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
    },
    byUserId: string,
    methodLabel: string,
  ) {
    // Attivazione abbonamento (durata dal periodo del piano: es. "3m").
    if (payment.subscriptionId && payment.subscription) {
      const months = parseInt(payment.subscription.plan.period, 10) || 3;
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);
      await this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'active', startDate: start, endDate: end },
      });
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
    await this.finance.generateCommissions({
      id: payment.id,
      clientId: payment.clientId,
      amountCents: payment.amountCents,
    });
    await this.crm.autoAdvance(payment.clientId, 'paid', byUserId, payment.amountCents);

    await this.mail.sendPaymentReceipt(
      payment.client.email,
      {
        description: payment.description,
        amountCents: payment.amountCents,
        paymentId: payment.id,
        date: new Date(),
      },
      payment.client.locale,
    );
    await this.notifications.notifyOncePerDay({
      userId: payment.clientId,
      type: 'payment_approved',
      messageKey: payment.subscriptionId ? 'payment_approved_subscription' : 'payment_approved_order',
      payload: { method: methodLabel },
    });
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
    if (payment.status !== 'receipt_uploaded') {
      throw new BadRequestException('Si rifiutano solo pagamenti con contabile caricata');
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

  /** Mai esporre i byte della contabile nelle liste. */
  private publicPayment(payment: Record<string, unknown>) {
    const { receiptData, ...rest } = payment;
    return { ...rest, hasReceipt: Boolean(receiptData) };
  }
}
