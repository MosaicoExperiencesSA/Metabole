/**
 * DIAGNOSTICA: **chi si rompe se sposta l'orologio.**
 *
 * Nasce da una revisione del 21/8, e risponde a una domanda che nessuno script sapeva fare.
 *
 * ## La domanda, e perché `diag:digiuni` non la copre
 *
 * `diag:digiuni` guarda la finestra che ogni cliente ha **adesso**: incrocia i pasti promessi con
 * quelli che il catalogo servito sa comporre, e le divide in rotte e sane. È giusto e serve. Ma da
 * quando c'è l'orologio, la finestra non è più un dato fermo: **la sposta la cliente, dall'app, con
 * un tocco, senza permesso e senza revisione**. Una cliente «sana» oggi può rompersi domattina
 * scegliendo un altro protocollo, e nessuno se ne accorgerebbe finché non lo racconta lei.
 *
 * Questo script simula **tutti e cinque i protocolli** su ogni cliente in digiuno e dice, per
 * ciascuna, quali scelte il catalogo sa servire e quali no. Non scrive niente.
 *
 * ## ⚠️ Non ricalcola niente a mano
 *
 * Usa le stesse funzioni del motore — `derivaDaOrologio`, `strutturaChiesta`, `pickDietFor`,
 * `pastiPromessiCheMancano` — perché una diagnostica che risponde diversamente dal codice manda a
 * cercare il difetto dove non c'è. È già successo due volte su «perché non riceve il menu?».
 *
 * ⚠️ L'ora di apertura **non cambia la risposta**: la Regola d'Oro dice che è la *durata* a decidere
 * quanti pasti, e c'è un test che lo verifica su tutte e 96 le posizioni della giornata. Qui si
 * simula a partire dall'orario che la cliente ha (o da mezzogiorno se non l'ha ancora impostato),
 * e la risposta vale per qualunque orario scelga.
 *
 * ## Cosa NON dice
 *
 * ⚠️ Guarda **i pasti**, non le calorie. Un protocollo può avere tutti i pasti in catalogo e restare
 * corto di kcal — è il caso della 23:1, che con le quote {pranzo .45, merenda .10, cena .45} arriva
 * al 45% del fabbisogno e servirebbe un moltiplicatore ×2,22 contro un tetto di ×1,8. Quella
 * domanda la fa `npm run diag:kcal`, e la terza condizione di verifica del §3 (`restaCorta`) non la
 * calcola ancora nessuno: sta a backlog, dichiarata mancante invece che data per coperta.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:orologio
 */
import { PrismaClient } from '@prisma/client';
import { PROTOCOLLI_DIGIUNO, derivaDaOrologio } from '../src/menu/orologio-digiuno';
import { pastiPromessiCheMancano, pastiPromessiDallaFinestra } from '../src/catalog/struttura-per-digiuno';
import { pickDietFor, strutturaChiesta } from '../src/catalog/pick-diet';
import { NOME_PASTO } from '../src/catalog/giornate-complete';

const prisma = new PrismaClient();

/** ⚠️ Mezzogiorno quando non ha ancora scelto: la posizione non cambia quanti pasti riceve. */
const APERTURA_DI_SCORTA = 12 * 60;

type DietaTrovata = {
  id: string; name: string; style: string | null; regime: string | null;
  mealsPerDay: number; fasting: boolean;
};

const SELECT: Record<string, boolean> = {
  id: true, name: true, style: true, regime: true, mealsPerDay: true, fasting: true,
};

