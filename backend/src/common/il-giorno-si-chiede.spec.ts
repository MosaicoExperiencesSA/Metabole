import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ⚠️ **DOVE È GIÀ STATO CORRETTO, «CHE GIORNO È OGGI» SI CHIEDE — NON SI CALCOLA.**
 *
 * Come `mese-uno-solo.spec.ts` e `nutrient-facts/una-porta-sola.spec.ts`, questo test guarda il
 * **sorgente**. Serve perché il difetto del 20/8 non stava dentro una funzione: stava in una
 * trentina di punti che si calcolavano «oggi» per conto loro, con `setHours(0, 0, 0, 0)` (il fuso
 * del **processo**, UTC su Render) o con `Date.UTC(d.getUTC…)`. Fra mezzanotte e le 02:00 in Italia
 * rispondevano tutti **ieri**, e nessun confronto fra due di loro poteva rivelarlo perché
 * sbagliavano insieme.
 *
 * ⚠️ **L'elenco qui sotto NON è tutto il progetto**: è quello che è stato corretto e verificato, un
 * pezzo per volta. Aggiungere un file qui è il modo di dichiarare «questo l'ho guardato», e va
 * fatto **dopo** averlo guardato, non prima.
 *
 * ⛔ **E la frase che stava qui era sbagliata in due modi**, corretta il 20/8 sera. Diceva
 * «restano fuori l'analitica, i report, il marketing e gli agenti — dove un giorno spostato cambia
 * un grafico, non quello che una persona riceve». Guardandoli davvero:
 *  · **`marketing/lifecycle`** non cambia un grafico: decide **a chi parte una email oggi**. Una
 *    cliente che entrava nella finestra alle 00:30 la riceveva con un giorno di ritardo.
 *  · **`agents/agent-orchestrator`** decide se un agente giornaliero **ha già girato oggi**: alle
 *    00:30 italiane rispondeva di no, e lo rimetteva in coda.
 *  · **`reports/plan-report`** aveva **due domande in una funzione sola** (`day0`), chiamata sia su
 *    `new Date()` sia su `sub.startDate` — lo stesso miscuglio di `coach-tasks.day()`.
 *  · **`dashboard` e `crm` non avevano niente da correggere**: li avevo elencati senza guardarli.
 *    ⛔ **E anche questo era falso, scoperto il 25/8**: tutti e due si costruivano il primo del mese
 *    con `new Date(now.getFullYear(), now.getMonth(), 1)`. Il `grep` del 20/8 cercava solo
 *    `setHours(0,0,0,0)`, quindi «guardati» voleva dire «cercata la formula che conoscevo».
 *  · **`analytics/serie-giornaliera`** era **già giusto**, e con il commento che lo spiega: prende
 *    la finestra larga un giorno per lato e filtra sul giorno locale.
 *  · Resta un solo `setHours(0,0,0,0)` in `analytics.service.ts`, ed è dentro il **generatore dei
 *    dati dimostrativi**: lì il giorno esatto non lo legge nessuno. ⚠️ **Tolto il 25/8** insieme al
 *    resto: un'eccezione dichiarata «tanto è finta» è il posto da cui la formula ricompare.
 * ⚠️ Cioè: l'elenco di quello che restava fuori era scritto a memoria, non misurato — la stessa cosa
 * che questo file esiste per impedire.
 *
 * ⛔ E resta fuori, di proposito, l'altra metà del problema: il giorno di una data **salvata** si
 * continua a leggere in UTC. Quelle sono istanti veri in banca dati, e rileggerli in un altro fuso
 * sposterebbe di un giorno piani e prove già vendute. Si misura con `npm run diag:giorno-piani`,
 * poi si decide. Per questo `Date.UTC(` non è fra le formule vietate: nei file qui sotto è la
 * risposta **giusta** alla seconda domanda.
 */
