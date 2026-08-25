/**
 * ⛔ **QUANTO È COSTATO IL GIORNO CALCOLATO A MANO** — la misura di quello che il 25/8 è stato
 * corretto, fatta **dopo** la correzione perché racconta il passato: le righe già scritte restano
 * come sono, e questa dice quante sono e chi sono.
 *
 * Il difetto: tredici punti si costruivano «oggi» o «questo mese» nel fuso del **processo**. Su
 * Render `TZ` non è impostata, quindi il processo sta a UTC, e fra la **mezzanotte e le 02:00**
 * italiane (l'01:00 d'inverno) il giorno UTC è ancora ieri. Le domande, in ordine di danno:
 *
 *  1. ⛔ **Il peso di partenza archiviato al giorno prima.** Chi finiva il questionario in quella
 *     fascia si vedeva scrivere la prima misura con la data di ieri. E `measurement` ha la chiave
 *     unica `(cliente, data)` scritta in `upsert … update: {}`: se per il giorno prima una misura
 *     esisteva già, **il peso dichiarato è sparito in silenzio**. Qui si guardano tutte e due: le
 *     misure sulla data sbagliata, e quelle in cui il peso è andato perso.
 *  2. **Le registrazioni contate nel mese sbagliato**: chi si è iscritto nella prima ora del mese
 *     (le prime due d'estate) risultava del mese precedente in «Nuovi questo mese» e nell'analitica.
 *  3. **Gli incassi contati nel mese sbagliato**: stessa fascia, sulla dashboard commerciale.
 *
 * ⚠️ **Zero non è «non è mai successo»**: è «non è successo alle persone che ci sono adesso». Le
 * righe cancellate non ci sono più, e il conto guarda quello che è rimasto.
 *
 * ⚠️ Sola lettura, non tocca niente. `npm run diag:giorno-a-mano`.
 */
import { PrismaClient } from '@prisma/client';
import { FUSO, giornoLocale, meseLocale } from '../src/common/date-only';

const giornoUtc = (d: Date): string => d.toISOString().slice(0, 10);
const meseUtc = (d: Date): string => d.toISOString().slice(0, 7);

type Cliente = { id: string; email: string; createdAt: Date; clientProfile: { name: string | null; onboardingCompletedAt: Date | null } | null };

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(`\nFuso dell'azienda: ${FUSO} · fuso del processo: ${process.env.TZ || '(non impostato → UTC)'}\n`);

    const clienti = (await prisma.user.findMany({
      where: { role: 'client' as never },
      select: {
        id: true,
        email: true,
        createdAt: true,
        clientProfile: { select: { name: true, onboardingCompletedAt: true } },
      },
    })) as Cliente[];

    const nomeDi = new Map(clienti.map((c) => [c.id, c.clientProfile?.name ?? c.email]));

    // ---------- 1) Il peso di partenza ----------
    /**
     * ⚠️ Il questionario scriveva la misura con il giorno **UTC** di `onboardingCompletedAt`. Se
     * quell'istante cade nella fascia, il giorno scritto è diverso da quello che la cliente ha
     * vissuto: si guarda se la misura esiste sul giorno UTC (sbagliato) invece che su quello di Roma.
     */
    const nellaFascia = clienti.filter(
      (c) => c.clientProfile?.onboardingCompletedAt && giornoUtc(c.clientProfile.onboardingCompletedAt) !== giornoLocale(c.clientProfile.onboardingCompletedAt),
    );

    console.log(`1) PESO DI PARTENZA`);
    console.log(`   Clienti con questionario completato nella fascia ambigua: ${nellaFascia.length} su ${clienti.length}`);

    let suDataSbagliata = 0;
    let pesoPerso = 0;
    for (const c of nellaFascia) {
      const fatto = c.clientProfile!.onboardingCompletedAt!;
      const giornoScritto = new Date(`${giornoUtc(fatto)}T00:00:00.000Z`);
      const giornoVero = new Date(`${giornoLocale(fatto)}T00:00:00.000Z`);
      const misure = (await prisma.measurement.findMany({
        where: { clientId: c.id, date: { in: [giornoScritto, giornoVero] } },
        select: { date: true, weightKg: true, createdAt: true },
      })) as { date: Date; weightKg: number | null; createdAt: Date }[];
      const sulSbagliato = misure.find((m) => m.date.getTime() === giornoScritto.getTime());
      if (sulSbagliato) {
        suDataSbagliata++;
        /**
         * ⛔ Il caso peggiore: la misura su quel giorno c'era **già prima** del questionario. Con
         * `update: {}` la scrittura non ha fatto niente e il peso dichiarato non è mai entrato.
         * Si riconosce dal fatto che la misura è più vecchia del questionario.
         */
        if (sulSbagliato.createdAt < fatto) pesoPerso++;
        console.log(
          `   · ${nomeDi.get(c.id)} · questionario ${fatto.toISOString()} → misura sul ${giornoUtc(fatto)}` +
            ` (a Roma era il ${giornoLocale(fatto)}) · ${sulSbagliato.weightKg ?? '—'} kg` +
            (sulSbagliato.createdAt < fatto ? '  ⛔ misura preesistente: il peso dichiarato NON è entrato' : ''),
        );
      }
    }
    if (!nellaFascia.length) {
      console.log('   → nessuna cliente ha finito il questionario in quella fascia: niente da rimediare.');
    } else {
      console.log(`   Misure archiviate al giorno sbagliato: ${suDataSbagliata}`);
      console.log(`   ⛔ Pesi dichiarati PERSI (misura già presente su quel giorno): ${pesoPerso}`);
    }

    // ---------- 2) Le registrazioni nel mese sbagliato ----------
    const meseStorto = clienti.filter((c) => meseUtc(c.createdAt) !== meseLocale(c.createdAt));
    console.log(`\n2) «NUOVI QUESTO MESE» — clienti contati nel mese sbagliato: ${meseStorto.length}`);
    for (const c of meseStorto) {
      console.log(`   · ${nomeDi.get(c.id)} · iscritta ${c.createdAt.toISOString()} → contata in ${meseUtc(c.createdAt)}, era ${meseLocale(c.createdAt)}`);
    }
    if (!meseStorto.length) console.log('   → nessuna: nessun contatore mensile è stato spostato da una registrazione.');

    // ---------- 3) Gli incassi nel mese sbagliato ----------
    const incassi = (await prisma.ledgerEntry.findMany({
      where: { type: 'income' as never },
      select: { id: true, date: true, amountCents: true },
    })) as { id: string; date: Date; amountCents: number }[];
    const incassiStorti = incassi.filter((e) => meseUtc(e.date) !== meseLocale(e.date));
    const totale = incassiStorti.reduce((a, e) => a + e.amountCents, 0);
    console.log(`\n3) INCASSO DEL MESE (dashboard commerciale) — righe nel mese sbagliato: ${incassiStorti.length} su ${incassi.length}`);
    for (const e of incassiStorti) {
      console.log(`   · ${e.date.toISOString()} · ${(e.amountCents / 100).toFixed(2)} € → contata in ${meseUtc(e.date)}, era ${meseLocale(e.date)}`);
    }
    if (incassiStorti.length) console.log(`   Totale spostato: ${(totale / 100).toFixed(2)} €`);
    else console.log('   → nessuna: gli incassi cadono tutti dentro il mese in cui sono stati fatti.');

    console.log('\n--- fine. Niente è stato modificato. ---\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
