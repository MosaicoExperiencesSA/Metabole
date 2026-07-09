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

  /** Crea la sessione di Checkout: il paymentId viaggia nei metadata e torna col webhook. */
  async createCheckoutSession(input: {
    paymentId: string;
    description: string;
    amountCents: number;
    customerEmail: string;
  }): Promise<{ sessionId: string; url: string }> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://metabole-backend.onrender.com';
    const session = await this.getClient().checkout.sessions.create({
      mode: 'payment',
      customer_email: input.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: input.amountCents,
            product_data: { name: input.description },
          },
        },
      ],
      metadata: { paymentId: input.paymentId },
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment/cancelled`,
    });
    if (!session.url) throw new BadRequestException('Stripe non ha restituito l\'URL di pagamento');
    return { sessionId: session.id, url: session.url };
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
