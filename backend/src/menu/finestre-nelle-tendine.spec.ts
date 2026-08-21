/**
 * ⛔ **NESSUNO SCEGLIE PIÙ UNA FINESTRA — E TUTTI DEVONO POTERLA LEGGERE.**
 *
 * `finestre-digiuno.ts` è la tabella unica, ma i due frontend non possono importarla: là le voci
 * sono **copiate a mano**, con sopra un commento che promette di tenerle allineate. Fino al 21/8 era
 * una promessa e basta — e la promessa si è rotta due volte in due giorni:
 *
 * 1. le tre finestre nate dall'orologio sono comparse nel questionario sotto la domanda «quali pasti
 *    preferisci saltare?», con etichette che nominano i pasti che **restano**;
 * 2. `skip_lunch`, ritirata, sarebbe rimasta scegliibile in tutti e due i frontend, perché toglierla
 *    dalla tabella del backend non toglie niente da un file `.tsx`.
 *
 * ## ⛔ Cos'è cambiato il 21/8, e perché questo file si è accorciato
 *
 * Simone: «non ha più senso scegliere i pasti, sono campi che devono proprio sparire». `fastingWindow`
 * non è più una scelta di nessuno: è quello che l'orologio **produce** da apertura e protocollo. Sono
 * spariti insieme la domanda del questionario, la tendina dello staff (`FASTING_WINDOW_SCEGLIBILI`,
 * `MOTIVO_FUORI_TENDINA`) e i pallini nel profilo dell'app (`FASTING_OPTIONS`,
 * `FINESTRE_DALL_OROLOGIO`) — e con loro i test che li guardavano.
 *
 * ⚠️ **Un test si toglie quando sparisce la cosa che guardava, non quando diventa scomodo.** Le sei
 * prove qui sotto restano perché la loro metà — *leggere* — non è sparita affatto: si è allargata.
 * Chi l'orologio non l'ha ancora toccato porta una finestra storica che **sta decidendo quali pasti
 * riceve**, e va letta in tutte e due le schede. Un dato che agisce e non si vede.
 *
 * ⚠️ Le tre liste del backend (`VALORI_FINESTRA_SELEZIONABILI`, le derivate, la ritirata) restano
 * verificate qui perché la tabella le usa ancora: `finestreRaggiungibili()` dice quali finestre
 * l'orologio sa produrre, e `atterraggioOrologio` ci decide se una cliente storica è traducibile o
 * va segnalata alla nutrizionista. ⛔ **I DTO no**, non più da oggi: `VALORI_FINESTRA_DIGIUNO` è
 * uscito da tutti e tre insieme al campo, e i loro import morti sono stati tolti con lui.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  FINESTRE_DIGIUNO,
  VALORI_FINESTRA_DIGIUNO,
  VALORI_FINESTRA_SELEZIONABILI,
  finestraDigiuno,
} from './finestre-digiuno';
import { finestreRaggiungibili } from './orologio-digiuno';

const RADICE = join(__dirname, '..', '..', '..');
const CLIENT_DETAIL = join(RADICE, 'backoffice', 'src', 'pages', 'ClientDetail.tsx');
const PROFILO = join(RADICE, 'app', 'src', 'pages', 'Profilo.tsx');

/** Il corpo di `const NOME … = [ … ]` o `= { … }`, preso dal sorgente. */
function blocco(sorgente: string, nome: string): string {
  const i = sorgente.indexOf(`const ${nome}`);
  expect(i).toBeGreaterThan(-1);
  // ⚠️ Dall'`=` in poi, non dalla prima parentesi: `const X: { a: string }[] = [...]` ha una graffa
  // nell'**annotazione di tipo**, e partire da lì vuol dire leggere il tipo invece dell'elenco.
  const uguale = sorgente.slice(i).search(/=\s*[[{]/);
  expect(uguale).toBeGreaterThan(-1);
  const inizio = i + uguale + sorgente.slice(i + uguale).search(/[[{]/);
  // ⚠️ Parentesi contate, non «la prima chiusura a inizio riga»: gli elenchi qui sono a volte su una
  // riga sola e a volte su venti, e un test che sa leggerne solo una forma è un test che un giorno
  // smette di guardare senza dirlo.
  const apre = sorgente[inizio];
  const chiude = apre === '[' ? ']' : '}';
  let profondita = 0;
  for (let k = inizio; k < sorgente.length; k += 1) {
    if (sorgente[k] === apre) profondita += 1;
    else if (sorgente[k] === chiude) {
      profondita -= 1;
      if (profondita === 0) return sorgente.slice(inizio, k);
    }
  }
  throw new Error(`blocco «${nome}» non chiuso`);
}

/** Le chiavi `nome_cosi: …` di un oggetto, senza quelle dentro i commenti. */
const chiavi = (corpo: string): string[] =>
  [...senzaCommenti(corpo).matchAll(/^\s*([a-z_]+)\s*:/gm)].map((m) => m[1]);

/** Le coppie `nome_cosi: 'frase'` di un oggetto, frase compresa. */
function valoriDiOggetto(corpo: string): Record<string, string> {
  const fuori: Record<string, string> = {};
  for (const m of senzaCommenti(corpo).matchAll(/^\s*([a-z_]+)\s*:\s*'((?:[^'\\]|\\.)*)'/gm)) {
    fuori[m[1]] = m[2].replace(/\\'/g, "'");
  }
  return fuori;
}

/*
 * ⛔ Qui c'era `valori()` — i `'cosi'` di un elenco di stringhe, o i `value: 'cosi'` di un elenco di
 * oggetti. Leggeva le tre liste delle tendine, ed è sparita con loro il 21/8. Una funzione di
 * supporto che non supporta più niente non si tiene «per quando servirà»: il prossimo che la trova
 * pensa che ci sia una lista da qualche parte da guardare.
 */

/**
 * ⚠️ I commenti di quei file **nominano** le finestre che spiegano — è giusto che le nominino, è là
 * che sta scritto perché non ci sono più. Un test che si accende sulla propria spiegazione
 * costringe a togliere la spiegazione.
 */
const senzaCommenti = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');

describe('le tendine dei due frontend dicono quello che dice la tabella', () => {
  it('i due file ci sono davvero (se no il test non guarda niente)', () => {
    expect(existsSync(CLIENT_DETAIL)).toBe(true);
    expect(existsSync(PROFILO)).toBe(true);
  });

  it('⛔ scegliibili: quattro, e si dicono per nome', () => {
    expect([...VALORI_FINESTRA_SELEZIONABILI].sort()).toEqual([
      'skip_breakfast', 'skip_breakfast_lunch', 'skip_dinner', 'skip_dinner_breakfast',
    ]);
  });

  /**
   * ⛔ **E NESSUNO LE OFFRE PIÙ** (21/8): non è un dettaglio da lasciare al ricordo di chi c'era.
   *
   * Le due tendine sono state tolte perché la finestra la produce l'orologio. Se domani qualcuno
   * riattacca una `<select>` a `fastingWindow` — o riporta la domanda nel questionario — la cliente
   * si ritrova con due cose che decidono lo stesso campo: quella che tocca lei, e quella che
   * l'orologio riscrive al primo spostamento. Chi vince dipende da chi ha toccato per ultimo, cioè
   * nessuno lo sa.
   *
   * ⚠️ Si guarda il **sorgente**: è una riga di codice che non esiste, non un comportamento
   * raggiungibile da un test. E si cerca la scrittura, non la lettura — `FASTING_WINDOW_LABEL` e
   * `SALTA_LABEL` *devono* nominare `fastingWindow`, è il loro mestiere.
   */
  it('⛔ nessuno dei due frontend SCRIVE più `fastingWindow`', () => {
    /**
     * ⛔ **TERZA STESURA, e le prime due sono la ragione per cui questo commento è lungo.**
     *
     * *(1)* La prima legava la regex ai valori che stavano nelle righe appena cancellate (`f.`,
     * `form.`, `next`): `dto.fastingWindow = x` le passava davanti. *(2)* La seconda cercava le
     * **forme** — assegnamento e proprietà di oggetto — e mancava le due che il codice cancellato
     * usava davvero: `S('fastingWindow', …)`, cioè **il nome del campo come stringa** passato a un
     * helper che poi scrive `{...p, [k]: v}`, e la scorciatoia `{ fastingWindow }`.
     *
     * ⚠️ Un test che riconosce solo il difetto che ha già visto protegge la storia, non il codice — e
     * qui la forma «già vista» era proprio quella che non guardava.
     *
     * ## Le quattro forme di scrittura, cercate per quello che sono
     *
     *  1. **assegnamento** — `x.fastingWindow = …`. ⚠️ Il punto davanti non assolve: era la via di
     *     fuga della prima stesura.
     *  2. **proprietà di un oggetto** — `{ fastingWindow: … }`, cioè un corpo di richiesta.
     *  3. **scorciatoia** — `{ fastingWindow }`, che è la (2) scritta più corta.
     *  4. ⛔ **il nome come stringa** — `'fastingWindow'`, `["fastingWindow"]`. È il modo con cui la
     *     tendina cancellata scriveva: il campo non compariva mai come identificatore.
     *
     * ⛔ Le eccezioni sono due, e sono **letture**: la dichiarazione di tipo
     * (`fastingWindow: string | null`), riconosciuta da un elenco **chiuso** di primitivi — non da un
     * `[^;\n]*` che è una scappatoia travestita — e l'accesso a proprietà (`p.fastingWindow`) quando
     * non è seguito da un `=`.
     *
     * ⚠️ Le letture in JSX (`prop={p.fastingWindow}`) passano dalla (1) con `={`, che è escluso.
     */
    const TIPO = '(?:string|number|boolean|null|undefined)';
    const DICHIARAZIONE = new RegExp(`^\\??:\\s*${TIPO}(?:\\s*\\|\\s*${TIPO})*\\s*[;,)}]`);
    const scritture: string[] = [];
    for (const [nome, file] of [['app/Profilo.tsx', PROFILO], ['backoffice/ClientDetail.tsx', CLIENT_DETAIL]] as const) {
      const testo = senzaCommenti(readFileSync(file, 'utf8'));
      const intorno = (i: number) => testo.slice(Math.max(0, i - 45), i + 65).replace(/\s+/g, ' ').trim();
      for (const m of testo.matchAll(/fastingWindow/g)) {
        const prima = testo.slice(Math.max(0, m.index - 1), m.index);
        const dopo = testo.slice(m.index + 'fastingWindow'.length);
        // 4. il nome come stringa: `'fastingWindow'` / `"fastingWindow"`.
        if ((prima === "'" || prima === '"') && (dopo[0] === prima)) {
          scritture.push(`${nome} [nome come stringa]: …${intorno(m.index)}`);
          continue;
        }
        // 1. assegnamento (`= x`), ma non `==`, `===`, `=>`, né la prop JSX `={…}`.
        if (/^\s*=[^=>{]/.test(dopo)) { scritture.push(`${nome} [assegnamento]: …${intorno(m.index)}`); continue; }
        // Lettura: `qualcosa.fastingWindow` senza un `=` dietro. Da qui in poi non ci riguarda.
        if (prima === '.') continue;
        // 2. proprietà di un oggetto — salvo che sia una dichiarazione di tipo.
        if (/^\s*\??:/.test(dopo) && !DICHIARAZIONE.test(dopo)) {
          scritture.push(`${nome} [proprietà]: …${intorno(m.index)}`);
          continue;
        }
        // 3. scorciatoia `{ fastingWindow }` o `{ fastingWindow, … }`.
        if (/^\s*[,}]/.test(dopo)) scritture.push(`${nome} [scorciatoia]: …${intorno(m.index)}`);
      }
    }
    expect(scritture).toEqual([]);
  });

  /**
   * ⛔ **E LA DOMANDA NON TORNA NEL QUESTIONARIO.** È l'altra metà di quello che è stato tolto, e il
   * test qui sopra non la guarda: sta in un file del backend, non in un `.tsx`.
   *
   * ⚠️ Chi si iscrive oggi **non sceglie** la finestra: la imposta trascinando l'orologio al primo
   * avvio dell'app. Rimettere la domanda vorrebbe dire farle scegliere due volte la stessa cosa, con
   * la seconda che sovrascrive la prima — e con etichette che nominano i pasti, cioè la domanda
   * sbagliata: la Regola d'Oro dice che è la **durata** a decidere quanti pasti.
   */
  it('⛔ il questionario non chiede più quali pasti salta', () => {
    const DOMANDE = join(RADICE, 'backend', 'src', 'onboarding', 'onboarding.questions.ts');
    expect(existsSync(DOMANDE)).toBe(true);
    const testo = senzaCommenti(readFileSync(DOMANDE, 'utf8'));
    expect(testo).not.toContain('fastingWindow');
  });

  /**
   * ⚠️ L'altra metà, e quella che si dimentica: **leggere**. Una finestra fuori dalle tendine ma
   * scritta in un profilo deve comparire come una frase in tutte e due le schede.
   */
  it('⚠️ le etichette dello staff ci sono per TUTTE e otto', () => {
    const mappa = chiavi(blocco(readFileSync(CLIENT_DETAIL, 'utf8'), 'FASTING_WINDOW_LABEL'));
    expect(VALORI_FINESTRA_DIGIUNO.filter((v) => !mappa.includes(v))).toEqual([]);
  });

  it('⚠️ le etichette della cliente ci sono per TUTTE e otto', () => {
    const mappa = chiavi(blocco(readFileSync(PROFILO, 'utf8'), 'SALTA_LABEL'));
    expect(VALORI_FINESTRA_DIGIUNO.filter((v) => !mappa.includes(v))).toEqual([]);
  });

  /**
   * ⛔ E le frasi, non solo le chiavi (trovato in revisione, 21/8).
   *
   * Con il solo controllo sulle chiavi si poteva cambiare `etichettaCliente` di
   * `skip_all_but_dinner` in «Mangi solo a colazione» — falso, quella finestra lascia solo la cena —
   * e la suite restava verde. Il titolo qui sopra dice «dicono quello che dice la tabella»: allora
   * lo si verifica, o è un altro commento che promette e basta.
   */
  it('⛔ e le FRASI sono quelle della tabella, parola per parola', () => {
    const staff = valoriDiOggetto(blocco(readFileSync(CLIENT_DETAIL, 'utf8'), 'FASTING_WINDOW_LABEL'));
    const cliente = valoriDiOggetto(blocco(readFileSync(PROFILO, 'utf8'), 'SALTA_LABEL'));
    const diverse: string[] = [];
    for (const f of FINESTRE_DIGIUNO) {
      if (staff[f.valore] !== f.etichettaStaff) diverse.push(`staff/${f.valore}: «${staff[f.valore]}» ≠ «${f.etichettaStaff}»`);
      if (cliente[f.valore] !== f.etichettaCliente) diverse.push(`cliente/${f.valore}: «${cliente[f.valore]}» ≠ «${f.etichettaCliente}»`);
    }
    expect(diverse).toEqual([]);
  });

  /**
   * ⛔ **IL RIPIEGO PER CHI L'OROLOGIO NON L'HA ANCORA TOCCATO.**
   *
   * È il posto dove `SALTA_LABEL` e `FASTING_WINDOW_LABEL` servono davvero. Chi si è iscritta prima
   * dell'orologio porta una finestra storica che decide i suoi pasti: se le due schede mostrassero
   * solo le fasce, per lei sarebbero **vuote** — e una donna che riceve solo la cena leggerebbe
   * «non impostata» in app e la coach non vedrebbe niente in scheda.
   *
   * ⚠️ In revisione la prima stesura di questo test cercava solo `SALTA_LABEL[` — che compare anche
   * dentro la mappa stessa. Qui si cerca il ripiego **sul campo del profilo**, che è la cosa che
   * qualcuno può cancellare per sbaglio semplificando un ternario.
   */
  it('⛔ tutte e due le schede leggono la finestra storica di chi non ha ancora scelto', () => {
    const mancanti: string[] = [];
    const app = senzaCommenti(readFileSync(PROFILO, 'utf8'));
    if (!/SALTA_LABEL\[n\.fastingWindow\]/.test(app)) mancanti.push('app/Profilo.tsx');
    const staff = senzaCommenti(readFileSync(CLIENT_DETAIL, 'utf8'));
    if (!/FASTING_WINDOW_LABEL\[p\.fastingWindow\]/.test(staff)) mancanti.push('backoffice/ClientDetail.tsx');
    expect(mancanti).toEqual([]);
  });

  /**
   * ⛔ **`hidden` NON NASCONDE NIENTE SE L'ELEMENTO HA `display` INLINE** (trovato in revisione, 21/8).
   *
   * Nel profilo dell'app i pulsanti della finestra stavano su un `<div style={{ display: 'grid' }}>`
   * con `hidden={…}`. `hidden` funziona perché il foglio di stile **del browser** dice
   * `[hidden] { display: none }` — ma uno stile inline è dell'autore e vince sempre su quello del
   * browser. Risultato: i pulsanti restavano a schermo sotto un riquadro che diceva «per cambiarla
   * sposta la tua finestra», e un tocco qualsiasi sovrascriveva la finestra derivata dall'orologio.
   *
   * ⚠️ Il difetto non è di quella riga: è del meccanismo. Un elemento che non deve essere toccabile
   * **non si nasconde, non si disegna**. Qui la regola è tenuta ferma sul sorgente, perché non è
   * raggiungibile da un test di comportamento senza un browser.
   *
   * ⛔ Serve davvero `hidden` da qualche parte? Si usa senza `style` inline (una classe CSS), oppure
   * si aggiunge il file qui con scritto **perché**. Il punto non è vietare: è che la scelta si veda.
   */
  it('⛔ nessun `hidden={…}` nei due frontend: quello che non va toccato non si disegna', () => {
    const CON_MOTIVO: string[] = [];
    const trovati: string[] = [];
    for (const [nome, file] of [['app/Profilo.tsx', PROFILO], ['backoffice/ClientDetail.tsx', CLIENT_DETAIL]] as const) {
      if (CON_MOTIVO.includes(nome)) continue;
      if (/hidden=\{/.test(senzaCommenti(readFileSync(file, 'utf8')))) trovati.push(nome);
    }
    expect(trovati).toEqual([]);
  });
});

describe('⛔ le due ragioni per cui una finestra non si sceglie non sono la stessa', () => {
  /**
   * Le derivate le **produce** l'orologio; la ritirata no, e nessuna posizione dei cinque protocolli
   * la dà. È la differenza che l'app deve dire a parole: alla prima «viene dai tuoi orari», alla
   * seconda no — dirglielo sarebbe spiegarle la sua finestra con un motivo inventato.
   */
  const derivate = FINESTRE_DIGIUNO
    .filter((f) => !f.selezionabile && finestreRaggiungibili().includes(f.valore))
    .map((f) => f.valore);
  const ritirate = FINESTRE_DIGIUNO
    .filter((f) => !f.selezionabile && !finestreRaggiungibili().includes(f.valore))
    .map((f) => f.valore);

  it('sono tre derivate e una ritirata, non quattro uguali', () => {
    expect(derivate.sort()).toEqual(['skip_all_but_dinner', 'skip_breakfast_and_snacks', 'skip_morning_snack']);
    expect(ritirate).toEqual(['skip_lunch']);
  });

  /**
   * ⛔ **QUI C'ERANO DUE PROVE SULLE TENDINE, e sono sparite con le tendine (21/8).**
   *
   * Guardavano `FINESTRE_DALL_OROLOGIO` nel profilo dell'app e `MOTIVO_FUORI_TENDINA` in scheda
   * cliente: le due liste che spiegavano *perché* una finestra non fosse in elenco. Non c'è più un
   * elenco, quindi non c'è più un fuori-elenco — e la differenza fra «derivata» e «ritirata» adesso
   * non serve a scegliere una frase: la prima l'orologio la produce, la seconda no, e in tutte e due
   * le schede si legge la stessa cosa, cioè cosa mangia.
   *
   * ⚠️ Le due prove qui sotto **restano** perché la distinzione vive ancora nella tabella: la
   * ritirata dev'essere ancora **leggibile** — chi ce l'ha scritta va letta, in tutte e due le
   * schede — pur non essendo raggiungibile da nessuna posizione dell'orologio. ⛔ Non parlano più di
   * DTO: `fastingWindow` non è più in nessun DTO, quindi non c'è più niente da accettare.
   */
  it('⚠️ la ritirata resta LEGGIBILE: «non si sceglie più» non è «non esiste più»', () => {
    for (const v of ritirate) {
      const riga = finestraDigiuno(v);
      expect(riga).toBeDefined();
      expect(riga!.etichettaStaff.length).toBeGreaterThan(10);
      expect(riga!.etichettaCliente.length).toBeGreaterThan(10);
      // ⚠️ Resta nella tabella: se ne uscisse, `finestraDigiuno()` tornerebbe `undefined` e le due
      // schede mostrerebbero il codice grezzo a chi quella finestra ce l'ha ancora addosso.
      expect(VALORI_FINESTRA_DIGIUNO).toContain(v);
    }
  });
});
