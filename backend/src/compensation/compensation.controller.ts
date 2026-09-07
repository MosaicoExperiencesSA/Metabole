import { Controller, Get, Query } from '@nestjs/common';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { confineMese } from '../common/date-only';
import { CATEGORIE_COMPENSO, tettoAttivoCents } from '../common/tetto-compensi';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Compensi staff: aggrega dal registro contabile (LedgerEntry) quanto spetta a ciascuno,
 * distinguendo provvigioni vendita e compensi visite.
 *
 * ⛔ **CHI ENTRA LO DECIDE LA MATRICE, non un elenco di ruoli scritto qui** (7/9). Era
 * `@Roles('admin')`, e la casella «Compensi staff» della pagina Permessi non accendeva niente:
 * Simone l'aveva data in sola vista alla **Responsabile Coach**, lei apriva la pagina e leggeva
 * «Sezione riservata agli amministratori». È il caso esatto che `CLAUDE.md` chiama *«una chiave
 * dichiarata e non letta da nessuno è un interruttore che non accende niente»* — con l'aggravante
 * che l'interruttore c'era, si poteva alzare, e restava buio.
 *
 * ⚠️ Qui il livello lo deduce il metodo: è un `GET`, quindi basta **view**. Non c'è nessuna rotta
 * di scrittura sotto questo controller, quindi «vedere» è tutto quello che questa pagina concede —
 * che è quello che serviva: *«lei deve vederle non modificarle ma vedere»*.
 *
 * ⚠️ E `@Roles` è tolto, non affiancato: con un `@Roles` sotto, `PageGuard` resta permissivo se la
 * lettura della matrice fallisce (vedi il fail-open in `page.guard.ts`). Senza, questo è l'unico
 * cancello e un errore **chiude**.
 *
 * Da §16.8 la riga porta anche il TETTO mensile della persona e se lo ha raggiunto: è la pagina
 * dove un mese «strano» si guarda, ed è il posto in cui la risposta «ha toccato il tetto» deve
 * essere leggibile senza aprire il registro contabile riga per riga.
 */
@Controller('admin/compensation')
@RequirePage('compensation')
export class CompensationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('period') period?: string) {
    let dateFilter: Record<string, unknown> = {};
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      // Il mese di Roma, cioè lo STESSO confine con cui il tetto ha contato queste righe: con
      // `Date.UTC(...)` la pagina che risponde «ha toccato il tetto» sommava un mese spostato di
      // due ore rispetto a quello su cui il tetto aveva deciso.
      dateFilter = { date: confineMese(period) };
    }

    const entries = (await this.prisma.ledgerEntry.findMany({
      where: {
        type: 'expense' as never,
        category: { in: CATEGORIE_COMPENSO },
        staffId: { not: null },
        ...dateFilter,
      },
      select: { staffId: true, amountCents: true, category: true },
    })) as { staffId: string; amountCents: number; category: string }[];

    const agg = new Map<string, { commission: number; compensation: number; total: number }>();
    for (const e of entries) {
      const row = agg.get(e.staffId) ?? { commission: 0, compensation: 0, total: 0 };
      if (e.category === 'sales_commission') row.commission += e.amountCents;
      else row.compensation += e.amountCents;
      row.total += e.amountCents;
      agg.set(e.staffId, row);
    }

    const staff = (await this.prisma.staff.findMany({
      where: { id: { in: Array.from(agg.keys()) } },
      select: { id: true, displayName: true, earningsCapCents: true, user: { select: { role: true } } },
    })) as { id: string; displayName: string; earningsCapCents: number | null; user: { role: string } | null }[];
    const staffMap = new Map(staff.map((s) => [s.id, s]));
    // Il tetto è MENSILE: «raggiunto» ha senso solo mentre si sta guardando un mese. Con il
    // filtro su «Tutto» il totale è di più mesi insieme e confrontarlo col tetto direbbe una
    // bugia — quindi lì non si dice niente.
    const unMeseSolo = !!period && /^\d{4}-\d{2}$/.test(period);

    return Array.from(agg.entries())
      .map(([staffId, v]) => {
        const capCents = tettoAttivoCents(staffMap.get(staffId)?.earningsCapCents);
        return {
          staffId,
          displayName: staffMap.get(staffId)?.displayName ?? '—',
          role: staffMap.get(staffId)?.user?.role ?? '—',
          commissionCents: v.commission,
          compensationCents: v.compensation,
          totalCents: v.total,
          capCents,
          capReached: capCents !== null && unMeseSolo ? v.total >= capCents : null,
        };
      })
      .sort((a, b) => b.totalCents - a.totalCents);
  }
}
