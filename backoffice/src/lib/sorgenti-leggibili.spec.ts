/**
 * ⛔ **UN SORGENTE CON UN BYTE NUL DENTRO SPARISCE DAI TEST CHE LEGGONO I SORGENTI.**
 *
 * Successo davvero il 22/8, scrivendo `famiglieDiete.ts`: un carattere NUL è finito in mezzo a un
 * template literal. TypeScript ha compilato, `npm run build` è passato, i test erano verdi — dentro
 * una stringa il NUL è un carattere valido come un altro, e la chiave che quel template produceva
 * restava unica lo stesso. L'ha scoperto **una mutazione sopravvissuta**: il `replace` non trovava
 * più la riga da mutare, e solo allora ho guardato il file.
 *
 * ⚠️ **Perché è più grave di un refuso.** `grep` e git trattano come **binario** un file con un
 * byte di controllo, e lo saltano senza dire niente. In questo progetto ci sono parecchi test che
 * leggono i sorgenti per tenere ferme delle regole — le frecce sulle tabelle, la coda in un posto
 * solo, i tipi delle attività. Un file «binario» attraversa tutti quei controlli **senza essere
 * guardato**, e loro restano verdi dichiarando di aver guardato tutto. È il difetto di famiglia di
 * questo progetto — qualcosa che dichiara di sapere una cosa che non sa — in una forma che non è
 * nemmeno nel linguaggio.
 *
 * ⚠️ E vale la pena scriverlo: uno strumento che genera codice può introdurre difetti che nessuno
 * dei controlli abituali vede, perché non sono errori di programmazione.
 */
import { describe, expect, it } from 'vitest';

/**
 * Tutti i sorgenti del backoffice, presi come li prende Vite. ⚠️ `eager`, o tornerebbero delle
 * promesse e questo test guarderebbe zero file — passando.
 */
const SORGENTI: Record<string, string> = {
  ...import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }),
};

/**
 * I byte di controllo che rendono un file «binario» per gli strumenti di testo. ⚠️ Tab (9), a capo
 * (10) e ritorno a capo (13) sono esclusi: sono testo normale.
 */
const CONTROLLO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

describe('⛔ i sorgenti si leggono come testo', () => {
  /** ⚠️ Se il glob non prende niente, il test sotto passerebbe guardando il vuoto. */
  it('i sorgenti sono davvero tanti', () => {
    expect(Object.keys(SORGENTI).length).toBeGreaterThan(40);
  });

  it('⛔ nessun file ha byte di controllo dentro', () => {
    const sporchi = Object.entries(SORGENTI)
      .filter(([, testo]) => CONTROLLO.test(testo))
      .map(([nome, testo]) => {
        const i = testo.search(CONTROLLO);
        const codice = testo.charCodeAt(i).toString(16).padStart(4, '0');
        return `${nome} (\\u${codice} al carattere ${i})`;
      });
    expect(sporchi).toEqual([]);
  });

  /**
   * ⚠️ **E la prova che il controllo funziona**, perché un test che cerca una cosa che non c'è mai
   * stata è indistinguibile da un test rotto.
   */
  it('⚠️ il controllo riconoscerebbe un NUL', () => {
    expect(CONTROLLO.test('prima\u0000dopo')).toBe(true);
    expect(CONTROLLO.test('testo\tnormale\r\ncon a capo')).toBe(false);
  });
});
