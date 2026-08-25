import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { CommerceService } from '../commerce/commerce.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  COSA_RESTA,
  COSA_SI_CANCELLA,
  GIORNI_ATTESA,
  PAROLA_CONFERMA,
  confermaValida,
  dataCancellazione,
  eIlGiornoPrima,
  eScaduta,
  giorniRimanenti,
  mailFatta,
  mailImmediata,
  mailSospesa,
  mailStaff,
  mailUltimoGiorno,
  testoPopup,
} from './cancellazione';

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

/**
 * Le tabelle da svuotare, in ordine: prima le foglie, poi chi le conteneva. L'ordine conta perché
 * lo schema ha relazioni con vincoli, e cancellare un profilo che ha ancora figli fallisce.
 *
 * **Non c'è la contabilità**, e non è una dimenticanza: `payment`, `order`, `subscription`,
 * `ledgerEntry`, `pendingCommission`, `staffCompensation` e `discountRedemption` restano. Le
 * fatture sono un obbligo di legge (dieci anni) e i compensi già maturati sono fatti avvenuti fra
 * noi e lo staff: cancellarli falserebbe il conto economico e i compensi di persone terze, che non
 * hanno chiesto niente.
 *
 * Va tenuto allineato a `COSA_SI_CANCELLA`, che è l'elenco che la cliente legge: se qui si
 * aggiungesse una tabella senza scriverla là, quella pagina diventerebbe incompleta; se là si
 * scrivesse una cosa che qui non c'è, diventerebbe una bugia documentata.
 */
const TABELLE_DA_SVUOTARE: { nome: string; modello: string; campo?: string }[] = [
  { nome: 'acqua', modello: 'waterLog' },
  { nome: 'passi', modello: 'stepLog' },
  { nome: 'check-in', modello: 'dailyCheckin' },
  { nome: 'check-in saltati', modello: 'checkinSkip' },
  { nome: 'misure', modello: 'measurement' },
  { nome: 'pesate del menu', modello: 'menuWeight' },
  { nome: 'valutazioni dei piatti', modello: 'recipeRating' },
  { nome: 'liste della spesa', modello: 'shoppingList' },
  { nome: 'giornate di menu', modello: 'menuDay' },
  { nome: 'base ricette personale', modello: 'clientMenuPool' },
  { nome: 'feedback di ciclo', modello: 'cycleFeedback' },
  { nome: 'cicli', modello: 'clientCycle' },
  { nome: 'traguardi', modello: 'milestone' },
  { nome: 'obiettivi', modello: 'objective' },
  { nome: 'documenti', modello: 'document' },
  { nome: 'note cliniche', modello: 'clinicalNote' },
  { nome: 'note dello staff', modello: 'clientNote' },
  { nome: 'certificati di personalizzazione', modello: 'personalizationCertificate' },
  { nome: 'notifiche', modello: 'notification', campo: 'userId' },
  { nome: 'token push', modello: 'pushToken', campo: 'userId' },
  { nome: 'token di azione', modello: 'actionToken', campo: 'userId' },
  { nome: 'sessioni', modello: 'refreshToken', campo: 'userId' },
  { nome: 'eventi di navigazione', modello: 'analyticsEvent', campo: 'userId' },
  { nome: 'riassunti delle conversazioni', modello: 'conversationSummary' },
  { nome: 'decisioni del motore', modello: 'engineDecision' },
  { nome: 'segnalazioni', modello: 'escalation' },
  { nome: 'avvisi alla coach', modello: 'alert' },
  { nome: 'appuntamenti', modello: 'appointment' },
  { nome: 'visite', modello: 'visit' },
  { nome: 'eventi di calendario', modello: 'event', campo: 'userId' },
  { nome: 'richieste di pausa', modello: 'pauseRequest', campo: 'userId' },
  { nome: 'attività della coach', modello: 'coachTask' },
  { nome: 'report di fine piano', modello: 'clientReport' },
  /**
   * ⛔ **LE DOMANDE APERTE SU VERA** — aggiunte in revisione il 25/8. Erano fuori dall'elenco fin
   * dall'inizio, e la sorveglianza sui percorsi supervisionati ha peggiorato la cosa in volume e in
   * contenuto: ogni promemoria scrive, **per nome**, «X è in percorso supervisionato (ha dichiarato
   * farmaci o condizioni in registrazione)». È un dato sanitario esplicito, e sopravviveva alla
   * cancellazione dell'account.
   */
  { nome: 'domande aperte per il nutrizionista', modello: 'richiestaVera', campo: 'clienteId' },
  { nome: 'promemoria CRM', modello: 'crmReminder' },
  { nome: 'scheda CRM', modello: 'crmRecord' },
  { nome: 'profilo cliente', modello: 'clientProfile', campo: 'userId' },
];

