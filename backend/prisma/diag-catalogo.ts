/**
 * DIAGNOSTICA: **il generatore di ricette sta lavorando?** — sola lettura.
 *
 * Nasce da una domanda di Simone del 18/8: «ieri avevamo montato un generatore di ricette
 * automatico, come facciamo a sapere se sta lavorando?».
 *
 * ## ⚠️ Perché non bastava guardare il registro
 *
 * Il generatore lasciava una riga (`engine_rule.preset.generate_catalog`) **solo quando riusciva a
 * scrivere qualcosa**. I tre motivi per cui un giro può finire a mani vuote avevano quindi lo stesso
 * aspetto — nessuna riga:
 *
 *   1. il catalogo è completo → tutto bene;
 *   2. l'AI è fuori uso o il credito è finito → si riproverà, o non si riproverà mai più;
 *   3. ⚠️ **il cron su Render è spento, o non è mai stato creato** → non gira, e non lo dice nessuno.
 *
 * Dal 18/8 ogni giro scrive un **battito** (`cron.genera_catalogo`) qualunque cosa sia successo.
 * Questa diagnostica legge quello. ⚠️ E se di battiti non ne trova **nessuno**, lo dice a chiare
 * lettere invece di stampare zeri: «nessun battito» e «tutto a posto» non devono somigliarsi.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:catalogo            → l'ultima settimana
 *   GIORNI=30 npm run diag:catalogo  → una finestra più larga
 *
 * ⚠️ Non scrive niente e non genera niente: risponde e basta.
 */
import { PrismaClient } from '@prisma/client';
import { EngineRulesService } from '../src/engine-rules/engine-rules.service';
import { SETTIMANE_OBIETTIVO, quantoManca } from '../src/engine-rules/prossima-generazione';

const prisma = new PrismaClient();

/** Il servizio vero, con gli stub per quello che qui non serve: `statoVarianti` legge e basta.
 *  ⚠️ Si riusa il servizio invece di ricopiare il conto delle settimane: due punti che rispondono
 *  alla stessa domanda prima o poi divergono, e il giorno che divergono questa pagina direbbe che
 *  manca poco mentre il generatore continua a lavorare. */
const servizio = new EngineRulesService(
  prisma as never,
  { getNumber: async (_k: string, d?: number) => d, getBool: async (_k: string, d?: boolean) => d } as never,
  { log: async () => undefined } as never,
  { generateJson: async () => null } as never,
  { computeTargetKcal: async () => null } as never,
);

const iso = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

