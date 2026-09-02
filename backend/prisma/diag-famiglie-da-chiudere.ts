/**
 * LE FAMIGLIE CHE SI CHIUDONO, E CHI CI STA SOPRA — sola lettura.
 *
 * ⚠️ Fase 9 del piano panieri. Sei famiglie di oggi **non sono famiglie**: sono regimi, strutture o
 * funzioni travestite da famiglia. Le loro varianti non versano in nessun paniere — sono le 78 che
 * `panieri:confronta` conta — e finché stanno fuori il paniere non è finito.
 *
 * ⛔ **NON SCRIVE NIENTE**, e non sposta nessuna cliente.
 *
 * ## La domanda vera non è «quante varianti», è «quante persone»
 *
 * Decisione di Simone del 26/8: *«ad oggi restano così, quando siamo pronti al passaggio li vediamo
 * uno per uno»*. Questo tabulato serve a sapere **quanti sono quegli uno per uno**, prima di
 * cominciare: se sono tre si fanno in un pomeriggio, se sono ottanta è un piano a sé.
 *
 * ⛔ **`ClientProfile.dietFamily` contiene il NOME della dieta.** Chiudere o rinominare una famiglia
 * **scollega** le clienti che ce l'hanno sopra: restano con un nome che non esiste più, e nessuno
 * se ne accorge finché non serve. Per questo esiste `npm run rinomina:prodotto`, che sposta il nome
 * dappertutto — e per questo il tabulato conta le clienti PER NOME, non per id della dieta.
 *
 * ⚠️ **Dove finiscono** lo dice `FAMIGLIE_CHE_SPARISCONO`, e per tre famiglie la risposta è
 * «da nessuna parte»: sono regimi (Vegana, Vegetariana) o strutture (Digiuno 16:8) che nel modello
 * nuovo non sono famiglie ma **colonne** — il regime e la struttura della sua dieta. Quelle clienti
 * non si spostano su un'altra famiglia: si guarda che famiglia ALIMENTARE stavano davvero seguendo,
 * ed è una domanda per una nutrizionista, non per uno script.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:famiglie-da-chiudere
 */