/**
 * REVOCA DEL CONSENSO E CANCELLAZIONE A 30 GIORNI (richiesta di Simone dell'8/8).
 *
 * Il giro completo: la cliente revoca dal profilo, scrive ELIMINA, riceve una mail col pulsante per
 * fermare tutto, coach e manager ricevono una copia per sapere cosa sta succedendo. Il giorno prima
 * della scadenza l'ultimo avviso. Al 31° giorno il cron cancella.
 *
 * ## Perché la cancellazione ANONIMIZZA l'utenza invece di eliminare la riga
 *
 * Perché le fatture restano — obbligo di legge — e una fattura appesa a un `clientId` che non esiste
 * più è una fattura che in contabilità nessuno sa più leggere. Cancellare la riga `user` sarebbe
 * anche tecnicamente impossibile: `payment`, `order` e `subscription` hanno vincoli verso di lei, e
 * il database rifiuterebbe.
 *
 * Quindi: **tutto il resto viene distrutto** — profilo, misure, menu, conversazioni, documenti,
 * note cliniche — e dell'utenza resta un guscio senza nome, senza email vera, senza indirizzo e
 * senza password, con `deletedAt` valorizzato. Non è un compromesso al ribasso: è la forma in cui
 * l'obbligo fiscale e il diritto alla cancellazione stanno insieme senza che uno dei due sia finto.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly commerce: CommerceService,
    private readonly config: ConfigService,
  ) {}

  // ---------- Lettura ----------

  /** La card «Consenso» nel profilo dell'app: quando è stato dato, e se c'è una richiesta in corso. */
  async statoConsenso(clientId: string) {
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { consents: true },
    })) as { consents: unknown } | null;
    const consensi = (profilo?.consents ?? {}) as {
      healthDataConsent?: { accepted?: boolean; at?: string; revokedAt?: string };
    };
    const richiesta = await this.richiestaAperta(clientId);
    return {
      accettato: consensi.healthDataConsent?.accepted === true,
      /** Quando l'ha dato: lo scrive l'onboarding. */
      il: consensi.healthDataConsent?.at ?? null,
      revocatoIl: consensi.healthDataConsent?.revokedAt ?? null,
      giorniAttesa: GIORNI_ATTESA,
      parolaConferma: PAROLA_CONFERMA,
      testi: testoPopup(),
      cancellazione: richiesta
        ? {
            richiestaIl: richiesta.requestedAt.toISOString(),
            previstaIl: richiesta.scheduledFor.toISOString(),
            giorniRimanenti: giorniRimanenti(richiesta.scheduledFor, new Date()),
          }
        : null,
    };
  }

  /** La pagina di trasparenza: cosa cancelliamo, cosa siamo obbligati a tenere e perché. */
  cosaCancelliamo() {
    return { giorniAttesa: GIORNI_ATTESA, siCancella: COSA_SI_CANCELLA, resta: COSA_RESTA };
  }

  private async richiestaAperta(clientId: string) {
    return (await this.prisma.deletionRequest.findFirst({
      where: { clientId, status: 'pending' },
      orderBy: { requestedAt: 'desc' },
    })) as {
      id: string;
      clientId: string;
      requestedAt: Date;
      scheduledFor: Date;
      status: string;
      warnedAt: Date | null;
    } | null;
  }

  // ---------- Revoca ----------

  /**
   * La cliente revoca il consenso. Da qui parte il termine.
   *
   * Idempotente: premere due volte non fa partire due termini né sposta la data. Chi ha già una
   * richiesta aperta si ritrova la stessa, con la stessa scadenza — e non riceve una seconda mail,
   * perché due mail identiche a distanza di un minuto fanno sembrare rotto un processo delicato.
   */
  async revoca(clientId: string, conferma: string) {
    if (!confermaValida(conferma)) {
      throw new BadRequestException(`Per confermare devi scrivere ${PAROLA_CONFERMA}.`);
    }
    const giaAperta = await this.richiestaAperta(clientId);
    if (giaAperta) {
      return {
        previstaIl: giaAperta.scheduledFor.toISOString(),
        giorniRimanenti: giorniRimanenti(giaAperta.scheduledFor, new Date()),
        giaInCorso: true,
      };
    }

    const adesso = new Date();
    const scadenza = dataCancellazione(adesso);
    const token = randomBytes(32).toString('hex');
    const richiesta = (await this.prisma.deletionRequest.create({
      data: { clientId, requestedAt: adesso, scheduledFor: scadenza, tokenHash: sha256(token), status: 'pending' },
    })) as { id: string };

    // Il consenso si segna revocato SUBITO, non al 31° giorno: dal momento in cui l'ha detto, il
    // trattamento non è più autorizzato. È anche il flag che i controlli del motore già leggono.
    await this.segnaConsenso(clientId, false, adesso);

    // Decisione del 10/8: la revoca disdice il rinnovo automatico. Il piano già pagato resta valido
    // fino alla scadenza — si ferma il rinnovo, non il servizio. Se non c'è un abbonamento
    // ricorrente non c'è niente da disdire, e non è un errore.
    let rinnovoDisdetto = false;
    try {
      await this.commerce.cancelMyRecurring(clientId);
      rinnovoDisdetto = true;
    } catch (e) {
      if (!(e instanceof NotFoundException)) {
        this.logger.error(
          `Disdetta del rinnovo non riuscita per ${clientId}: la revoca resta valida`,
          e instanceof Error ? e.stack : String(e),
        );
      }
    }

    await this.audit.log({
      action: 'privacy.consenso.revocato',
      actorId: clientId,
      entityType: 'deletion_request',
      entityId: richiesta.id,
      metadata: { previstaIl: scadenza.toISOString(), rinnovoDisdetto },
    });

    await this.avvisa(clientId, scadenza, token, false).catch((e) =>
      // Una mail che non parte non deve annullare una revoca: il diritto è esercitato, e l'avviso
      // del giorno prima ripasserà. Ma va scritto, perché è l'unico modo che ha di fermarla.
      this.logger.error('Mail di revoca non inviata', e instanceof Error ? e.stack : String(e)),
    );

    return {
      previstaIl: scadenza.toISOString(),
      giorniRimanenti: giorniRimanenti(scadenza, adesso),
      rinnovoDisdetto,
      giaInCorso: false,
    };
  }

  /**
   * «Sospendi l'eliminazione», dal link nella mail.
   *
   * Rotta pubblica: il token **è** l'autorizzazione, e questo è il modo in cui la decisione del 10/8
   * («solo la cliente») diventa vera anche tecnicamente — nessuna sessione dello staff può arrivarci.
   * Chi non ha il link non ferma niente.
   *
   * Fermare la cancellazione **rimette il consenso**: è la sola lettura sensata di «ho cambiato
   * idea». Lasciarlo revocato le darebbe un account fermo, senza menu e senza spiegazione.
   */
  async sospendi(token: string) {
    const richiesta = (await this.prisma.deletionRequest.findUnique({
      where: { tokenHash: sha256((token ?? '').trim()) },
    })) as { id: string; clientId: string; status: string; scheduledFor: Date } | null;
    if (!richiesta) throw new NotFoundException('Link non valido.');
    if (richiesta.status === 'done') {
      // Non si può tornare indietro, e dirlo con chiarezza è meglio di un errore generico.
      throw new BadRequestException('La cancellazione è già stata eseguita: non c\'è più niente da fermare.');
    }
    if (richiesta.status !== 'pending') {
      return { fermata: true, giaFermata: true };
    }

    await this.prisma.deletionRequest.update({
      where: { id: richiesta.id },
      data: { status: 'suspended', suspendedAt: new Date(), suspendedBy: richiesta.clientId },
    });
    await this.segnaConsenso(richiesta.clientId, true, new Date());
    await this.audit.log({
      action: 'privacy.cancellazione.sospesa',
      actorId: richiesta.clientId,
      entityType: 'deletion_request',
      entityId: richiesta.id,
      metadata: { da: 'link email' },
    });

    const utente = await this.utente(richiesta.clientId);
    if (utente?.email) {
      const m = mailSospesa(utente.firstName ?? null);
      await this.mail
        .send({ to: utente.email, subject: m.oggetto, html: m.html, templateKey: 'privacy_sospesa' })
        .catch(() => undefined);
    }
    return { fermata: true, giaFermata: false };
  }

  // ---------- Il cron ----------

  /**
   * Un passo del cron notturno: manda l'ultimo avviso a chi scade domani ed esegue le cancellazioni
   * scadute.
   *
   * Gli avvisi vengono prima delle cancellazioni di proposito: se il cron è saltato per un giorno,
   * chi doveva ricevere l'avviso ieri lo riceve oggi — e non si trova cancellata senza averlo mai
   * ricevuto. Meglio un avviso in ritardo che una cancellazione senza preavviso.
   */
  async passoGiornaliero() {
    const adesso = new Date();
    const aperte = (await this.prisma.deletionRequest.findMany({
      where: { status: 'pending' },
      orderBy: { scheduledFor: 'asc' },
      take: 500,
    })) as { id: string; clientId: string; scheduledFor: Date; warnedAt: Date | null }[];

    let avvisate = 0;
    let cancellate = 0;
    const errori: string[] = [];

    for (const r of aperte) {
      try {
        if (!r.warnedAt && (eIlGiornoPrima(r.scheduledFor, adesso) || eScaduta(r.scheduledFor, adesso))) {
          await this.avvisaUltimoGiorno(r.id, r.clientId, r.scheduledFor);
          avvisate += 1;
        }
      } catch (e) {
        errori.push(`avviso ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const r of aperte) {
      if (!eScaduta(r.scheduledFor, adesso)) continue;
      try {
        await this.cancella(r.clientId, r.id);
        cancellate += 1;
      } catch (e) {
        // Una cancellazione che fallisce resta `pending`: ripassa domani. Non si segna `done`
        // per far tacere il cron — sarebbe un adempimento dichiarato e non fatto.
        errori.push(`cancellazione ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
        this.logger.error(`Cancellazione non riuscita per ${r.clientId}`, e instanceof Error ? e.stack : String(e));
      }
    }
    return { aperte: aperte.length, avvisate, cancellate, errori };
  }

  /**
   * LA CANCELLAZIONE. Svuota le tabelle dei dati sanitari e del percorso, poi anonimizza l'utenza.
   *
   * Non è in una transazione unica di proposito: sono decine di `deleteMany` su una persona sola, e
   * una transazione così lunga terrebbe lock su mezzo database. Se si interrompe a metà, il resto
   * viene ripreso domani — l'operazione è **ripetibile**, perché cancellare ciò che non c'è più
   * costa zero e non fa danni.
   */
  async cancella(clientId: string, richiestaId?: string) {
    const utente = await this.utente(clientId);
    const report: Record<string, number> = {};

    for (const t of TABELLE_DA_SVUOTARE) {
      const modello = (this.prisma as unknown as Record<string, { deleteMany?: (a: unknown) => Promise<{ count: number }> }>)[t.modello];
      if (!modello?.deleteMany) continue;
      const where = { [t.campo ?? 'clientId']: clientId };
      try {
        const r = await modello.deleteMany({ where } as never);
        if (r.count) report[t.nome] = r.count;
      } catch (e) {
        // Una tabella che non c'è (o un campo diverso) non deve fermare tutto il resto: si annota e
        // si va avanti. Il conto finale dice cosa è stato cancellato davvero.
        this.logger.warn(`Cancellazione di «${t.nome}» non riuscita: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Le conversazioni: i messaggi stanno appesi ai thread, quindi prima i figli.
    try {
      const thread = (await this.prisma.chatThread.findMany({ where: { clientId }, select: { id: true } })) as { id: string }[];
      if (thread.length) {
        const m = await this.prisma.message.deleteMany({ where: { threadId: { in: thread.map((t) => t.id) } } });
        if (m.count) report['messaggi'] = m.count;
        const t = await this.prisma.chatThread.deleteMany({ where: { clientId } });
        if (t.count) report['conversazioni'] = t.count;
      }
    } catch (e) {
      this.logger.warn(`Cancellazione delle conversazioni non riuscita: ${e instanceof Error ? e.message : String(e)}`);
    }

    // L'utenza: un guscio senza nome, senza email vera, senza indirizzo e senza password. Le
    // fatture continuano a puntare qui, ed è il motivo per cui la riga non si elimina.
    await this.prisma.user.update({
      where: { id: clientId },
      data: {
        email: `cancellato+${clientId}@metabole.invalid`,
        secondaryEmail: null,
        // Password irrecuperabile: non è un hash di niente, è rumore. Nessuno può più entrare, e
        // nemmeno noi possiamo «riattivare» l'account per sbaglio.
        passwordHash: randomBytes(32).toString('hex'),
        firstName: 'Utente',
        lastName: 'cancellato',
        phone: null,
        addressLine: null,
        postalCode: null,
        city: null,
        province: null,
        country: null,
        birthDate: null,
        codiceFiscale: null,
        photoUrl: null,
        prefs: {} as never,
        status: 'disabled' as never,
        deletedAt: new Date(),
      } as never,
    });

    if (richiestaId) {
      await this.prisma.deletionRequest.update({
        where: { id: richiestaId },
        data: { status: 'done', completedAt: new Date(), report: report as never },
      });
    }
    await this.audit.log({
      action: 'privacy.dati.cancellati',
      actorId: clientId,
      entityType: 'user',
      entityId: clientId,
      metadata: { report, richiestaId: richiestaId ?? null },
    });

    // L'ultima mail, all'indirizzo che fra un attimo non è più nostro: si manda DOPO la
    // cancellazione, perché prima sarebbe una promessa e non un fatto.
    if (utente?.email) {
      const m = mailFatta(utente.firstName ?? null);
      await this.mail
        .send({ to: utente.email, subject: m.oggetto, html: m.html, templateKey: 'privacy_fatta' })
        .catch(() => undefined);
    }
    return { report };
  }

  // ---------- Interni ----------

  private async utente(clientId: string) {
    return (await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { email: true, firstName: true, lastName: true, locale: true },
    })) as { email: string; firstName: string | null; lastName: string | null; locale: string | null } | null;
  }

  /** Scrive (o riscrive) il consenso nel profilo, tenendo il resto del JSON com'è. */
  private async segnaConsenso(clientId: string, accettato: boolean, quando: Date) {
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { consents: true },
    })) as { consents: unknown } | null;
    const consensi = { ...((profilo?.consents ?? {}) as Record<string, unknown>) };
    const precedente = (consensi.healthDataConsent ?? {}) as Record<string, unknown>;
    consensi.healthDataConsent = accettato
      ? { ...precedente, accepted: true, at: precedente.at ?? quando.toISOString(), revokedAt: null }
      : { ...precedente, accepted: false, revokedAt: quando.toISOString() };
    await this.prisma.clientProfile.updateMany({ where: { userId: clientId }, data: { consents: consensi as never } });
  }

  private baseUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'https://app.metabole.eu';
  }

  /** Le due mail della revoca: alla cliente col pulsante, allo staff senza. */
  private async avvisa(clientId: string, scadenza: Date, token: string, ultimoAvviso: boolean) {
    const utente = await this.utente(clientId);
    if (!utente) return;
    const linkSospendi = `${this.baseUrl()}/privacy/sospendi?token=${token}`;
    const linkPrivacy = `${this.baseUrl()}/privacy/cancellazione`;
    const nome = utente.firstName ?? null;

    const perLei = ultimoAvviso
      ? mailUltimoGiorno(nome, scadenza, linkSospendi, linkPrivacy)
      : mailImmediata(nome, scadenza, linkSospendi, linkPrivacy);
    await this.mail.send({
      to: utente.email,
      subject: perLei.oggetto,
      html: perLei.html,
      templateKey: ultimoAvviso ? 'privacy_ultimo_avviso' : 'privacy_revoca',
    });

    // Allo staff, senza il pulsante. `copiaCoach` non basta: qui va anche la manager delle coach,
    // e il testo è diverso — quello per la cliente le chiede se ha cambiato idea, questo spiega alla
    // coach perché il pulsante non ce l'ha lei.
    const perStaff = mailStaff(
      [utente.firstName, utente.lastName].filter(Boolean).join(' ') || utente.email,
      utente.email,
      scadenza,
      ultimoAvviso,
    );
    for (const indirizzo of await this.indirizziStaff(clientId)) {
      await this.mail
        .send({ to: indirizzo, subject: perStaff.oggetto, html: perStaff.html, templateKey: 'privacy_staff' })
        .catch(() => undefined);
    }
  }

  private async avvisaUltimoGiorno(richiestaId: string, clientId: string, scadenza: Date) {
    // Il token in chiaro non l'abbiamo più (in tabella c'è solo l'hash), quindi se ne genera uno
    // nuovo e si sostituisce: il vecchio link smette di funzionare. È una conseguenza voluta —
    // l'ultima mail è quella che conta, e un solo link valido evita che due mail dicano cose
    // diverse sullo stesso termine.
    const token = randomBytes(32).toString('hex');
    await this.prisma.deletionRequest.update({
      where: { id: richiestaId },
      data: { tokenHash: sha256(token), warnedAt: new Date() },
    });
    await this.avvisa(clientId, scadenza, token, true);
    await this.audit.log({
      action: 'privacy.cancellazione.ultimo_avviso',
      actorId: clientId,
      entityType: 'deletion_request',
      entityId: richiestaId,
      metadata: { previstaIl: scadenza.toISOString() },
    });
  }

  /** Coach della cliente e manager delle coach: chi deve sapere che una persona se ne va. */
  private async indirizziStaff(clientId: string): Promise<string[]> {
    try {
      const profilo = (await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { assignedCoach: { select: { user: { select: { email: true } } } } },
      })) as { assignedCoach: { user: { email: string } | null } | null } | null;
      const manager = (await this.prisma.user.findMany({
        where: { role: { in: ['coach_coordinator', 'admin'] } as never, deletedAt: null },
        select: { email: true },
        take: 5,
      })) as { email: string }[];
      const tutti = [profilo?.assignedCoach?.user?.email, ...manager.map((m) => m.email)].filter(
        (e): e is string => typeof e === 'string' && e.includes('@'),
      );
      return [...new Set(tutti)];
    } catch {
      // Senza gli indirizzi dello staff la revoca resta valida: la mail che conta è quella a lei.
      return [];
    }
  }
}
