/**
 * ⛔ NIENTE IN `src/` PUÒ IMPORTARE DA `prisma/` — 20/8.
 *
 * ## Il fatto, e quanto è costato
 *
 * Il 20/8 ho spostato `piano-alimenti.ts` dentro `src/` per poterlo provare senza un database, e
 * gli ho lasciato un `import type { RigaAlimento } from '../../prisma/dati-alimenti'`.
 *
 *   · `npx tsc --noEmit -p tsconfig.json` → verde
 *   · `npx jest` → 4058 test verdi
 *   · `npm run build` (`nest build`) → **TS6059: file non sotto `rootDir` `src`**
 *
 * `nest build` usa `tsconfig.build.json`, che ha `rootDir: "src"`; l'altro tsconfig no. Il backend
 * non si è deployato per un'ora, **tre consegne sono rimaste ferme dietro quell'errore**, e in
 * produzione girava il codice di prima — mentre io scrivevo «267 suite, 4058 test verdi».
 *
 * ⚠️ È la seconda volta in una settimana che consegno una cosa che non compila avendo controllato
 * con lo strumento sbagliato: la prima fu il pulsante «Esporta in Excel» del backoffice, e allora
 * adottai la regola «se tocco app/ o backoffice/, lancio la build vera». Non l'avevo estesa al
 * backend, perché credevo che `tsc --noEmit` fosse la stessa cosa. **Non lo è: sono due tsconfig.**
 *
 * La regola adesso vale per tutti e tre. E questo test è la parte che non dipende dal fatto che me
 * ne ricordi: un `import` che esce da `src/` diventa rosso qui, in tre secondi, invece che su
 * Render in dieci minuti.
 *
 * ⚠️ `src/prisma/prisma.service` **non** è `prisma/`: è la cartella `src/prisma`, dentro `src`, ed è
 * il modo normale in cui mezzo backend prende il client. Il controllo guarda i percorsi che
 * **risalgono** fuori da `src`, non la parola «prisma».
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const SRC = resolve(__dirname, '..');

/**
 * ⚠️ **Quali file guardare lo dice `tsconfig.build.json`, non io.** Gli `.spec.ts` sono esclusi
 * dalla build, quindi possono importare da `prisma/` quanto vogliono — e lo fanno, per provare il
 * contenuto dei fogli con i dati veri. Se un domani qualcuno toglie quella riga di `exclude`, la
 * build comincerà a guardarli e questo test comincerà a guardarli insieme a lei: la lista sta in
 * un posto solo. Scriverla di nuovo qui vorrebbe dire avere due risposte alla stessa domanda.
 */
const ESCLUSI: string[] = (require('../../tsconfig.build.json').exclude ?? []) as string[];

/**
 * Da glob di tsconfig a espressione regolare, in **un solo passaggio**.
 *
 * ⚠️ La prima versione faceva tre `replace` in fila — prima `**\/`, poi `*` — e il secondo
 * riscriveva il `.*` appena prodotto dal primo: `**\/*spec.ts` diventava una regola che non
 * riconosceva niente, e il test restava rosso senza dire perché. Una sostituzione che lavora sul
 * risultato di quella prima è un baco che sembra un dettaglio.
 */
function aRegola(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; continue; }
    if (c === '*') { out += '[^/]*'; continue; }
    out += /[a-zA-Z0-9/_-]/.test(c) ? c : '\\' + c;
  }
  return new RegExp('^' + out + '$');
}

/** Escluso dalla build = escluso da questo controllo. Vale il file e vale la cartella. */
const escluso = (rel: string): boolean =>
  ESCLUSI.some((p) => aRegola(p).test(rel) || rel.startsWith(p.replace(/\/$/, '') + '/'));

function tuttiITs(dir: string): string[] {
  const fuori: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fuori.push(...tuttiITs(p));
    else if (nome.endsWith('.ts')) fuori.push(p);
  }
  return fuori;
}

describe('la build vera (`nest build`, rootDir: src)', () => {
  it('⛔ nessun file di `src/` importa qualcosa che sta fuori da `src/`', () => {
    const colpevoli: string[] = [];
    for (const file of tuttiITs(SRC)) {
      if (escluso(relative(resolve(SRC, '..'), file))) continue;
      const testo = readFileSync(file, 'utf8');
      for (const m of testo.matchAll(/from\s+'(\.[^']+)'/g)) {
        const dove = resolve(file, '..', m[1]);
        if (!dove.startsWith(SRC)) {
          colpevoli.push(`${relative(SRC, file)} → ${m[1]}`);
        }
      }
    }
    expect(colpevoli).toEqual([]);
  });
});
