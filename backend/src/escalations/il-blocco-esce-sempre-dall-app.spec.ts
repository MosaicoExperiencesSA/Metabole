/**
 * ⛔ **UNA PORTA CHE NESSUNO PASSA È UN INTERRUTTORE CHE NON ACCENDE NIENTE.**
 *
 * `apriSegnalazione` sa mandare push e mail dal 4/9, ma **solo se chi chiama le passa le porte**.
 * Il difetto naturale di questa forma è quello di `assignments` raccontato in `permissions/pages.ts`:
 * il meccanismo c'è, nessuno lo usa, e nessun errore lo dice — l'avviso semplicemente non parte, che
 * è indistinguibile da prima.
 *
 * Perciò la condizione sta qui e non in un commento: **ogni** punto che apre un `diet_blocked` deve
 * passare `canali`. Un terzo punto scritto fra sei mesi diventa rosso il giorno che lo si scrive,
 * non il giorno che una cliente resta ferma.
 *
 * ⚠️ Solo `diet_blocked`, che è la categoria che **ferma l'erogazione**: obbligare tutte le altre
 * vorrebbe dire decidere qui una cosa che sta scritta in `canali-della-segnalazione.ts`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Tutti i `.ts` del backend, esclusi i test: una chiamata dentro uno spec non avvisa nessuno. */
function sorgenti(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) sorgenti(p, out);
    else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

/**
 * Il testo di ogni chiamata `apriSegnalazione(...)`, presa contando le parentesi.
 *
 * ⚠️ Contare le parentesi e non fermarsi alla prima chiusa: gli argomenti contengono `slice(0, 4)`,
 * `join('; ')` e template literal, e una regex ingorda o pigra taglierebbe nel posto sbagliato —
 * cioè direbbe «manca `canali`» su una chiamata che ce l'ha, o il contrario.
 */
export function chiamate(testo: string): string[] {
  const trovate: string[] = [];
  const ago = 'apriSegnalazione(';
  let i = testo.indexOf(ago);
  while (i !== -1) {
    let profondita = 0;
    let j = i + ago.length - 1;
    for (; j < testo.length; j += 1) {
      if (testo[j] === '(') profondita += 1;
      else if (testo[j] === ')') {
        profondita -= 1;
        if (profondita === 0) break;
      }
    }
    /**
     * ⛔ **Se le parentesi non si chiudono, il lettore INGHIOTTE il resto del file** — e con lui le
     * chiamate successive, in silenzio. Capita con un `apriSegnalazione(` dentro un commento o una
     * stringa. Meglio accorgersene qui che avere una sentinella che guarda metà del progetto
     * credendo di guardarlo tutto.
     */
    if (profondita !== 0) throw new Error('parentesi non bilanciate dopo un apriSegnalazione(');
    trovate.push(testo.slice(i, j + 1));
    i = testo.indexOf(ago, j + 1);
  }
  return trovate;
}

const TUTTE = (() => {
  const out: { file: string; testo: string }[] = [];
  for (const p of sorgenti(join(__dirname, '..'))) {
    const testo = readFileSync(p, 'utf8');
    if (p.endsWith('apri-segnalazione.ts')) continue; // la definizione, non una chiamata
    for (const c of chiamate(testo)) out.push({ file: p.replace(/^.*\/src\//, 'src/'), testo: c });
  }
  return out;
})();

describe('il blocco che ferma l\'erogazione esce sempre dall\'app', () => {
  /**
   * ⛔ Se il lettore non trovasse nessuna chiamata, la prova sotto sarebbe verde sul nulla — è la
   * stessa sentinella che `chiavi-senza-guardia.spec.ts` si è dovuta dare.
   */
  it('⛔ il lettore trova davvero delle chiamate', () => {
    expect(TUTTE.length).toBeGreaterThanOrEqual(10);
  });

  it('⛔ ogni `diet_blocked` passa i canali: senza, l\'avviso non esce dall\'app e nessuno lo dice', () => {
    /** ⚠️ Le virgolette possono essere doppie e la spaziatura diversa: il filtro non è una stringa. */
    const bloccanti = TUTTE.filter((c) => /category:\s*['"]diet_blocked['"]/.test(c.testo));
    expect(bloccanti.length).toBeGreaterThanOrEqual(2);
    expect(bloccanti.filter((c) => !/canali:\s*\{/.test(c.testo)).map((c) => c.file)).toEqual([]);
  });

  /**
   * ⛔ **E li passa TUTTI E DUE.** Un `canali: { push }` senza il postino supera un controllo che
   * guardi solo la parola `canali`, e la posta semplicemente non parte — di nuovo senza che nessun
   * errore lo dica. La condizione è che il blocco esca **su tutti i canali che ha**, non che
   * l'oggetto esista.
   */
  it('⛔ e li passa tutti e due: `push` e `mail`', () => {
    const bloccanti = TUTTE.filter((c) => /category:\s*['"]diet_blocked['"]/.test(c.testo));
    const monchi = bloccanti.filter((c) => !/push:/.test(c.testo) || !/mail:/.test(c.testo));
    expect(monchi.map((c) => c.file)).toEqual([]);
  });
});
