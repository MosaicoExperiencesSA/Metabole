/**
 * ⛔ **CHI SI PUÒ SCEGLIERE, E CHI SI DEVE SOLO POTER LEGGERE.**
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
 * Questo test guarda il **sorgente** dei due frontend, come `common/mese-uno-solo.spec.ts`: è
 * l'unico modo di tenere ferma una regola che vive in tre file che non si parlano.
 *
 * ## Le due domande, che sono diverse
 *
 * - **Cosa si propone**: `FINESTRE_SELEZIONABILI`. Quattro. Fuori restano le tre che l'orologio
 *   calcola e quella ritirata.
 * - **Cosa si legge**: `FINESTRE_DIGIUNO`, tutte e otto. Una finestra che agisce e la cliente vede
 *   come `skip_all_but_dinner` è *un dato che agisce e non si vede*.
 *
 * ⚠️ E le due ragioni per cui una finestra non si sceglie **non sono la stessa**, perché portano a
 * due schermate diverse: da una finestra derivata non si esce toccando un pallino, da una ritirata
 * sì. Il test lo verifica anche là.
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

/** I valori `'cosi'` di un elenco di stringhe, o i `value: 'cosi'` di un elenco di oggetti. */
const valori = (corpo: string): string[] => {
  const testo = senzaCommenti(corpo);
  const conValue = [...testo.matchAll(/value:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  return conValue.length ? conValue : [...testo.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};

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

  it('la tendina dello staff offre esattamente quelle', () => {
    const lista = valori(blocco(readFileSync(CLIENT_DETAIL, 'utf8'), 'FASTING_WINDOW_SCEGLIBILI'));
    expect(lista.sort()).toEqual([...VALORI_FINESTRA_SELEZIONABILI].sort());
  });

  it('i pulsanti dell\'app offrono esattamente quelle', () => {
    const lista = valori(blocco(readFileSync(PROFILO, 'utf8'), 'FASTING_OPTIONS'));
    expect(lista.sort()).toEqual([...VALORI_FINESTRA_SELEZIONABILI].sort());
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
   * ⛔ **La voce conservata in fondo alla tendina dello staff.** Cancellando quelle due righe la
   * `select` si presenta vuota per una cliente che una finestra ce l'ha, e il primo salvataggio di
   * un altro campo gliela azzera. In revisione (21/8) è stato provato: si potevano togliere e
   * nessun test suonava. È una riga di codice, non un comportamento raggiungibile da qui — quindi
   * si guarda il sorgente, come per il mese dei soldi.
   */
  it('⛔ la tendina dello staff CONSERVA il valore già scritto che non è in lista', () => {
    const testo = senzaCommenti(readFileSync(CLIENT_DETAIL, 'utf8'));
    expect(testo).toMatch(/form\.fastingWindow\s*&&\s*!FASTING_WINDOW_SCEGLIBILI\.includes\(/);
    expect(testo).toContain('MOTIVO_FUORI_TENDINA[form.fastingWindow]');
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

  it('l\'app chiama «dall\'orologio» esattamente le derivate', () => {
    const lista = valori(blocco(readFileSync(PROFILO, 'utf8'), 'FINESTRE_DALL_OROLOGIO'));
    expect(lista.sort()).toEqual([...derivate].sort());
  });

  /**
   * ⛔ Il suffisso che la coach legge in fondo alla tendina. Uno per motivo, non uno per tutti:
   * dire «dagli orari» di una finestra ritirata è mandarla a spostare un orario che non esiste.
   */
  it('⛔ lo staff legge il motivo GIUSTO per ogni finestra fuori tendina', () => {
    const motivi = valoriDiOggetto(blocco(readFileSync(CLIENT_DETAIL, 'utf8'), 'MOTIVO_FUORI_TENDINA'));
    // C'è un motivo per ognuna delle quattro fuori lista, e per nessun'altra.
    expect(Object.keys(motivi).sort()).toEqual([...derivate, ...ritirate].sort());
    // Le derivate dicono da dove vengono; la ritirata **non** lo dice, perché non è vero.
    for (const v of derivate) expect(motivi[v]).toContain('orari');
    for (const v of ritirate) expect(motivi[v]).not.toContain('orari');
    for (const v of ritirate) expect(motivi[v]).toMatch(/ritirat/);
  });

  it('⚠️ la ritirata resta leggibile e resta accettata: «cosa si propone» non è «cosa si accetta»', () => {
    for (const v of ritirate) {
      const riga = finestraDigiuno(v);
      expect(riga).toBeDefined();
      expect(riga!.etichettaStaff.length).toBeGreaterThan(10);
      expect(riga!.etichettaCliente.length).toBeGreaterThan(10);
      // I DTO validano su questa lista: se la ritirata ne uscisse, salvare la scheda di una cliente
      // che ce l'ha scritta fallirebbe — e la coach non saprebbe perché.
      expect(VALORI_FINESTRA_DIGIUNO).toContain(v);
    }
  });
});
