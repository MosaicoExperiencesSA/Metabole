import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Involucro sottile attorno a Stripe: checkout con carta e verifica webhook.
 * Le chiavi vivono SOLO nelle variabili d'ambiente di Render.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY'));
  }

  private getClient(): Stripe {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) {
      throw new BadRequestException(
        'Pagamento con carta non ancora disponibile: usa il bonifico. (STRIPE_SECRET_KEY non configurata)',
      );
    }
    if (!this.client) this.client = new Stripe(key);
    return this.client;
  }

  /**
   * Crea la sessione di Checkout: il paymentId viaggia nei metadata e torna col webhook.
   *
   * Due modalità, e la differenza non è cosmetica:
   * - **una tantum** (`ricorrente` assente): si paga una volta. È il comportamento di sempre, e
   *   resta identico per i percorsi 1/3/6 mesi.
   * - **abbonamento** (`ricorrente: { intervallo: 'month' }`): Stripe addebita da solo ogni mese
   *   e manda `invoice.paid` a ogni rinnovo. Serve al mantenimento e al monitoraggio.
   *
   * ⚠️ In modalità abbonamento i metadata vanno messi **due volte**: su `metadata` (la sessione,
   * che torna col primo `checkout.session.completed`) e su `subscription_data.metadata`, che
   * finisce sull'abbonamento e torna su OGNI fattura successiva. Senza il secondo, dal secondo
   * mese in poi i rinnovi arriverebbero senza sapere di chi sono.
   */
  async createCheckoutSession(input: {
    paymentId: string;
    description: string;
    amountCents: number;
    customerEmail: string;
    ricorrente?: { intervallo: 'month'; subscriptionId: string; clientId: string };
  }): Promise<{ sessionId: string; url: string }> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://app.metabole.eu';
    const abbonamento = input.ricorrente;
    const session = await this.getClient().checkout.sessions.create({
      mode: abbonamento ? 'subscription' : 'payment',
      customer_email: input.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: input.amountCents,
            product_data: { name: input.description },
            ...(abbonamento ? { recurring: { interval: abbonamento.intervallo } } : {}),
          },
        },
      ],
      metadata: { paymentId: input.paymentId },
      ...(abbonamento
        ? {
            subscription_data: {
              metadata: {
                subscriptionId: abbonamento.subscriptionId,
                clientId: abbonamento.clientId,
              },
            },
          }
        : {}),
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment/cancelled`,
    });
    if (!session.url) throw new BadRequestException('Stripe non ha restituito l\'URL di pagamento');
    return { sessionId: session.id, url: session.url };
  }

  /**
   * Disdetta: l'abbonamento resta attivo fino alla fine del periodo GIÀ PAGATO, poi si ferma.
   * Non si cancella subito perché la cliente ha pagato quel mese: toglierle i menu il giorno
   * della disdetta sarebbe trattenere i soldi e togliere il servizio.
   */
  async cancelAtPeriodEnd(stripeSubscriptionId: string): Promise<void> {
    await this.getClient().subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
  }

  /** Ripensamento: si annulla la disdetta finché il periodo pagato non è finito. */
  async resumeSubscription(stripeSubscriptionId: string): Promise<void> {
    await this.getClient().subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false });
  }

  /**
   * Portale clienti di Stripe: la cliente cambia la carta lì, non da una nostra schermata.
   * È la scelta giusta due volte — non tocchiamo mai i dati della carta, e il portale è già
   * tradotto, conforme e mantenuto da loro.
   */
  async portalUrl(stripeCustomerId: string, ritornoA?: string): Promise<string> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://app.metabole.eu';
    const sessione = await this.getClient().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: ritornoA ?? `${appUrl}/profilo`,
    });
    return sessione.url;
  }

  /** L'abbonamento come lo vede Stripe: serve al webhook e alla disdetta. */
  async getSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    return this.getClient().subscriptions.retrieve(stripeSubscriptionId);
  }

  /** Verifica la firma del webhook e restituisce l'evento. */
  verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET non configurata');
    }
    try {
      return this.getClient().webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      this.logger.warn(`Firma webhook Stripe non valida: ${err instanceof Error ? err.message : err}`);
      throw new BadRequestException('Firma webhook non valida');
    }
  }
}
