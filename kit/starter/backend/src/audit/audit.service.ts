/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — file estratto da Metabole e ripulito.
 * Manuale: kit/manuale/07-amministrazione.md
 * Da fare mentre lo copi: niente
 * ⚠️ I commenti che raccontano decisioni ed errori passati sono TENUTI apposta:
 *    sono il motivo per cui il file è fatto così. Non toglierli mentre adatti.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string; // es. "auth.login", "admin.user.create", "health_data.read"
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Audit log: ogni accesso/azione su dati sensibili e ogni evento di sicurezza viene registrato. La
 * scrittura non deve MAI far fallire l'operazione principale: gli errori vengono loggati e assorbiti.
 *
 * ## ⚠️ L'ATTORE CHE NON ESISTE (19/8)
 *
 * `AuditLog.actorId` è una **chiave esterna su `user`**. Chi chiama, però, non sempre ha un utente
 * per le mani: il webhook di Stripe passa `'stripe-webhook'`, il form pubblico del sito `'public'`,
 * un lavoro notturno passava `'system'`. L'INSERT viola il vincolo, l'eccezione viene assorbita qui —
 * ed è **giusto** che venga assorbita, perché un pagamento non deve fallire per una riga di registro —
 * ma la riga si perde **in silenzio**: di tutti i pagamenti con carta non esisteva un solo audit
 * `commerce.payment.approve`, e nessuno poteva accorgersene guardando l'app.
 *
 * ⚠️ La risposta **non** è un elenco di stringhe da riconoscere («se è `'public'` allora…»): il
 * giorno che qualcuno ne inventa una nuova siamo daccapo, e questa è la seconda volta che succede.
 * Qui si riprova **una volta sola**, senza attore e conservando nel `metadata` chi diceva di essere:
 * la riga esiste, dice chi l'ha fatta e non è legata a un utente che non c'è. Il ripiego lascia anche
 * un `warn`, perché un ripiego che non si vede diventa la norma.
 *
 * ⚠️ **E si riprova SOLO sulla violazione della chiave esterna** (`P2003`), non su un errore
 * qualsiasi. Con un attore vero e il database in difficoltà — Neon che chiude la connessione — un
 * ritentativo cieco riuscirebbe e scriverebbe `actorId: null` su un'azione fatta da una persona
 * vera: una riga **sbagliata che sembra buona**, che su questa tabella è peggio di una riga mancante.
 * E su un guasto vero raddoppierebbe le query proprio mentre il database sta soffrendo.
 */
/**
 * Il database ha detto «questo attore non esiste»? (violazione della chiave esterna).
 *
 * ⚠️ Si guarda il **codice** di Prisma (`P2003`) e non il testo del messaggio, che cambia con la
 * versione e con la lingua del server. Il testo resta come secondo controllo per i casi in cui il
 * codice non arriva (query grezze, driver diversi): due strade per la stessa domanda sono di solito
 * un difetto, qui sono la stessa domanda fatta a due interlocutori che non rispondono uguale.
 */
function attoreInesistente(err: unknown): boolean {
  const codice = (err as { code?: string } | null)?.code;
  if (codice === 'P2003') return true;
  const testo = err instanceof Error ? err.message : String(err ?? '');
  return /foreign key|actor_id_fkey/i.test(testo);
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** La riga come va in tabella. `senzaAttore` è il ripiego: attore fuori, e chi era nel metadata. */
  private riga(e: AuditEntry, senzaAttore = false) {
    return {
      action: e.action,
      actorId: senzaAttore ? null : (e.actorId ?? null),
      entityType: e.entityType,
      entityId: e.entityId,
      metadata: (senzaAttore && e.actorId
        ? { ...(e.metadata ?? {}), attoreNonUtente: e.actorId }
        : e.metadata) as never,
      ipAddress: e.ipAddress,
    };
  }

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: this.riga(entry) });
    } catch (err) {
      // ⚠️ Secondo tentativo senza attore: solo se un attore c'era **e** il database ha detto che
      // quell'attore non esiste. Vedi la nota in testa alla classe.
      if (entry.actorId && attoreInesistente(err)) {
        // ⚠️ In un `try`: qui siamo già dentro un `catch`, e un errore SINCRONO (non una promise
        // rifiutata) uscirebbe dal metodo — cioè `log` rigetterebbe, e la maggior parte dei
        // chiamanti la aspetta senza `.catch`. Sarebbe l'unico modo in cui una riga di registro
        // fa fallire l'operazione principale, che è precisamente quello che questa classe promette
        // di non fare mai.
        try {
          await this.prisma.auditLog.create({ data: this.riga(entry, true) });
          this.logger.warn(
            `Audit ${entry.action}: «${entry.actorId}» non è un utente, riga scritta senza attore ` +
              '(chi era è nel metadata, campo `attoreNonUtente`).',
          );
          return;
        } catch {
          /* il ripiego non è riuscito: si cade nell'errore qui sotto, che è la verità */
        }
      }
      this.logger.error(
        `Scrittura audit log fallita per action=${entry.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Una riga per ogni entità toccata da un'azione di massa, in una sola query.
   *
   * Nasce dall'assegnazione massiva dei lead: scriveva UN audit con l'id del primo lead, e nel log
   * degli altri duecento non compariva niente — la scheda di quel lead diceva che nessuno l'aveva
   * mai assegnato. Un ciclo di `log()` sarebbe stato duecento INSERT; `createMany` è uno.
   */
  async logMany(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      await this.prisma.auditLog.createMany({ data: entries.map((e) => this.riga(e)) });
    } catch (err) {
      /**
       * Stesso ripiego di `log`, e per la stessa ragione: qui una riga persa sono N righe perse.
       *
       * ⚠️ Ma **riga per riga**, non rifacendo la `createMany` senza attori: `createMany` è una
       * INSERT sola, quindi basta **un** attore inesistente per far perdere l'attribuzione a tutte
       * le altre — comprese quelle di una persona vera. Il ripiego costa N query, ma succede solo
       * quando la strada veloce è già fallita, e ognuna tiene o perde il suo attore per conto suo.
       */
      if (entries.some((e) => e.actorId) && attoreInesistente(err)) {
        let senzaAttore = 0;
        for (const e of entries) {
          try {
            await this.prisma.auditLog.create({ data: this.riga(e) });
          } catch {
            try {
              await this.prisma.auditLog.create({ data: this.riga(e, true) });
              senzaAttore++;
            } catch {
              /* questa riga è persa: lo dice l'errore qui sotto */
            }
          }
        }
        this.logger.warn(
          `Audit ${entries[0]?.action}: attore non utente, ${senzaAttore} righe su ${entries.length} ` +
            'scritte senza attore (chi era è nel metadata, campo `attoreNonUtente`).',
        );
        return;
      }
      this.logger.error(
        `Scrittura audit log di massa fallita (${entries.length} righe, action=${entries[0]?.action})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
