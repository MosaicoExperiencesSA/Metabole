/**
 * LE DATE DEI PIANI STANNO NELLA FASCIA AMBIGUA? — la misura da fare prima di decidere.
 *
 * Il 20/8 «che giorno è oggi» è passato al fuso di Roma anche nel sottosistema dei piani: all'una
 * di notte del giorno in cui un percorso comincia, adesso il percorso è cominciato. ⛔ Ma c'è una
 * metà che **non** è stata toccata, di proposito: il giorno di una data **salvata** si continua a
 * leggere in UTC.
 *
 * La ragione è che `Subscription.startDate` non è una colonna DATE ma un `DateTime`: in banca dati
 * ci sono istanti veri, scritti da punti diversi in momenti diversi. Rileggerli nel fuso di Roma
 * sposterebbe di un giorno **tutte le righe che cadono fra le 22:00 e le 24:00 UTC** — cioè una
 * data d'inizio o di fine che si muove da sola su un contratto già pagato. Prima di fare una cosa
 * del genere si guarda quante sono.
 *
 * Le tre domande, in ordine:
 *
 *  1. **quante righe hanno un orario diverso da mezzanotte?** Se sono zero, tutte le date passano
 *    da `toDateOnly` e la questione è chiusa: leggerle in un fuso o nell'altro dà lo stesso giorno;
 *  2. **quante stanno nella fascia** in cui il giorno UTC e quello di Roma non coincidono? Sono le
 *    uniche che si sposterebbero;
 *  3. **chi sono**, con nome e date, perché se sono tre si guardano a mano in cinque minuti.
 *
 * ⚠️ Sola lettura, non tocca niente. `npm run diag:giorno-piani`.
 */
import { PrismaClient } from '@prisma/client';
import { giornoLocale } from '../src/common/date-only';

const giornoUtc = (d: Date): string => d.toISOString().slice(0, 10);
const oraUtc = (d: Date): string => d.toISOString().slice(11, 16);

type Riga = {
  id: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  client: { email: string; clientProfile: { name: string | null } | null } | null;
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const righe = (await prisma.subscription.findMany({
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        client: { select: { email: true, clientProfile: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })) as Riga[];

    const date: { riga: Riga; campo: 'inizio' | 'fine'; d: Date }[] = [];
    for (const r of righe) {
      if (r.startDate) date.push({ riga: r, campo: 'inizio', d: r.startDate });
      if (r.endDate) date.push({ riga: r, campo: 'fine', d: r.endDate });
    }

    const conOrario = date.filter((x) => oraUtc(x.d) !== '00:00');
    const spostate = date.filter((x) => giornoLocale(x.d) !== giornoUtc(x.d));

    console.log(`\nAbbonamenti letti: ${righe.length} · date guardate: ${date.length}\n`);
    console.log(`1) Date con un orario diverso da mezzanotte UTC: ${conOrario.length}`);
    if (!conOrario.length) {
      console.log('   → tutte passano da `toDateOnly`. Leggerle in UTC o a Roma dà lo stesso giorno:');
      console.log('     la seconda metà del difetto non esiste, e il punto si può chiudere.');
    }

    console.log(`\n2) Date che cambierebbero GIORNO leggendole a Roma: ${spostate.length}`);
    if (!spostate.length) {
      console.log('   → nessuna riga si sposterebbe. Nessun contratto pagato cambia data.');
    } else {
      console.log('   ⚠️ Queste sì, e vanno guardate una per una prima di toccare il codice:\n');
      for (const x of spostate) {
        const chi = x.riga.client?.clientProfile?.name ?? x.riga.client?.email ?? '—';
        console.log(
          `   ${chi} · ${x.riga.status} · ${x.campo}: ${x.d.toISOString()}` +
            `  → a UTC ${giornoUtc(x.d)}, a Roma ${giornoLocale(x.d)}`,
        );
      }
    }

    // Utile anche solo per capire come vengono scritte: gli orari più frequenti.
    if (conOrario.length) {
      const conta = new Map<string, number>();
      for (const x of conOrario) conta.set(oraUtc(x.d), (conta.get(oraUtc(x.d)) ?? 0) + 1);
      const top = [...conta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      console.log('\n3) Gli orari che si ripetono (dicono da quale punto vengono scritte):');
      for (const [ora, n] of top) console.log(`   ${ora} UTC — ${n} date`);
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