import { PrismaClient } from '@prisma/client';
import { FAMIGLIE_CHE_SPARISCONO, paniereDellaVariante } from '../src/catalog/appartenenza-panieri';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 40) || 40);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('LE FAMIGLIE CHE SI CHIUDONO — quante varianti, e quante persone');

  const [diete, profili, clientiPerDieta] = await Promise.all([
    prisma.diet.findMany({
      /**
       * ⚠️ **`clientVisible` è la porta d'ingresso** — aggiunto il 2/9 su una domanda di Simone:
       * «se una cliente si registra oggi vede solo quelle esistenti?». La registrazione mostra le
       * diete `clientVisible && approved` (`onboarding.service.ts`), quindi finché il flag è acceso
       * su una famiglia che si chiude **una nuova cliente ci si può ancora iscrivere** — e domani è
       * un'altra persona da migrare a mano. Le venti della Fase 9 non sono un lavoro che finisce se
       * la porta resta aperta.
       */
      select: { id: true, name: true, regime: true, mealsPerDay: true, fasting: true, status: true, clientVisible: true },
    }) as unknown as Promise<{ id: string; name: string; regime: string; mealsPerDay: number | null; fasting: boolean | null; status: string | null; clientVisible: boolean | null }[]>,
    prisma.clientProfile.findMany({
      select: { userId: true, name: true, dietFamily: true },
    }) as unknown as Promise<{ userId: string; name: string | null; dietFamily: string | null }[]>,
    prisma.$queryRaw`
      SELECT diet_id AS "dietId", COUNT(DISTINCT client_id)::int AS clienti
      FROM menu_day WHERE date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY diet_id
    ` as Promise<{ dietId: string; clienti: number }[]>,
  ]);

  const serviteDa = new Map(clientiPerDieta.map((c) => [c.dietId, Number(c.clienti)]));

  /**
   * ⚠️ Una famiglia si riconosce dal PREFISSO del nome della variante: in banca dati le varianti si
   * chiamano «Mediterranea — vegana 5 pasti» e simili. Il confronto è sul nome esatto della
   * famiglia seguito da un separatore, non un `includes`: «Mediterranea» dentro «Mediterranea senza
   * glutine» darebbe due volte la stessa variante, a due famiglie diverse.
   */
  const famigliaDi = (nome: string): string | null => {
    for (const f of Object.keys(FAMIGLIE_CHE_SPARISCONO)) {
      if (nome === f || nome.startsWith(`${f} `) || nome.startsWith(`${f}—`) || nome.startsWith(`${f} —`)) return f;
    }
    return null;
  };

  const perFamiglia = new Map<string, { varianti: number; approvate: number; visibili: number; serviteDa: number; dove: string }>();
  for (const d of diete) {
    const f = famigliaDi(d.name);
    if (!f) continue;
    const c = perFamiglia.get(f) ?? { varianti: 0, approvate: 0, visibili: 0, serviteDa: 0, dove: FAMIGLIE_CHE_SPARISCONO[f] };
    c.varianti += 1;
    if (d.status === 'approved') c.approvate += 1;
    /** ⛔ Approvata **e** visibile alla cliente = una nuova iscritta ci si può ancora mettere. */
    if (d.status === 'approved' && d.clientVisible) c.visibili += 1;
    c.serviteDa += serviteDa.get(d.id) ?? 0;
    perFamiglia.set(f, c);
  }

  /** ⚠️ E le persone: `dietFamily` è il NOME, ed è lì che una chiusura fa danno. */
  const profiliPerFamiglia = new Map<string, { userId: string; nome: string }[]>();
  for (const p of profili) {
    const nome = (p.dietFamily ?? '').trim();
    if (!nome) continue;
    const f = famigliaDi(nome) ?? (Object.prototype.hasOwnProperty.call(FAMIGLIE_CHE_SPARISCONO, nome) ? nome : null);
    if (!f) continue;
    const lista = profiliPerFamiglia.get(f) ?? [];
    lista.push({ userId: p.userId, nome: p.name ?? '—' });
    profiliPerFamiglia.set(f, lista);
  }

  riga('');
  riga('  ┌─ famiglia che si chiude ───────────────┬ var. ┬ appr ┬ APERTA ┬ serv ┬ profili ┬ dove va ─────────┐');
  let totProfili = 0;
  for (const f of Object.keys(FAMIGLIE_CHE_SPARISCONO)) {
    const c = perFamiglia.get(f) ?? { varianti: 0, approvate: 0, visibili: 0, serviteDa: 0, dove: FAMIGLIE_CHE_SPARISCONO[f] };
    const quanti = (profiliPerFamiglia.get(f) ?? []).length;
    totProfili += quanti;
    const dove = c.dove || '⛔ da decidere a mano';
    /** ⛔ Il numero che dice se domani ci saranno altre persone da migrare. */
    const aperta = c.visibili > 0 ? `⛔ ${String(c.visibili).padStart(3)}` : '   ✅';
    riga(`  │ ${f.slice(0, 38).padEnd(38)} │ ${String(c.varianti).padStart(4)} │ ${String(c.approvate).padStart(4)} │ ${aperta.padEnd(6)} │ ${String(c.serviteDa).padStart(4)} │ ${String(quanti).padStart(7)} │ ${dove.slice(0, 17).padEnd(17)} │`);
  }
  riga('  └────────────────────────────────────────┴──────┴──────┴────────┴──────┴─────────┴───────────────────┘');
  riga('  var. = varianti in catalogo · appr = approvate · serv = clienti servite negli ultimi 30 giorni');
  riga('  profili = clienti che hanno QUEL NOME in `dietFamily` — sono quelle che una chiusura scollega');
  riga('');
  /**
   * ⛔ **«APERTA» è la colonna che decide se questo lavoro finisce.** Sono le varianti approvate e
   * `clientVisible`: quelle che una cliente che si registra OGGI vede e può scegliere. Finché il
   * numero non è zero, ogni iscritta nuova può finire su una famiglia che stiamo chiudendo, e le
   * venti persone della Fase 9 diventano ventuno.
   */
  const totAperte = [...perFamiglia.values()].reduce((n, c) => n + c.visibili, 0);
  if (totAperte > 0) {
    riga(`  ⛔ LA PORTA È ANCORA APERTA: ${totAperte} varianti di famiglie in chiusura sono approvate E`);
    riga('     visibili alla cliente. Chi si registra oggi le vede e le può scegliere, e domani è');
    riga('     un\'altra persona da migrare a mano. Si chiude togliendo la spunta «visibile alla');
    riga('     cliente» su quelle varianti — non serve cancellare niente.');
    riga('  ⚠️ La tendina del BACKOFFICE è un\'altra porta e non guarda quel flag: `catalog.famiglie()`');
    riga('     filtra solo `status: approved`. Spegnere `clientVisible` chiude l\'app, non la scheda.');
  } else {
    riga('  ✅ La porta è chiusa: nessuna variante di queste famiglie è visibile a chi si registra.');
  }

  riga('');
  riga(`  Persone da vedere una per una: ${totProfili}`);

  if (totProfili) {
    riga('');
    for (const [f, gente] of profiliPerFamiglia) {
      const dove = FAMIGLIE_CHE_SPARISCONO[f];
      riga(`  · ${f} → ${dove || '⛔ nessuna famiglia corrispondente: decide una nutrizionista'}`);
      for (const g of gente.slice(0, ESEMPI)) riga(`      ${g.userId.slice(0, 8)}  ${g.nome}`);
      if (gente.length > ESEMPI) riga(`      …e altre ${gente.length - ESEMPI}.`);
    }
  }

  /**
   * ⚠️ Il controllo che chiude il cerchio: quelle varianti stanno davvero fuori da ogni paniere?
   *
   * ⛔ **E «fuori» sono TRE cose diverse, non una** — corretto l'1/9, dopo un falso allarme in
   * produzione. La prima stesura filtrava `tipo !== 'paniere'` e metteva tutto nello stesso mucchio
   * «vanno guardate»: ci sono finite le dodici varianti keto vegane, che non sono un buco ma una
   * **decisione presa** (`IMPOSSIBILI`, §Fase 5: chi le chiede legge una frase che spiega perché e
   * dove andare invece). Un tabulato che chiama «da guardare» una cosa già decisa fa perdere un
   * pomeriggio a chi lo legge — ed è la terza volta oggi che una mia diagnostica grida sul niente.
   *
   * ⚠️ Le tre: **censita** (una delle famiglie che si chiudono, ha la sua riga qui sopra),
   * **impossibile** (cella dichiarata non possibile: si guarda solo se ci sta sopra qualcuno), e
   * **non mappabile** (nessuno sa cos'è: quella sì, va guardata).
   */
  const fuori = diete
    .map((d) => ({ d, esito: paniereDellaVariante(d as never) }))
    .filter((x) => x.esito.tipo !== 'paniere');
  const impossibili = fuori.filter((x) => x.esito.tipo === 'impossibile');
  const nonMappabili = fuori.filter((x) => x.esito.tipo === 'non_mappabile' && !famigliaDi(x.d.name));
  riga('');
  riga(`  Varianti fuori da ogni paniere: ${fuori.length}`);
  riga(`    · spiegate dalle famiglie che si chiudono   ${fuori.length - impossibili.length - nonMappabili.length}`);
  riga(`    · celle dichiarate NON POSSIBILI            ${impossibili.length}`);
  riga(`    · senza spiegazione                         ${nonMappabili.length}`);

  if (impossibili.length) {
    riga('');
    /**
     * ⚠️ Il conto che serve non è quante varianti sono, è **se ci sta sopra qualcuno**: una cella
     * dichiarata impossibile e vuota è a posto; con una cliente sopra è una persona che riceve
     * menu da una combinazione che abbiamo detto di non fare.
     */
    const nomiImpossibili = new Set(impossibili.map((x) => x.d.name));
    const conGente = [...profiliPerFamiglia.entries()].filter(([f]) => nomiImpossibili.has(f));
    riga('  ⚠️ Le celle NON POSSIBILI (decisione della Fase 5, non un buco): chi le chiede legge una');
    riga('  frase che dice perché e dove andare invece. Qui si guarda solo se ci sta sopra qualcuno.');
    for (const [nome, quante] of [...nomiImpossibili].map((n) => [n, impossibili.filter((x) => x.d.name === n).length] as const)) {
      riga(`     · ${nome} — ${quante} varianti`);
    }
    if (conGente.length) {
      riga('');
      riga('  ⛔ E c\'è chi ci sta sopra: vanno spostate, perché quella combinazione l\'abbiamo');
      riga('  dichiarata non possibile e loro la stanno ricevendo lo stesso.');
      for (const [f, gente] of conGente) for (const g of gente) riga(`     · ${g.userId.slice(0, 8)}  ${g.nome}  («${f}»)`);
    } else {
      riga('  ✅ Nessuna cliente ci sta sopra: restano in catalogo e non fanno male a nessuno.');
    }
  }

  if (nonMappabili.length) {
    riga('');
    riga('  ⛔ Queste stanno fuori per un motivo che il piano non ha censito — vanno guardate:');
    for (const x of nonMappabili.slice(0, ESEMPI)) riga(`     · ${x.d.name}  (${x.esito.tipo === 'non_mappabile' ? x.esito.perche : ''})`);
    if (nonMappabili.length > ESEMPI) riga(`     …e altre ${nonMappabili.length - ESEMPI}.`);
  } else {
    riga('');
    riga('  ✅ Nessuna variante fuori senza spiegazione.');
  }
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
