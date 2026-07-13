import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Notifiche push (Firebase Cloud Messaging).
 * - I token dei dispositivi si salvano/rimuovono dall'app (POST/DELETE /me/push-tokens).
 * - L'invio parte quando si crea una notifica (vedi NotificationsService), rispettando le preferenze.
 * - Le credenziali server stanno SOLO nella env `FIREBASE_SERVICE_ACCOUNT` (JSON, su Render).
 *   Se manca, il push è semplicemente disattivato (no-op): l'in-app e l'email continuano a funzionare.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private messaging: admin.messaging.Messaging | null = null;
  private tried = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private fcm(): admin.messaging.Messaging | null {
    if (this.tried) return this.messaging;
    this.tried = true;
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!raw || raw.length < 20) {
      this.logger.log('FIREBASE_SERVICE_ACCOUNT non impostata: notifiche push disattivate.');
      return null;
    }
    try {
      const cred = JSON.parse(raw) as admin.ServiceAccount;
      const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(cred) });
      this.messaging = app.messaging();
    } catch (e) {
      this.logger.warn(`FIREBASE_SERVICE_ACCOUNT non valida: push disattivate (${e instanceof Error ? e.message : e})`);
      this.messaging = null;
    }
    return this.messaging;
  }

  async saveToken(userId: string, token: string, platform = 'android'): Promise<void> {
    if (!token || token.length < 10) return;
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  /** Invia una push a tutti i dispositivi dell'utente. No-op se il push non è configurato. */
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    const fcm = this.fcm();
    if (!fcm) return;
    const rows = await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    const tokens = rows.map((r) => r.token);
    if (tokens.length === 0) return;
    try {
      const res = await fcm.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data ?? {},
      });
      // Rimuovo i token non più validi (app disinstallata, token scaduto).
      const stale: string[] = [];
      res.responses.forEach((r, i) => {
        const code = (r.error as { code?: string } | undefined)?.code;
        if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')) {
          stale.push(tokens[i]);
        }
      });
      if (stale.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: stale } } });
    } catch (e) {
      this.logger.warn(`Invio push fallito: ${e instanceof Error ? e.message : e}`);
    }
  }
}
