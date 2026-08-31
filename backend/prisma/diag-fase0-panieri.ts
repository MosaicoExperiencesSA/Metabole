/**
 * DIAGNOSTICA: **la misura della Fase 0 del piano panieri** — sola lettura.
 *
 * `progetto/PIANO_Panieri_Ricette.md` §9 dice che prima di aprire la Fase 1 servono due numeri
 * bloccanti. Uno è la firma del capo nutrizionista (arrivata il 31/8). L'altro è **questo**:
 * piatti / attivi / rotti per ogni variante e per ogni pasto.
 *
 * ⚠️ Il piano è esplicito sull'uscita: *«se "attivi" ≥ 60 per pasto su tutte le celle, si procede
 * senza cambiare niente»*. Quindi questo script non stampa una tabella e basta: dice **sì o no**, e
 * quando è no dice quali celle e quante clienti ci stanno sopra.
 *
 * ⛔ **NON SCRIVE NIENTE.**
 *
 * ## Perché non basta `diag:settimane`
 *
 * Quello conta i `recipeId` **nominati dalle giornate**. Non dice se quelle ricette sono ancora
 * **attive**, né se esistono ancora. «84» è il massimo, non l'utile — è il §2.4 del piano.
 *
 * ⚠️ E il §2.4 dichiara un difetto che questo tabulato misura di striscio: **l'erogazione non
 * controlla `active`**, la base personale sì. Cioè una ricetta in bozza, ancora nominata da una
 * giornata, viene servita da una porta e rifiutata dall'altra. Il divario piatti−attivi qui sotto è
 * quanto vale quel difetto oggi.
 *
 * ⚠️ Le regole non si riscrivono qui: `coperturaCatalogo`, `slotAttesi` e `statoCopertura` sono le
 * stesse che disegnano la pagina «Copertura catalogo» del backoffice. Una seconda copia direbbe
 * un'altra cosa, e a decidere sarebbe quella sbagliata.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:fase0                  → tutte le varianti, verdetto sulla soglia del piano
 *   SOGLIA=60 npm run diag:fase0        → cambia la soglia (default 60, quella del piano)
 *   ESEMPI=40 npm run diag:fase0        → più righe negli elenchi (default 20)
 *   SETTIMANA=3 npm run diag:fase0      → guarda una settimana sola
 */
import { PrismaClient } from '@prisma/client';
import { coperturaCatalogo } from '../src/engine-rules/copertura-catalogo';
import { primaQuelleConClienti, verdettoFase0 } from '../src/engine-rules/misura-fase0';

const prisma = new PrismaClient();

const SOGLIA = Math.max(0, Number(process.env.SOGLIA ?? 60) || 60);
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 20) || 20);
const SETTIMANA = Number(process.env.SETTIMANA ?? '') || null;

const NOME_SLOT: Record<string, string> = {
  breakfast: 'colazione', morning_snack: 'spuntino', lunch: 'pranzo',
  afternoon_snack: 'merenda', dinner: 'cena',
};