async function main(): Promise<void> {
  const giorni = Math.max(1, Number(process.env.GIORNI ?? 7) || 7);
  const da = new Date(Date.now() - giorni * 86_400_000);

  console.log('');
  console.log('==================================================================');
  console.log('  GENERATORE DI CATALOGO — sta lavorando?');
  console.log(`  Finestra: ultimi ${giorni} giorni.`);
  console.log('==================================================================');

  // ---------- 1. I BATTITI ----------
  const battiti = (await prisma.auditLog.findMany({
    where: { action: 'cron.genera_catalogo' } as never,
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { createdAt: true, metadata: true },
  })) as { createdAt: Date; metadata: unknown }[];

  console.log('\n── 1. I GIRI DEL CRON');
  if (!battiti.length) {
    /**
     * ⚠️ La riga più importante di tutto lo script. Nessun battito non vuol dire «non ha avuto
     * niente da fare»: vuol dire che **il cron non è mai partito** — oppure che sta girando una
     * versione del codice precedente al 18/8, che i battiti non li scriveva.
     */
    console.log('   ⚠️  NESSUN BATTITO TROVATO.');
    console.log('   Vuol dire una di queste due cose, e vanno guardate in questo ordine:');
    console.log('     a) su Render il cron `genera-catalogo` non esiste o è spento → è il caso più probabile;');
    console.log('     b) è in produzione una versione precedente al 18/8, che i battiti non li scriveva.');
    console.log('   ⚠️  NON vuol dire che il catalogo è a posto: quello si legge al punto 2.');
  } else {
    const ultimo = battiti[0];
    const oreFa = (Date.now() - ultimo.createdAt.getTime()) / 3_600_000;
    const m = (ultimo.metadata ?? {}) as Record<string, unknown>;
    console.log(`   Ultimo giro: ${iso(ultimo.createdAt)} (${oreFa < 1 ? 'meno di un\'ora fa' : `${Math.round(oreFa)} ore fa`})`);
    console.log(`   Esito: ${m.ok === false ? `⚠️ ERRORE — ${String(m.errore ?? 'senza messaggio')}` : m.fatto ? `generata ${String(m.variante ?? '?')}, settimana ${String(m.settimana ?? '?')}` : `niente da fare — ${String(m.motivo ?? 'senza motivo')}`}`);
    if (oreFa > 36) console.log('   ⚠️  Più di 36 ore dall\'ultimo giro: se il cron è giornaliero, ne ha saltato almeno uno.');

    const nellaFinestra = battiti.filter((b) => b.createdAt >= da);
    const conErrore = nellaFinestra.filter((b) => ((b.metadata ?? {}) as Record<string, unknown>).ok === false);
    const conLavoro = nellaFinestra.filter((b) => ((b.metadata ?? {}) as Record<string, unknown>).fatto === true);
    console.log(`   Nei ${giorni} giorni: ${nellaFinestra.length} giri · ${conLavoro.length} hanno generato · ${conErrore.length} in errore`);
    if (conErrore.length) {
      console.log('   ⚠️  Errori più recenti:');
      for (const b of conErrore.slice(0, 3)) {
        console.log(`      ${iso(b.createdAt)}  ${String(((b.metadata ?? {}) as Record<string, unknown>).errore ?? '')}`.slice(0, 160));
      }
    }
  }

  // ---------- 2. QUANTO MANCA ----------
  console.log('\n── 2. QUANTO MANCA AL CATALOGO COMPLETO');
  const varianti = await servizio.statoVarianti();
  const restano = quantoManca(varianti, SETTIMANE_OBIETTIVO);
  if (!varianti.length) {
    console.log('   ⚠️  Nessuna variante trovata: senza preset il generatore non ha niente da riempire.');
  } else {
    console.log(`   ${'variante'.padEnd(42)} ${'sett.'.padStart(6)} ${'magra'.padStart(6)} ${'clienti'.padStart(8)}`);
    for (const v of [...varianti].sort((a, b) => b.clientiGruppo - a.clientiGruppo)) {
      const sett = `${v.settimaneFatte}/${SETTIMANE_OBIETTIVO}`;
      console.log(
        `   ${v.etichetta.slice(0, 42).padEnd(42)} ${sett.padStart(6)} ${String(v.primaSettimanaMagra ?? '—').padStart(6)} ${String(v.clientiGruppo).padStart(8)}`,
      );
    }
    console.log(`\n   Unità di lavoro rimaste: ${restano}` + (restano === 0 ? ' → catalogo completo.' : ' (una per giro, quindi altrettante notti).'));
  }

  // ---------- 3. LE RICETTE NATE DAVVERO ----------
  console.log('\n── 3. RICETTE NATE NELLA FINESTRA');
  const nate = await prisma.recipe.count({ where: { createdAt: { gte: da } } as never });
  const daConfermare = await prisma.recipe.count({ where: { createdAt: { gte: da }, allergensReviewed: false } as never });
  console.log(`   ${nate} ricette nuove negli ultimi ${giorni} giorni.`);
  if (nate > 0) {
    // ⚠️ Le ricette nuove nascono con gli allergeni NON confermati: finché non lo sono, non
    // entrano nelle diete. Un catalogo che cresce e una coda che non si smaltisce è un catalogo
    // che cresce e non serve a nessuno.
    console.log(`   Di queste, ${daConfermare} aspettano la conferma degli allergeni${daConfermare ? ' → pagina «Allergeni ricette»' : ''}.`);
  } else if (battiti.length) {
    console.log('   ⚠️  Il cron gira ma non nasce niente: guarda l\'esito dei giri al punto 1.');
  }

  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log('  Nessuna scrittura: questa diagnostica legge e basta.');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