async function main() {
  const profili = await prisma.clientProfile.findMany({
    where: { pathType: 'intermittent_fasting' } as never,
    select: {
      userId: true, name: true, regime: true, dietStyle: true, dietFamily: true,
      mealsPerDay: true, objective: true, pathType: true,
      fastingWindow: true, fastingProtocol: true, fastingStartMin: true,
      user: { select: { email: true } },
    } as never,
  }) as unknown as {
    userId: string; name: string | null; regime: string | null; dietStyle: string | null;
    dietFamily: string | null; mealsPerDay: number | null; objective: string | null;
    pathType: string | null; fastingWindow: string | null; fastingProtocol: string | null;
    fastingStartMin: number | null; user: { email: string } | null;
  }[];

  console.log(`\n${'='.repeat(78)}`);
  console.log('CHI SI ROMPE SE SPOSTA L\'OROLOGIO — simulazione dei cinque protocolli');
  console.log('='.repeat(78));
  console.log(`\nClienti in digiuno intermittente: ${profili.length}\n`);
  if (profili.length === 0) {
    console.log('Nessuna. Niente da simulare.');
    return;
  }

  /** Quante clienti hanno almeno un protocollo scoperto, e quali protocolli sono i colpevoli. */
  let esposte = 0;
  const perProtocollo = new Map<string, number>();
  /** Le famiglie a cui manca una variante, con quante clienti ne dipendono. */
  const famiglieDaRiempire = new Map<string, Set<string>>();

  for (const p of profili) {
    const chi = p.name || p.user?.email || p.userId;
    const apertura = typeof p.fastingStartMin === 'number' ? p.fastingStartMin : APERTURA_DI_SCORTA;
    const righe: string[] = [];
    let scoperti = 0;

    for (const proto of PROTOCOLLI_DIGIUNO) {
      /**
       * ⚠️ **`derivata?.fastingWindow`, non `derivata`** (revisione, 21/8). `derivaDaOrologio` può
       * tornare un oggetto valido con `fastingWindow: undefined` — le soglie che decidono quanti
       * pasti sono configurabili e dichiarate provvisorie. Con la sola guardia sull'oggetto, quel
       * caso proseguiva e tutto a valle lo leggeva come «nessuna finestra»: pasti promessi 5,
       * nessuno mancante, e la riga usciva **«✅ ok»** — cioè il caso non derivabile travestito da
       * caso sano, l'opposto di quello che questo script esiste per dire.
       */
      const derivata = derivaDaOrologio(apertura, proto.valore);
      if (!derivata?.fastingWindow) { righe.push(`   ${proto.valore.padEnd(6)} ⛔ non derivabile: il catalogo non c'entra, guarda le soglie dei pasti`); continue; }
      const finestra = derivata.fastingWindow;
      const promessi = pastiPromessiDallaFinestra(finestra);

      const profiloSimulato = {
        regime: p.regime, dietStyle: p.dietStyle, dietFamily: p.dietFamily,
        mealsPerDay: p.mealsPerDay, objective: p.objective,
        pathType: 'intermittent_fasting', fastingWindow: finestra,
      };
      const servita = await pickDietFor<DietaTrovata>(
        (where) => prisma.diet.findFirst({ where: where as never, orderBy: { approvedAt: 'desc' }, select: SELECT as never }) as unknown as Promise<DietaTrovata | null>,
        profiloSimulato,
      );

      const struttura = strutturaChiesta(profiloSimulato);
      const mancanti = servita
        ? pastiPromessiCheMancano('intermittent_fasting', finestra, { mealsPerDay: servita.mealsPerDay, fasting: servita.fasting })
        : promessi;

      // ⚠️ Tre esiti diversi, e si scrivono diversi: nessuna dieta, dieta di un'ALTRA famiglia
      // (che non lascia nessuna traccia da nessuna parte), pasti mancanti.
      const altraFamiglia = !!(servita && p.dietFamily && servita.name !== p.dietFamily);
      const segno = !servita ? '⛔' : mancanti.length ? '⛔' : altraFamiglia ? '⚠️ ' : '✅';
      if (!servita || mancanti.length) {
        scoperti += 1;
        perProtocollo.set(proto.valore, (perProtocollo.get(proto.valore) ?? 0) + 1);
        const chiave = `${p.dietFamily ?? '—'} · ${p.regime ?? '—'} · ${p.objective ?? 'dimagrimento'} → serve ${JSON.stringify(struttura)}`;
        if (!famiglieDaRiempire.has(chiave)) famiglieDaRiempire.set(chiave, new Set());
        famiglieDaRiempire.get(chiave)!.add(chi);
      }
      const dettaglio = !servita
        ? 'NESSUNA dieta servibile'
        : mancanti.length
          ? `mancano: ${mancanti.map((s) => NOME_PASTO[s] ?? s).join(', ')}  (servita: ${servita.name}, ${servita.mealsPerDay} pasti${servita.fasting ? ', digiuno' : ''})`
          : altraFamiglia
            ? `servita da un'ALTRA famiglia: ${servita.name}`
            : `ok (${servita.name})`;
      righe.push(`   ${proto.valore.padEnd(6)} ${segno} ${promessi.length} past${promessi.length === 1 ? 'o' : 'i'} · ${dettaglio}`);
    }

    if (scoperti) esposte += 1;
    const stato = scoperti === 0 ? '✅ tutti e cinque i protocolli serviti' : `⛔ ${scoperti} protocoll${scoperti === 1 ? 'o' : 'i'} su 5 scopert${scoperti === 1 ? 'o' : 'i'}`;
    console.log(`── ${chi}  (${p.dietFamily ?? 'nessuna famiglia'} · ${p.regime ?? '—'})`);
    console.log(`   adesso: ${p.fastingProtocol ?? 'non ha ancora scelto'}${p.fastingWindow ? ` → ${p.fastingWindow}` : ''}`);
    console.log(`   ${stato}`);
    righe.forEach((r) => console.log(r));
    console.log('');
  }

  console.log('='.repeat(78));
  console.log(`RIEPILOGO: ${esposte} client${esposte === 1 ? 'e' : 'i'} su ${profili.length} ha almeno un protocollo scoperto.`);
  if (perProtocollo.size) {
    console.log('\nProtocolli che rompono, e quante clienti:');
    for (const proto of PROTOCOLLI_DIGIUNO) {
      const n = perProtocollo.get(proto.valore);
      if (n) console.log(`   ${proto.valore.padEnd(6)} ${n}`);
    }
  }
  if (famiglieDaRiempire.size) {
    console.log('\nVarianti da generare (famiglia · regime · obiettivo → struttura), con le clienti che ne dipendono:');
    for (const [chiave, chi] of famiglieDaRiempire) {
      console.log(`   • ${chiave}`);
      console.log(`     ${[...chi].join(', ')}`);
    }
    console.log('\n⚠️ La generazione della struttura «5 pasti» per una famiglia di digiuno è oggi');
    console.log('   BLOCCATA dal backoffice (CreazioneValidazione: le strutture 3 e 5 sono disabilitate');
    console.log('   quando il nome contiene «digiuno»). Finché quel blocco c\'è, il rimedio non è');
    console.log('   raggiungibile da nessuna schermata.');
  }
  console.log('\n⚠️ Questo script guarda i PASTI, non le calorie: per quelle, `npm run diag:kcal`.\n');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
