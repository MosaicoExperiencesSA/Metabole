import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CATEGORIE_COMPENSO, euroCents, inizioMese, mesePeriodo, quotaSottoTetto, tettoAttivoCents } from '../common/tetto-compensi';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

// Client di transazione: tipo canonico di Prisma (evita implicit any in sandbox).
type PrismaTx = Prisma.TransactionClient;

/**
 * Eventi economici automatici (spec sez. 8): niente doppio inserimento.
 * - pagamento approvato → LedgerEntry income + provvigioni (coach/nutrizionista)
 * - visita completata → compenso nutrizionista + LedgerEntry expense
 */
@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  // Il mese di Roma, non quello del server: vedi `mesePeriodo` in `common/tetto-compensi.ts`.
  private period(date = new Date()): string {
    return mesePeriodo(date);
  }

  async recordIncome(input: {
    amountCents: number;
    category: string;
    ref: string;
    clientId?: string;
    note?: string;
  }) {
    return this.prisma.ledgerEntry.create({
      data: { type: 'income', ...input },
    });
  }

  /**
   * Provvigione/compenso: aggrega su staff_compensation e scrive l'uscita nel ledger.
   *
   * ⚠️ È l'IMBUTO UNICO di ogni accredito — catena a percentuali, importi fissi legacy, ricalcolo,
   * accantonati risolti all'assegnazione passano tutti di qui. È il motivo per cui il **tetto di
   * guadagno mensile** (§16.8) si applica in questo punto e non in quattro: aggiungerlo altrove
   * significherebbe una strada che lo scavalca, e nessuno se ne accorgerebbe.
   *
   * Ritorna quanto è stato accreditato DAVVERO: il chiamante non può darlo per scontato.
   */
  async creditStaff(input: {
    staffId: string;
    amountCents: number;
    kind: string; // sales_commission | visit_compensation
    ref: string;
    clientId?: string;
  }): Promise<{ erogatoCents: number; tagliatoCents: number }> {
    if (input.amountCents <= 0) return { erogatoCents: 0, tagliatoCents: 0 };

    const tetto = await this.quotaConsentita(input.staffId, input.amountCents);
    if (tetto.tagliatoCents > 0) {
      // L'eccedenza si perde (decisione dell'11/8): non diventa un accantonamento, non slitta al
      // mese dopo. Ma non sparisce in silenzio — resta scritta qui e nel log, perché «quel mese ho
      // preso meno del dovuto» è una domanda che qualcuno farà.
      this.logger.warn(
        `[tetto] staff=${input.staffId} tetto=${euroCents(tetto.tettoCents ?? 0)} maturato=${euroCents(tetto.giaMaturatoCents)} ` +
          `dovuto=${euroCents(input.amountCents)} erogato=${euroCents(tetto.erogabileCents)} perso=${euroCents(tetto.tagliatoCents)} ref=${input.ref}`,
      );
      await this.audit.log({
        action: 'provvigione.tetto_mensile',
        entityType: 'staff',
        entityId: input.staffId,
        metadata: {
          ref: input.ref,
          kind: input.kind,
          tettoCents: tetto.tettoCents,
          giaMaturatoCents: tetto.giaMaturatoCents,
          dovutoCents: input.amountCents,
          erogatoCents: tetto.erogabileCents,
          tagliatoCents: tetto.tagliatoCents,
        },
      });
    }
    // Tetto già saturo: nessuna riga da zero euro nel registro contabile — sarebbe rumore in
    // Contabilità e nel portafoglio, e l'informazione utile è già nell'audit qui sopra.
    if (tetto.erogabileCents <= 0) return { erogatoCents: 0, tagliatoCents: tetto.tagliatoCents };

    const erogato = tetto.erogabileCents;
    const nota =
      tetto.tagliatoCents > 0
        ? `Tetto mensile ${euroCents(tetto.tettoCents ?? 0)}: quota ridotta da ${euroCents(input.amountCents)} a ${euroCents(erogato)}.`
        : undefined;

    const period = this.period();
    const existing = await this.prisma.staffCompensation.findUnique({
      where: { staffId_period: { staffId: input.staffId, period } },
    });
    const items = [
      ...((existing?.items as unknown[]) ?? []),
      {
        at: new Date().toISOString(),
        kind: input.kind,
        amountCents: erogato,
        ref: input.ref,
        // Presente solo quando il tetto ha morso: chi rilegge la riga vede subito perché l'importo
        // non corrisponde alla quota del piano.
        ...(tetto.tagliatoCents > 0 ? { tettoTagliatoCents: tetto.tagliatoCents } : {}),
      },
    ];
    await this.prisma.staffCompensation.upsert({
      where: { staffId_period: { staffId: input.staffId, period } },
      create: { staffId: input.staffId, period, amountCents: erogato, items: items as never },
      update: { amountCents: { increment: erogato }, items: items as never },
    });
    await this.prisma.ledgerEntry.create({
      data: {
        type: 'expense',
        amountCents: erogato,
        category: input.kind,
        ref: input.ref,
        clientId: input.clientId,
        staffId: input.staffId,
        ...(nota ? { note: nota } : {}),
      },
    });
    return { erogatoCents: erogato, tagliatoCents: tetto.tagliatoCents };
  }

  /**
   * Quanto di `dovutoCents` sta sotto il tetto mensile di questa persona (§16.8).
   *
   * Il maturato del mese si legge **sommando il registro contabile**, non `StaffCompensation`:
   * quel contatore viene decrementato con un `Math.max(0, …)` quando si storna un acquisto, quindi
   * uno storno più grande del residuo gli fa perdere l'informazione. Il registro invece tiene gli
   * storni come righe negative, e la somma algebrica è il numero vero — lo stesso che la persona
   * vede nel suo portafoglio.
   */
  private async quotaConsentita(
    staffId: string,
    dovutoCents: number,
  ): Promise<{ erogabileCents: number; tagliatoCents: number; tettoCents: number | null; giaMaturatoCents: number }> {
    const staff = (await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { earningsCapCents: true },
    })) as { earningsCapCents: number | null } | null;
    const tettoCents = tettoAttivoCents(staff?.earningsCapCents);
    // Il caso normale: nessun tetto, nessuna query in più.
    if (tettoCents === null) return { erogabileCents: dovutoCents, tagliatoCents: 0, tettoCents: null, giaMaturatoCents: 0 };

    const somma = await this.prisma.ledgerEntry.aggregate({
      _sum: { amountCents: true },
      where: {
        type: 'expense' as never,
        category: { in: CATEGORIE_COMPENSO },
        staffId,
        date: { gte: inizioMese() },
      },
    });
    const giaMaturatoCents = somma?._sum?.amountCents ?? 0;
    const esito = quotaSottoTetto({ tettoCents, giaMaturatoCents, dovutoCents });
    return { erogabileCents: esito.erogabileCents, tagliatoCents: esito.tagliatoCents, tettoCents, giaMaturatoCents };
  }

  /**
   * Provvigioni all'approvazione di un pagamento. Gli importi sono FISSI (in €) e
   * definiti su ogni PRODOTTO/PIANO del negozio (4 quote: coach, manager coach,
   * nutrizionista, capo nutrizionista), non più percentuali globali.
   * La catena: la quota base va allo staff assegnato + una quota al suo responsabile
   * (Staff.managerId). In caso di sconto, gli importi sono riscalati sull'importo
   * effettivamente pagato (paid/gross).
   */
  async generateCommissions(payment: { id: string; clientId: string; amountCents: number }) {
    const [profile, full] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId: payment.clientId },
        select: {
          assignedCoachId: true,
          assignedNutritionistId: true,
          assignedCoach: { select: { managerId: true } },
          assignedNutritionist: { select: { managerId: true } },
        },
      }),
      this.prisma.payment.findUnique({
        where: { id: payment.id },
        select: {
          // Perché è nato il pagamento: sui RINNOVI vale una condizione in più (vedi sotto).
          billingReason: true,
          subscription: {
            select: {
              plan: {
                select: {
                  priceCents: true,
                  commissionCoachCents: true,
                  commissionManagerCoachCents: true,
                  commissionNutritionistCents: true,
                  commissionHeadNutritionistCents: true,
                  commissionCoachPct: true,
                  commissionCoordinatorPct: true,
                  commissionManagerPct: true,
                  commissionNutritionistPct: true,
                  commissionHeadNutritionistPct: true,
                },
              },
            },
          },
          order: { select: { items: true } },
        },
      }),
    ]);
    if (!profile) return;

    /**
     * RINNOVO: la provvigione va SOLO alla coach ancora assegnata (decisione Simone 6/8).
     *
     * Il residual è senza scadenza — finché la cliente si rinnova, la coach incassa — e regge
     * proprio perché è legato al RAPPORTO e non al contratto: la quota si calcola sempre su
     * `profile.assignedCoachId`, cioè sulla coach ATTUALE. Se la cliente viene spostata, dal
     * rinnovo successivo incassa la nuova. Nessuna riga in più serve per questo: è già così.
     *
     * ⚠️ Un caso resta come prima, per scelta esplicita di Simone (7/8): se al rinnovo la
     * cliente non ha NESSUNA coach, la provvigione viene **accantonata** (`pendingCommission`)
     * e pagata a chi verrà assegnato. Segnalato che su un rinnovo significa far incassare a una
     * coach futura una rendita costruita da un'altra; risposta: va bene così. Lo si tiene
     * scritto qui perché è una decisione, non una svista — e perché se un domani i conti dei
     * compensi sembreranno strani, si parte da questa riga.
     */

    // RETE A DIFFERENZA (decisione 17/07): se il piano/prodotti hanno percentuali,
    // si paga per differenza lungo la catena reale (coach → coordinatrice → manager;
    // nutrizionista → capo). Altrimenti restano gli importi fissi legacy.
    const pq = await this.percentAmounts(payment.amountCents, full);
    if (pq) {
      await this.settleChain(payment, 'coach', profile.assignedCoachId, [
        { role: 'coach', amountCents: pq.coach },
        { role: 'coach_coordinator', amountCents: pq.coordinator },
        { role: 'sales', amountCents: pq.manager },
      ]);
      await this.settleChain(payment, 'nutritionist', profile.assignedNutritionistId, [
        { role: 'nutritionist', amountCents: pq.nutritionist },
        { role: 'head_nutritionist', amountCents: pq.headNutritionist },
      ]);
      return;
    }

    const q = await this.commissionAmounts(payment.amountCents, full);

    await this.settleSide(payment, 'coach', profile.assignedCoachId, profile.assignedCoach?.managerId, q.coach, q.managerCoach);
    await this.settleSide(payment, 'nutritionist', profile.assignedNutritionistId, profile.assignedNutritionist?.managerId, q.nutritionist, q.headNutritionist);
  }

  /**
   * Quote in centesimi PER LIVELLO dal modello a percentuali (per piano/prodotto,
   * sull'importo effettivamente pagato). Ritorna null se nessuna percentuale è
   * impostata (→ si usa il modello legacy a importi fissi).
   */
  private async percentAmounts(
    paidCents: number,
    full: {
      subscription?: { plan?: (Record<string, unknown> & { priceCents: number }) | null } | null;
      order?: { items: unknown } | null;
    } | null,
  ): Promise<{ coach: number; coordinator: number; manager: number; nutritionist: number; headNutritionist: number } | null> {
    type Pcts = { coach: number; coordinator: number; manager: number; nutritionist: number; headNutritionist: number };
    const zero: Pcts = { coach: 0, coordinator: 0, manager: 0, nutritionist: 0, headNutritionist: 0 };
    const acc = { ...zero };
    let gross = 0;
    let anyPct = false;

    const addItem = (grossCents: number, p: Pcts) => {
      gross += grossCents;
      acc.coach += grossCents * (p.coach / 100);
      acc.coordinator += grossCents * (p.coordinator / 100);
      acc.manager += grossCents * (p.manager / 100);
      acc.nutritionist += grossCents * (p.nutritionist / 100);
      acc.headNutritionist += grossCents * (p.headNutritionist / 100);
      if (p.coach || p.coordinator || p.manager || p.nutritionist || p.headNutritionist) anyPct = true;
    };
    const pctsOf = (r: Record<string, unknown> | null | undefined): Pcts => ({
      coach: Number(r?.commissionCoachPct ?? 0),
      coordinator: Number(r?.commissionCoordinatorPct ?? 0),
      manager: Number(r?.commissionManagerPct ?? 0),
      nutritionist: Number(r?.commissionNutritionistPct ?? 0),
      headNutritionist: Number(r?.commissionHeadNutritionistPct ?? 0),
    });

    const plan = full?.subscription?.plan;
    if (plan) addItem(plan.priceCents, pctsOf(plan));

    const items = Array.isArray(full?.order?.items)
      ? (full!.order!.items as unknown as { productId: string; priceCents: number; qty: number }[])
      : [];
    if (items.length > 0) {
      const products = (await this.prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
      })) as unknown as (Record<string, unknown> & { id: string })[];
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const it of items) {
        const qty = it.qty ?? 1;
        addItem((it.priceCents ?? 0) * qty, pctsOf(byId.get(it.productId)));
      }
    }

    if (!anyPct) return null;
    // Sconto: le percentuali valgono sull'importo pagato reale → riscala paid/gross.
    const scale = gross > 0 ? Math.min(1, paidCents / gross) : 1;
    return {
      coach: Math.round(acc.coach * scale),
      coordinator: Math.round(acc.coordinator * scale),
      manager: Math.round(acc.manager * scale),
      nutritionist: Math.round(acc.nutritionist * scale),
      headNutritionist: Math.round(acc.headNutritionist * scale),
    };
  }

  /**
   * Paga la catena PER DIFFERENZA: chi vende incassa la quota del suo livello;
   * ogni superiore (risalendo `Staff.managerId`) incassa la differenza tra la
   * quota del suo livello e quella già pagata sotto di lui. Con rete completa
   * 25/35/45 → 25 + 10 + 10; coach direttamente sotto la manager → 25 + 20;
   * vendita della coordinatrice → 35 + 10. Livelli mancanti = differenza NON
   * erogata (resta all'azienda). Cliente non assegnato → accantona come legacy.
   */
  /**
   * RICALCOLO delle provvigioni di un pagamento già approvato: **aggiunge solo il mancante**.
   *
   * Nasce dall'8/8: il piano «Percorso Metabole 3 mesi» aveva le percentuali scritte come quote
   * separate (25 / 10 / 10) invece che come soglie cumulative. Pagando a differenza, il secondo
   * livello calcolava `10 − 25 = −15` — negativo — e si fermava: incassava solo la coach.
   * Corretto il piano, i pagamenti già fatti **non si ricalcolano da soli**.
   *
   * Due scelte deliberate:
   *  - **non cancella niente**: righe di contabilità già registrate sono compensi che qualcuno
   *    può aver già visto o incassato;
   *  - se qualcuno ha preso **più** del dovuto non gli toglie niente: lo riporta e basta.
   *    Togliere soldi a una persona non è un'operazione da bottone.
   * Rilanciarlo non raddoppia: la seconda volta la differenza è zero.
   *
   * ⚠️ **DOMANDA APERTA (20/8), scritta qui perché è una decisione e non una svista.** Il tetto di
   * guadagno è MENSILE e si misura sul mese in cui si preme il pulsante, non su quello del
   * pagamento. Quindi: una quota tagliata dal tetto ad agosto — e perduta, perché l'eccedenza non
   * slitta — se il ricalcolo gira a settembre **viene pagata**, sotto il tetto di settembre. Non è
   * un difetto del codice: è quello che «aggiungi il mancante» significa, letteralmente. Ma è
   * anche il modo in cui una decisione di prodotto («l'eccedenza si perde») si può disfare con un
   * clic, senza che chi clicca lo sappia. Va deciso da Simone se il ricalcolo debba escludere le
   * quote già tagliate da un tetto di un mese chiuso; finché non è deciso, resta così e sta
   * scritto.
   */
  async ricalcolaProvvigioni(paymentId: string): Promise<{
    aggiunte: { staff: string; ruolo: string; importoCents: number }[];
    eccessi: { staff: string; ruolo: string; dovutoCents: number; presoCents: number }[];
    totaleAggiuntoCents: number;
    messaggio: string;
  }> {
    const pay = (await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, clientId: true, amountCents: true, status: true, subscriptionId: true },
    })) as { id: string; clientId: string; amountCents: number; status: string; subscriptionId: string | null } | null;
    if (!pay) throw new NotFoundException('Pagamento non trovato.');
    if (pay.status !== 'approved') {
      return { aggiunte: [], eccessi: [], totaleAggiuntoCents: 0, messaggio: 'Il pagamento non è approvato: niente da ricalcolare.' };
    }
    if (!pay.subscriptionId) {
      return { aggiunte: [], eccessi: [], totaleAggiuntoCents: 0, messaggio: 'Acquisto senza abbonamento: le quote seguono i prodotti, non la scala del piano.' };
    }

    const full = (await this.prisma.payment.findUnique({
      where: { id: pay.id },
      select: {
        subscription: { select: { plan: { select: { priceCents: true, commissionCoachPct: true, commissionCoordinatorPct: true, commissionManagerPct: true, commissionNutritionistPct: true, commissionHeadNutritionistPct: true } } } },
        order: { select: { items: true } },
      },
    })) as never;
    const pq = await this.percentAmounts(pay.amountCents, full);
    if (!pq) {
      return { aggiunte: [], eccessi: [], totaleAggiuntoCents: 0, messaggio: 'Questo piano non usa le percentuali: si applicano gli importi fissi storici.' };
    }

    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: pay.clientId },
      // Solo la coach: la catena nutrizionista questa funzione non la guarda più (vedi sotto).
      select: { assignedCoachId: true },
    })) as { assignedCoachId: string | null } | null;

    /**
     * ⚠️ **SOLO LA CATENA COACH** (Simone, 20/8). Fino a oggi questa funzione guardava anche la
     * catena nutrizionista — `nutritionist` → `head_nutritionist` — e quindi il pulsante «Ricalcola
     * provvigioni» aggiungeva quote anche lì.
     *
     * ⛔ Non era una scelta: era una riga scritta per simmetria con `generateCommissions`, e nessuno
     * l'aveva più riletta. È venuta fuori il 20/8 perché Simone, rispondendo a un'altra domanda, ha
     * descritto il pulsante come «lavora solo sulle provvigioni della rete coach» — e il codice
     * faceva un'altra cosa. **Su un pulsante che muove soldi, la differenza fra quello che il
     * proprietario crede che faccia e quello che fa è il difetto**, indipendentemente da quale
     * delle due versioni sia la migliore.
     *
     * ⚠️ Le righe già a registro per i nutrizionisti **non si toccano**: questa funzione non toglie
     * niente a nessuno (vedi sopra), e adesso semplicemente non le guarda — quindi non le somma né
     * le segnala come eccesso. Quello che è stato pagato resta pagato.
     */
    const atteso = new Map<string, { nome: string; ruolo: string; cents: number }>();
    for (const [id, v] of await this.dovutoLungoCatena(profile?.assignedCoachId, [
      { role: 'coach', amountCents: pq.coach },
      { role: 'coach_coordinator', amountCents: pq.coordinator },
      { role: 'sales', amountCents: pq.manager },
    ])) atteso.set(id, v);

    const righe = (await this.prisma.ledgerEntry.findMany({
      where: { ref: pay.id, category: 'sales_commission' as never },
      select: { staffId: true, amountCents: true },
    })) as { staffId: string | null; amountCents: number }[];
    const gia = new Map<string, number>();
    for (const r of righe) if (r.staffId) gia.set(r.staffId, (gia.get(r.staffId) ?? 0) + r.amountCents);

    const aggiunte: { staff: string; ruolo: string; importoCents: number }[] = [];
    const eccessi: { staff: string; ruolo: string; dovutoCents: number; presoCents: number }[] = [];
    let tagliatoDalTetto = 0;
    for (const [staffId, v] of atteso) {
      const preso = gia.get(staffId) ?? 0;
      const diff = v.cents - preso;
      if (diff > 0) {
        // ⚠️ Quello che si è aggiunto è quello che `creditStaff` dice di aver aggiunto, non `diff`:
        // il tetto mensile (§16.8) può averne erogata solo una parte, o niente. Riportare `diff`
        // vorrebbe dire dire all'admin «aggiunti 44,55 €» quando sul registro ce ne sono 10.
        const esito = await this.creditStaff({ staffId, amountCents: diff, kind: 'sales_commission', ref: pay.id, clientId: pay.clientId });
        if (esito.erogatoCents > 0) aggiunte.push({ staff: v.nome, ruolo: v.ruolo, importoCents: esito.erogatoCents });
        tagliatoDalTetto += esito.tagliatoCents;
      } else if (diff < 0) {
        eccessi.push({ staff: v.nome, ruolo: v.ruolo, dovutoCents: v.cents, presoCents: preso });
      }
    }

    const totale = aggiunte.reduce((n, x) => n + x.importoCents, 0);
    const codaTetto = tagliatoDalTetto > 0 ? ` ⚠️ Tetto mensile: ${euroCents(tagliatoDalTetto)} non erogati.` : '';
    const messaggio =
      (aggiunte.length
        ? `Aggiunte ${aggiunte.length} quote mancanti per un totale di € ${(totale / 100).toFixed(2).replace('.', ',')}.`
        : eccessi.length
          ? 'Niente da aggiungere. Attenzione: qualcuno ha preso più del dovuto (vedi dettaglio) — non è stato tolto niente.'
          : tagliatoDalTetto > 0
            ? 'Niente da aggiungere: le quote mancanti erano tutte sopra il tetto mensile.'
            : 'Già a posto: nessuna quota mancante.') + codaTetto;
    return { aggiunte, eccessi, totaleAggiuntoCents: totale, messaggio };
  }

  /** Chi c'è nella catena e quanto gli spetta, con la stessa regola a differenza di `settleChain`. */
  private async dovutoLungoCatena(
    sellerStaffId: string | null | undefined,
    ladder: { role: string; amountCents: number }[],
  ): Promise<Map<string, { nome: string; ruolo: string; cents: number }>> {
    const out = new Map<string, { nome: string; ruolo: string; cents: number }>();
    if (!sellerStaffId) return out;
    const chain: { id: string; nome: string; ruolo: string }[] = [];
    const seen = new Set<string>();
    let cur: string | null = sellerStaffId;
    for (let hop = 0; hop < 4 && cur && !seen.has(cur); hop++) {
      seen.add(cur);
      const st = (await this.prisma.staff.findUnique({
        where: { id: cur },
        select: { id: true, displayName: true, managerId: true, user: { select: { role: true } } },
      })) as { id: string; displayName: string; managerId: string | null; user: { role: string } | null } | null;
      if (!st) break;
      chain.push({ id: st.id, nome: st.displayName, ruolo: st.user?.role ?? '' });
      cur = st.managerId;
    }
    const levelOf = (role: string) => ladder.findIndex((l) => l.role === role);
    let paidLevel = -1;
    let paidAmount = 0;
    for (const link of chain) {
      const lvl = levelOf(link.ruolo);
      if (lvl < 0 || lvl <= paidLevel) continue;
      const due = ladder[lvl].amountCents - paidAmount;
      if (due > 0) out.set(link.id, { nome: link.nome, ruolo: link.ruolo, cents: due });
      paidLevel = lvl;
      paidAmount = Math.max(paidAmount, ladder[lvl].amountCents);
      if (paidLevel >= ladder.length - 1) break;
    }
    return out;
  }

  private async settleChain(
    payment: { id: string; clientId: string; amountCents: number },
    group: 'coach' | 'nutritionist',
    sellerStaffId: string | null | undefined,
    ladder: { role: string; amountCents: number }[], // dal livello più basso al più alto
  ) {
    const levelOf = (role: string) => ladder.findIndex((l) => l.role === role);

    if (!sellerStaffId) {
      // Non assegnato: accantona nei due secchi legacy (base + differenza piena al
      // vertice); alla futura assegnazione si paga base → staff e resto → suo manager.
      const [primaryRole, managerRole] = group === 'coach' ? ['coach', 'manager_coach'] : ['nutritionist', 'head_nutritionist'];
      const base = ladder[0]?.amountCents ?? 0;
      const top = ladder[ladder.length - 1]?.amountCents ?? 0;
      const pendings: { paymentId: string; clientId: string; role: string; amountCents: number }[] = [];
      if (base > 0) pendings.push({ paymentId: payment.id, clientId: payment.clientId, role: primaryRole, amountCents: base });
      if (top - base > 0) pendings.push({ paymentId: payment.id, clientId: payment.clientId, role: managerRole, amountCents: top - base });
      for (const data of pendings) await this.prisma.pendingCommission.create({ data });
      return;
    }

    // Catena reale: venditore + superiori via managerId (max 3 anelli, cicli esclusi).
    const chain: { staffId: string; role: string }[] = [];
    const seen = new Set<string>();
    let cursorId: string | null = sellerStaffId;
    for (let hop = 0; hop < 4 && cursorId && !seen.has(cursorId); hop++) {
      seen.add(cursorId);
      const st = (await this.prisma.staff.findUnique({
        where: { id: cursorId },
        select: { id: true, managerId: true, user: { select: { role: true } } },
      })) as { id: string; managerId: string | null; user: { role: string } | null } | null;
      if (!st) break;
      chain.push({ staffId: st.id, role: st.user?.role ?? '' });
      cursorId = st.managerId;
    }
    if (!chain.length) return;

    let paidLevel = -1;
    let paidAmount = 0;
    for (const link of chain) {
      const lvl = levelOf(link.role);
      if (lvl < 0 || lvl <= paidLevel) continue; // ruolo fuori scala o non superiore: salta
      const due = ladder[lvl].amountCents - paidAmount;
      if (due > 0) {
        await this.creditStaff({ staffId: link.staffId, amountCents: due, kind: 'sales_commission', ref: payment.id, clientId: payment.clientId });
      }
      paidLevel = lvl;
      paidAmount = Math.max(paidAmount, ladder[lvl].amountCents);
      if (paidLevel >= ladder.length - 1) break; // vertice raggiunto
    }
  }

  /**
   * Somma le 4 quote provvigionali (in centesimi) dovute da questo acquisto:
   * dal piano dell'abbonamento e/o da ciascun prodotto dell'ordine (× quantità).
   * Il totale è riscalato sull'importo effettivamente pagato (per gli sconti).
   */
  private async commissionAmounts(
    paidCents: number,
    full: {
      subscription?: {
        plan?: {
          priceCents: number;
          commissionCoachCents: number;
          commissionManagerCoachCents: number;
          commissionNutritionistCents: number;
          commissionHeadNutritionistCents: number;
        } | null;
      } | null;
      order?: { items: unknown } | null;
    } | null,
  ): Promise<{ coach: number; managerCoach: number; nutritionist: number; headNutritionist: number }> {
    let coach = 0, managerCoach = 0, nutritionist = 0, headNutritionist = 0, gross = 0;

    const plan = full?.subscription?.plan;
    if (plan) {
      coach += plan.commissionCoachCents;
      managerCoach += plan.commissionManagerCoachCents;
      nutritionist += plan.commissionNutritionistCents;
      headNutritionist += plan.commissionHeadNutritionistCents;
      gross += plan.priceCents;
    }

    const items = Array.isArray(full?.order?.items)
      ? (full!.order!.items as unknown as { productId: string; priceCents: number; qty: number }[])
      : [];
    if (items.length > 0) {
      const products = (await this.prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: {
          id: true,
          commissionCoachCents: true,
          commissionManagerCoachCents: true,
          commissionNutritionistCents: true,
          commissionHeadNutritionistCents: true,
        },
      })) as {
        id: string;
        commissionCoachCents: number;
        commissionManagerCoachCents: number;
        commissionNutritionistCents: number;
        commissionHeadNutritionistCents: number;
      }[];
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const it of items) {
        const qty = it.qty ?? 1;
        gross += (it.priceCents ?? 0) * qty;
        const prod = byId.get(it.productId);
        if (!prod) continue;
        coach += prod.commissionCoachCents * qty;
        managerCoach += prod.commissionManagerCoachCents * qty;
        nutritionist += prod.commissionNutritionistCents * qty;
        headNutritionist += prod.commissionHeadNutritionistCents * qty;
      }
    }

    // Sconto: riscala le quote sull'importo pagato (paid/gross). Senza sconto scale=1.
    const scale = gross > 0 ? Math.min(1, paidCents / gross) : 1;
    return {
      coach: Math.round(coach * scale),
      managerCoach: Math.round(managerCoach * scale),
      nutritionist: Math.round(nutritionist * scale),
      headNutritionist: Math.round(headNutritionist * scale),
    };
  }

  /**
   * Regola una "metà" della catena (coaching o nutrizione):
   * - se lo staff è assegnato → paga subito la quota (e quella del responsabile se c'è);
   * - se NON è assegnato → accantona le quote, pagate poi all'assegnazione.
   */
  private async settleSide(
    payment: { id: string; clientId: string; amountCents: number },
    group: 'coach' | 'nutritionist',
    primaryStaffId: string | null | undefined,
    managerStaffId: string | null | undefined,
    primaryAmountCents: number,
    managerAmountCents: number,
  ) {
    const [primaryRole, managerRole] = group === 'coach' ? ['coach', 'manager_coach'] : ['nutritionist', 'head_nutritionist'];

    if (primaryStaffId) {
      // Assegnato: paga subito la quota base e (se presente il responsabile) la sua.
      if (primaryAmountCents > 0) {
        await this.creditStaff({ staffId: primaryStaffId, amountCents: primaryAmountCents, kind: 'sales_commission', ref: payment.id, clientId: payment.clientId });
      }
      if (managerStaffId && managerAmountCents > 0) {
        await this.creditStaff({ staffId: managerStaffId, amountCents: managerAmountCents, kind: 'sales_commission', ref: payment.id, clientId: payment.clientId });
      }
      return;
    }

    // Non assegnato: accantona (pagheremo all'assegnazione dal backoffice).
    const pendings: { paymentId: string; clientId: string; role: string; amountCents: number }[] = [];
    if (primaryAmountCents > 0) pendings.push({ paymentId: payment.id, clientId: payment.clientId, role: primaryRole, amountCents: primaryAmountCents });
    if (managerAmountCents > 0) pendings.push({ paymentId: payment.id, clientId: payment.clientId, role: managerRole, amountCents: managerAmountCents });
    for (const data of pendings) {
      await this.prisma.pendingCommission.create({ data });
    }
  }

  /**
   * Assegnato coach/nutrizionista → paga le provvigioni accantonate del cliente:
   * la quota base va allo staff appena assegnato, la quota "responsabile" al suo
   * manager (se impostato), altrimenti quella quota viene annullata.
   */
  async resolvePendingForAssignment(clientId: string, group: 'coach' | 'nutritionist', staffId: string) {
    const [primaryRole, managerRole] = group === 'coach' ? ['coach', 'manager_coach'] : ['nutritionist', 'head_nutritionist'];
    const pendings = await this.prisma.pendingCommission.findMany({
      where: { clientId, status: 'pending', role: { in: [primaryRole, managerRole] } },
    });
    if (!pendings.length) return;
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { managerId: true } });
    for (const p of pendings as { id: string; role: string; amountCents: number; paymentId: string }[]) {
      const target = p.role === primaryRole ? staffId : staff?.managerId ?? null;
      if (target && p.amountCents > 0) {
        await this.creditStaff({ staffId: target, amountCents: p.amountCents, kind: 'sales_commission', ref: p.paymentId, clientId });
        await this.prisma.pendingCommission.update({ where: { id: p.id }, data: { status: 'paid', resolvedStaffId: target, resolvedAt: new Date() } });
      } else {
        await this.prisma.pendingCommission.update({ where: { id: p.id }, data: { status: 'cancelled', resolvedAt: new Date() } });
      }
    }
  }

  /*
   * COMPENSO VISITA: TOLTO (11/8, decisione di Simone: «togliamolo totalmente»).
   *
   * C'era `creditVisitCompensation`: al completamento di ogni visita accreditava alla nutrizionista
   * un importo fisso (`visit_compensation_amount_cents`, 40 €) e scriveva l'uscita a ledger.
   * Dal 14/07 quello che lo staff guadagna è definito **sul prodotto** — gli importi in € su ogni
   * piano (`commission*Cents` / `commission*Pct`) — e il compenso a visita era l'ultimo residuo del
   * modello precedente: pagava una seconda volta, di lato, una cosa già pagata dalla provvigione del
   * piano, con un numero che viveva in un parametro globale e non nel prodotto.
   *
   * Cosa NON è stato toccato, di proposito: la categoria `visit_compensation` resta in
   * `COMMISSION_CATEGORIES`, nelle etichette della Contabilità, nei Compensi staff e nei Prelievi.
   * Gli importi già accreditati sono soldi già dovuti o già pagati: se sparissero dalle etichette
   * resterebbero in tabella come una categoria senza nome. Non nascono più righe nuove; le vecchie
   * si continuano a leggere.
   */

  // ---------- Dashboard e ledger ----------

  async ledger(filter: { from?: string; to?: string; type?: string; category?: string }) {
    return this.prisma.ledgerEntry.findMany({
      where: {
        ...(filter.type ? { type: filter.type as never } : {}),
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.from || filter.to
          ? { date: { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(filter.to) } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 500,
    });
  }

  async accountingDashboard() {
    const entries = await this.prisma.ledgerEntry.groupBy({
      by: ['type', 'category'],
      _sum: { amountCents: true },
    });
    type Row = { type: string; category: string; _sum: { amountCents: number | null } };
    const income = (entries as Row[]).filter((e) => e.type === 'income');
    const expense = (entries as Row[]).filter((e) => e.type === 'expense');
    const sum = (rows: Row[]) => rows.reduce((a, r) => a + (r._sum.amountCents ?? 0), 0);
    return {
      totalIncomeCents: sum(income),
      totalExpenseCents: sum(expense),
      netCents: sum(income) - sum(expense),
      byCategory: (entries as Row[]).map((e) => ({
        type: e.type,
        category: e.category,
        amountCents: e._sum.amountCents ?? 0,
      })),
    };
  }

  /**
   * ⚠️ **CHE DOMANDA RISPONDE, e quale no.** Questa restituisce le righe `StaffCompensation`, cioè
   * il **dettaglio** di cosa ha composto un mese (`items`: ogni accredito con data, tipo e `ref`) —
   * una cosa che il registro contabile non ha in quella forma.
   *
   * ⛔ Il suo `amountCents`, però, è un contatore mantenuto a parte: si decrementa con un
   * `Math.max(0, …)` quando si storna, e un rimborso a cavallo di due mesi lo scala dal mese
   * ORIGINALE mentre il registro scrive la riga negativa nel mese CORRENTE. Per «quanto ha
   * guadagnato questa persona» la risposta buona è una sola ed è il registro: la dà
   * `GET /admin/compensation` (`CompensationController`), che è anche quello che la pagina
   * «Compensi staff» usa davvero. Dal 20/8 lo legge dal registro anche lo «Storico mesi» nell'app
   * dello staff, che prima leggeva questo contatore e mostrava un numero diverso dal saldo
   * prelevabile stampato due centimetri sotto.
   *
   * ⚠️ Oggi nessuna schermata chiama questo endpoint (è documentato nel README e nella specifica):
   * resta perché il dettaglio per periodo è una domanda legittima, non perché serva a qualcuno
   * adesso. Se un giorno lo si usa per mostrare un totale, il totale va preso dal registro.
   */
  async compensationDashboard(period?: string) {
    return this.prisma.staffCompensation.findMany({
      where: period ? { period } : {},
      orderBy: [{ period: 'desc' }, { amountCents: 'desc' }],
      include: { staff: { select: { displayName: true, user: { select: { role: true } } } } },
      take: 200,
    });
  }

  /**
   * Elenco delle provvigioni pagate (ledger, categoria sales_commission),
   * con destinatario, cliente e prodotto risolti. I filtri fini (cliente,
   * prodotto, ricevente, importo) li applica il frontend sull'elenco.
   */
  async listCommissions() {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { type: 'expense' as never, category: 'sales_commission' },
      orderBy: { date: 'desc' },
      take: 1000,
    });
    type Entry = { id: string; date: Date; amountCents: number; ref: string | null; clientId: string | null; staffId: string | null };
    const list = entries as Entry[];
    const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => Boolean(x))));

    const [staff, clients, payments] = await Promise.all([
      this.prisma.staff.findMany({ where: { id: { in: uniq(list.map((e) => e.staffId)) } }, select: { id: true, displayName: true } }),
      this.prisma.user.findMany({ where: { id: { in: uniq(list.map((e) => e.clientId)) } }, select: { id: true, email: true, clientProfile: { select: { name: true } } } }),
      this.prisma.payment.findMany({ where: { id: { in: uniq(list.map((e) => e.ref)) } }, select: { id: true, description: true } }),
    ]);
    const staffMap = new Map((staff as { id: string; displayName: string }[]).map((s) => [s.id, s.displayName]));
    const clientMap = new Map((clients as { id: string; email: string; clientProfile: { name: string | null } | null }[]).map((c) => [c.id, c.clientProfile?.name ?? c.email]));
    const payMap = new Map((payments as { id: string; description: string }[]).map((p) => [p.id, p.description]));

    return list.map((e) => ({
      id: e.id,
      date: e.date,
      amountCents: e.amountCents,
      recipientId: e.staffId,
      recipient: (e.staffId && staffMap.get(e.staffId)) || '—',
      clientId: e.clientId,
      client: (e.clientId && clientMap.get(e.clientId)) || '—',
      product: (e.ref && payMap.get(e.ref)) || '—',
    }));
  }

  /**
   * Elimina una singola provvigione: rimuove la voce di ledger E scala il
   * compenso aggregato dello staff nel periodo (coerenza contabile).
   */
  async deleteCommission(ledgerId: string, actorId: string) {
    const entry = (await this.prisma.ledgerEntry.findUnique({ where: { id: ledgerId } })) as
      | { id: string; category: string; amountCents: number; staffId: string | null; ref: string | null; date: Date }
      | null;
    if (!entry || entry.category !== 'sales_commission') {
      throw new NotFoundException('Provvigione non trovata.');
    }
    // Stesso mese con cui la riga era stata scritta: se qui si usasse il mese UTC, una
    // provvigione accreditata a mese nuovo verrebbe scalata dal periodo sbagliato.
    const period = mesePeriodo(entry.date);

    await this.prisma.$transaction(async (tx: PrismaTx) => {
      await tx.ledgerEntry.delete({ where: { id: ledgerId } });
      if (entry.staffId) {
        const comp = (await tx.staffCompensation.findUnique({
          where: { staffId_period: { staffId: entry.staffId, period } },
        })) as { amountCents: number; items: unknown } | null;
        if (!comp) {
          // Vedi la stessa nota in `commerce.service.ts`: la riga di ledger sparisce comunque —
          // è lei la verità — ma il contatore aggregato del mese resta indietro, e «Storico mesi»
          // mostrerà un numero più alto del vero. Meglio saperlo dal log che dal sospetto.
          this.logger.warn(
            `[provvigione eliminata] compenso aggregato assente: staff=${entry.staffId} periodo=${period} ledger=${ledgerId} — contatore del mese non allineato.`,
          );
        }
        if (comp) {
          const items = (Array.isArray(comp.items) ? comp.items : []) as { kind?: string; amountCents?: number; ref?: string }[];
          const idx = items.findIndex((it) => it.kind === 'sales_commission' && it.amountCents === entry.amountCents && it.ref === entry.ref);
          if (idx >= 0) items.splice(idx, 1);
          await tx.staffCompensation.update({
            where: { staffId_period: { staffId: entry.staffId, period } },
            data: { amountCents: Math.max(0, comp.amountCents - entry.amountCents), items: items as never },
          });
        }
      }
    });

    await this.audit.log({ action: 'finance.commission.delete', actorId, entityType: 'ledger_entry', entityId: ledgerId });
    return { removed: ledgerId };
  }
}
