/**
 * DIAGNOSTICA: **quali alimenti non dicono se sono crudi o cotti** — sola lettura.
 *
 * Nasce dalle domande arrivate alla nutrizionista sul **grano saraceno** (19/8). Il numero è lo
 * stesso alimento visto in due modi:
 *
 *     grano saraceno   crudo ~343 kcal → cotto ~92 kcal      rapporto 0,27×
 *
 * ⚠️ Quasi **quattro volte**. Chi legge «80 g di grano saraceno» e lo pesa dalla parte sbagliata non
 * ha un'imprecisione, ha un altro pasto — ed è la stessa cosa già vista sul farro (voce 228).
 *
 * ## Cosa c'è già, e cosa lascia scoperto
 *
 * Dal 18/8 `NutrientFact.state` fa parte del significato dei numeri, e `stato-alimento.ts` fa la
 * cosa giusta: se l'alimento è in tabella **due volte** con stati diversi e la domanda non lo dice,
 * Gaia non sceglie — risponde «dipende se crudo o cotto».
 *
 * ⚠️ **Ma se la riga è UNA SOLA non c'è nessuna ambiguità da dichiarare**, e Gaia dice il numero. Se
 * quella riga è il crudo e la cliente sta pesando il cotto, il numero è giusto in tabella e sbagliato
 * nel piatto. Un dato che agisce e non si vede: nessun errore, nessuna riga rossa.
 *
 * ⚠️ E lo stesso vale nella scheda ricetta: «80 g di grano saraceno» non dice da che parte pesare.
 *
 * ## ⚠️ LA CONVENZIONE, decisa da Simone il 19/8
 *
 * «Diamo per assodato che gli ingredienti siano a crudo in tutte le ricette, come si fa nei libri.»
 * È una buona convenzione perché è **una sola**, ed è quella che una persona si aspetta: nei libri
 * di cucina «80 g di riso» sono 80 g di riso secco.
 *
 * ⚠️ Ma allora il pericolo **cambia forma**, e diventa più preciso: non è «l'alimento non dice se è
 * crudo o cotto», è **«di quell'alimento abbiamo SOLO il valore da cotto»**. Nella tabella verificata
 * sono 37 righe su 96, e sono le più pesanti del piatto: pasta, riso, quinoa, cuscus, orzo, farro,
 * tutti i legumi, le patate. Contare «80 g di quinoa» con la riga bollita (120 kcal/100 g) scrive 96
 * kcal dove ce ne sono ~284 — **tre volte meno**, e il numero sembra buono.
 *
 * ## Cosa dice questa diagnostica
 *
 * Quattro elenchi, ordinati per **quante ricette attive usano quell'alimento** — che è una priorità
 * oggettiva e non un giudizio clinico:
 *
 *   1. ⚠️ alimenti che in tabella ci sono **solo da cotto**, usati nelle ricette: è il pericolo vero;
 *   2. alimenti in tabella **senza stato**, usati nelle ricette: si contano, ma nessuno sa se quel
 *      valore è a crudo — «senza stato» non è «cotto», è «non lo so»;
 *   3. alimenti usati nelle ricette e **non in tabella**: su quelli Gaia non può dire niente;
 *   4. alimenti **già a crudo o a secco**: qui va tutto bene, e si contano per sapere quanti sono.
 *
 * ⚠️ **Non scrive e non indovina nessuno stato.** «Il grano saraceno delle ricette sarà cotto» è una
 * supposizione: metterla in banca dati vorrebbe dire far dire a Gaia un numero deciso da me. L'elenco
 * lo riempie la nutrizionista.
 *
 * ## ⚠️ E DAL 19/8 SERA L'ELENCO DI LAVORO STA NELLA PAGINA
 *
 * Richiesta di Simone: «crea una tabella dove possiamo correggere a mano». I primi 300 nomi per
 * numero di ricette finiscono ogni notte nella pagina **Valori nutrizionali** del backoffice, con
 * scritto perche il conto non li sa contare e a quale riga si abbinerebbero. ⚠️ Questa diagnostica
 * **resta**, e non e un doppione: la pagina mostra la testa dell'elenco a chi ci lavora, qui si
 * vedono **tutti** e settemila, divisi nei quattro casi, con i conteggi.
 *
 * ⚠️ Le REGOLE sono le stesse in tutti e due i posti — `scegliPerRicetta` e `abbina`, importate,
 * non ricopiate. Il primo giro in produzione ha mostrato cosa succede a ricopiarle: qui la regola
 * del crudo era scritta a mano e bocciava «quinoa (cruda)» perche confrontava con `['crudo']` al
 * maschile. Quello che resta diverso e **come si assembla l'elenco**, e resta diverso apposta:
 * questa diagnostica risponde a «com'e messa la tabella», la pagina a «cosa faccio adesso».
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:crudo-cotto
 *   QUANTI=40 npm run diag:crudo-cotto
 */