const PERIMETRO = [
  // I soldi
  'common/tetto-compensi.ts',
  'payouts/payouts.service.ts',
  'compensation/compensation.controller.ts',
  'commerce/finance.service.ts',
  // Chi sta ricevendo un menu
  'commerce/abbonamento-in-corso.ts',
  'commerce/stati-abbonamento.ts',
  'common/piano-attivo.ts',
  'clients/clients.service.ts',
  // Le attività della coach
  'coach-tasks/coach-tasks.service.ts',
  'coach-tasks/avvisi-attivita.ts',
  'coach-tasks/porta-delle-attivita.ts',
  // Date che una persona legge o subisce
  'privacy/cancellazione.ts',
  'menu/correzione-kcal.ts',
  'pause/pause.service.ts',
  'menu/senza-glutine.ts',
  'vera/menu-da-rifare.ts',
  'monitoring/monitoring.service.ts',
  // Aggiunti il 20/8 sera, dopo averli guardati uno per uno (vedi il commento qui sopra).
  'marketing/lifecycle.service.ts',
  'agents/agent-orchestrator.service.ts',
  'reports/plan-report.service.ts',
  /**
   * Aggiunto il 23/8 dopo averlo guardato riga per riga, correggendone una: la finestra di blocco
   * contava le ore fino alla mezzanotte **UTC** del giorno d'inizio invece che a quella di Roma, e
   * il blocco dichiarato di 24 ore ne durava 22 (`istanteDiPartenza`). Trovato con
   * `npm run test:notte`.
   *
   * ⚠️ **Cosa resta e perché**, che è la parte che una prima stesura di questa nota aveva scritto
   * a memoria — «tutti valori-giorno normalizzati» — e che non era vera:
   *  · `situazione()` confronta `s.startDate`/`s.endDate` **grezzi** contro `toDateOnly()` per
   *    decidere se un piano è in corso. Sono istanti salvati contro un giorno, ed è la stessa
   *    distinzione dichiarata in `date-only.ts`: il giorno di una data salvata si legge in UTC, e
   *    un piano che finisce a metà giornata sta ancora erogando fino a quell'ora;
   *  · `inizio` è `startDate.toISOString().slice(0, 10)`, cioè il giorno **UTC** di quell'istante:
   *    serve per **scriverlo** alla cliente, non per contarci sopra — il conto lo fa
   *    `istanteDiPartenza` sul valore, non sulla stringa.
   */
  'menu/data-inizio-chat.service.ts',
  /**
   * Aggiunti il 23/8 col via libera clinico. `via-libera-clinico.ts` è la riga in cui la distinzione
   * fra le due domande costa un giorno di menu a una persona: «oggi» si chiede a `aGiorno` (Roma), la
   * scadenza salvata si rilegge con `giornoDelDato` (UTC, com'è scritta). `idoneita.ts` valida la
   * data nuova contro l'oggi di Roma.
   */
  'clients/via-libera-clinico.ts',
  'clients/idoneita.ts',
  /**
   * ⛔ **I TREDICI PUNTI DEL CENSIMENTO DEL 24/8, chiusi il 25/8** — e questa volta l'elenco non è
   * scritto a memoria: viene da un `grep` su tutto `src` per le tre formule vietate qui sotto, e
   * ognuno è stato aperto e guardato prima di finire in questa lista.
   *
   * Otto sbagliavano **anche su Render** (`TZ` non impostata → processo a UTC), ogni notte fra la
   * mezzanotte e le 02:00 o nella prima ora del mese:
   *  · `onboarding.service.ts` — il **peso di partenza** archiviato al giorno prima. E `measurement`
   *    ha la chiave unica `(cliente, data)` scritta in `upsert … update: {}`: se per quel giorno una
   *    misura esisteva già, il peso dichiarato **spariva in silenzio**. Sulla stessa colonna
   *    `signals.service` scrive con `toDateOnly()`: due definizioni di giorno sulla stessa chiave.
   *  · `agenda.controller.ts` — l'anteprima degli orari liberi partiva da **ieri**;
   *  · `prenotazioni.service.ts` — i due estremi con due definizioni diverse: **29 giorni invece di
   *    30**, e l'ultimo giorno prenotabile non compariva;
   *  · `coach.service.ts` — il calendario della coach cominciava da **ieri**;
   *  · `commerce/piano-prova.ts` — il primo giorno accettabile era **ieri**, quindi si poteva
   *    scegliere una partenza già passata e il controllo non scattava;
   *  · `agent-runner.service.ts` — il tetto di spesa contava il **mese scorso**: un agente esaurito
   *    restava bloccato nella prima ora del mese nuovo;
   *  · `crm.service.ts` — la dashboard commerciale mostrava l'incasso del **mese scorso**;
   *  · `dashboard.service.ts` e `analytics.service.ts` — «Nuovi questo mese» e i kg persi nel mese.
   *
   * Cinque sbagliavano **solo sul portatile** (`TZ=Europe/Rome`), che è la forma peggiore perché su
   * Render non si riproduce: `agenda.service.ts` (la copia non corretta di `creaFerie`),
   * `plan-report.service.ts` (`addMonths`), `commerce.service.ts` (il ripiego del rinnovo),
   * `referral.service.ts` (i giorni regalati), `pause.service.ts` (la finestra dei rientri).
   *
   * ⚠️ `marketing/lifecycle.service.ts` era già nel perimetro dal 20/8 e **aveva ancora un
   * `setDate`**: `daysAgo(n)`, che il primo giro non aveva guardato perché il test di allora vietava
   * solo `setHours(0,0,0,0)`. È il motivo per cui le formule vietate adesso sono cinque.
   */
  'onboarding/onboarding.service.ts',
  'coach/coach.service.ts',
  'agenda/agenda.controller.ts',
  'agenda/agenda.service.ts',
  'agenda/prenotazioni.service.ts',
  'agents/agent-runner.service.ts',
  'commerce/crm.service.ts',
  'commerce/commerce.service.ts',
  'commerce/piano-prova.ts',
  'dashboard/dashboard.service.ts',
  'analytics/analytics.service.ts',
  'referral/referral.service.ts',
  /**
   * ⚠️ **QUATTRO PUNTI CHE IL CENSIMENTO DEL 24/8 NON AVEVA ELENCATO**, trovati il 25/8 in revisione
   * rifacendo il `grep` con la regola larga invece che con le formule note. È la ragione per cui la
   * regola qui sotto adesso è larga:
   *  · `clients/finestra-menu.ts` — la finestra dei menu della coach conservava **l'ora corrente**
   *    ed era confrontata con `MenuDay.date` (colonna DATE): alle 09:00 mostrava 55 giorni, alle
   *    00:10 ne mostrava 56. Lo stesso menu, la stessa cliente, due risposte nella stessa giornata;
   *  · `menu/sostituzione-chat.service.ts` — la finestra dei 30 giorni che decide se alla cliente
   *    parte «parlane con la tua coach»: `setDate` su una mezzanotte UTC, la riga gemella di quella
   *    corretta in `pause.service`;
   *  · `coach-tasks/kcal-restano-corte.ts` — la scadenza dell'attività. Le altre scadenze passavano
   *    già da `oggiPiu`: questa stava in un file suo e nessuno l'aveva riguardata;
   *  · `menu/plateau.ts` — `getDay()` su un valore-giorno decideva **in che giorno della settimana**
   *    una cliente in plateau riceve i piatti che ama. Latente (giusto a est di Greenwich), ma è un
   *    giorno che si dice a voce alla cliente.
   */
  'clients/finestra-menu.ts',
  'menu/sostituzione-chat.service.ts',
  'coach-tasks/kcal-restano-corte.ts',
  'menu/plateau.ts',
];

