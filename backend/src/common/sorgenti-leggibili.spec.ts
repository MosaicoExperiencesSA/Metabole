/**
 * ⛔ **UN SORGENTE CON UN BYTE DI CONTROLLO DENTRO SPARISCE DAI TEST CHE LEGGONO I SORGENTI.**
 *
 * Trovato il 22/8. Scrivendo un file nuovo mi è finito dentro un byte NUL, in mezzo a un template
 * literal: TypeScript compilava, `nest build` passava, i test erano verdi — dentro una stringa il
 * NUL è un carattere come un altro. L'ha scoperto **una mutazione sopravvissuta**: il `replace` non
 * trovava più la riga da mutare.
 *
 * ⛔ **E cercandolo, ce n'erano già DUE in produzione**, tutti e due nella stessa forma — la chiave
 * di una famiglia di diete composta come `` `${nome}<NUL>${stile}` ``:
 *
 *  · `src/onboarding/onboarding.service.ts` (la funzione che costruisce lo schermo «Stile che
 *    preferisci»);
 *  · `prisma/diag-digiuni-e-varianti.ts`.
 *
 * Non erano un mio refuso: erano lì da prima. E `catalog.service.ts` fa **la stessa cosa scritta
 * bene**, con l'escape testuale `\\u0000` — la forma giusta esisteva già nel repo, accanto alle
 * due sbagliate.
 *
 * ## ⚠️ Perché è più grave di un refuso
 *
 * `grep` e git trattano come **binario** un file con un byte di controllo, e lo saltano senza dire
 * niente. In questo progetto ci sono parecchi test che leggono i sorgenti per tenere ferme delle
 * regole — «le attività nascono da una porta sola», «il giorno si chiede», «le frecce anche in
 * cima». Un file «binario» attraversa tutti quei controlli **senza essere guardato**, e loro
 * restano verdi dichiarando di aver guardato tutto. È il difetto di famiglia di questo progetto —
 * qualcosa che dichiara di sapere una cosa che non sa — in una forma che non è nel linguaggio,
 * quindi nessun compilatore e nessun linter la vede.
 *
 * ⚠️ Il gemello lato backoffice è `backoffice/src/lib/sorgenti-leggibili.spec.ts`: due pacchetti,
 * due test, perché ognuno legge i propri file con lo strumento che ha.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/** La radice del backend: questo file sta in `src/common/`. */
const RADICE = join(__dirname, '..', '..');
const CARTELLE = ['src', 'prisma'];
const SALTA = new Set(['node_modules', 'dist', 'coverage', '.git']);
const ESTENSIONI = ['.ts', '.tsx', '.js', '.json', '.prisma'];

function tuttiIFile(dir: string, dentro: string[] = []): string[] {
  for (const voce of readdirSync(dir)) {
    if (SALTA.has(voce)) continue;
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) tuttiIFile(p, dentro);
    else if (ESTENSIONI.some((e) => voce.endsWith(e))) dentro.push(p);
  }
  return dentro;
}

/**
 * I byte che rendono un file «binario» per gli strumenti di testo.
 * ⚠️ Tab (9), a capo (10) e ritorno a capo (13) sono esclusi: sono testo normale.
 */
const CONTROLLO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

describe('⛔ i sorgenti del backend si leggono come testo', () => {
  const file = CARTELLE.flatMap((c) => tuttiIFile(join(RADICE, c)));

  /** ⚠️ Se il giro non trova niente, il test sotto passerebbe guardando il vuoto. */
  it('i file trovati sono davvero tanti', () => {
    expect(file.length).toBeGreaterThan(200);
  });

  it('⛔ nessun file ha byte di controllo dentro', () => {
    const sporchi = file
      .map((p) => ({ p, testo: readFileSync(p, 'utf8') }))
      .filter(({ testo }) => CONTROLLO.test(testo))
      .map(({ p, testo }) => {
        const i = testo.search(CONTROLLO);
        const codice = testo.charCodeAt(i).toString(16).padStart(4, '0');
        return `${p.slice(RADICE.length + 1)} (\\u${codice} al carattere ${i})`;
      });
    expect(sporchi).toEqual([]);
  });

  /**
   * ⚠️ **E la prova che il controllo funziona.** Un test che cerca una cosa che non c'è mai stata è
   * indistinguibile da un test rotto: qui si costruisce il caso a mano invece di sperarci.
   */
  it('⚠️ il controllo riconoscerebbe un NUL, e lascia stare tab e a capo', () => {
    expect(CONTROLLO.test(`prima${String.fromCharCode(0)}dopo`)).toBe(true);
    expect(CONTROLLO.test('testo\tnormale\r\ncon a capo')).toBe(false);
  });
});
