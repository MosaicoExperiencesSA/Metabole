/**
 * CONTROLLO: le chiavi che il codice legge esistono davvero?
 *
 * Tre volte in un mese lo stesso difetto: il codice legge una chiave di configurazione (o un
 * modello email) con un default scritto dentro, la chiave non è seminata, e il risultato è un
 * interruttore promesso che non esiste — invisibile, perché tutto continua a funzionare col
 * default e nessuno riceve un errore. È successo con i parametri del fabbisogno calorico, col
 * modello dell'email delle credenziali e con quello della ricevuta di rimborso.
 *
 * Questo script legge i SORGENTI (non il database) e confronta:
 *   - le chiavi passate a configParams.getString/getNumber/getBool(...)   → seed + catalogo motore
 *   - le chiavi passate a this.resolve('...') in mail.service              → modelli email del seed
 * e segnala quelle che il codice cerca ma che non sono dichiarate da nessuna parte.
 *
 * NON serve il database e non tocca niente: si può lanciare ovunque, anche in CI.
 *   npm run diag:parametri        → elenco, esce 1 se trova chiavi non dichiarate
 *
 * Nota onesta sui limiti: è un'analisi testuale. Una chiave costruita a runtime
 * (`get('prefix_' + x)`) non viene vista. Va bene così: serve a intercettare la dimenticanza
 * ordinaria, che è quella che è già costata tre volte.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');
const SEED = join(__dirname, 'seed.ts');
const SEED_MARKETING = join(__dirname, 'seed_email_marketing.ts');
const CATALOGO = join(SRC, 'engine-rules', 'engine-rules.catalog.ts');

function fileTs(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fileTs(p, out);
    else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const leggi = (p: string): string => {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
};

/** Tutte le occorrenze del gruppo 1 di una regex, su un testo. */
function estrai(testo: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo)) !== null) out.push(m[1]);
  return out;
}

const sorgenti = fileTs(SRC).map((p) => ({ p, testo: leggi(p) }));

// --- chiavi LETTE dal codice ---
const letteParam = new Map<string, string[]>(); // chiave → file che la leggono
const letteEmail = new Map<string, string[]>();
for (const { p, testo } of sorgenti) {
  const rel = p.slice(p.indexOf('/src/') + 1);
  for (const k of estrai(testo, /get(?:String|Number|Bool)\(\s*'([a-z][a-z0-9_]*)'/g)) {
    letteParam.set(k, [...(letteParam.get(k) ?? []), rel]);
  }
  for (const k of estrai(testo, /resolve\(\s*'([a-z][a-z0-9_]*)'/g)) {
    letteEmail.set(k, [...(letteEmail.get(k) ?? []), rel]);
  }
}

// --- chiavi DICHIARATE ---
const seed = leggi(SEED);
const dichiarateSeed = new Set(estrai(seed, /key:\s*'([a-z][a-z0-9_]*)'/g));
const dichiarateCatalogo = new Set(estrai(leggi(CATALOGO), /code:\s*'([a-z][a-z0-9_]*)'/g));
const dichiarateMarketing = new Set(estrai(leggi(SEED_MARKETING), /key:\s*'([a-z][a-z0-9_]*)'/g));

/**
 * Eccezioni volute: chiavi che il codice legge ma che NON vanno seminate, con il motivo.
 * Ogni riga qui dentro è una decisione, non una dimenticanza — se cresce troppo, è un segnale.
 */
const ECCEZIONI: Record<string, string> = {
  // Vuota di proposito: se non c'è, l'onboarding usa i tre regimi di default scritti nel codice.
  // Seminarla con un valore significherebbe congelare la lista dei regimi a DB.
  diet_regimes: 'vuota = fallback ai regimi di default (voluto)',
};

const noteParam = (k: string) =>
  dichiarateCatalogo.has(k) ? 'nel catalogo motore (creata al primo salvataggio)' : '';

const paramMancanti = [...letteParam.keys()]
  .filter((k) => !dichiarateSeed.has(k) && !dichiarateCatalogo.has(k) && !ECCEZIONI[k])
  .sort();
const paramSoloCatalogo = [...letteParam.keys()]
  .filter((k) => !dichiarateSeed.has(k) && dichiarateCatalogo.has(k))
  .sort();
const emailMancanti = [...letteEmail.keys()]
  .filter((k) => !dichiarateSeed.has(k) && !dichiarateMarketing.has(k))
  .sort();

console.log('--- Parametri letti dal codice ma NON dichiarati (né seed né catalogo motore) ---');
if (paramMancanti.length === 0) console.log('nessuno ✓');
for (const k of paramMancanti) {
  console.log(`  ${k}  ← ${[...new Set(letteParam.get(k))].join(', ')}`);
}

console.log('\n--- Parametri nel catalogo motore ma non nel seed (attenuati: la pagina Regole motore li crea) ---');
if (paramSoloCatalogo.length === 0) console.log('nessuno');
for (const k of paramSoloCatalogo) console.log(`  ${k}  ${noteParam(k)}`);

console.log('\n--- Modelli email usati dal codice ma NON seminati ---');
if (emailMancanti.length === 0) console.log('nessuno ✓');
for (const k of emailMancanti) {
  console.log(`  ${k}  ← ${[...new Set(letteEmail.get(k))].join(', ')}`);
}

const eccezioniViste = Object.keys(ECCEZIONI).filter((k) => letteParam.has(k));
if (eccezioniViste.length) {
  console.log('\n--- Eccezioni volute (non vanno seminate) ---');
  for (const k of eccezioniViste) console.log(`  ${k}  → ${ECCEZIONI[k]}`);
}

console.log(`\nEsaminati ${sorgenti.length} file sorgente · ${letteParam.size} parametri letti · ${letteEmail.size} modelli email usati.`);

if (paramMancanti.length > 0 || emailMancanti.length > 0) {
  console.log('\n⚠️  Le chiavi qui sopra funzionano col default scritto nel codice, ma non compaiono');
  console.log('   in nessuna pagina del backoffice: chi le cerca per cambiarle non le trova.');
  console.log('   Si sistemano aggiungendole al seed (o, per i parametri del motore, al catalogo).');
  process.exit(1);
}