import { PrismaClient } from '@prisma/client';
import { abbinaPerRicetta, paroleChe } from '../src/nutrient-facts/abbinamento-alimenti';
import { normalizzaStato, scegliPerRicetta } from '../src/nutrient-facts/stato-alimento';
import { normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';

const prisma = new PrismaClient();
const QUANTI = Math.max(1, Number(process.env.QUANTI ?? 20) || 20);

/**
 * ⚠️ «PERCHÉ QUESTO STA QUI?» — la modalità che risponde su UN nome (19/8).
 *
 * Nasce da tre domande di Simone sulla lista: «sale è sale, pepe è pepe, perché qui? acqua? ricotta
 * fresca?». Erano domande giuste, e la risposta onesta era «senza guardare i dati non lo so» — che
 * su una diagnostica è una risposta che non si può dare due volte.
 *
 * ⚠️ Non aggiunge una regola: **spiega quella che c'è già**, passo per passo, su un nome solo. Un
 * elenco che dice *dove* finisce una riga senza dire *perché* obbliga chi lo legge a fidarsi — e chi
 * si fida di un elenco che non capisce, il giorno che sbaglia non se ne accorge.
 *
 *   NOME='ricotta fresca' npm run diag:crudo-cotto
 */
async function spiegaUnNome(nome: string) {
  console.log('');
  console.log('==================================================================');
  console.log(`  PERCHÉ «${nome}» FINISCE DOVE FINISCE`);
  console.log('==================================================================');
  console.log('');

  const alimenti = (await prisma.nutrientFact.findMany({
    select: { name: true, synonyms: true, state: true, kcal: true } as never,
  })) as { name: string; synonyms: string[]; state: string | null; kcal: number | null }[];
  const t = normalizzaNome(nome);

  const esatti = alimenti.filter((a) => [a.name, ...(a.synonyms ?? [])].map(normalizzaNome).includes(t));
  console.log(`1) In tabella con questo nome esatto (o come sinonimo): ${esatti.length}.`);
  for (const e of esatti) console.log(`     ▸ ${e.name}   stato: ${e.state ?? '(nessuno)'}   ${e.kcal ?? '?'} kcal`);
  if (esatti.length) {
    const scelta = scegliPerRicetta(esatti);
    console.log(`   → per una ricetta (grammature a crudo): ${scelta.tipo}`);
    if (scelta.tipo === 'solo_cotto') console.log(`     ⚠️  in tabella c'è solo: ${scelta.stati.join(', ')} — manca la riga a crudo.`);
    console.log('');
    return;
  }
  console.log('   Nessuna: quindi non passa dalla via esatta, e si prova l\'abbinamento.');
  console.log('');

  const trovato = abbinaPerRicetta(nome, alimenti);
  console.log('2) Abbinamento (`abbinamento-alimenti.ts`):');
  if (trovato) {
    console.log(`     ▸ si abbina a «${trovato.riga.name}» con la regola [${trovato.regola}].`);
    const scelta = scegliPerRicetta([trovato.riga]);
    console.log(`     ▸ stato di quella riga: ${trovato.riga.state ?? '(nessuno)'} → per la ricetta: ${scelta.tipo}`);
  } else {
    console.log('     ▸ NON si abbina. Le due regole sono: le paroline non contano, e la ricetta');
    console.log('       può aggiungere solo QUALIFICATORI innocui (freschi, sgusciate, pelate…).');
    /**
     * ⚠️ Si dice **quali righe erano vicine e perché non bastavano**: «non si abbina» da solo manda
     * chi legge a cercare a mano dentro diciannovemila ricette, ed è esattamente il gesto che questa
     * diagnostica esiste per evitare.
     */
    const mie = new Set(paroleChe(nome));
    const vicine = alimenti
      .map((a) => {
        const nomi = [a.name, ...(a.synonyms ?? [])];
        let migliore: { nome: string; comuni: number; inPiuSue: string[] } | null = null;
        for (const n of nomi) {
          const sue = paroleChe(n);
          const comuni = sue.filter((p) => mie.has(p)).length;
          if (!comuni) continue;
          if (!migliore || comuni > migliore.comuni) migliore = { nome: n, comuni, inPiuSue: sue.filter((p) => !mie.has(p)) };
        }
        return migliore ? { riga: a, ...migliore } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.comuni - a!.comuni)
      .slice(0, 5) as { riga: { name: string; state: string | null }; nome: string; comuni: number; inPiuSue: string[] }[];
    if (!vicine.length) {
      console.log('     ▸ E in tabella non c\'è niente che condivida nemmeno una parola: l\'alimento');
      console.log('       manca del tutto, e va aggiunto dalla pagina Alimenti.');
    } else {
      console.log('     ▸ Le righe più vicine, e cosa manca perché l\'abbinamento scatti:');
      for (const v of vicine) {
        const inPiuMie = [...mie].filter((p) => !paroleChe(v.nome).includes(p));
        const statoRiga = normalizzaStato(v.riga.state);
        console.log(`         · «${v.riga.name}»  — parole in comune: ${v.comuni}   stato riga: ${v.riga.state ?? '(nessuno)'}`);
        if (v.inPiuSue.length) console.log(`           la tabella ha in più: ${v.inPiuSue.join(', ')}  (parole che DISTINGUONO: non si abbina)`);
        /**
         * ⚠️ **SI DICE PERCHÉ, NON «se no»** — 20/8, dopo che questa riga ha lasciato Simone senza
         * risposta su «spinaci freschi» (1350 ricette). Diceva «qualificatori innocui? se no, non si
         * abbina», cioè rimandava la domanda a chi legge: e la risposta ce l'aveva sotto gli occhi.
         *
         * Una parola in più passa in due casi: è un **qualificatore innocuo**, oppure è una parola di
         * **stato che combacia con lo stato della riga**. Tutti e due si sanno qui, e adesso si dicono.
         */
        for (const p of inPiuMie) {
          const suo = normalizzaStato(p);
          const eStato = suo !== '' && suo !== 'altro';
          const verdetto = !eStato
            ? 'non è una parola di stato: passa solo se è un qualificatore innocuo (sgusciate, pelate, bio…)'
            : statoRiga === ''
              ? `⚠️ vuol dire «${suo}», ma la riga NON DICHIARA lo stato: non c'è niente con cui combaciare → non si abbina. Basta scrivere lo stato sulla riga.`
              : suo === statoRiga
                ? `vuol dire «${suo}» e la riga è «${statoRiga}»: combaciano → questa parola non impedisce l'abbinamento`
                : `⚠️ vuol dire «${suo}» ma la riga è «${statoRiga}»: sono due prodotti diversi → non si abbina, ed è giusto così`;
          console.log(`           la ricetta ha in più: «${p}» — ${verdetto}`);
        }
      }
    }
  }
  console.log('');
}

async function main() {
  const soloUno = (process.env.NOME ?? '').trim();
  if (soloUno) return spiegaUnNome(soloUno);
  console.log('');
  console.log('==================================================================');
  console.log('  CRUDO O COTTO — quali alimenti non lo dicono');
  console.log('  Sola lettura: non scrive e non indovina nessuno stato.');
  console.log('==================================================================');
  console.log('');

  const alimenti = (await prisma.nutrientFact.findMany({
    select: { name: true, synonyms: true, state: true, kcal: true } as never,
  })) as { name: string; synonyms: string[]; state: string | null; kcal: number | null }[];
  if (!alimenti.length) {
    // ⚠️ Tabella vuota: «zero fuori tabella» e «tutto fuori tabella» avrebbero lo stesso aspetto.
    console.log('⚠️  La tabella nutrienti è vuota: non c\'è niente con cui confrontare le ricette.');
    console.log('');
    return;
  }

  /** Da nome normalizzato (nome o sinonimo) alle righe che lo portano. */
  const perNome = new Map<string, { name: string; state: string | null }[]>();
  for (const a of alimenti) {
    for (const n of [a.name, ...(a.synonyms ?? [])]) {
      const k = normalizzaNome(n);
      if (!k) continue;
      perNome.set(k, [...(perNome.get(k) ?? []), { name: a.name, state: a.state }]);
    }
  }

  /**
   * Quante ricette usano ogni ingrediente. ⚠️ Si conta sulle ricette **attive**: una bozza mai
   * approvata non è nel piatto di nessuno, e contarla farebbe salire in cima alla lista un alimento
   * che oggi non mangia nessuno.
   */
  const ricette = (await prisma.recipe.findMany({
    where: { active: true } as never,
    select: { ingredients: true } as never,
  })) as { ingredients: unknown }[];

  const usi = new Map<string, number>();
  for (const r of ricette) {
    if (!Array.isArray(r.ingredients)) continue;
    // ⚠️ `Set` per ricetta: lo stesso ingrediente due volte nella stessa ricetta è UNA ricetta che
    // lo usa, non due. Senza, un piatto che ripete l'olio salirebbe in cima da solo.
    const nella = new Set<string>();
    for (const i of r.ingredients as { name?: unknown }[]) {
      const k = normalizzaNome(String((i ?? {}).name ?? ''));
      if (k) nella.add(k);
    }
    for (const k of nella) usi.set(k, (usi.get(k) ?? 0) + 1);
  }

  const soloCotto: { nome: string; quante: number; stati: string }[] = [];
  const senzaStato: { nome: string; quante: number }[] = [];
  const fuoriTabella: { nome: string; quante: number }[] = [];
  let aPosto = 0;
  const giaVisti = new Set<string>();

  for (const [k, quante] of usi) {
    const righe = perNome.get(k);
    if (!righe) { fuoriTabella.push({ nome: k, quante }); continue; }
    const nome = righe[0].name;
    if (giaVisti.has(nome)) continue;
    giaVisti.add(nome);
    /**
     * ⚠️ **La stessa identica funzione** che usa il calcolo (`scegliPerRicetta`), non una copia della
     * sua regola. Il primo giro in produzione (19/8) l'ha dimostrato: qui la regola era ricopiata a
     * mano, e bocciava «quinoa (cruda)» perché confrontava con `['crudo']` al maschile. Due
     * risposte alla stessa domanda, e quella sbagliata era la copia.
     */
    const scelta = scegliPerRicetta(righe);
    if (scelta.tipo === 'va_bene') { aPosto += 1; continue; }
    if (scelta.tipo === 'stato_ignoto') { senzaStato.push({ nome, quante }); continue; }
    if (scelta.tipo === 'solo_cotto') soloCotto.push({ nome, quante, stati: scelta.stati.join(', ') });
  }

  const perUso = (a: { quante: number }, b: { quante: number }) => b.quante - a.quante;
  soloCotto.sort(perUso);
  senzaStato.sort(perUso);
  fuoriTabella.sort(perUso);

  console.log('   ⚠️  Convenzione (Simone, 19/8): nelle ricette le grammature sono A CRUDO, come nei libri.');
  console.log('');
  console.log(`1) ⚠️  SOLO DA COTTO, e usati nelle ricette: ${soloCotto.length}. È il pericolo vero.`);
  console.log('   Su una grammatura a crudo quel numero sbaglia di volte (riso e legumi: anche tre),');
  console.log('   e sembra buono. Ordinati per quante ricette attive li usano.');
  for (const x of soloCotto.slice(0, QUANTI)) console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}  (in tabella: ${x.stati})`);
  if (soloCotto.length > QUANTI) console.log(`     … e altri ${soloCotto.length - QUANTI} (QUANTI=n per vederne di più)`);
  console.log('');

  console.log(`2) SENZA STATO, e usati nelle ricette: ${senzaStato.length}.`);
  console.log('   Si contano, ma nessuno sa se quel valore è a crudo: «senza stato» non è «cotto»,');
  console.log('   è «non lo so», e il conto lo dichiara invece di tacerlo.');
  for (const x of senzaStato.slice(0, QUANTI)) console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}`);
  if (senzaStato.length > QUANTI) console.log(`     … e altri ${senzaStato.length - QUANTI}`);
  console.log('');

  /**
   * ⚠️ I DUE ELENCHI IN CUI SI SPACCA IL «FUORI TABELLA» (19/8, dopo il primo giro in produzione).
   *
   * 7831 nomi sconosciuti sembrano un elenco da riempire, e non lo sono: quasi tutti parlano di
   * righe **che ci sono già**, scritte in un altro modo. Qui si separano le due cose, perché portano
   * a due lavori diversi:
   *
   *   3a) quelli che si abbinerebbero da soli con le regole di `abbinamento-alimenti.ts` — da
   *       controllare **prima** di accendere quelle regole in produzione: si guarda l'elenco, e se
   *       anche un accoppiamento è storto lo si è scoperto prima e non dopo;
   *   3b) quelli che restano fuori davvero: è la lista da aggiungere a mano, ed è corta.
   */
  const alimentiPerAbbinare = alimenti.map((a) => ({ name: a.name, synonyms: a.synonyms ?? [] }));
  const nomiDi = (r: { name: string; synonyms: string[] }) => [r.name, ...r.synonyms];
  const abbinabili: { nome: string; quante: number; a: string; regola: string }[] = [];
  const restanoFuori: { nome: string; quante: number }[] = [];
  for (const x of fuoriTabella) {
    const trovato = abbinaPerRicetta(x.nome, alimentiPerAbbinare);
    if (trovato) abbinabili.push({ nome: x.nome, quante: x.quante, a: trovato.riga.name, regola: trovato.regola });
    else restanoFuori.push(x);
  }

  console.log(`3) FUORI TABELLA — usati nelle ricette e sconosciuti a Gaia: ${fuoriTabella.length}.`);
  console.log('   Su questi Gaia non dice niente: meglio di un numero sbagliato, ma resta un buco.');
  console.log('');
  console.log(`3a) ⚠️  SI ABBINEREBBERO DA SOLI: ${abbinabili.length} nomi, ${abbinabili.reduce((n, x) => n + x.quante, 0)} usi in ricette.`);
  console.log('    ⚠️  DA CONTROLLARE PRIMA di accendere l\'abbinamento: se anche uno di questi');
  console.log('       accoppiamenti è storto, si è scoperto adesso e non dopo averlo messo in');
  console.log('       produzione. Scorrine cinquanta con la nutrizionista.');
  for (const x of abbinabili.slice(0, QUANTI)) {
    console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}  →  ${x.a}   [${x.regola}]`);
  }
  if (abbinabili.length > QUANTI) console.log(`     … e altri ${abbinabili.length - QUANTI} (QUANTI=n per vederne di più)`);
  console.log('');

  console.log(`3b) DA AGGIUNGERE A MANO: ${restanoFuori.length} nomi.`);
  console.log('    Nessuna regola li può abbinare: o l\'alimento non c\'è in tabella, o il nome è');
  console.log('    ambiguo e indovinare vorrebbe dire scrivere calorie decise a caso.');
  for (const x of restanoFuori.slice(0, QUANTI)) console.log(`     ▸ ${String(x.quante).padStart(5)} ricette   ${x.nome}`);
  if (restanoFuori.length > QUANTI) console.log(`     … e altri ${restanoFuori.length - QUANTI}`);
  console.log('');

  console.log(`4) GIÀ A POSTO — alimenti con la riga a crudo (o a secco): ${aPosto}.`);
  console.log('   Su questi il conto della ricetta usa il numero giusto.');
  console.log('');

  console.log('──────────────────────────────────────────────────────────────────');
  console.log('  ⚠️  I valori a crudo NON si calcolano dal cotto con un fattore: il rapporto cambia da');
  console.log('     alimento ad alimento (il riso assorbe acqua, la carne la perde). Le righe a crudo');
  console.log('     si aggiungono dalla pagina Alimenti, con la fonte.');
  console.log('  ⚠️  E finché una riga a crudo non c\'è, la ricetta dettata a Vera NON si scrive: meglio');
  console.log('     fermarsi che scrivere un totale tre volte più basso del vero in `Recipe.kcal`.');
  console.log('  Nessuna scrittura: questa diagnostica legge e basta.');
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