const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  riga('');
  riga('==================================================================');
  riga('  FASE 0 — la misura che manca prima di aprire la Fase 1');
  riga(`  Sola lettura. Soglia del piano: ${SOGLIA} piatti ATTIVI per pasto.`);
  if (SETTIMANA) riga(`  Finestra: solo la settimana ${SETTIMANA}.`);
  riga('==================================================================');

  const [diete, copertura, clienti, ricette] = await Promise.all([
    prisma.diet.findMany({
      select: {
        id: true, name: true, style: true, regime: true, objective: true,
        mealsPerDay: true, fasting: true, status: true,
      },
      orderBy: [{ name: 'asc' }, { regime: 'asc' }, { objective: 'asc' }, { mealsPerDay: 'asc' }],
    }) as unknown as Promise<{
      id: string; name: string; style: string | null; regime: string; objective: string | null;
      mealsPerDay: number; fasting: boolean | null; status: string;
    }[]>,
    coperturaCatalogo(prisma, SETTIMANA),
    /**
     * Le clienti che ci stanno sopra ADESSO: una variante magra con qualcuno sopra è un'altra cosa,
     * ed è il numero su cui il piano decide i tempi.
     *
     * ⛔ **NON da `client_cycle`**, che è quello che avevo scritto per primo e che la revisione del
     * 31/8 ha smontato in tre punti: `status` lì è sempre `'active'` (nessuno scrive mai altro,
     * quindi il filtro non filtrava niente); le righe sono **cicli di due giorni**, quindi una
     * cliente da tre mesi ne vale una quarantina e, se ha cambiato dieta, compare su tutte e due; e
     * si materializzano solo quando qualcuno dello staff apre una certa schermata, quindi una
     * cliente vera può contare zero. Un numero insieme gonfiato e bucato, stampato come decisivo.
     *
     * ⚠️ `menu_day` ha `@@unique(clientId, date)`: una cliente, un giorno, una dieta. Contare le
     * clienti DISTINTE con una giornata negli ultimi 30 giorni risponde alla domanda vera.
     */
    prisma.$queryRaw`
      SELECT diet_id AS "dietId", COUNT(DISTINCT client_id)::int AS clienti
      FROM menu_day
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY diet_id
    ` as Promise<{ dietId: string; clienti: number }[]>,
    /**
     * ⛔ **I totali per RICETTA, non per appartenenza** — l'altro numero che la revisione ha
     * smontato. Sommando i conteggi delle varianti, con la strada B (catalogo condiviso) la stessa
     * ricetta si conta una volta per ogni variante che la nomina: su 306 varianti il totale esce di
     * un ordine di grandezza sopra le ricette vere, e sotto c'era scritto che quel numero è «quanto
     * vale la differenza fra le due porte». Era falso: quella differenza si misura in ricette.
     */
    prisma.$queryRaw`
      WITH nominate AS (
        SELECT DISTINCT (m->>'recipeId') AS recipe_id
        FROM diet_day_template t
        CROSS JOIN LATERAL jsonb_array_elements(t.meals) AS m
      )
      SELECT COUNT(*)::int AS nominate,
             COUNT(*) FILTER (WHERE r.id IS NOT NULL AND r.active)::int AS attive,
             COUNT(*) FILTER (WHERE r.id IS NOT NULL AND NOT r.active)::int AS spente,
             COUNT(*) FILTER (WHERE r.id IS NULL)::int AS inesistenti
      FROM nominate n
      LEFT JOIN recipe r ON r.id = n.recipe_id
    ` as Promise<{ nominate: number; attive: number; spente: number; inesistenti: number }[]>,
  ]);

  const clientiPer = new Map(clienti.map((c) => [c.dietId, Number(c.clienti)]));
  const perRicetta = ricette[0] ?? { nominate: 0, attive: 0, spente: 0, inesistenti: 0 };

  /**
   * ⚠️ Lo **stato** della dieta entra nell'etichetta, e non è un dettaglio: `pick-diet.ts` eroga solo
   * sulle `approved`, quindi una bozza mai approvata che risulta sotto soglia non è un lavoro da
   * fare — è una variante che non serve nessuno. La prima stesura lo caricava e non lo mostrava.
   */
  const etichetta = (d: { name: string; style: string | null; regime: string; objective: string | null; mealsPerDay: number; fasting: boolean | null; status: string }) =>
    [d.name, d.style, d.regime, d.objective, `${d.mealsPerDay} pasti`, d.fasting ? 'digiuno' : null,
      d.status === 'approved' ? null : `⚠️ ${d.status}`].filter(Boolean).join(' · ');

  /**
   * ⚠️ Il conto sta in `engine-rules/misura-fase0.ts`, con le sue prove: da questo verdetto dipende
   * se la Fase 6 è zero consegne, cioè la stima di tutto il piano. Un conto che decide non vive in
   * un file di `prisma/` che nessun test guarda.
   */
  const { misure, verdetto } = verdettoFase0(diete, copertura, clientiPer, SOGLIA, SETTIMANA);
  const perNome = new Map(diete.map((d) => [d.id, etichetta(d)]));
  const rotte = misure.filter((m) => m.rotti > 0).sort((a, b) => b.rotti - a.rotti || b.clienti - a.clienti);
  const sotto = [...verdetto.sotto].sort(primaQuelleConClienti);

  const approvate = diete.filter((d) => d.status === 'approved').length;

  titolo('IL VERDETTO DEL PIANO');
  riga('');
  riga(`  Varianti in catalogo: ${verdetto.varianti} (di cui approvate: ${approvate}).`);
  riga(`  Con clienti attive sopra negli ultimi 30 giorni: ${verdetto.conClienti}.`);
  riga('');
  if (verdetto.siProcede) {
    riga(`  ✅ TUTTE le celle hanno almeno ${SOGLIA} piatti attivi per pasto, e nessun riferimento rotto.`);
    riga('  Il piano dice: si procede senza cambiare niente. La Fase 6 resta a zero consegne.');
  } else {
    riga(`  ⛔ ${sotto.length} varianti su ${verdetto.varianti} NON arrivano a ${SOGLIA} piatti attivi su almeno un pasto.`);
    riga(`  Di queste, ${verdetto.sottoConClienti} hanno clienti attive sopra.`);
    riga('');
    riga('  ⚠️ Il piano dice che qui la stima cambia: le varianti magre SENZA clienti spariscono da');
    riga('  sole chiudendo le famiglie doppione (§2.3), quelle CON clienti vanno spostate a mano.');
    riga(`  Il numero che conta per i tempi è quindi ${verdetto.sottoConClienti}, non ${sotto.length}.`);
    riga('');
    riga(`  Sulle sole varianti CON clienti sopra il verdetto è: ${verdetto.siProcedeSulleVive ? '✅ si procede' : '⛔ no'}.`);
    riga('  ⚠️ I due verdetti si leggono insieme. Se il primo è «no» e il secondo «sì», il piano non');
    riga('  cambia: quello che manca sta su varianti che nessuno usa e che le famiglie doppione');
    riga('  portano via con sé.');
    if (verdetto.rottiTot > 0) {
      riga('');
      riga(`  ⚠️ E ci sono ${verdetto.rottiTot} riferimenti rotti: da soli bastano a non procedere, perché la`);
      riga('  Fase 1 pretende che vadano a zero. Il §9 chiede tre numeri, non uno.');
    }
  }

  titolo('LE RICETTE — contate una volta sola');
  riga('');
  riga(`  Ricette DIVERSE nominate dalle giornate   ${perRicetta.nominate}`);
  riga(`  …attive                                  ${perRicetta.attive}`);
  riga(`  …spente (esistono, ma \`active = false\`)  ${perRicetta.spente}`);
  riga(`  …inesistenti (riferimento rotto)         ${perRicetta.inesistenti}`);
  riga('');
  riga('  ⛔ Le «spente» sono il difetto del §2.4 del piano, non una curiosità: l\'erogazione NON');
  riga('  controlla `active`, la base personale sì. Quelle ricette una porta le serve e l\'altra le');
  riga('  rifiuta — cioè quel numero è quanto vale oggi la differenza fra le due porte.');
  riga('  ⚠️ E le «inesistenti» sono piatti nominati da una giornata che non c\'è più: quei pasti si');
  riga('  vedono vuoti. La chiave esterna che li renderebbe impossibili arriva con la Fase 1.');
  riga('');
  riga(`  Per confronto, le stesse cose contate per APPARTENENZA (una ricetta vale una volta per`);
  riga(`  ogni variante che la nomina): ${verdetto.piattiTot} nominate, ${verdetto.attiviTot} attive, ${verdetto.rottiTot} rotte.`);
  riga('  ⚠️ Questo secondo gruppo dice «quanto è grosso il catalogo come lo vedono le varianti», non');
  riga('  quante ricette esistono. Sono due domande diverse, e la prima stesura le confondeva.');

  titolo('LO STATO DELLE VARIANTI');
  riga('');
  for (const [s, n] of [...verdetto.perStato.entries()].sort((a, b) => b[1] - a[1])) {
    riga(`  · ${String(n).padStart(4)}  ${s}`);
  }

  if (rotte.length) {
    titolo(`VARIANTI CON RIFERIMENTI ROTTI (${rotte.length})`);
    riga('');
    for (const r of rotte.slice(0, ESEMPI)) {
      riga(`  · ${String(r.rotti).padStart(4)} rotti${r.clienti ? `  ⚠️ ${r.clienti} clienti sopra` : ''}  — ${perNome.get(r.dietId) ?? r.dietId}`);
    }
    if (rotte.length > ESEMPI) riga(`  …e altre ${rotte.length - ESEMPI}.`);
  }

  if (sotto.length) {
    titolo(`SOTTO SOGLIA — prima quelle con clienti sopra (${sotto.length})`);
    riga('');
    for (const m of sotto.slice(0, ESEMPI)) {
      const pasto = NOME_SLOT[m.pastoPeggiore ?? ''] ?? m.pastoPeggiore ?? '—';
      riga(`  · ${String(m.minimoAttivi).padStart(3)} attivi su «${pasto}»${m.clienti ? `  ⚠️ ${m.clienti} clienti sopra` : ''}  [${m.stato}]`);
      riga(`      ${perNome.get(m.dietId) ?? m.dietId}`);
    }
    if (sotto.length > ESEMPI) riga(`  …e altre ${sotto.length - ESEMPI}. Alza ESEMPI per vederle.`);
  }

  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