/**
 * Le due formule che dicono «me lo calcolo io» a partire da **adesso**.
 *
 * ⚠️ `setHours(0, 0, 0, 0)` è la peggiore delle due perché sembra innocua: legge il fuso del
 * processo, quindi in locale su un Mac italiano dà la risposta giusta e su Render no. Un difetto
 * che si comporta bene sulla macchina di chi lo scrive è un difetto che nessuno trova.
 */
const VIETATE: { cerca: RegExp; nome: string }[] = [
  { cerca: /setHours\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/, nome: 'setHours(0, 0, 0, 0)' },
  { cerca: /setUTCHours\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/, nome: 'setUTCHours(0, 0, 0, 0)' },
  /**
   * ⛔ **LA REGOLA LARGA, scritta il 25/8 dopo che quella stretta ha fallito due volte.**
   *
   * Il primo giro (20/8) vietava solo `setHours(0,0,0,0)`, e per questo non vedeva
   * `new Date(d.getFullYear(), d.getMonth(), 1)` — **sette** dei tredici punti del censimento. La
   * seconda stesura di questo elenco aggiungeva una `RegExp` per quella forma specifica, e la
   * revisione l'ha bucata in cinque modi in dieci minuti: `new Date(anno, mese, 1)` con i campi
   * presi in variabili una riga prima, `const g = d.getDate(); x.setUTCDate(g + 30)`,
   * `d.setHours(0); d.setMinutes(0); …`, `Date.UTC(d.getFullYear(), …)` senza `new Date` davanti.
   * Una `RegExp` che elenca le forme sbagliate perde contro chi ne scrive una nuova senza saperlo.
   *
   * ✅ **Quindi si vieta la causa, non le sue forme**: dentro il perimetro **non si leggono e non si
   * scrivono campi di calendario nel fuso del processo**, mai. `getDate`, `getMonth`,
   * `getFullYear`, `getHours`, `getDay` e i `set*` corrispondenti rispondono tutti «secondo la
   * macchina che sta eseguendo», e su Render la macchina sta a UTC mentre le clienti stanno in
   * Italia. Le versioni `…UTC…` restano permesse: quelle sono deterministiche, e
   * `plan-report.addMonths` le usa apposta.
   *
   * ⚠️ **Misurato prima di scriverlo**: al 25/8 tutti e 41 i file del perimetro passano questa
   * regola senza nessuna eccezione dichiarata. Un divieto con dentro un elenco di deroghe è un
   * divieto che non morde.
   *
   * ⚠️ **Quello che resta fuori, e va detto**: `new Date(2026, 8, 1)` con tre numeri scritti a mano
   * non lo prende nessuna `RegExp`, perché non c'è niente che dica «calendario» in tre interi. È il
   * buco dichiarato di questo guardiano.
   */
  {
    cerca: /\.(?:set|get)(?:Date|Day|FullYear|Hours|Milliseconds|Minutes|Month|Seconds)\s*\(/,
    nome: 'campi di calendario nel fuso del processo — usa date-only (o le versioni …UTC…)',
  },
];

/** Toglie commenti e stringhe: in questi file le formule vecchie COMPAIONO, spiegate nei commenti. */
function soloCodice(sorgente: string): string {
  return sorgente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

describe('nel perimetro già corretto, il giorno si chiede', () => {
  const radice = join(__dirname, '..');

  it.each(PERIMETRO)('%s non azzera l’ora a mano', (file) => {
    const codice = soloCodice(readFileSync(join(radice, file), 'utf8'));
    expect(VIETATE.filter((v) => v.cerca.test(codice)).map((v) => v.nome)).toEqual([]);
  });

  /**
   * ⚠️ Il primo test non basta da solo: qualcuno potrebbe tornare a calcolarsi «oggi» con
   * `Date.UTC(d.getUTC…)`, che è **legittimo** per una data salvata e quindi non si può vietare.
   * Questo secondo guarda l'altra faccia — che il file la risposta la vada a chiedere.
   */
  const NON_CHIEDONO_IL_GIORNO = new Map<string, string>([
    // Riceve `dueDate` da chi la chiama: un giorno non lo calcola e non lo legge. Sta nel perimetro
    // lo stesso perché è la porta da cui nascono le attività, ed è lì che qualcuno sarebbe tentato
    // di scriverne uno.
    ['coach-tasks/porta-delle-attivita.ts', 'non chiede mai che giorno è: la scadenza gliela passa il chiamante'],
    // Riceve il giorno già costruito da `menu.service` e ne guarda solo il giorno della settimana
    // (in UTC). Sta nel perimetro perché è lì che `getDay()` era la risposta sbagliata.
    ['menu/plateau.ts', 'riceve il giorno dal chiamante: guarda che giorno della settimana è, non quale'],
  ]);

  it('tutti gli altri chiamano `date-only` (se no non rispondono alla domanda, la evitano)', () => {
    const senza = PERIMETRO.filter((f) => {
      if (NON_CHIEDONO_IL_GIORNO.has(f)) return false;
      const s = readFileSync(join(radice, f), 'utf8');
      // Chi non ha bisogno di «oggi» ma solo del mese lo prende da `tetto-compensi`, che a sua
      // volta chiama `date-only`: vale lo stesso, la risposta è una sola.
      return !/from '.*date-only'/.test(s) && !/from '.*tetto-compensi'/.test(s);
    });
    expect(senza).toEqual([]);
  });

  it('e le eccezioni dichiarate sono davvero nel perimetro (un elenco che non morde è rumore)', () => {
    for (const f of NON_CHIEDONO_IL_GIORNO.keys()) expect(PERIMETRO).toContain(f);
  });

  /**
   * ⛔ **E LE FORMULE VIETATE SI RICONOSCONO DAVVERO** (25/8). Una `RegExp` sbagliata in
   * quell'elenco non fa fallire niente: fa **passare tutto**, e il file resta verde dicendo di aver
   * guardato trentasei file. Il primo giro del 20/8 vietava solo `setHours(0,0,0,0)`, e per questo
   * non vedeva `new Date(d.getFullYear(), …)` — sette dei tredici punti del censimento.
   *
   * ⚠️ Ogni riga è la formula **com'era scritta nel punto vero**, copiata da lì.
   */
  /** Il nome della regola larga, così i campioni non lo ricopiano quindici volte. */
  const CAMPO = VIETATE[VIETATE.length - 1].nome;

  const CAMPIONI: [string, string][] = [
    ['setHours(0, 0, 0, 0)', 'const startDate = new Date(); startDate.setHours(0, 0, 0, 0);'],
    ['setHours(0, 0, 0, 0)', 'startToday.setHours(0,0,0,0);'],
    ['setUTCHours(0, 0, 0, 0)', 'd.setUTCHours(0, 0, 0, 0);'],
    [CAMPO, 'const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);'],
    [CAMPO, 'return new Date(d.getFullYear(), d.getMonth(), d.getDate());'],
    [CAMPO, 'date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },'],
    [CAMPO, 'fra30.setDate(fra30.getDate() + 30);'],
    [CAMPO, 'newEnd.setDate(newEnd.getDate() + days);'],
    [CAMPO, 'limite.setMonth(limite.getMonth() + MESI_MAX_DATA_INIZIO);'],
    [CAMPO, 'return giorno.getDay() === GIORNO_CONFORTO;'],
    /**
     * ⛔ **Le cinque forme con cui la revisione del 25/8 ha bucato la `RegExp` stretta.** Stanno qui
     * perché il buco si riapre solo se qualcuno restringe di nuovo la regola, e allora questi
     * cadono per primi.
     */
    [CAMPO, 'const anno = d.getFullYear(); const mese = d.getMonth(); const m = new Date(anno, mese, 1);'],
    [CAMPO, 'const x = new Date(2026, now.getMonth(), 1);'],
    [CAMPO, 'const g = d.getDate(); l.setUTCDate(g + 30);'],
    [CAMPO, 'd.setHours(0); d.setMinutes(0); d.setSeconds(0); d.setMilliseconds(0);'],
    [CAMPO, 'return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());'],
  ];

  it.each(CAMPIONI)('⛔ «%s» riconosce «%s»', (nome, riga) => {
    const presi = VIETATE.filter((v) => v.cerca.test(riga)).map((v) => v.nome);
    expect(presi).toContain(nome);
  });

  /**
   * ⚠️ **E non prende quello che è giusto.** Le versioni UTC sono la risposta **corretta** su una
   * data salvata (`plan-report.addMonths` le usa apposta): un guardiano che le vietasse
   * costringerebbe a rimettere la formula sbagliata per farlo tacere.
   */
  it.each([
    'x.setUTCDate(Math.min(day, lastDay));',
    'x.setUTCMonth(x.getUTCMonth() + n);',
    'new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))',
    'return new Date(aGiorno(adesso).getTime() + giorni * 86_400_000);',
    'const monthStart = inizioMeseLocale();',
    'return giorno.getUTCDay() === GIORNO_CONFORTO;',
    // ⚠️ E il codice che non parla di calendario affatto: una regola larga che prendesse anche
    // questi costringerebbe a rimettere la formula sbagliata per farla tacere.
    'const ore = (fine.getTime() - inizio.getTime()) / 3_600_000;',
    'return { start: new Date(t), etichetta: nomeDi(t) };',
    'const righe = [new Date(a), etichetta(chiave)];',
  ])('⚠️ e non tocca «%s», che è la risposta giusta', (riga) => {
    expect(VIETATE.filter((v) => v.cerca.test(riga))).toEqual([]);
  });

  it('il filtro dei commenti non nasconde il codice vero', () => {
    // Se `soloCodice` fosse troppo aggressivo, ogni file risulterebbe pulito per sempre.
    expect(soloCodice('// spiegazione: x.setHours(0, 0, 0, 0)')).not.toMatch(/setHours/);
    expect(soloCodice('x.setHours(0, 0, 0, 0); // spiegazione')).toMatch(/setHours/);
    expect(soloCodice('/** doc con setUTCHours(0, 0, 0, 0) */\nconst y = 1;')).not.toMatch(/setUTCHours/);
    // ⚠️ Anche per le formule nuove: nei file corretti stanno **spiegate nei commenti**, e se il
    // filtro non le togliesse il perimetro sarebbe rosso per i commenti che raccontano la correzione.
    expect(soloCodice('// era new Date(now.getFullYear(), now.getMonth(), 1)')).not.toMatch(/getFullYear/);
    expect(soloCodice('const m = new Date(now.getFullYear(), now.getMonth(), 1);')).toMatch(/getFullYear/);
    expect(soloCodice('/** era `d.setDate(d.getDate() - n)` */')).not.toMatch(/setDate/);
  });

  it('i file del perimetro esistono davvero', () => {
    for (const f of PERIMETRO) expect(readFileSync(join(radice, f), 'utf8').length).toBeGreaterThan(0);
  });
});
