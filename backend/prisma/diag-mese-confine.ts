/**
 * IL CONFINE DEL MESE HA GIÀ COSTATO SOLDI A QUALCUNO? — la misura, non l'ipotesi.
 *
 * Fino al 20/8 la parte economica prendeva il mese e il giorno nel fuso del **server** (su Render
 * UTC), non in quello di Roma. Fra mezzanotte e le 02:00 del primo del mese, a Roma è mese nuovo e
 * per il server no. Il difetto è chiuso; questa diagnostica risponde alla domanda che resta:
 * **quante righe sono nate in quella fascia, e a qualcuno è già costato qualcosa?**
 *
 * Tre domande, in quest'ordine di importanza:
 *
 *  1. ⚠️ **Il tetto di guadagno ha tagliato qualcosa vicino a un confine di mese?** È il caso che
 *     costa davvero: l'eccedenza sopra il tetto **si perde** per decisione esplicita, e una
 *     provvigione contata nel mese sbagliato può essere stata tagliata da un tetto già pieno che
 *     non era il suo. Si legge dall'audit (`provvigione.tetto_mensile`), l'unico posto dove un
 *     taglio lascia traccia — a registro non c'è nessuna riga da guardare.
 *  2. **Quante provvigioni stanno nella fascia spostata?** Sono le righe per cui il mese di Roma e
 *     il mese UTC non coincidono: quelle scritte sotto il periodo precedente.
 *  3. **Il compenso aggregato di quelle righe sta sotto il periodo giusto?** Se sta sotto il
 *     vecchio, uno storno futuro non lo troverebbe (ora almeno lo scrive nel log).
 *
 * ⚠️ Sola lettura, non tocca niente. `npm run diag:mese-confine`.
 */
import { PrismaClient } from '@prisma/client';
import { meseLocale, giornoLocale } from '../src/common/date-only';
import { CATEGORIE_COMPENSO, euroCents } from '../src/common/tetto-compensi';

const meseUtc = (d: Date): string => d.toISOString().slice(0, 7);
const giornoUtc = (d: Date): string => d.toISOString().slice(0, 10);

type Riga = { id: string; date: Date; amountCents: number; staffId: string | null; category: string; ref: string | null };
type Taglio = { createdAt: Date; entityId: string | null; metadata: unknown };

async function main() {
  const prisma = new PrismaClient();
  try {
    // ---- 1) I tagli del tetto, tutti, con evidenza di quelli sul confine.
    const tagli = (await prisma.auditLog.findMany({
      where: { action: 'provvigione.tetto_mensile' },
      select: { createdAt: true, entityId: true, metadata: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })) as Taglio[];

    console.log('\n=== 1) TAGLI DEL TETTO DI GUADAGNO ===');
    if (!tagli.length) {
      console.log('Nessun taglio: il tetto non ha mai morso. La domanda che costa soldi è chiusa.');
    } else {
      let sulConfine = 0;
      for (const t of tagli) {
        const m = (t.metadata ?? {}) as Record<string, unknown>;
        const spostato = meseLocale(t.createdAt) !== meseUtc(t.createdAt);
        if (spostato) sulConfine++;
        console.log(
          `${spostato ? '⚠️  ' : '    '}${t.createdAt.toISOString()}  staff=${t.entityId}  ` +
            `dovuto=${euroCents(Number(m.dovutoCents ?? 0))} erogato=${euroCents(Number(m.erogatoCents ?? 0))} ` +
            `perso=${euroCents(Number(m.tagliatoCents ?? 0))} ref=${String(m.ref ?? '—')}` +
            (spostato ? `  ← contato in ${meseUtc(t.createdAt)} ma a Roma era ${meseLocale(t.createdAt)}` : ''),
        );
      }
      console.log(`\nTotale tagli: ${tagli.length}. Sul confine (mese sbagliato): ${sulConfine}.`);
      if (sulConfine > 0) {
        console.log(
          '⚠️  Quelli marcati vanno riletti a mano: se il mese giusto era quello nuovo, il tetto\n' +
            '    era vuoto e l\'importo NON andava tagliato. Si recupera con «Ricalcola provvigioni»\n' +
            '    sul pagamento indicato da `ref`.',
        );
      }
    }

    // ---- 2) Le provvigioni nate nella fascia spostata.
    const righe = (await prisma.ledgerEntry.findMany({
      where: { type: 'expense' as never, category: { in: CATEGORIE_COMPENSO }, staffId: { not: null } },
      select: { id: true, date: true, amountCents: true, staffId: true, category: true, ref: true },
      orderBy: { date: 'desc' },
    })) as Riga[];
    const spostate = righe.filter((r) => meseLocale(r.date) !== meseUtc(r.date));

    console.log(`\n=== 2) PROVVIGIONI NELLA FASCIA SPOSTATA ===`);
    console.log(`Righe di compenso in tutto: ${righe.length}. Nella fascia: ${spostate.length}.`);
    if (!spostate.length) {
      console.log('Nessuna: nessuna riga è mai stata scritta fra mezzanotte e le 02:00 del primo.');
    }

    // ---- 3) Sotto che periodo sta il compenso aggregato di quelle righe.
    for (const r of spostate) {
      const roma = meseLocale(r.date);
      const utc = meseUtc(r.date);
      const [aRoma, aUtc] = await Promise.all([
        prisma.staffCompensation.findUnique({ where: { staffId_period: { staffId: r.staffId as string, period: roma } }, select: { amountCents: true } }),
        prisma.staffCompensation.findUnique({ where: { staffId_period: { staffId: r.staffId as string, period: utc } }, select: { amountCents: true } }),
      ]);
      console.log(
        `  ${r.date.toISOString()}  ${euroCents(r.amountCents)}  staff=${r.staffId}  ` +
          `giorno a Roma=${giornoLocale(r.date)} / a UTC=${giornoUtc(r.date)}  ` +
          `compenso: ${roma}=${aRoma ? euroCents(aRoma.amountCents) : 'assente'} · ${utc}=${aUtc ? euroCents(aUtc.amountCents) : 'assente'}`,
      );
    }

    console.log('\n--- fine. Niente è stato modificato. ---\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
