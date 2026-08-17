import { randomUUID } from 'crypto';
import { eViolazioneUnicita } from '../common/violazione-unicita';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { avvisaCoachDellaCliente } from '../common/avvisa-coach';
import { clienteNelPerimetro, filtroPerimetroSuCliente, perimetroClienti } from '../common/perimetro-clienti';
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
import { coachTeamScope } from '../common/coach-team';
import { emettiEventoFunnel } from './funnel-event';
import { assicuraProvaIniziata } from './prova-attivata';
import { isTrialPlan, messaggioData, validaDataInizio } from './piano-prova';
import { FinanceService } from './finance.service';
import { StripeService } from './stripe.service';
import { prezzoEffettivo } from './prezzo-piano';
import { esitoAnnullamento, raccontaAnnullamento, type AbbonamentoLetto } from './annulla-abbonamento';

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
  // 'maintenance' e 'monitoring' sono etichette, non durate: valgono entrambe **1 mese**.
  // Senza il secondo, il monitoraggio finiva nel fallback muto qui sotto e ogni mese pagato
  // sarebbe valso 3 mesi di servizio.
  if (isMaintenancePlan(period) || isMonitoringPlan(period)) {
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

/**
 * True se `period` è in un formato RICONOSCIUTO (Nd/Nw/Nm/Ny oppure 'maintenance').
 * Se è falso, `subscriptionEnd` userebbe il fallback lungo (3 mesi): pericoloso per un
 * piano GRATUITO mal configurato. Usato come rete di sicurezza in fase di attivazione.
 */
export function isKnownPeriod(period: string): boolean {
  if (isMaintenancePlan(period) || isMonitoringPlan(period)) return true;
  const p = String(period ?? '').trim().toLowerCase();
  const m = p.match(/^(\d+)\s*([dwmy]?)$/);
  return !!m && Number.isFinite(parseInt(m[1], 10)) && parseInt(m[1], 10) > 0;
}

/** Durata prova di default (giorni) quando un piano gratuito non ha un period valido. */
export const FREE_PLAN_FALLBACK_PERIOD = '8d';

/**
 * Il `period` che marca il piano di MANTENIMENTO. Non e' solo una durata: e' l'etichetta su cui
 * si reggono quattro cose diverse — la visibilita' del piano solo a obiettivo raggiunto
 * (`listPlansForClient`), il riquadro "Mantenimento" del report di fine percorso
 * (`plan-report.service.ts`), lo sblocco del monitoraggio (`monitoring.service.ts`) e l'attivita'
 * coach sul peso che risale (`coach-tasks.service.ts`). Cambiarlo su un piano gia' in produzione
 * spegne tutte e quattro insieme, in silenzio.
 */
export const MAINTENANCE_PERIOD = 'maintenance';

/** True se il piano e' il mantenimento (confronto tollerante a spazi e maiuscole). */
export function isMaintenancePlan(period: string | null | undefined): boolean {
  return String(period ?? '').trim().toLowerCase() === MAINTENANCE_PERIOD;
}

/**
 * Il `period` del MONITORAGGIO a pagamento (€19/mese, solo abbonamento): l'ultimo gradino del
 * percorso, dopo il mantenimento, e si puo' tenere anche per sempre.
 *
 * ⚠️ Non e' il monitoraggio GRATUITO — quello che parte quando il piano viene sospeso e vive in
 * `monitoring.service.ts` senza passare da un piano. Stesso nome, due cose diverse.
 */
export const MONITORING_PERIOD = 'monitoring';

/** True se il piano e' il monitoraggio a pagamento. */
export function isMonitoringPlan(period: string | null | undefined): boolean {
  return String(period ?? '').trim().toLowerCase() === MONITORING_PERIOD;
}

/**
 * Sceglie l'abbonamento "principale" di una cliente: quello che la scheda mostra come piano
 * corrente e quello su cui agiscono le correzioni di data.
 *
 * Priorità: attivo > in attesa > qualunque altro stato non terminale (es. in pausa) > scaduto >
 * (in ultimo) il più recente, che a quel punto può essere solo annullato. La lista va passata
 * GIÀ ORDINATA per `createdAt` decrescente, così a parità di stato vince il più recente.
 *
 * Questa funzione esiste perché la stessa scelta era ricopiata in tre punti e uno era diverso:
 * `updatePlanStart` si fermava a "attivo > in attesa > il più recente" e quindi, su una cliente
 * con un checkout ANNULLATO creato dopo la prova, spostava le date sull'abbonamento annullato
 * mentre la scheda continuava a mostrare la prova scaduta con le date vecchie. Da fuori sembrava
 * che il salvataggio non facesse niente. Una sola funzione, un solo comportamento.
 */
export function pickMainSubscription<T extends { status: string }>(subs: T[]): T | null {
  return (
    subs.find((s) => s.status === 'active') ??
    subs.find((s) => s.status === 'pending') ??
    subs.find((s) => s.status !== 'cancelled' && s.status !== 'expired') ??
    subs.find((s) => s.status === 'expired') ??
    subs[0] ??
    null
  );
}

/**
 * L'id dell'abbonamento dentro una fattura Stripe — **da due punti diversi**, e non è pedanteria.
 *
 * Fino all'API 2025 la fattura aveva `invoice.subscription`. Dalla `2026-06-24.dahlia` (quella
 * predefinita nell'SDK 22 che usiamo) quel campo **non esiste più**: l'abbonamento sta in
 * `invoice.parent.subscription_details.subscription`.
 *
 * Il guaio è come si sarebbe manifestato. Il codice leggeva solo il campo vecchio, quindi ogni
 * `invoice.paid` di rinnovo usciva subito con «fattura non legata a un abbonamento»: Stripe
 * incassava i €49 ogni mese, e da noi non nasceva **nessun** pagamento, nessuna provvigione,
 * nessuna ricevuta — e la scadenza dell'abbonamento non si spostava, quindi la cliente pagante
 * si sarebbe vista scadere il percorso. Tutto questo con la webhook che risponde 200: nessun
 * errore, nessun avviso, i soldi che arrivano lo stesso.
 *
 * Si leggono entrambe le forme perché la versione API che Stripe usa per consegnare gli eventi
 * dipende dall'account (e da come è configurato l'endpoint), non dall'SDK: un account ancora su
 * una versione precedente continuerà a mandare la forma vecchia.
 */
export function subscriptionIdDaFattura(inv: unknown): string | null {
  const f = (inv ?? {}) as {
    subscription?: string | { id?: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
  };
  const grezzo = f.parent?.subscription_details?.subscription ?? f.subscription ?? null;
  if (!grezzo) return null;
  return typeof grezzo === 'string' ? grezzo : grezzo.id ?? null;
}

/**
 * I NOSTRI id dentro una fattura Stripe — la seconda strada per ritrovare l'abbonamento.
 *
 * Alla creazione del checkout mettiamo `subscriptionId` e `clientId` in
 * `subscription_data.metadata`: Stripe li appiccica all'abbonamento e li rimanda su **ogni**
 * fattura. È una copia dei nostri identificativi che viaggia insieme al denaro.
 *
 * Serve perché `stripeSubscriptionId` da noi lo scrive **solo** `checkout.session.completed`.
 * Se quel singolo webhook si perde — endpoint irraggiungibile durante un deploy, un 500, una
 * disattivazione temporanea — la colonna resta `null` per sempre, e da quel momento nessuna
 * fattura successiva trova più la riga: la cliente paga ogni mese, la scadenza non si sposta
 * (quindi a un certo punto perde i menu, pur pagando) e la disdetta dall'app risponde
 * «Nessun abbonamento da disdire». Tutto senza un errore da nessuna parte.
 *
 * Con questi metadati la fattura stessa dice a chi appartiene, e l'aggancio si può rifare.
 * Come sopra si leggono due forme: `parent.subscription_details.metadata` (API 2026) e
 * `subscription_details.metadata` (API precedenti).
 */
export function metadatiAbbonamentoDaFattura(inv: unknown): { subscriptionId?: string; clientId?: string } {
  const f = (inv ?? {}) as {
    subscription_details?: { metadata?: Record<string, string> | null } | null;
    parent?: { subscription_details?: { metadata?: Record<string, string> | null } | null } | null;
    lines?: { data?: { metadata?: Record<string, string> | null }[] } | null;
  };
  const m =
    f.parent?.subscription_details?.metadata ??
    f.subscription_details?.metadata ??
    f.lines?.data?.[0]?.metadata ??
    {};
  return {
    subscriptionId: m?.subscriptionId || undefined,
    clientId: m?.clientId || undefined,
  };
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
    // Fail-closed: la chiave di cifratura ricevute è obbligatoria (niente chiave pubblica di
    // ripiego). Su Render è generata automaticamente (generateValue).
    const fileKey = this.config.get<string>('FILE_ENCRYPTION_KEY');
    if (!fileKey) throw new Error('FILE_ENCRYPTION_KEY mancante: configurarla nelle variabili d\'ambiente');
    this.receiptKey = deriveKey(fileKey);
  }

  // ---------- Piani e prodotti ----------

  /**
   * Prezzo EFFETTIVO di vendita di un piano (handoff Prezzi lancio):
   * finché la promo è attiva (listino presente e `promoEndsAt` nel futuro o assente)
   * si vende a `priceCents` col listino barrato; scaduta la promo si torna
   * AUTOMATICAMENTE al listino pieno, senza toccare il DB.
   */
  // La regola sta in `common/prezzo-piano.ts` dal 12/8: era scritta qui e — leggermente diversa —
  // anche in `plan-report.service`. Questo metodo resta come porta d'ingresso, il corpo no.
  private planPricing(plan: { priceCents: number; listPriceCents?: number | null; promoEndsAt?: Date | null }): { effectivePriceCents: number; promoActive: boolean } {
    return prezzoEffettivo(plan);
  }

  async listPlans() {
    const plans = await this.prisma.plan.findMany({ where: { active: true, hidden: false } as never, orderBy: { priceCents: 'asc' } });
    return (plans as { priceCents: number; listPriceCents?: number | null; promoEndsAt?: Date | null }[]).map((p) => ({ ...p, ...this.planPricing(p) }));
  }

  /**
   * Catalogo PUBBLICO (`GET /plans`, senza autenticazione): come `listPlans` ma **senza il
   * mantenimento**.
   *
   * Il mantenimento non e' un piano d'ingresso: si propone a chi ha raggiunto l'obiettivo, e la
   * regola vive in `listPlansForClient`. Solo che quella regola puo' applicarla soltanto un
   * endpoint che sappia CHI sta chiedendo: qui non lo sappiamo, quindi l'unica risposta corretta
   * e' non mostrarlo. Prima questo endpoint restituiva l'elenco intero, quindi il mantenimento
   * era leggibile da chiunque senza nemmeno fare login.
   *
   * Chi in backoffice deve poterlo vendere a mano usa `GET /admin/purchases/plans`, che passa da
   * `listPlans` e li vede tutti.
   */
  async listPublicPlans() {
    const plans = await this.listPlans();
    // Fuori anche il MONITORAGGIO, per la stessa ragione del mantenimento: e' l'ultimo gradino
    // del percorso (percorso → mantenimento → monitoraggio), non un piano d'ingresso. Senza
    // questo filtro comparirebbe sulla landing accanto ai percorsi, a €19, come se si potesse
    // partire da li'.
    // Fuori anche la PROVA (11/8): non si compra più da nessuna parte, si attiva a fine
    // questionario. Lasciarla in vetrina pubblica sarebbe un pulsante che porta a un rifiuto.
    return (plans as unknown as { period?: string; priceCents?: number }[]).filter(
      (p) => !isMaintenancePlan(p.period) && !isMonitoringPlan(p.period) && !isTrialPlan(p),
    );
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

  /**
   * Il cliente ha RAGGIUNTO l'obiettivo? (peso attuale ≤ peso obiettivo). Usato per mostrare il
   * MANTENIMENTO solo a obiettivo raggiunto (stessa regola del report).
   */
  private async hasReachedObjective(clientId: string): Promise<boolean> {
    const [objective, lastMeasure] = await Promise.all([
      this.prisma.objective.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { targetWeightKg: true } }) as Promise<{ targetWeightKg: number | null } | null>,
      this.prisma.measurement.findFirst({ where: { clientId }, orderBy: { date: 'desc' }, select: { weightKg: true } }) as Promise<{ weightKg: number } | null>,
    ]);
    const target = objective?.targetWeightKg ?? null;
    return target != null && lastMeasure != null && lastMeasure.weightKg <= target;
  }

  /**
   * IL MONITORAGGIO SI VEDE SOLO A MANTENIMENTO **SCADUTO E NON RINNOVATO** (decisione Simone, 12/8).
   *
   * Prima la condizione era «ha già fatto (o sta facendo) il mantenimento», contando gli abbonamenti
   * `active` o `expired`. Effetto: il monitoraggio compariva dal **primo giorno** di mantenimento, e
   * una cliente che aveva appena pagato €49 si vedeva offrire l'opzione da €19 — cioè le vendevamo
   * contro noi stessi, dentro il mese che aveva appena comprato.
   *
   * La regola nuova rende il monitoraggio una **scelta di rientro**: si presenta quando il
   * mantenimento è finito e lei non l'ha rinnovato, non mentre lo sta usando.
   *
   * Tre casi al bordo, e li rispetta la coppia di condizioni qui sotto:
   *  - **disdetto ma con la fine nel futuro** → il periodo pagato è suo: `endDate` non è passata,
   *    quindi «concluso» è falso e il monitoraggio non compare ancora;
   *  - **rinnovato** → il rinnovo sposta `endDate` in avanti sulla stessa riga e lo stato resta
   *    `active`: «in corso» diventa vero e blocca;
   *  - **più mantenimenti nella storia** → basta che uno sia concluso e che nessuno sia in corso.
   *
   * Torna anche il MOTIVO, perché «non ancora» e «non ti riguarda» sono due messaggi diversi per la
   * cliente, e dirle quello sbagliato la manda a chiedere alla coach una cosa che non serve.
   */
  private async statoMonitoraggio(
    clientId: string,
    adesso = new Date(),
  ): Promise<{ disponibile: boolean; motivo: 'ok' | 'mai_fatto' | 'ancora_in_corso' }> {
    // Confronto per GIORNO: `endDate` è una data, e un mantenimento che finisce oggi va considerato
    // ancora in corso fino a domani. Usare l'istante farebbe comparire il monitoraggio a mezzanotte
    // e un minuto dell'ultimo giorno pagato.
    const oggi = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), adesso.getUTCDate()));
    const [concluso, inCorso] = await Promise.all([
      // Un mantenimento la cui fine è già PASSATA: "il giorno dopo che è scaduto" è esattamente
      // `endDate < inizio di oggi`.
      this.prisma.subscription.findFirst({
        where: { clientId, plan: { period: MAINTENANCE_PERIOD }, endDate: { lt: oggi } } as never,
        select: { id: true },
      }),
      /**
       * Un mantenimento ANCORA in corso: la fine non è passata (o non c'è).
       *
       * `active` **e** `cancelled`, e la seconda non è una svista: una cliente che disdice il
       * rinnovo sta comunque usando il mese che ha pagato, e per lei il mantenimento è in corso.
       * Contarla come «non ce l'ha» le farebbe comparire il monitoraggio dentro un periodo già
       * pagato — e le diremmo anche la frase sbagliata, quella di chi non ha mai fatto il
       * mantenimento. Fuori `pending`, che è un ordine non pagato e non dà diritto a niente.
       *
       * Il rinnovo lo copre da sé: sposta `endDate` in avanti sulla stessa riga, restando `active`.
       */
      this.prisma.subscription.findFirst({
        where: {
          clientId,
          status: { in: ['active', 'cancelled'] },
          plan: { period: MAINTENANCE_PERIOD },
          OR: [{ endDate: null }, { endDate: { gte: oggi } }],
        } as never,
        select: { id: true },
      }),
    ]);
    if (inCorso) return { disponibile: false, motivo: 'ancora_in_corso' };
    if (!concluso) return { disponibile: false, motivo: 'mai_fatto' };
    return { disponibile: true, motivo: 'ok' };
  }

  /** Piani visibili al CLIENTE: attivi, meno quelli non riacquistabili che ha già preso.
   * Il MANTENIMENTO (period 'maintenance') compare SOLO a obiettivo raggiunto; il MONITORAGGIO
   * (period 'monitoring') solo dal giorno dopo che il mantenimento è scaduto e non è stato
   * rinnovato (vedi `statoMonitoraggio`). */
  async listPlansForClient(clientId: string) {
    const [plans, bought, reached, monitoraggio] = await Promise.all([
      this.listPlans(),
      this.purchasedIds(clientId),
      this.hasReachedObjective(clientId),
      this.statoMonitoraggio(clientId),
    ]);
    return (plans as unknown as { id: string; period?: string; priceCents?: number; repurchasable?: boolean }[])
      .filter((p) => !isMaintenancePlan(p.period) || reached) // mantenimento solo a obiettivo raggiunto
      .filter((p) => !isMonitoringPlan(p.period) || monitoraggio.disponibile) // solo a mantenimento scaduto e non rinnovato
      // LA PROVA NON SI COMPRA PIÙ (11/8): si attiva da sola a fine questionario, e il negozio la
      // cliente lo incontra alla fine degli 8 giorni, quando la scelta ha senso. Il piano resta nel
      // database perché serve il suo id per attivarlo: sparisce solo dalla vetrina.
      .filter((p) => !isTrialPlan(p))
      .filter((p) => p.repurchasable !== false || !bought.plans.has(p.id));
  }

  /**
   * ATTIVAZIONE DI «CONOSCIAMOCI» A FINE QUESTIONARIO — §16.1, decisione di Simone dell'11/8.
   *
   * «C'è una complicazione inutile: a tutti i clienti, una volta che completano il questionario, in
   * automatico attiviamo Conosciamoci senza passare dallo shop e senza generare un acquisto.»
   *
   * Quindi: **niente `Payment`, niente `Order`**. Il pagamento a €0 esisteva per un motivo solo —
   * far girare `finalizeApproval` — e in cambio intasava la tabella Acquisti con righe che non
   * documentano nessun acquisto. La traccia dell'attivazione è l'audit più la Subscription.
   *
   * ## Le tre cose che questa funzione deve fare bene, e perché
   *
   * 1. **La Subscription nasce `active`, non `pending`.** Una `pending` senza `Payment` è una
   *    trappola senza uscita: l'unica strada che la porta a `cancelled` parte dal pagamento, e
   *    finché è lì blocca **ogni acquisto futuro**. Sarebbe una cliente che non può comprare più
   *    niente, per sempre, senza che nessuno capisca perché.
   * 2. **La rete di sicurezza sulla durata.** Se il `period` del piano è scritto male,
   *    `subscriptionEnd` cade sul fallback lungo (3 mesi) e regaliamo tre mesi di accesso. Sul
   *    gratuito il default prudente è 8 giorni, come in `finalizeApproval`.
   * 3. **`planStartDate`**, che è il buco che questa modifica chiude: nel percorso gratuito restava
   *    `null` — la schermata che chiede la data esiste solo dopo Stripe — e il menu restava in
   *    `preparing` finché la cliente non incontrava per caso la card in Home.
   *
   * NON fa `provaAttivata` (funnel, CRM, avviso alla coach): quello scatta al **primo menu**, che
   * con una data scelta da lei può essere fra settimane. Vedi `prova-attivata.ts`.
   */
  async attivaBenvenuto(
    clientId: string,
    dataInizio: unknown,
  ): Promise<{ attivata: boolean; giaAttiva?: boolean; subscriptionId: string; planStartDate: string }> {
    const esito = validaDataInizio(dataInizio);
    if (!esito.ok) throw new BadRequestException(messaggioData(esito.motivo));
    const inizio = esito.data;

    /**
     * IDEMPOTENZA. Il questionario si può rifare, e questa chiamata arriva dall'app: due tocchi sul
     * pulsante non devono produrre due abbonamenti. Due condizioni, non una:
     *  - un abbonamento **attivo qualunque** (ha già un percorso in corso: non le si mette una prova
     *    sopra);
     *  - o una Subscription **sul piano della prova**, in qualunque stato (l'ha già fatta: `active`,
     *    `expired` o anche `pending` di un vecchio giro).
     * In entrambi i casi si aggiorna la data se serve e si esce senza creare niente.
     */
    const piano = await this.pianoDellaProva();
    const [attivoQualunque, provaEsistente] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { clientId, status: 'active' } as never,
        select: { id: true },
      }) as Promise<{ id: string } | null>,
      this.prisma.subscription.findFirst({
        where: { clientId, planId: piano.id } as never,
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }) as Promise<{ id: string } | null>,
    ]);
    const gia = attivoQualunque ?? provaEsistente;
    if (gia) {
      await this.audit
        .log({
          action: 'commerce.benvenuto.gia_attiva',
          actorId: clientId,
          entityType: 'subscription',
          entityId: gia.id,
          metadata: { dataRichiesta: inizio.toISOString() },
        })
        .catch(() => undefined);
      const prof = (await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { planStartDate: true },
      })) as { planStartDate: Date | null } | null;
      return {
        attivata: false,
        giaAttiva: true,
        subscriptionId: gia.id,
        planStartDate: (prof?.planStartDate ?? inizio).toISOString(),
      };
    }

    // Rete di sicurezza sulla durata: identica a `finalizeApproval`, e per la stessa ragione.
    const rawPeriod = piano.period ?? '';
    const period = isKnownPeriod(rawPeriod) ? rawPeriod : FREE_PLAN_FALLBACK_PERIOD;
    if (period !== rawPeriod) {
      await this.audit.log({
        action: 'commerce.free_plan_period_fallback',
        actorId: clientId,
        entityType: 'plan',
        entityId: piano.id,
        metadata: { rawPeriod, appliedPeriod: period, reason: 'attivazione benvenuto senza durata valida' },
      });
    }

    const sub = await this.prisma.subscription.create({
      data: {
        clientId,
        planId: piano.id,
        status: 'active' as never,
        startDate: inizio,
        endDate: subscriptionEnd(inizio, period),
      },
    });

    // La data di inizio: è il campo che oggi manca del tutto nel percorso gratuito. Senza,
    // `deliverIfEligible` non parte nemmeno.
    await this.prisma.clientProfile.updateMany({
      where: { userId: clientId },
      data: { planStartDate: inizio },
    });

    // «Porta un'amica» e monitoraggio: le stesse due chiamate dell'attivazione a pagamento. Non
    // devono mai far fallire l'attivazione.
    await this.referral.onConvert(clientId).catch(() => undefined);
    await this.referral.riscuotiSospese(clientId).catch(() => undefined);
    await this.monitoring
      .onPlanActivated(clientId, {
        id: piano.id,
        name: piano.name,
        priceCents: piano.priceCents,
        period,
      })
      .catch(() => undefined);

    /**
     * L'audit al posto del `Payment`. Era l'ottava conseguenza dell'analisi: togliendo il pagamento
     * sparirebbe `commerce.payment.approve`, cioè l'unica riga che diceva «questa prova è stata
     * attivata, in questo momento». Qui c'è, con dentro la data scelta e la durata applicata.
     */
    await this.audit.log({
      action: 'commerce.benvenuto.attivata',
      actorId: clientId,
      entityType: 'subscription',
      entityId: sub.id,
      metadata: { planId: piano.id, planStartDate: inizio.toISOString(), period },
    });

    return { attivata: true, subscriptionId: sub.id, planStartDate: inizio.toISOString() };
  }

  /**
   * Il piano della prova, quello che «Conosciamoci» attiva.
   *
   * Prima si guarda il parametro `trial_plan_id` (le soglie e le scelte di configurazione stanno in
   * `config_param`, per regola di progetto: mai un id scritto nel codice). Se non è impostato si
   * cade sull'unico piano attivo a €0 — che oggi è la situazione vera.
   *
   * Se i piani a €0 sono più di uno, **si ferma con un errore parlante** invece di indovinarne uno:
   * attivare il piano sbagliato vorrebbe dire una durata sbagliata, quindi una scadenza sbagliata,
   * quindi menu che finiscono quando non devono — e nessuno lo collegherebbe a questa riga.
   */
  private async pianoDellaProva(): Promise<{ id: string; name: string; priceCents: number; period: string | null }> {
    const idConfigurato = (await this.configParams.getString('trial_plan_id', '')).trim();
    if (idConfigurato) {
      const p = (await this.prisma.plan.findUnique({
        where: { id: idConfigurato },
        select: { id: true, name: true, priceCents: true, period: true },
      })) as { id: string; name: string; priceCents: number; period: string | null } | null;
      if (!p) {
        throw new BadRequestException(
          `Il parametro trial_plan_id punta a un piano che non esiste (${idConfigurato}): correggilo nei Parametri.`,
        );
      }
      return p;
    }
    const gratuiti = (await this.prisma.plan.findMany({
      where: { active: true, priceCents: 0 } as never,
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, priceCents: true, period: true },
    })) as { id: string; name: string; priceCents: number; period: string | null }[];
    if (gratuiti.length === 0) {
      throw new BadRequestException(
        'Non trovo il piano della prova (nessun piano attivo a €0). Impostalo nei Parametri con la chiave trial_plan_id.',
      );
    }
    if (gratuiti.length > 1) {
      throw new BadRequestException(
        `Ci sono ${gratuiti.length} piani attivi a €0 (${gratuiti.map((g) => g.name).join(', ')}): indica quale è la prova nei Parametri, con la chiave trial_plan_id.`,
      );
    }
    return gratuiti[0];
  }

  /**
   * Rifiuta l'acquisto del MANTENIMENTO a chi non ha raggiunto l'obiettivo.
   *
   * Nasconderlo dall'elenco non basta: l'elenco e' un suggerimento, l'acquisto e' una POST con un
   * `planId` dentro. Bastava conoscere l'id — e fino a ieri lo dava `GET /plans` pubblico — per
   * comprare il mantenimento saltando del tutto la vetrina. La regola va detta anche qui, dove si
   * decide davvero.
   *
   * NON vale per l'acquisto manuale da backoffice (`createManualPurchase`): li' e' un'operatrice
   * che sa com'e' messa la cliente e puo' avere motivi legittimi per attivarlo lo stesso (peso
   * misurato in studio e non ancora inserito, per esempio). La scelta e' voluta.
   */
  private async assertPlanPurchasable(clientId: string, plan: { period?: string | null; priceCents?: number | null }) {
    /**
     * LA PROVA NON SI COMPRA (11/8). Si attiva da sola a fine questionario (`attivaBenvenuto`), e
     * chi arriva qui con l'id del piano in mano viene fermato: la cliente non deve poter creare una
     * seconda prova, né rifarla dal negozio dopo averla consumata.
     *
     * Come per il mantenimento, questo controllo NON vale per l'acquisto manuale da backoffice
     * (`createManualPurchase`): l'operatrice può avere motivi legittimi per attivarla a mano.
     */
    if (isTrialPlan(plan)) {
      throw new BadRequestException(
        'Il periodo di prova si attiva da solo appena finisci il questionario: non serve acquistarlo. Se non lo vedi partire, scrivi alla tua coach.',
      );
    }
    if (isMonitoringPlan(plan.period)) {
      // Stesso ragionamento del mantenimento: nascondere non basta, l'acquisto è una POST con
      // dentro un `planId`. E la condizione deve essere la STESSA della vetrina, altrimenti la
      // porta resta aperta da una parte.
      const m = await this.statoMonitoraggio(clientId);
      if (m.disponibile) return;
      throw new BadRequestException(
        m.motivo === 'ancora_in_corso'
          ? 'Il Monitoraggio si attiva quando il Mantenimento è finito: finché è in corso continui con quello, senza pagare due volte. Parlane con la tua coach se pensi sia un errore.'
          : 'Il Monitoraggio viene dopo il Mantenimento: serve un peso raggiunto da tenere. Parlane con la tua coach se pensi sia un errore.',
      );
    }
    if (!isMaintenancePlan(plan.period)) return;
    if (await this.hasReachedObjective(clientId)) return;
    throw new BadRequestException(
      'Il Mantenimento si attiva quando hai raggiunto il tuo obiettivo di peso. Parlane con la tua coach se pensi sia un errore.',
    );
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

  async createPlan(actorId: string, dto: { name: string; priceCents: number; period: string; billing?: string; mealsPerDay?: number; features?: string[]; active?: boolean; repurchasable?: boolean; commissionCoachCents?: number; commissionManagerCoachCents?: number; commissionNutritionistCents?: number; commissionHeadNutritionistCents?: number }) {
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
    // Il mantenimento si vende in DUE modi (listino 6/8): abbonamento o mese singolo. La scelta
    // arriva da qui. Sui piani `recurring` è imposta, su quelli `one_time` è ignorata.
    abbonamentoRichiesto = false,
  ) {
    await this.assertMethodEnabled(method === 'card' ? 'card' : 'bank_transfer');
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) throw new NotFoundException('Piano non trovato');

    // Come si vende questo piano: one_time | recurring | both.
    const billing = ((plan as { billing?: string }).billing ?? 'one_time') as 'one_time' | 'recurring' | 'both';
    const ricorrente = billing === 'recurring' || (billing === 'both' && abbonamentoRichiesto);
    // Il ricorrente vive di addebito automatico: un bonifico mensile andrebbe inseguito a mano
    // ogni mese (decisione 7/8). Chi non vuole la carta prende il mese singolo o un percorso.
    if (ricorrente && method !== 'card') {
      throw new BadRequestException(
        billing === 'both'
          ? 'L\'abbonamento si paga con carta. Con il bonifico puoi acquistare il mese singolo.'
          : 'Questo prodotto si paga con carta: è un abbonamento con addebito automatico.',
      );
    }
    await this.assertPlanPurchasable(clientId, plan as { period?: string | null; priceCents?: number });

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
        description: ricorrente ? `${plan.name} — abbonamento mensile` : `Abbonamento ${plan.name}`,
        method: method as never,
        status: 'pending',
        // Primo addebito: le provvigioni si pagano per intero. Sui RINNOVI vale la condizione
        // «solo se è ancora la coach assegnata» (decisione 6/8).
        billingReason: 'first',
      } as never,
    });
    await this.audit.log({
      action: 'commerce.subscribe',
      actorId: clientId,
      entityType: 'payment',
      entityId: payment.id,
      metadata: { planId, amountCents: planPrice, method, ricorrente },
    });

    if (method === 'card') {
      const session = await this.stripe.createCheckoutSession({
        paymentId: payment.id,
        description: payment.description,
        amountCents: payment.amountCents,
        customerEmail: clientEmail,
        ...(ricorrente
          ? { ricorrente: { intervallo: 'month' as const, subscriptionId: subscription.id, clientId } }
          : {}),
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
    input: {
      planId?: string; items?: { productId: string; qty: number }[];
      method: 'card' | 'bank_transfer'; discountCode?: string;
      // Il mantenimento si vende in abbonamento O a mese singolo (listino 6/8): qui arriva la
      // scelta della cliente. Sui piani solo-abbonamento è imposta, sugli altri è ignorata.
      abbonamento?: boolean;
    },
  ) {
    const method: 'card' | 'bank_transfer' = input.method === 'card' ? 'card' : 'bank_transfer';
    let subtotal = 0;

    let plan: { id: string; name: string; priceCents: number; period?: string | null; listPriceCents?: number | null; promoEndsAt?: Date | null; billing?: string | null } | null = null;
    if (input.planId) {
      // `period` serve al controllo sul mantenimento qui sotto: senza, il carrello era la
      // scorciatoia per comprarlo senza aver raggiunto l'obiettivo (e' la strada che usa il
      // pulsante del report).
      plan = await this.prisma.plan.findFirst({ where: { id: input.planId, active: true }, select: { id: true, name: true, priceCents: true, period: true, listPriceCents: true, promoEndsAt: true, billing: true } });
      if (!plan) throw new NotFoundException('Piano non trovato');
      await this.assertPlanPurchasable(clientId, plan);
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

    // --- ABBONAMENTO: tre regole, e nessuna è un capriccio ---
    const billing = (plan?.billing ?? 'one_time') as 'one_time' | 'recurring' | 'both';
    const ricorrente = !!plan && (billing === 'recurring' || (billing === 'both' && !!input.abbonamento));
    if (ricorrente) {
      // 1. Niente prodotti nello stesso ordine: la sessione Stripe di un abbonamento ha UNA
      //    riga ricorrente, e infilarci dentro un integratore una-tantum farebbe pagare
      //    l'integratore ogni mese, per sempre. Meglio due acquisti che un addebito perpetuo.
      if (detailed.length > 0) {
        throw new BadRequestException(
          'L\'abbonamento si acquista da solo: completa prima questo, poi aggiungi i prodotti in un secondo ordine.',
        );
      }
      // 2. Solo carta: il ricorrente vive di addebito automatico (decisione 7/8).
      if (method !== 'card') {
        throw new BadRequestException(
          billing === 'both'
            ? 'L\'abbonamento si paga con carta. Con il bonifico puoi acquistare il mese singolo.'
            : 'Questo prodotto si paga con carta: è un abbonamento con addebito automatico.',
        );
      }
      // 3. Niente sconti sul ricorrente: un codice applicato a un prezzo mensile resterebbe
      //    applicato a ogni rinnovo, per sempre. Se un giorno servirà, sarà uno sconto Stripe
      //    a durata definita, non il nostro.
      if (input.discountCode) {
        throw new BadRequestException('I codici sconto non si applicano agli abbonamenti.');
      }
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

    const parts = [
      plan ? (ricorrente ? `${plan.name} — abbonamento mensile` : `Abbonamento ${plan.name}`) : null,
      detailed.length ? `${detailed.length} prodotti` : null,
    ].filter(Boolean);
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
      const session = await this.stripe.createCheckoutSession({
        paymentId: payment.id,
        description,
        amountCents: totalCents,
        customerEmail: clientEmail,
        ...(ricorrente && subscriptionId
          ? { ricorrente: { intervallo: 'month' as const, subscriptionId, clientId } }
          : {}),
      });
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

  /**
   * Elenco acquisti. `actorUserId` restringe alla **rete di chi guarda**: da quando la pagina è
   * aperta anche alle coach (richiesta di Simone dell'11/8: «visibile alle coach, ma devono vedere
   * solo le clienti nella loro rete») il filtro non è un dettaglio grafico, è la regola di accesso.
   *
   * Il perimetro è lo stesso della tabella Clienti — `perimetroClienti`, un solo posto — perché due
   * definizioni di «le mie clienti» che divergono qui vogliono dire una coach che legge i pagamenti
   * delle clienti di un'altra. Chi non ha perimetro (admin, commerciale) vede tutto, come prima.
   */
  async listPayments(status?: string, actorUserId?: string) {
    const perimetro = await perimetroClienti(this.prisma, actorUserId);
    const payments = await this.prisma.payment.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...filtroPerimetroSuCliente(perimetro),
      } as never,
      // Più recenti in alto; col take:200 l'ordine desc garantisce di tenere gli ultimi.
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { email: true, clientProfile: { select: { name: true } } } } },
      take: 200,
    });
    return payments.map((p: Record<string, unknown>) => this.publicPayment(p));
  }

  /**
   * Blocca un'azione su UN acquisto fuori dalla rete di chi guarda.
   *
   * Filtrare l'elenco non basta: l'id di una riga che non compare in elenco si può sempre chiedere a
   * mano, e le ricevute contengono nome, indirizzo e importo di una cliente. Il messaggio è lo stesso
   * della scheda cliente, perché è lo stesso confine.
   */
  private async assertAcquistoNelPerimetro(paymentId: string, actorUserId?: string): Promise<void> {
    const perimetro = await perimetroClienti(this.prisma, actorUserId);
    if (!perimetro) return;
    const payment = (await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { clientId: true },
    })) as { clientId: string | null } | null;
    if (!payment) throw new NotFoundException('Acquisto non trovato');
    if (!(await clienteNelPerimetro(this.prisma, perimetro, payment.clientId))) {
      throw new ForbiddenException('Questa cliente non è assegnata a te.');
    }
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
    // CLAIM ATOMICO: passa ad "approved" SOLO se è ancora in attesa. Se due operatori
    // cliccano insieme (o si ripete l'azione), una sola updateMany tocca la riga → nessuna
    // doppia attivazione/provvigione. count=0 = già chiuso o non più in attesa.
    const claim = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: { in: ['receipt_uploaded', 'pending'] as never } },
      data: { status: 'approved', approvedById: staff?.id, approvedAt: new Date() },
    });
    if (claim.count === 0) {
      const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
      if (!existing) throw new NotFoundException('Pagamento non trovato');
      if (existing.status === 'approved') return this.publicPayment(existing as never); // idempotente
      throw new BadRequestException('Questo pagamento non è più in attesa di approvazione');
    }
    // Ricarico il pagamento (ora approved) con le relazioni per la catena post-approvazione.
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } }, client: { select: { email: true, locale: true } } },
    });
    if (!payment) throw new NotFoundException('Pagamento non trovato');
    await this.finalizeApproval(payment, operator.sub, 'bonifico');
    return this.publicPayment(payment);
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

    // CLAIM ATOMICO (idempotenza): Stripe RICONSEGNA i webhook. Passa ad "approved" SOLO se
    // ancora in attesa: se count=0 il webhook è già stato processato → nessun doppio
    // accredito/provvigione. Sostituisce il vecchio check "if status===approved" che, tra
    // due webhook concorrenti, poteva passare due volte.
    const claim = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: { in: ['pending', 'receipt_uploaded'] as never } },
      data: { status: 'approved', approvedAt: new Date(), pspRef: session.payment_intent ?? session.id },
    });
    if (claim.count === 0) {
      return { handled: true, idempotent: true }; // già processato (o stato non valido)
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } }, client: { select: { email: true, locale: true } } },
    });
    if (!payment) return { handled: false, reason: 'pagamento sconosciuto' };
    // Abbonamento: da adesso i rinnovi arriveranno da soli. Ci serve l'id di Stripe per
    // ritrovare QUESTA riga a ogni fattura, e per poter disdire.
    // `subscription` può arrivare come id o come oggetto espanso: si accettano entrambi, così
    // un giorno in cui qualcuno aggiunge un `expand` non si perde l'aggancio ai rinnovi.
    const subGrezzo = (event.data.object as { subscription?: string | { id?: string } | null }).subscription ?? null;
    const stripeSubId = typeof subGrezzo === 'string' ? subGrezzo : subGrezzo?.id ?? null;
    if (stripeSubId && payment.subscriptionId) {
      await this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { stripeSubscriptionId: stripeSubId } as never,
      });
    }
    await this.finalizeApproval(payment, 'stripe-webhook', 'carta');
    return { handled: true };
  }

  /**
   * L'abbonamento attivo della cliente, come lo vede lei nel profilo: cosa paga, quando scade,
   * se ha già chiesto la disdetta. Ritorna null se non ha abbonamenti ricorrenti.
   */
  async myRecurring(clientId: string) {
    const sub = (await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' as never, stripeSubscriptionId: { not: null } } as never,
      orderBy: { endDate: 'desc' },
      select: {
        id: true, endDate: true, cancelAtPeriodEnd: true, lastPaymentFailedAt: true,
        plan: { select: { name: true, priceCents: true } },
      },
    })) as {
      id: string; endDate: Date | null; cancelAtPeriodEnd: boolean; lastPaymentFailedAt: Date | null;
      plan: { name: string; priceCents: number } | null;
    } | null;
    if (!sub) return null;
    return {
      id: sub.id,
      nome: sub.plan?.name ?? 'Abbonamento',
      prezzoCents: sub.plan?.priceCents ?? 0,
      rinnovaIl: sub.endDate,
      disdettaChiesta: sub.cancelAtPeriodEnd,
      pagamentoFallito: !!sub.lastPaymentFailedAt,
    };
  }

  /**
   * DISDETTA dall'app, decisa dalla cliente (7/8). Vale a **fine periodo già pagato**: i menu
   * continuano fino alla scadenza, poi si fermano. Non si rimborsa la parte non goduta, perché
   * quel mese è stato erogato.
   *
   * Reversibile: finché il periodo non è finito, `riprendiAbbonamento` annulla la disdetta.
   * Farla self-service è una scelta: chi vuole uscire esce comunque bloccando la carta, e
   * l'attrito lo si racconta agli altri.
   */
  async cancelMyRecurring(clientId: string) {
    const sub = (await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' as never, stripeSubscriptionId: { not: null } } as never,
      orderBy: { endDate: 'desc' },
      select: { id: true, stripeSubscriptionId: true, endDate: true },
    })) as { id: string; stripeSubscriptionId: string | null; endDate: Date | null } | null;
    if (!sub?.stripeSubscriptionId) throw new NotFoundException('Nessun abbonamento da disdire.');

    await this.stripe.cancelAtPeriodEnd(sub.stripeSubscriptionId);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true } as never,
    });
    await this.audit.log({
      action: 'commerce.subscription.cancel_requested',
      actorId: clientId,
      entityType: 'subscription',
      entityId: sub.id,
    });
    return { disdetta: true, attivoFinoAl: sub.endDate };
  }

  /** Ripensamento: annulla la disdetta finché il periodo pagato non è finito. */
  async resumeMyRecurring(clientId: string) {
    const sub = (await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' as never, cancelAtPeriodEnd: true } as never,
      select: { id: true, stripeSubscriptionId: true },
    })) as { id: string; stripeSubscriptionId: string | null } | null;
    if (!sub?.stripeSubscriptionId) throw new NotFoundException('Nessuna disdetta da annullare.');
    await this.stripe.resumeSubscription(sub.stripeSubscriptionId);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: false } as never,
    });
    await this.audit.log({
      action: 'commerce.subscription.cancel_revoked',
      actorId: clientId,
      entityType: 'subscription',
      entityId: sub.id,
    });
    return { disdetta: false };
  }

  /**
   * «Aggiorna la carta»: si apre il portale clienti di Stripe, non una nostra schermata.
   * È la scelta giusta due volte — non tocchiamo mai i dati della carta, e il portale è già
   * tradotto, conforme e mantenuto da loro.
   */
  async cardPortalUrl(clientId: string): Promise<{ url: string }> {
    const sub = (await this.prisma.subscription.findFirst({
      where: { clientId, stripeSubscriptionId: { not: null } } as never,
      orderBy: { createdAt: 'desc' },
      select: { stripeSubscriptionId: true },
    })) as { stripeSubscriptionId: string | null } | null;
    if (!sub?.stripeSubscriptionId) throw new NotFoundException('Nessun abbonamento con carta da aggiornare.');
    const stripeSub = await this.stripe.getSubscription(sub.stripeSubscriptionId);
    const customer = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id;
    if (!customer) throw new BadRequestException('Cliente Stripe non trovato per questo abbonamento.');
    return { url: await this.stripe.portalUrl(customer) };
  }

  /**
   * RINNOVO AUTOMATICO (`invoice.paid`) — è l'evento che fa vivere l'abbonamento nel tempo.
   *
   * Stripe manda una fattura ogni mese. La PRIMA la ignoriamo: è lo stesso incasso già gestito
   * da `checkout.session.completed`, e contarla due volte significherebbe due pagamenti, due
   * provvigioni e due ricevute per un solo addebito. Si riconosce da `billing_reason`
   * (`subscription_create`) — non dall'importo né dalla data, che possono coincidere.
   *
   * Dal secondo mese in poi: si registra un pagamento nuovo, si allunga la scadenza, si pagano
   * le provvigioni (con la condizione sulla coach) e si manda la ricevuta.
   * Idempotente sull'id della fattura: Stripe riconsegna i webhook, e un rinnovo contato due
   * volte è denaro.
   */
  /**
   * Paga le provvigioni SENZA poter far cadere il resto della catena.
   *
   * Il pagamento, quando si arriva qui, è già registrato e già marcato: la sua riga esiste col
   * suo `pspRef`. Se `generateCommissions` solleva, l'eccezione risale fino alla webhook, che
   * risponde 500; Stripe la riconsegna, e la seconda volta il controllo di idempotenza trova il
   * pagamento e esce subito. Risultato: le provvigioni di quel mese **non nascono mai**, e con
   * loro saltano anche ricevuta, notifica alla coach e audit, che stanno più in basso.
   * È il modo silenzioso in cui si perdono i soldi di una persona: nessun errore visibile, un
   * webhook che risponde 200 al secondo tentativo, e un compenso che semplicemente non c'è.
   *
   * Qui l'errore viene fermato e scritto nell'audit come `commerce.commission.failed`. Il resto
   * della catena prosegue, e il recupero c'è già: **Acquisti → ↻ Ricalcola provvigioni** su
   * quel pagamento (o `npm run ricalcola:provvigioni`) rilegge la scala e accredita il mancante.
   */
  private async provvigioniSenzaPerdere(paymentId: string, clientId: string, amountCents: number): Promise<void> {
    try {
      await this.finance.generateCommissions({ id: paymentId, clientId, amountCents });
    } catch (e) {
      await this.audit
        .log({
          action: 'commerce.commission.failed',
          entityType: 'payment',
          entityId: paymentId,
          metadata: {
            clientId,
            amountCents,
            errore: e instanceof Error ? e.message : String(e),
            rimedio: 'Acquisti → Ricalcola provvigioni su questo acquisto (oppure npm run ricalcola:provvigioni)',
          },
        })
        .catch(() => undefined);
    }
  }

  /**
   * Trova l'abbonamento di una fattura, e se l'aggancio si è perso lo RIFÀ.
   *
   * Prima strada: `stripeSubscriptionId`, che è quello normale. Se non trova niente prova con i
   * metadati della fattura (vedi `metadatiAbbonamentoDaFattura`) e, se la riga esiste ed è
   * ancora senza id di Stripe, gliel'ho scrive: da quel momento l'abbonamento è di nuovo
   * raggiungibile e i rinnovi successivi passano dalla prima strada.
   *
   * ⚠️ Riaggancia SOLO righe con `stripeSubscriptionId` nullo. Se la riga puntasse già a un
   * altro abbonamento Stripe, sovrascriverla vorrebbe dire spostare a mano il filo dei
   * pagamenti di qualcun altro: in quel caso non si tocca niente e resta la segnalazione
   * nell'audit, perché è una situazione che va guardata da una persona.
   *
   * Ritorna l'id NOSTRO dell'abbonamento, o null se non c'è modo di risalirci.
   */
  private async riagganciaAbbonamento(stripeSubId: string, inv: unknown): Promise<string | null> {
    const perId = (await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubId } as never,
      select: { id: true },
    })) as { id: string } | null;
    if (perId) return perId.id;

    const meta = metadatiAbbonamentoDaFattura(inv);
    if (!meta.subscriptionId) return null;
    const perMeta = (await this.prisma.subscription.findUnique({
      where: { id: meta.subscriptionId },
      select: { id: true, clientId: true, stripeSubscriptionId: true },
    })) as { id: string; clientId: string; stripeSubscriptionId: string | null } | null;
    if (!perMeta) return null;

    if (perMeta.stripeSubscriptionId && perMeta.stripeSubscriptionId !== stripeSubId) {
      await this.audit.log({
        action: 'commerce.subscription.riaggancio_rifiutato',
        entityType: 'subscription',
        entityId: perMeta.id,
        metadata: { atteso: stripeSubId, presente: perMeta.stripeSubscriptionId, motivo: 'punta già a un altro abbonamento Stripe' },
      }).catch(() => undefined);
      return perMeta.id;
    }

    if (!perMeta.stripeSubscriptionId) {
      await this.prisma.subscription.update({
        where: { id: perMeta.id },
        data: { stripeSubscriptionId: stripeSubId } as never,
      });
      await this.audit.log({
        action: 'commerce.subscription.riagganciato',
        entityType: 'subscription',
        entityId: perMeta.id,
        metadata: {
          stripeSubscriptionId: stripeSubId,
          clientId: perMeta.clientId,
          motivo: 'checkout.session.completed mai arrivato: id recuperato dai metadati della fattura',
        },
      }).catch(() => undefined);
    }
    return perMeta.id;
  }

  async handleInvoicePaid(event: { type: string; data: { object: unknown } }) {
    const inv = event.data.object as {
      id: string;
      billing_reason?: string | null;
      amount_paid?: number | null;
      lines?: { data?: { period?: { end?: number | null } | null }[] } | null;
    };
    const subscriptionId = subscriptionIdDaFattura(inv);
    if (!subscriptionId) return { handled: false, reason: 'fattura non legata a un abbonamento' };
    if (inv.billing_reason === 'subscription_create') {
      return { handled: true, primoAddebito: true }; // già incassato dal checkout
    }

    const subId = await this.riagganciaAbbonamento(subscriptionId, inv);
    const sub = subId
      ? ((await this.prisma.subscription.findUnique({
          where: { id: subId },
          include: { plan: true, client: { select: { email: true, locale: true } } },
        })) as
          | {
              id: string; clientId: string; endDate: Date | null;
              plan: { name: string } | null;
              client: { email: string; locale: string | null } | null;
            }
          | null)
      : null;
    if (!sub) return { handled: false, reason: 'abbonamento sconosciuto' };

    /**
     * IDEMPOTENZA: una fattura di rinnovo = un pagamento, e lo garantisce il DATABASE.
     *
     * Il `findFirst` qui sotto resta come strada veloce — il caso normale è un webhook ripetuto, e
     * intercettarlo con una lettura evita di sporcare i log con un errore atteso — ma **non è la
     * garanzia**: fra il controllo e la scrittura passa un istante, e Stripe i webhook non li manda
     * in fila indiana. Due copie della stessa fattura passavano entrambe questo controllo e
     * scrivevano due pagamenti, quindi **due provvigioni**: un errore che si scopre solo confrontando
     * i compensi con gli incassi.
     *
     * La garanzia è l'indice `payment_psp_ref_renewal_key` (migrazione del 12/8): un solo pagamento
     * per `psp_ref` fra i rinnovi. Chi arriva secondo si prende il rifiuto del vincolo, e quel
     * rifiuto **è** la risposta — «c'era già» — non un errore da segnalare.
     */
    const gia = await this.prisma.payment.findFirst({ where: { pspRef: inv.id }, select: { id: true } });
    if (gia) return { handled: true, idempotent: true };

    const importo = inv.amount_paid ?? 0;
    let payment: { id: string; description: string };
    try {
      payment = (await this.prisma.payment.create({
        data: {
          clientId: sub.clientId,
          subscriptionId: sub.id,
          amountCents: importo,
          description: `${sub.plan?.name ?? 'Abbonamento'} — rinnovo mensile`,
          method: 'card' as never,
          status: 'approved',
          approvedAt: new Date(),
          pspRef: inv.id,
          billingReason: 'renewal',
        } as never,
      })) as { id: string; description: string };
    } catch (e) {
      // Il vincolo ha detto no: un'altra copia di questo webhook ha già fatto tutto il lavoro qui
      // sotto (scadenza, incasso, provvigioni, ricevuta). Rifarlo è precisamente il danno.
      if (eViolazioneUnicita(e)) return { handled: true, idempotent: true };
      throw e;
    }

    // Nuova scadenza: quella del periodo fatturato da Stripe, che è la verità. Se manca (non
    // dovrebbe), si aggiunge un mese alla scadenza attuale.
    const fineStripe = inv.lines?.data?.[0]?.period?.end;
    const nuovaFine = fineStripe
      ? new Date(fineStripe * 1000)
      : (() => { const d = new Date(sub.endDate ?? new Date()); d.setMonth(d.getMonth() + 1); return d; })();
    await this.prisma.subscription.update({
      where: { id: sub.id },
      // Il rinnovo riuscito chiude anche l'eventuale serie di tentativi falliti.
      data: { status: 'active', endDate: nuovaFine, lastPaymentFailedAt: null } as never,
    });

    /**
     * L'EVENTO `plan_renewed` — mancava, e la dashboard marketing vedeva **zero rinnovi**.
     *
     * L'evento esisteva solo sul percorso manuale/bonifico (`approvePayment`), dove per capire se un
     * pagamento è un rinnovo bisogna andare a cercare se prima c'era un abbonamento pagato. Qui la
     * domanda non si pone: siamo dentro `invoice.paid` con `billing_reason` diverso da
     * `subscription_create`, quindi questo pagamento **è** un rinnovo per definizione. Non emetterlo
     * significava che sui piani ricorrenti — cioè la strategia — il funnel raccontava un prodotto in
     * cui nessuno rinnova mai.
     *
     * Sta dopo la creazione del pagamento di proposito: così è protetto dalla stessa idempotenza, e
     * due webhook della stessa fattura non producono due rinnovi nei grafici.
     *
     * L'importo va nel payload e non nella condizione: un rinnovo a zero (uno sconto totale) resta
     * un rinnovo del rapporto, e chi legge i numeri può filtrarlo sapendo che c'è.
     */
    await this.funnelEvent(sub.clientId, 'plan_renewed', {
      subscriptionId: sub.id,
      amountCents: importo,
      origine: 'stripe',
    }).catch(() => undefined);
    await this.finance
      .recordIncome({ amountCents: importo, category: 'subscription', ref: payment.id, clientId: sub.clientId })
      .catch(() => undefined);
    await this.provvigioniSenzaPerdere(payment.id, sub.clientId, importo);
    // RICEVUTA DEL RINNOVO, **con il PDF allegato** come quella del primo pagamento.
    // Prima l'allegato non c'era: dal secondo mese in poi la cliente riceveva un'email che
    // diceva «ecco la tua ricevuta» e non conteneva nessuna ricevuta. Chi paga un abbonamento
    // per sei mesi ha un documento buono e cinque email vuote — e se lo chiede al commercialista
    // deve venirlo a chiedere a noi.
    if (sub.client?.email && importo > 0) {
      const ricevuta = await this.generateReceiptPdf(payment.id).catch(() => null);
      await this.mail
        .sendPaymentReceipt(
          sub.client.email,
          { description: payment.description, amountCents: importo, paymentId: payment.id, date: new Date() },
          sub.client.locale,
          ricevuta ? [{ name: ricevuta.fileName, content: ricevuta.contentBase64 }] : undefined,
        )
        .catch(() => undefined);
    }
    // La coach vedeva l'incasso solo del PRIMO mese: dal secondo in poi il rinnovo passava di
    // qui e non avvisava nessuno, quindi dalla sua parte una cliente che paga da sei mesi
    // sembrava ferma al primo pagamento. Due notifiche distinte, perché sono due cose diverse:
    // il rinnovo (un passo del percorso) e l'incasso (i suoi soldi).
    await this.notifyCoachOfClient(
      sub.clientId,
      'client_renewed',
      'Rinnovo',
      (nome) => `${nome} ha rinnovato il piano.`,
    ).catch(() => undefined);
    await this.notifyCoachOfPayment(sub.clientId, importo).catch(() => undefined);
    await this.audit.log({
      action: 'commerce.subscription.renewed',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { subscriptionId: sub.id, invoiceId: inv.id, amountCents: importo },
    });
    return { handled: true, renewed: true };
  }

  /**
   * CARTA RIFIUTATA (`invoice.payment_failed`).
   *
   * L'abbonamento resta **attivo** durante i tentativi di Stripe (4 in circa due settimane):
   * una carta scaduta non è una disdetta, e togliere i menu a chi ha solo cambiato bancomat è
   * il modo peggiore di farsi dire addio. Si avvisa, e basta:
   * - al PRIMO rifiuto: email alla cliente col link per aggiornare la carta;
   * - dal secondo: attività alla coach, perché a quel punto serve una telefonata, non un'email.
   *
   * Quando i tentativi finiscono davvero è Stripe a chiudere l'abbonamento, e arriva
   * `customer.subscription.deleted`: lì l'abbonamento passa a scaduto.
   */
  async handleInvoiceFailed(event: { type: string; data: { object: unknown } }) {
    const inv = event.data.object as { id: string; attempt_count?: number | null };
    const subscriptionId = subscriptionIdDaFattura(inv);
    if (!subscriptionId) return { handled: false, reason: 'fattura non legata a un abbonamento' };
    // Stesso riaggancio del rinnovo: se la carta viene rifiutata su un abbonamento che non
    // abbiamo mai collegato, avvisare la cliente conta più che collegarlo.
    const subIdFallito = await this.riagganciaAbbonamento(subscriptionId, inv);
    const sub = subIdFallito
      ? ((await this.prisma.subscription.findUnique({
          where: { id: subIdFallito },
          select: { id: true, clientId: true, lastPaymentFailedAt: true, client: { select: { email: true } } },
        })) as { id: string; clientId: string; lastPaymentFailedAt: Date | null; client: { email: string } | null } | null)
      : null;
    if (!sub) return { handled: false, reason: 'abbonamento sconosciuto' };

    const primoRifiuto = !sub.lastPaymentFailedAt;
    if (primoRifiuto) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { lastPaymentFailedAt: new Date() } as never,
      });
    }

    await this.notifications
      .notify({
        userId: sub.clientId,
        type: 'payment_failed',
        title: 'Non siamo riusciti a rinnovare il tuo abbonamento',
        body: primoRifiuto
          ? 'La tua banca ha rifiutato l\'addebito. Aggiorna la carta dal tuo profilo: il percorso continua, ci riproviamo nei prossimi giorni.'
          : 'Ci abbiamo riprovato senza riuscirci. Aggiorna la carta dal tuo profilo, così non si interrompe niente.',
        payload: { subscriptionId: sub.id, tentativo: inv.attempt_count ?? null },
      })
      .catch(() => undefined);

    await this.audit.log({
      action: 'commerce.subscription.payment_failed',
      entityType: 'subscription',
      entityId: sub.id,
      metadata: { invoiceId: inv.id, tentativo: inv.attempt_count ?? null, primoRifiuto },
    });
    return { handled: true, primoRifiuto };
  }

  /**
   * ABBONAMENTO CHIUSO da Stripe (`customer.subscription.deleted`): o la cliente ha disdetto e
   * il periodo pagato è finito, oppure i tentativi di addebito sono esauriti. In entrambi i casi
   * il servizio finisce QUI, non prima: fino a questo momento i menu sono continuati.
   */
  /**
   * ABBONAMENTO MODIFICATO su Stripe — serve per una porta sola: il **portale clienti**.
   *
   * La disdetta si fa dall'app, ma il portale Stripe (quello di «Aggiorna la carta») mostra
   * anche il pulsante «Annulla abbonamento», configurato a fine periodo come il nostro. Se una
   * cliente lo usa lì, Stripe imposta `cancel_at_period_end` e noi non lo sapremmo: il profilo
   * continuerebbe a dire «si rinnova il 5 settembre» per un mese intero, su un abbonamento che
   * non si rinnoverà. Il finale sarebbe comunque corretto — `customer.subscription.deleted`
   * arriva a scadenza — ma per un mese l'app direbbe una cosa falsa alla cliente.
   *
   * Si allinea solo quel flag, e solo quando è cambiato: tutto il resto delle modifiche
   * (cambio prezzo, di piano, di stato) resta fuori di proposito, perché non sappiamo ancora
   * cosa dovrebbero fare e indovinare qui significherebbe scriverlo su dati di pagamento.
   */
  async handleSubscriptionUpdated(event: { type: string; data: { object: unknown } }) {
    const s = event.data.object as { id: string; cancel_at_period_end?: boolean | null };
    const disdetta = !!s.cancel_at_period_end;
    const sub = (await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: s.id } as never,
      select: { id: true, cancelAtPeriodEnd: true },
    })) as { id: string; cancelAtPeriodEnd: boolean } | null;
    if (!sub) return { handled: false, reason: 'abbonamento sconosciuto' };
    if (sub.cancelAtPeriodEnd === disdetta) return { handled: true, invariato: true };

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: disdetta } as never,
    });
    await this.audit.log({
      action: disdetta ? 'commerce.subscription.cancel_requested' : 'commerce.subscription.cancel_undone',
      entityType: 'subscription',
      entityId: sub.id,
      metadata: { stripeSubscriptionId: s.id, origine: 'portale-stripe' },
    });
    return { handled: true, disdettaChiesta: disdetta };
  }

  async handleSubscriptionDeleted(event: { type: string; data: { object: unknown } }) {
    const s = event.data.object as { id: string };
    const sub = (await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: s.id } as never,
      select: { id: true, clientId: true },
    })) as { id: string; clientId: string } | null;
    if (!sub) return { handled: false, reason: 'abbonamento sconosciuto' };
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'expired' as never, endDate: new Date() },
    });
    await this.audit.log({
      action: 'commerce.subscription.ended',
      entityType: 'subscription',
      entityId: sub.id,
      metadata: { stripeSubscriptionId: s.id },
    });
    return { handled: true, ended: true };
  }

  /** Catena post-approvazione condivisa: attivazione, ledger, provvigioni, CRM, ricevuta. */
  /**
   * Evento di funnel del lancio (trial_started, trial_expired, …) su analytics_event.
   * Handoff punto 6: ogni evento porta anche SEGMENTO di provenienza (ex cliente /
   * lead caldo / lead freddo) e CANALE, letti dalla scheda CRM del cliente.
   *
   * Dall'11/8 il corpo vive in `funnel-event.ts`: `trial_started` si è spostato al primo menu
   * erogato, e chi eroga i menu (`MenuService`) non può dipendere da questo servizio. Qui resta il
   * metodo, perché lo chiamano venti punti, ma la logica è una sola — così non può divergere.
   */
  private async funnelEvent(userId: string, name: string, data?: Record<string, unknown>): Promise<void> {
    await emettiEventoFunnel(this.prisma, userId, name, data);
  }

  /** Il piano è la PROVA GRATUITA? (prezzo 0: senza carta per definizione). */
  private isTrialPlanPrice(priceCents: number | null | undefined): boolean {
    return isTrialPlan({ priceCents });
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
      /**
       * Prezzo di LISTINO del piano, quando `amountCents` è stato azzerato perché l'attivazione
       * non è una vendita. Serve a distinguere «attivazione senza incasso di un piano da €130» da
       * «piano davvero gratuito»: senza questa distinzione la rete di sicurezza sulle durate (qui
       * sotto) leggerebbe 0 e, su un piano con `period` scritto male, accorcerebbe l'abbonamento
       * a 8 giorni.
       */
      prezzoListinoCents?: number;
    },
    byUserId: string,
    methodLabel: string,
    /**
     * `skipIncome` — attivazione che **non è una vendita**. Nata dalla segnalazione di Simone
     * dell'8/8: un piano da €130 attivato a mano per Antonio gonfiava i ricavi di €130 mai
     * incassati. Governa tre cose, e ci sono volute due passate per capirlo tutto:
     *  1. **nessuna riga nel `ledgerEntry`** → fuori dal conto economico;
     *  2. **nessun evento del funnel** (`trial_started`, `trial_converted`, `plan_renewed`,
     *     `maintenance_started`): un'attivazione interna non è né una prova né una conversione, e
     *     contarla come tale falsa i tassi di conversione del lancio;
     *  3. **il CRM non si tocca**: con importo 0 la cliente sarebbe retrocessa a «Prova» e la
     *     coach avrebbe ricevuto «ha attivato la settimana di prova», che non è vero. Lo stato lo
     *     mette l'operatrice, che sa perché sta attivando quel piano.
     *
     * Il `payment` resta, a documentare che l'attivazione c'è stata e chi l'ha fatta — ma con
     * **importo 0**, perché i grafici del fatturato sommano i pagamenti approvati e non il ledger
     * (`analytics.service.ts`, `dashboard.service.ts`): tenere l'importo pieno lì gonfiava
     * «Fatturato / mese» e «Fatturato cumulato» anche col conto economico pulito. È il secondo
     * richiamo di Simone sullo stesso punto — il ledger non era tutto.
     */
    options?: { skipCommissions?: boolean; skipIncome?: boolean },
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
      } else {
        /**
         * PIANO IN CODA: parte alla scadenza di quello in corso, e la data scelta dalla cliente
         * viene ignorata — giustamente, due piani non possono sovrapporsi.
         *
         * Quello che mancava è **dirlo**: `profile.planStartDate` restava la data che aveva scelto
         * lei, mentre l'abbonamento partiva un'altra volta. Da lì in poi i due numeri raccontavano
         * storie diverse — i menu seguono il profilo, la scadenza segue l'abbonamento — e in
         * dashboard compariva una data che non era quella vera. Scriverla qui allinea tutto in una
         * riga: banner, gate del menu e scheda dicono la stessa cosa (decisione di Simone del
         * 10/8: «non le chiedo la data, glielo dico»).
         */
        await this.prisma.clientProfile
          .updateMany({ where: { userId: payment.clientId }, data: { planStartDate: start } })
          .catch(() => undefined);
        await this.audit
          .log({
            action: 'commerce.plan.queued',
            actorId: byUserId,
            entityType: 'subscription',
            entityId: payment.subscriptionId,
            metadata: { inizioEffettivo: start.toISOString(), motivo: 'in coda al piano attivo' },
          })
          .catch(() => undefined);
      }
      // Rete di sicurezza (attivazione GRATUITA): se il piano è a €0 ma la sua durata
      // (`period`) non è configurata in un formato valido, NON usare il fallback lungo di
      // subscriptionEnd (3 mesi): sarebbe accesso gratuito per mesi. Default prudente a 8
      // giorni (durata prova). I piani con period valido (es. '8d', 'maintenance') non cambiano.
      const rawPeriod = payment.subscription.plan.period;
      // Il confronto è sul prezzo di LISTINO quando c'è: un'attivazione senza incasso registra 0,
      // ma il piano da €130 non è un piano gratuito e non deve finire nella rete di sicurezza
      // degli 8 giorni.
      const isFreeActivation = (payment.prezzoListinoCents ?? payment.amountCents) === 0;
      const safePeriod = isFreeActivation && !isKnownPeriod(rawPeriod) ? FREE_PLAN_FALLBACK_PERIOD : rawPeriod;
      if (safePeriod !== rawPeriod) {
        await this.audit.log({
          action: 'commerce.free_plan_period_fallback',
          actorId: byUserId,
          entityType: 'subscription',
          entityId: payment.subscriptionId,
          metadata: { rawPeriod, appliedPeriod: safePeriod, reason: 'piano gratuito senza durata valida' },
        });
      }
      const end = subscriptionEnd(start, safePeriod);
      await this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'active', startDate: start, endDate: end },
      });
      // "Porta un'amica": alla prima attivazione dell'invitata premia chi l'ha
      // invitata (idempotente sull'invito; non deve mai far fallire il pagamento).
      await this.referral.onConvert(payment.clientId).catch(() => undefined);
      // ...e nell'altro verso: se QUESTA cliente aveva ricompense in sospeso — un'amica che ha
      // comprato mentre lei era senza piano attivo — adesso che un abbonamento ce l'ha, le
      // riscuote. Senza questa riga quei giorni restavano appesi per sempre, senza che nessuno
      // se ne accorgesse.
      await this.referral.riscuotiSospese(payment.clientId).catch(() => undefined);
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

    // L'incasso in contabilità: si salta solo quando l'attivazione non è una vendita (vedi
    // `skipIncome`). Un omaggio che scrive una riga di ricavo è un numero falso nel conto
    // economico, e nessuno lo va a cercare mesi dopo.
    if (!options?.skipIncome) {
      await this.finance.recordIncome({
        amountCents: payment.amountCents,
        category: payment.subscriptionId ? 'subscription' : 'order',
        ref: payment.id,
        clientId: payment.clientId,
        note: payment.description,
      });
    }
    if (!options?.skipCommissions) {
      await this.provvigioniSenzaPerdere(payment.id, payment.clientId, payment.amountCents);
    }
    // Funnel del lancio: pagamento vero dopo una prova → trial_converted (idempotente: solo se non
    // già emesso).
    //
    // ⚠️ `trial_started` NON si emette più qui (11/8). Si emette al PRIMO MENU erogato, dove la
    // prova comincia davvero: la spiegazione sta in `prova-attivata.ts`, insieme al CRM e all'avviso
    // alla coach, che si sono spostati con lui. Tenerne uno indietro vorrebbe dire tre risposte
    // diverse alla domanda «quando è iniziata la prova?».
    //
    // Le attivazioni interne (`skipIncome`) restano **fuori dal funnel**: non sono una prova né
    // una conversione, e contarle come tali sposta i tassi del lancio senza che nessuno capisca
    // perché. Vedi la nota su `skipIncome`.
    if (payment.subscriptionId && !options?.skipIncome) {
      if (payment.amountCents > 0) {
        /**
         * `assicuraProvaIniziata` e non più la sola lettura dell'evento: spostando `trial_started`
         * al primo menu si è aperto un buco: chi compra PRIMA di aver ricevuto il primo menu non ha
         * l'evento, e la sua conversione non verrebbe contata mai — cioè proprio la cliente che si
         * entusiasma subito, quella che il tasso di conversione dovrebbe premiare. Se la prova c'è
         * stata (una Subscription su un piano a €0) l'evento si scrive a ritroso, marcato
         * `recuperato`, e la conversione può essere registrata.
         */
        const [hadTrial, alreadyConverted] = await Promise.all([
          assicuraProvaIniziata(this.prisma, payment.clientId),
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
    /**
     * CRM: pagamento vero → «Acquisito» (`paid`).
     *
     * ⚠️ Il ramo dell'importo a ZERO non fa più niente qui (11/8). Portava la scheda a «Prova» e
     * avvisava la coach **nel momento dell'attivazione**; con «Conosciamoci» che si attiva a fine
     * questionario e la data di inizio scelta dalla cliente, fra i due momenti possono passare
     * settimane. Una board piena di «Prova» su gente che non ha ancora visto un piatto non è un
     * dato: è rumore che la manager delle coach deve imparare a ignorare. Ora quei due pezzi
     * scattano al primo menu, insieme a `trial_started` (`prova-attivata.ts`).
     *
     * Sulle attivazioni interne (`skipIncome`) il CRM non si è mai toccato, e continua a non
     * toccarsi: lo stato lo mette l'operatrice, che sa perché ha attivato quel piano.
     */
    if (!options?.skipIncome && payment.amountCents > 0) {
      await this.crm.autoAdvance(payment.clientId, 'paid', byUserId, payment.amountCents);
    }

    // Riscatto del buono sconto (se applicato): incrementa gli utilizzi.
    if (payment.discountCodeId) {
      await this.discounts.redeem(payment.discountCodeId, payment.clientId, payment.id, payment.discountCents ?? 0);
    }

    // RICEVUTA: solo se ha pagato qualcosa.
    // La prova gratuita passa di qui con `amountCents: 0`, e fino all'8/8 riceveva una
    // «Ricevuta di pagamento» da € 0,00 con tanto di PDF numerato. Oltre a essere un documento
    // che non documenta niente, è la prima email che una cliente riceve dopo l'iscrizione:
    // parlarle di pagamenti quando non ha pagato è il modo più rapido per farle pensare che
    // qualcosa le verrà addebitato.
    if (payment.amountCents > 0) {
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
    }
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
  /**
   * Attivazione di un piano a mano dallo staff. Due posti la usano, e non sono la stessa cosa —
   * distinzione decisa da Simone l'8/8 dopo aver trovato €130 di ricavi mai incassati:
   *
   *  - **pagina Acquisti** (`origine: 'acquisti'`, default): è una **vendita vera** avvenuta fuori
   *    dal negozio — un bonifico gestito a mano, un pagamento raccolto dall'operatrice. Entra in
   *    contabilità come qualunque incasso.
   *  - **scheda cliente** (`origine: 'scheda_cliente'`): è un'attivazione **interna** — omaggio,
   *    staff, socio, prova. Il piano si attiva davvero, ma **non** scrive ricavi.
   *
   * Il default è `acquisti` di proposito: un chiamante vecchio che non passa `origine` continua a
   * contabilizzare, così l'aggiunta non fa sparire in silenzio degli incassi veri dai libri.
   */
  async createManualPurchase(operator: AuthUser, input: { clientId: string; planId: string; generateCommissions: boolean; discountCode?: string | null; origine?: string | null }) {
    const origine = input.origine === 'scheda_cliente' ? 'scheda_cliente' : 'acquisti';
    const contabilizza = origine === 'acquisti';
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
    // L'IMPORTO REGISTRATO. Se l'attivazione non è una vendita si registra **zero**, non il
    // prezzo del piano: i grafici del fatturato (`analytics.service.ts`) e la dashboard sommano i
    // pagamenti approvati, non il ledger, quindi tenere qui €130 gonfiava «Fatturato / mese» e
    // «Fatturato cumulato» anche col conto economico pulito. Secondo richiamo di Simone sullo
    // stesso punto: «va registrato a costo 0».
    // Il prezzo di listino non si perde: resta nella descrizione e nell'audit.
    const importoRegistrato = contabilizza ? amountCents : 0;
    const descrizione = contabilizza
      ? `Abbonamento ${plan.name}`
      : `Abbonamento ${plan.name} — attivazione interna, senza incasso (listino ${(amountCents / 100).toFixed(2).replace('.', ',')} €)`;
    const payment = await this.prisma.payment.create({
      data: {
        clientId: client.id,
        subscriptionId: subscription.id,
        amountCents: importoRegistrato,
        description: descrizione,
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
        // Il listino, per la rete di sicurezza sulle durate: un piano da €130 registrato a 0 non
        // è un piano gratuito e non deve durare 8 giorni.
        prezzoListinoCents: amountCents,
      },
      operator.sub,
      'manuale',
      {
        // Senza incasso non nascono provvigioni: non c'è niente da cui pagarle, e una provvigione
        // su un'attivazione interna è un costo vero contro un ricavo che non esiste. Chi vuole
        // provvigioni registra la vendita da **Acquisti**.
        skipCommissions: !contabilizza || !input.generateCommissions,
        skipIncome: !contabilizza,
      },
    );
    await this.audit.log({
      action: 'commerce.purchase.manual',
      actorId: operator.sub,
      entityType: 'payment',
      entityId: payment.id,
      // `contabilizzato` nell'audit: se un domani un ricavo non torna, qui c'è scritto se quella
      // attivazione doveva entrare nei conti e chi l'ha decisa.
      // Nell'audit ci sono TUTTI E DUE i numeri: quello registrato (0 per le attivazioni interne)
      // e il listino. Se fra sei mesi un ricavo non torna, qui c'è scritto cosa è stato attivato,
      // a quanto era di listino, se doveva entrare nei conti e chi l'ha deciso.
      metadata: {
        planId: plan.id,
        amountCents: importoRegistrato,
        prezzoListinoCents: amountCents,
        generateCommissions: contabilizza && input.generateCommissions,
        origine,
        contabilizzato: contabilizza,
      },
    });
    return this.publicPayment(payment);
  }

  /** Ricevuta PDF di un pagamento (numero, data, cliente, prodotto, importo). */
  async generateReceiptPdf(paymentId: string, actorUserId?: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
    // La ricevuta contiene nome, indirizzo e importo: chi la scarica deve avere quella cliente
    // nella propria rete. Con `actorUserId` assente (chiamate interne) il controllo non si applica.
    await this.assertAcquistoNelPerimetro(paymentId, actorUserId);
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
  async generateRefundReceiptPdf(paymentId: string, actorUserId?: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
    await this.assertAcquistoNelPerimetro(paymentId, actorUserId);
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
  /**
   * Avvisa la COACH di riferimento di un passo avanti della sua cliente.
   *
   * Richiesta delle coach dell'8/8: prova attivata, questionario completato, rinnovo. Prima
   * l'unica notifica di questo tipo era il pagamento — quindi una cliente poteva attivare la
   * prova, compilare il questionario e rinnovare senza che la coach ne sapesse niente finché
   * non apriva la board di sua iniziativa.
   *
   * Il `clientId` va SEMPRE nel payload: è quello che permette di aprire la scheda dalla
   * notifica con un tocco, invece di cercare il nome nell'elenco.
   */
  /**
   * Avvisa la coach di una sua cliente. Il corpo sta in `common/avvisa-coach.ts` da quando lo usa
   * anche la chiusura automatica dei percorsi (`CrmService`): due copie che cercano la coach in due
   * modi smettono di avvisare in momenti diversi, e l'assenza di una notifica non si nota.
   */
  private async notifyCoachOfClient(
    clientId: string,
    type: string,
    title: string,
    body: (nome: string) => string,
  ): Promise<void> {
    await avvisaCoachDellaCliente(this.prisma, this.notifications, clientId, { type, title, body });
  }

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

  // ─────────────────────────────────────────── annullare un abbonamento dalla scheda (17/8) ─

  /**
   * ANNULLA UN ABBONAMENTO. Richiesta di Simone, 17/8, dal caso Lorena Polidoro: due «Conosciamoci»
   * attivi insieme, e nessun modo di toglierne uno che non fosse scrivere a mano nel database.
   *
   * ⚠️ Un rimedio che non passa dal prodotto non lascia traccia, non chiede conferma e non avvisa
   * nessuno. La volta che va storto — e va storto proprio quando si sta rimediando in fretta a
   * qualcos'altro — non c'è niente da leggere.
   *
   * ⚠️ **Annullare non è stornare.** Qui si tocca il PIANO: da domani niente menu nuovi. I soldi
   * hanno la loro porta (`refundPurchase`), che scrive nel ledger e storna le provvigioni. Chi
   * arriva qui per disfare un incasso sta sbagliando porta, e questa non gliene apre una seconda.
   *
   * ⚠️ **Annullare non cancella la riga**: si scrive `cancelled` e la riga resta. Un pagamento la
   * referenzia, e la storia di una cliente è la cosa che si va a leggere proprio quando qualcosa
   * non torna. Cancellarla davvero è togliere le prove.
   *
   * ⚠️ I giorni di menu già consegnati NON si toccano. Il motore smette di generarne di nuovi
   * perché non trova più un abbonamento attivo — è la strada normale, e non serve cancellare niente.
   */
  async annullaAbbonamento(
    subscriptionId: string,
    actorId: string,
    dto: { motivo?: string | null; conferma?: boolean },
  ): Promise<{ ok: boolean; testo: string; restaSenzaPiano: boolean }> {
    const sub = (await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: { select: { name: true } } },
      // ⚠️ `as unknown as` e non `as` secco: il tipo vero del client Prisma è generato, e un cast
      // diretto verso una forma più stretta è quello che la CI rifiuta mentre lo stub della sandbox
      // lo accetta senza fiatare. Qui si dichiara cosa serve, e si passa dal nulla.
    })) as unknown as { id: string; clientId: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string } | null } | null;
    if (!sub) throw new NotFoundException('Abbonamento non trovato.');

    const tutti = (await this.prisma.subscription.findMany({
      where: { clientId: sub.clientId },
      include: { plan: { select: { name: true } } },
    })) as unknown as { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string } | null }[];

    const leggi = (x: { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string } | null }): AbbonamentoLetto => ({
      id: x.id, status: x.status, startDate: x.startDate, endDate: x.endDate, piano: x.plan?.name ?? 'piano',
    });

    const oggi = new Date();
    const esito = esitoAnnullamento(leggi(sub), tutti.map(leggi), oggi);
    if (esito.tipo === 'nulla_da_fare') throw new BadRequestException(esito.testo);
    if (esito.tipo === 'serve_conferma' && !dto?.conferma) throw new ConflictException(esito.testo);

    const restaSenzaPiano = esito.tipo === 'serve_conferma';
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'cancelled' as never },
    });

    const testo = raccontaAnnullamento(leggi(sub), restaSenzaPiano);
    await this.audit.log({
      action: 'commerce.subscription.cancelled',
      actorId,
      entityType: 'subscription',
      entityId: sub.id,
      metadata: {
        clientId: sub.clientId,
        piano: sub.plan?.name ?? null,
        prima: { status: sub.status, startDate: sub.startDate?.toISOString() ?? null, endDate: sub.endDate?.toISOString() ?? null },
        motivo: (dto?.motivo ?? '').slice(0, 300) || null,
        restaSenzaPiano,
        // ⚠️ Si registra ANCHE che non è uno storno: fra sei mesi, chi legge questa riga cercando
        // perché un incasso è sparito dai libri deve trovare scritto che di qui i soldi non passano.
        soldi: 'nessun movimento: annullamento del piano, non rimborso',
      },
    }).catch(() => undefined);

    return { ok: true, testo, restaSenzaPiano };
  }

}
