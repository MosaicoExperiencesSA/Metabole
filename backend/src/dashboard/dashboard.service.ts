import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamScope, isCoachLike } from '../common/coach-team';
import { MailboxService } from '../mailbox/mailbox.service';

const MANAGER_ROLES = ['admin', 'head_nutritionist', 'sales'];
const FINANCE_ROLES = ['admin', 'sales'];
type Row = {
  a: string;
  b?: string;
  sub?: string;
  /**
   * §Chat (12/8): pallino rosso — qualcuno ha scritto dopo l'ultima volta che questa persona ha
   * aperto quella conversazione. Solo dove una risposta è attesa: vedi sotto.
   */
  daLeggere?: boolean;
  /** Etichetta della controparte («Gaia», «coach», «nutrizionista»): serve a non confondersi. */
  chi?: string;
};

/**
 * Mini-anteprime per i moduli della dashboard: gli ultimi dati di ciascuna
 * pagina. Ogni sezione è isolata in try/catch (un errore non blocca le altre)
 * e rispetta lo scope per ruolo dove necessario.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly mailbox: MailboxService) {}

  /**
   * In quali conversazioni qualcuno ha scritto dopo l'ultima apertura di questa persona.
   *
   * Stessa regola dell'elenco chat (`chat.service.daLeggerePerThread`): conta solo quello che ha
   * scritto la CLIENTE — la propria risposta non è una cosa da leggere — e nessuna riga in
   * `chat_read` vuol dire «mai aperta», quindi pallino. Il conto è un di più: se fallisce,
   * l'anteprima si mostra lo stesso senza pallini.
   */
  private async threadDaLeggere(userId: string, threadIds: string[]): Promise<Set<string>> {
    const fuori = new Set<string>();
    if (!threadIds.length) return fuori;
    try {
      const [letture, ultimi] = await Promise.all([
        this.prisma.chatRead.findMany({
          where: { userId, threadId: { in: threadIds } },
          select: { threadId: true, readAt: true },
        }) as Promise<{ threadId: string; readAt: Date }[]>,
        this.prisma.message.groupBy({
          by: ['threadId'],
          where: { threadId: { in: threadIds }, senderRole: 'client', deletedAt: null },
          _max: { sentAt: true },
        }) as unknown as Promise<{ threadId: string; _max: { sentAt: Date | null } }[]>,
      ]);
      const lettoIl = new Map(letture.map((l) => [l.threadId, l.readAt.getTime()]));
      for (const u of ultimi) {
        const quando = u._max.sentAt?.getTime();
        if (quando && quando > (lettoIl.get(u.threadId) ?? 0)) fuori.add(u.threadId);
      }
    } catch { /* il pallino è un di più */ }
    return fuori;
  }

  async previews(user: AuthUser): Promise<Record<string, Row[]>> {
    const out: Record<string, Row[]> = {};
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
    const scopeAll = MANAGER_ROLES.includes(user.role);
    const clientWhere: Record<string, unknown> = { role: 'client', deletedAt: null };
    if (!scopeAll) {
      if (isCoachLike(user.role) && staff) clientWhere.clientProfile = { assignedCoachId: { in: (await coachTeamScope(this.prisma, user.sub)) ?? [] } };
      else if (user.role === 'nutritionist' && staff) clientWhere.clientProfile = { assignedNutritionistId: staff.id };
      else clientWhere.id = '__none__';
    }
    const dmy = (d: Date) => new Date(d).toLocaleDateString('it-IT');
    const euro = (c: number) => '€ ' + Math.round(c / 100).toLocaleString('it-IT');

    // Clienti recenti
    try {
      const rows = (await this.prisma.user.findMany({
        where: clientWhere as never, orderBy: { createdAt: 'desc' }, take: 5,
        select: { createdAt: true, email: true, clientProfile: { select: { name: true } } },
      })) as { createdAt: Date; email: string; clientProfile: { name: string | null } | null }[];
      out.clients = rows.map((r) => ({ a: r.clientProfile?.name ?? r.email, b: dmy(r.createdAt) }));
    } catch { /* skip */ }

    // CRM: lead recenti (con coach e nutrizionista assegnati).
    // Scope per ruolo: la coach vede SOLO i suoi lead; il nutrizionista solo quelli
    // dei suoi clienti; manager/capo/admin tutti.
    const leadWhere: Record<string, unknown> = {};
    if (!scopeAll) {
      if (isCoachLike(user.role) && staff) leadWhere.assignedCoachId = { in: (await coachTeamScope(this.prisma, user.sub)) ?? [] };
      else if (user.role === 'nutritionist' && staff) leadWhere.client = { clientProfile: { assignedNutritionistId: staff.id } };
      else leadWhere.id = '__none__';
    }
    try {
      const rows = (await this.prisma.crmRecord.findMany({
        where: leadWhere as never,
        orderBy: { updatedAt: 'desc' }, take: 5,
        select: {
          name: true, email: true, stage: true,
          assignedCoach: { select: { displayName: true } },
          client: { select: { email: true, clientProfile: { select: { name: true, assignedCoach: { select: { displayName: true } }, assignedNutritionist: { select: { displayName: true } } } } } },
        },
      })) as {
        name: string | null; email: string | null; stage: string;
        assignedCoach: { displayName: string } | null;
        client: { email: string; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null; assignedNutritionist: { displayName: string } | null } | null } | null;
      }[];
      out.crm_leads = rows.map((r) => {
        const coach = r.assignedCoach?.displayName ?? r.client?.clientProfile?.assignedCoach?.displayName ?? null;
        const nutri = r.client?.clientProfile?.assignedNutritionist?.displayName ?? null;
        const sub = `Coach: ${coach ?? '—'} · Nutr.: ${nutri ?? '—'}`;
        return { a: r.client?.clientProfile?.name ?? r.name ?? r.client?.email ?? r.email ?? 'Senza nome', b: r.stage, sub };
      });
    } catch { /* skip */ }

    // Lead da accettare: assegnati in attesa (assignmentStatus pending), scope per coach
    try {
      const whereAccept: Record<string, unknown> = { assignmentStatus: 'pending' };
      if (!scopeAll) {
        if (isCoachLike(user.role) && staff) whereAccept.assignedCoachId = { in: (await coachTeamScope(this.prisma, user.sub)) ?? [] };
        else whereAccept.id = '__none__';
      }
      const rows = (await this.prisma.crmRecord.findMany({
        where: whereAccept as never, orderBy: { assignedAt: 'desc' }, take: 5,
        select: {
          name: true, email: true, assignedAt: true,
          assignedCoach: { select: { displayName: true } },
          client: { select: { email: true, clientProfile: { select: { name: true } } } },
        },
      })) as {
        name: string | null; email: string | null; assignedAt: Date | null;
        assignedCoach: { displayName: string } | null;
        client: { email: string; clientProfile: { name: string | null } | null } | null;
      }[];
      out.lead_accept = rows.map((r) => ({
        a: r.client?.clientProfile?.name ?? r.name ?? r.client?.email ?? r.email ?? 'Senza nome',
        b: r.assignedAt ? dmy(r.assignedAt) : 'da accettare',
        sub: scopeAll && r.assignedCoach ? `Coach: ${r.assignedCoach.displayName}` : undefined,
      }));
    } catch { /* skip */ }

    // Grafici: numeri chiave (scope per ruolo)
    try {
      const ids = ((await this.prisma.user.findMany({ where: clientWhere as never, select: { id: true } })) as { id: string }[]).map((c) => c.id);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const newThisMonth = ids.length ? await this.prisma.user.count({ where: { id: { in: ids }, createdAt: { gte: monthStart } } }) : 0;
      const activeSubs = ids.length ? await this.prisma.subscription.count({ where: { clientId: { in: ids }, status: 'active' as never } }) : 0;
      out.charts = [
        { a: 'Clienti', b: String(ids.length) },
        { a: 'Nuovi questo mese', b: String(newThisMonth) },
        { a: 'Abbonamenti attivi', b: String(activeSubs) },
      ];
    } catch { /* skip */ }

    // Chat: ultime conversazioni (scope: coach/nutrizionista vedono i propri clienti)
    try {
      const threadWhere: Record<string, unknown> = { lastMessageAt: { not: null } };
      if (isCoachLike(user.role)) threadWhere.counterpart = 'coach';
      else if (user.role === 'nutritionist') threadWhere.counterpart = 'nutritionist';
      if (!scopeAll) threadWhere.client = { is: clientWhere };
      const rows = (await this.prisma.chatThread.findMany({
        where: threadWhere as never, orderBy: { lastMessageAt: 'desc' }, take: 5,
        select: {
          id: true, counterpart: true, lastMessageAt: true,
          client: { select: { email: true, clientProfile: { select: { name: true } } } },
          messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { body: true } },
        },
      })) as {
        id: string; counterpart: string; lastMessageAt: Date | null;
        client: { email: string; clientProfile: { name: string | null } | null };
        messages: { body: string }[];
      }[];

      /**
       * ⚠️ IL PALLINO SOLO DOVE UNA RISPOSTA È ATTESA.
       *
       * Per il capo nutrizionista questo elenco **non filtra la controparte**, quindi ci finiscono
       * dentro anche i thread di **Gaia** mescolati a quelli veri. Sembrano messaggi per lui e non
       * lo sono: in quel thread lo staff legge ma non può scrivere, e un messaggio a Gaia non
       * genera nessun avviso (di proposito: sarebbero decine al giorno per cliente).
       *
       * Un pallino rosso su una conversazione a cui nessuno deve rispondere è un allarme che
       * insegna a ignorare gli allarmi. Perciò: pallino solo su coach e nutrizionista, ed
       * `chi` scritto accanto, così un thread di Gaia si riconosce senza aprirlo.
       */
      const daRispondere = rows.filter((r) => r.counterpart !== 'ai').map((r) => r.id);
      const nonLette = await this.threadDaLeggere(user.sub, daRispondere);
      const ETICHETTA: Record<string, string> = { ai: 'Gaia', coach: 'coach', nutritionist: 'nutrizionista' };

      out.chat = rows.map((r) => ({
        a: r.client.clientProfile?.name ?? r.client.email,
        b: r.lastMessageAt ? dmy(r.lastMessageAt) : undefined,
        sub: r.messages[0]?.body?.slice(0, 80),
        chi: ETICHETTA[r.counterpart] ?? r.counterpart,
        daLeggere: nonLette.has(r.id),
      }));
    } catch { /* skip */ }

    // Posta: ultimi messaggi ricevuti nella casella @metabole.eu (IMAP, con timeout per non bloccare la dashboard)
    try {
      const inbox = (await Promise.race([
        this.mailbox.listInbox(user.sub, 5),
        new Promise((_r, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ])) as Array<{ from: string; fromName: string; subject: string; date: Date | string | null }>;
      out.posta = inbox.slice(0, 5).map((m) => ({
        a: m.subject || '(nessun oggetto)',
        b: m.date ? dmy(new Date(m.date)) : undefined,
        sub: m.fromName || m.from,
      }));
    } catch { /* casella non configurata o IMAP non disponibile: nessuna anteprima */ }

    // Testimonianze: le ultime inserite (marketing/admin)
    if (['marketing', 'head_marketing', 'admin'].includes(user.role)) {
      try {
        const rows = (await this.prisma.testimonial.findMany({
          orderBy: { createdAt: 'desc' }, take: 5,
          select: { name: true, published: true, createdAt: true },
        })) as { name: string; published: boolean; createdAt: Date }[];
        out.testimonials = rows.map((r) => ({ a: r.name, b: r.published ? 'pubblicata' : 'bozza', sub: dmy(r.createdAt) }));
      } catch { /* skip */ }
    }

    // Dati finanziari solo per admin/commerciale
    if (FINANCE_ROLES.includes(user.role)) {
      // Bonifici da verificare
      try {
        const rows = (await this.prisma.payment.findMany({
          where: { status: 'receipt_uploaded' as never }, orderBy: { createdAt: 'asc' }, take: 5,
          select: { amountCents: true, description: true, client: { select: { email: true, clientProfile: { select: { name: true } } } } },
        })) as { amountCents: number; description: string; client: { email: string; clientProfile: { name: string | null } | null } | null }[];
        out.accounting = rows.map((r) => ({ a: r.client?.clientProfile?.name ?? r.client?.email ?? r.description, b: euro(r.amountCents) }));
      } catch { /* skip */ }
      // Acquisti recenti (approvati) — con nickname del cliente
      try {
        const rows = (await this.prisma.payment.findMany({
          /**
           * ⚠️ Ne prende DODICI, non cinque, anche se il riquadro ne mostra cinque.
           *
           * Le righe a zero (Prova Gratuita, Conosciamoci, attivazioni interne) le nasconde il
           * frontend, seguendo lo stesso interruttore della tabella Acquisti (richiesta di Simone
           * dell'11/8: «il flag nascondi a 0 mettiamolo anche nel modulo in dashboard, di default 0
           * nascosti»). Se qui ne arrivassero cinque e quattro fossero a zero, il riquadro degli
           * acquisti mostrerebbe UNA riga — e sembrerebbe che non si venda niente.
           */
          where: { status: 'approved' as never }, orderBy: { approvedAt: 'desc' }, take: 12,
          select: { amountCents: true, description: true, approvedAt: true, client: { select: { email: true, clientProfile: { select: { name: true } } } } },
        })) as { amountCents: number; description: string; approvedAt: Date | null; client: { email: string; clientProfile: { name: string | null } | null } | null }[];
        /**
         * Il NOME in alto e il prodotto sotto, non il contrario.
         *
         * Segnalazione di Simone dell'11/8. Le descrizioni degli abbonamenti sono lunghe e quasi
         * uguali fra loro («Abbonamento Prova Gratuita — attivazione interna, senza incasso (listino
         * 349,00 €)»): messe come riga principale il riquadro diventava cinque volte la stessa frase
         * troncata, e la cosa che distingue una riga dall'altra — chi ha comprato — stava in piccolo
         * sotto. Invertite, il riquadro si legge: cinque nomi, cinque importi.
         */
        out.purchases = rows.map((r) => ({
          a: r.client?.clientProfile?.name ?? r.client?.email ?? r.description,
          b: euro(r.amountCents),
          sub: r.description,
          /** Incasso zero: il frontend lo nasconde di default, come fa la tabella Acquisti. */
          zero: r.amountCents === 0,
        }));
      } catch { /* skip */ }
    }

    // Sezioni amministrative (solo admin, come le rispettive pagine)
    if (user.role === 'admin') {
      // Negozio: piani e prodotti attivi
      try {
        const [plans, products] = await Promise.all([
          this.prisma.plan.findMany({ where: { active: true }, orderBy: { priceCents: 'asc' }, take: 3, select: { name: true, priceCents: true } }),
          this.prisma.product.findMany({ where: { active: true }, orderBy: { updatedAt: 'desc' }, take: 2, select: { name: true, priceCents: true } }),
        ]);
        out.shop = [
          ...(plans as { name: string; priceCents: number }[]).map((p) => ({ a: p.name, b: euro(p.priceCents), sub: 'Piano' })),
          ...(products as { name: string; priceCents: number }[]).map((p) => ({ a: p.name, b: euro(p.priceCents), sub: 'Prodotto' })),
        ];
      } catch { /* skip */ }
      // Buoni sconto attivi
      try {
        const rows = (await this.prisma.discountCode.findMany({
          where: { active: true }, orderBy: { createdAt: 'desc' }, take: 5,
          select: { code: true, type: true, value: true, usedCount: true, maxTotalUses: true },
        })) as { code: string; type: string; value: number; usedCount: number; maxTotalUses: number | null }[];
        out.discounts = rows.map((r) => ({
          a: r.code,
          b: r.type === 'percent' ? `-${r.value}%` : '-' + euro(r.value),
          sub: `Usato ${r.usedCount}${r.maxTotalUses ? `/${r.maxTotalUses}` : ''} volte`,
        }));
      } catch { /* skip */ }
      // Contabilità: ultimi movimenti
      try {
        const rows = (await this.prisma.ledgerEntry.findMany({
          orderBy: { date: 'desc' }, take: 5,
          select: { type: true, amountCents: true, category: true, date: true },
        })) as { type: string; amountCents: number; category: string; date: Date }[];
        out.accounting_costs = rows.map((r) => ({
          a: r.category,
          b: (r.type === 'expense' ? '-' : '+') + euro(r.amountCents),
          sub: dmy(r.date),
        }));
      } catch { /* skip */ }
      // Provvigioni in sospeso
      try {
        const rows = (await this.prisma.pendingCommission.findMany({
          where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 5,
          select: { role: true, amountCents: true, createdAt: true },
        })) as { role: string; amountCents: number; createdAt: Date }[];
        out.commissions = rows.map((r) => ({ a: r.role, b: euro(r.amountCents), sub: dmy(r.createdAt) }));
      } catch { /* skip */ }
      // Richieste di prelievo da evadere
      try {
        const rows = (await this.prisma.commissionWithdrawal.findMany({
          where: { status: 'requested' }, orderBy: { requestedAt: 'asc' }, take: 5,
          select: { amountCents: true, requestedAt: true, staff: { select: { displayName: true } } },
        })) as { amountCents: number; requestedAt: Date; staff: { displayName: string } }[];
        out.withdrawals = rows.map((r) => ({ a: r.staff.displayName, b: euro(r.amountCents), sub: dmy(r.requestedAt) }));
      } catch { /* skip */ }
    }

    return out;
  }
}
