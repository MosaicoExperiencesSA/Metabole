import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ⚠️ **NEL PERIMETRO DEI SOLDI IL MESE SI CHIEDE, NON SI CALCOLA.**
 *
 * Come `nutrient-facts/una-porta-sola.spec.ts`, questo test non guarda un comportamento: guarda il
 * **sorgente**. Serve perché il difetto del 20/8 non stava dentro una funzione — stava nei punti
 * che il mese se lo calcolavano da soli, e ognuno a modo suo:
 *
 * | dove                        | come                                              | che mese diceva |
 * |-----------------------------|---------------------------------------------------|-----------------|
 * | tetto di guadagno           | `new Date(d.getFullYear(), d.getMonth(), 1)`      | fuso del server |
 * | periodo dei compensi        | `date.toISOString().slice(0, 7)`                  | UTC             |
 * | storno provvigione          | `c.date.toISOString().slice(0, 7)`                | UTC             |
 * | pagina Compensi staff       | `Date.UTC(y, m - 1, 1)`                           | UTC             |
 * | finestra prelievi «1–7»     | `d.getDate()`                                     | fuso del server |
 * | guadagni del mese (coach)   | `new Date(d.getFullYear(), d.getMonth(), 1)`      | fuso del server |
 *
 * Su Render `TZ` non è impostata, quindi tutte e sei sbagliavano **insieme** e nessun confronto fra
 * due di loro poteva rivelarlo. È il motivo per cui una mutazione non basta: il mese giusto lo
 * conosce solo `date-only.ts`, e l'unico modo di tenere ferma la regola è guardare chi la chiama.
 *
 * ⛔ Se un file qui dentro deve davvero fare aritmetica di calendario propria, si aggiunge
 * all'elenco con scritto **perché**. Il punto non è vietare: è che la scelta si veda in un commit.
 */
const PERIMETRO = [
  'common/tetto-compensi.ts',
  'payouts/payouts.service.ts',
  'compensation/compensation.controller.ts',
  'commerce/finance.service.ts',
  'coach/coach.service.ts',
  'nutritionist/nutritionist.service.ts',
];

/** Le formule che dicono «me lo calcolo io», con il nome che useremmo per spiegarle a voce. */
const VIETATE: { cerca: RegExp; nome: string; invece: string }[] = [
  { cerca: /\.getMonth\s*\(\s*\)/, nome: 'getMonth()', invece: 'inizioMese() / mesePeriodo()' },
  { cerca: /\.getFullYear\s*\(\s*\)/, nome: 'getFullYear()', invece: 'inizioMese() / mesePeriodo()' },
  { cerca: /\.getDate\s*\(\s*\)/, nome: 'getDate()', invece: 'giornoDelMeseLocale()' },
  { cerca: /toISOString\s*\(\s*\)\s*\.slice\s*\(\s*0\s*,\s*7\s*\)/, nome: "toISOString().slice(0, 7)", invece: 'mesePeriodo()' },
  { cerca: /Date\.UTC\s*\(/, nome: 'Date.UTC(', invece: 'confineMese()' },
];

/**
 * Toglie commenti e stringhe: in questi file il nome della formula vecchia COMPARE, ed è giusto
 * che compaia — sta scritto nei commenti che spiegano perché non si usa più. Un test che si
 * accende sulla propria spiegazione costringe a togliere la spiegazione.
 */
function soloCodice(sorgente: string): string {
  return sorgente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

describe('il mese dei soldi ha una risposta sola', () => {
  const radice = join(__dirname, '..');

  it.each(PERIMETRO)('%s non si calcola il mese da sé', (file) => {
    const codice = soloCodice(readFileSync(join(radice, file), 'utf8'));
    const trovate = VIETATE.filter((v) => v.cerca.test(codice)).map((v) => `${v.nome} → usa ${v.invece}`);
    expect(trovate).toEqual([]);
  });

  it('il filtro dei commenti non nasconde il codice vero (se no questo test non guarda niente)', () => {
    // Se `soloCodice` fosse troppo aggressivo, cancellerebbe anche le chiamate da trovare e ogni
    // file risulterebbe pulito per sempre. Questi due casi lo tengono onesto.
    expect(soloCodice('// niente: d.getMonth()')).not.toMatch(/getMonth/);
    expect(soloCodice('const x = d.getMonth(); // commento')).toMatch(/getMonth/);
    expect(soloCodice("/** doc con `toISOString().slice(0, 7)` */\nconst y = 1;")).not.toMatch(/toISOString/);
    expect(soloCodice('const p = d.toISOString().slice(0, 7);')).toMatch(/toISOString/);
  });

  it('i file del perimetro esistono davvero (un percorso sbagliato è un test che non guarda niente)', () => {
    for (const file of PERIMETRO) expect(readFileSync(join(radice, file), 'utf8').length).toBeGreaterThan(0);
  });
});
