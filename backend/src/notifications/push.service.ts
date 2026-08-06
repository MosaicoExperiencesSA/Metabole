import { randomUUID } from 'crypto';
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
/**
 * Esito di una push di PROVA, pensato per capire DOVE si rompe la catena
 * backend → Firebase → APNs/FCM → telefono. Ogni gradino ha il suo indizio.
 */
export interface PushTestResult {
  /** `FIREBASE_SERVICE_ACCOUNT` presente e valida su Render. */
  fcmConfigured: boolean;
  /** Dispositivi registrati per quell'utente (token in chiaro MAI restituito). */
  devices: { platform: string; tokenTail: string; ok: boolean; error: string | null }[];
  sent: number;
  failed: number;
  /** Token scaduti rimossi durante la prova (app disinstallata, token ruotato). */
  removedStale: number;
  /** Frase in italiano che dice cosa guardare adesso. */
  diagnosi: string;
}

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

  /**
   * Il telefono non è riuscito a registrarsi alle push: registriamo il MOTIVO.
   *
   * Prima questo errore finiva in un listener vuoto dentro l'app e spariva: dal server
   * si vedeva solo l'assenza del token, senza sapere se fosse un permesso negato, un
   * entitlement mancante nella build iOS o Firebase mal configurato. Lo salviamo come
   * evento analytics (nessuna migrazione) e lo rileggiamo nella push di prova.
   */
  async logRegistrationError(userId: string, message: string, platform = 'unknown'): Promise<void> {
    await this.prisma.analyticsEvent
      .create({
        data: {
          eventId: randomUUID(),
          name: 'push_registration_error',
          userId,
          phase: 'app',
          data: { message: message.slice(0, 500), platform } as never,
        } as never,
      })
      .catch(() => undefined);
  }

  /** Ultimo errore di registrazione riportato dai telefoni di questo utente. */
  private async lastRegistrationError(
    userId: string,
  ): Promise<{ message: string; platform: string; when: Date } | null> {
    const row = (await this.prisma.analyticsEvent.findFirst({
      where: { userId, name: 'push_registration_error' },
      orderBy: { receivedAt: 'desc' },
      select: { data: true, receivedAt: true },
    })) as { data: { message?: string; platform?: string } | null; receivedAt: Date } | null;
    if (!row?.data?.message) return null;
    return { message: row.data.message, platform: row.data.platform ?? 'unknown', when: row.receivedAt };
  }

  /** Invia una push a tutti i dispositivi dell'utente. No-op se il push non è configurato. */
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    const fcm = this.fcm();
    if (!fcm) return;
    const rows = await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    const tokens = rows.map((r: { token: string }) => r.token);
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

  /**
   * Push di PROVA con diagnostica, per il pulsante nel backoffice.
   *
   * Differenze dall'invio normale: non passa da NotificationsService, quindi
   * ignora preferenze e limiti "una volta al giorno" (che nella prova con la chat
   * facevano sembrare rotto quello che funzionava), e soprattutto RIPORTA l'errore
   * invece di ingoiarlo. Non crea nessuna notifica in app: è solo un ping.
   */
  async sendTest(userId: string): Promise<PushTestResult> {
    const fcm = this.fcm();
    const rows = (await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true, platform: true },
    })) as { token: string; platform: string }[];

    const tail = (t: string) => `…${t.slice(-8)}`;

    if (!fcm) {
      return {
        fcmConfigured: false,
        devices: rows.map((r) => ({ platform: r.platform, tokenTail: tail(r.token), ok: false, error: null })),
        sent: 0,
        failed: 0,
        removedStale: 0,
        diagnosi:
          'Firebase non è configurato sul server: la variabile FIREBASE_SERVICE_ACCOUNT su Render manca o non è un JSON valido. Finché è così nessuna push può partire, da nessuna parte.',
      };
    }
    if (rows.length === 0) {
      // Se il telefono ci ha detto PERCHÉ non è riuscito a registrarsi, quello vale
      // molto più del messaggio generico: è la differenza fra "non ha mai provato" e
      // "ha provato e iOS l'ha rifiutato".
      const err = await this.lastRegistrationError(userId);
      if (err) {
        const quando = err.when.toLocaleString('it-IT');
        const entitlement = /aps-environment|no valid .?aps|entitlement/i.test(err.message)
          ? ' Questo messaggio indica la capability Push mancante nella build: si risolve solo con una nuova build store (Xcode → Signing & Capabilities → Push Notifications + Background Modes), non con un OTA.'
          : '';
        return {
          fcmConfigured: true,
          devices: [],
          sent: 0,
          failed: 0,
          removedStale: 0,
          diagnosi: `Nessun dispositivo registrato, ma il telefono (${err.platform}) ha segnalato un errore il ${quando}: «${err.message}».${entitlement}`,
        };
      }
      return {
        fcmConfigured: true,
        devices: [],
        sent: 0,
        failed: 0,
        removedStale: 0,
        diagnosi:
          'Nessun dispositivo registrato e nessun errore segnalato dal telefono. Il token si registra dopo il LOGIN in app (non basta installarla) e solo col permesso notifiche concesso. Se hai fatto login e accettato le notifiche e qui non compare nulla, l\'app non sta nemmeno provando: di solito è il bundle costruito senza google-services.json. La web app non registra nulla, serve l\'app installata.',
      };
    }

    const tokens = rows.map((r) => r.token);
    let sent = 0;
    let failed = 0;
    const devices: PushTestResult['devices'] = [];
    const stale: string[] = [];

    try {
      const res = await fcm.sendEachForMulticast({
        tokens,
        notification: { title: 'Prova di notifica 🔔', body: 'Se leggi questo messaggio le push funzionano.' },
        data: { type: 'push_test' },
      });
      res.responses.forEach((r, i) => {
        const code = (r.error as { code?: string } | undefined)?.code ?? null;
        if (r.success) sent++;
        else failed++;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          stale.push(tokens[i]);
        }
        devices.push({ platform: rows[i].platform, tokenTail: tail(tokens[i]), ok: r.success, error: code });
      });
      if (stale.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: stale } } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        fcmConfigured: true,
        devices: rows.map((r) => ({ platform: r.platform, tokenTail: tail(r.token), ok: false, error: msg })),
        sent: 0,
        failed: rows.length,
        removedStale: 0,
        diagnosi: `Firebase ha rifiutato la chiamata: ${msg}. Di solito significa credenziali del progetto sbagliate (FIREBASE_SERVICE_ACCOUNT di un altro progetto) oppure progetto Firebase non abilitato.`,
      };
    }

    // Interpretazione: la parte interessante è distinguere "Firebase ok ma Apple no"
    // dal resto, perché è lì che casca la chiave APNs.
    let diagnosi: string;
    const iosFalliti = devices.filter((d) => d.platform === 'ios' && !d.ok);
    if (sent > 0 && failed === 0) {
      diagnosi =
        'Inviata correttamente a tutti i dispositivi. Se sul telefono non compare nulla, il problema non è più il server: controlla il permesso notifiche nelle impostazioni del telefono e che l\'app non sia in "riepilogo programmato".';
    } else if (sent > 0) {
      diagnosi = `Inviata a ${sent} dispositivi su ${devices.length}. I falliti sono elencati qui sotto: se l'errore è "registration-token-not-registered" era solo un token vecchio, e l'ho già rimosso.`;
    } else if (iosFalliti.length > 0) {
      diagnosi =
        'Tutti i dispositivi iOS hanno fallito: è il sintomo tipico della chiave APNs mancante o sbagliata su Firebase (Impostazioni progetto → Cloud Messaging → configurazione app iOS). Verifica che la chiave caricata sia quella nuova, con Key ID e Team ID giusti, e che il bundle sia app.metabole.';
    } else {
      diagnosi = 'Nessun invio riuscito. Guarda il codice di errore dei singoli dispositivi qui sotto.';
    }

    return { fcmConfigured: true, devices, sent, failed, removedStale: stale.length, diagnosi };
  }
}
