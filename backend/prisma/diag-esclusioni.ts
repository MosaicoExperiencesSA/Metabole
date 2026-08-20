/**
 * QUANTO TOGLIE IN PIÙ LA RADICE — la misura che io non posso fare, e che decide una costante.
 *
 * Dal 20/8 il filtro delle esclusioni guarda anche la **radice** della parola chiave: «mandorle»
 * copre «mandorla», «gamberi» copre «gamberetti». Serviva perché quattro piatti del catalogo del
 * repo contenevano l'allergene e passavano lo stesso.
 *
 * ⚠️ Ma quella misura è su **118 ricette**, il catalogo keto che sta nel repo. In produzione ce ne
 * sono migliaia, e su quelle non l'ha verificato nessuno. La domanda che questa diagnostica
 * risponde è una sola: **la radice toglie qualcosa che non c'entra?**
 *
 * Il caso da cui guardarsi l'ho trovato misurando e non ragionando: `polpo` senza vocale finale è
 * `polp`, che sta dentro **polpette**. Con la soglia di `RADICE_MINIMA` a 6 caratteri quel caso non
 * si presenta — ma «polp» non è l'unica parola corta della lingua italiana, e le ricette vere le ha
 * scritte qualcuno che non stava pensando a questo file.
 *
 * ## Come si legge l'esito
 *
 * Per ogni allergene stampa le ricette che **oggi passavano e da adesso no**. Vanno lette una per
 * una, ed è un lavoro di cinque minuti:
 *
 *   · se il piatto **contiene davvero** quell'allergene → è un difetto chiuso, ed è il punto;
 *   · se **non c'entra niente** → la radice è troppo aggressiva su quella parola. Si alza
 *     `RADICE_MINIMA` in `src/menu/exclusions.ts` (sta lì da sola apposta) e si rilancia.
 *
 * ⚠️ Sola lettura, non tocca niente. `npm run diag:esclusioni`.
 */
import { PrismaClient } from '@prisma/client';
import { exclusionKeys, iniziaUnaParola, radiceChiave, recipeHaystack } from '../src/menu/exclusions';

/** Gli allergeni che una cliente può davvero dichiarare: le chiavi della mappa e gli alias UE. */
const DA_GUARDARE = [
  'latte', 'glutine', 'uova', 'pesce', 'crostacei', 'molluschi', 'soia', 'sesamo',
  'arachidi', 'frutta a guscio', 'frutta secca', 'legumi', 'sedano', 'senape', 'lupini', 'solfiti',
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const ricette = (await prisma.recipe.findMany({
      where: { active: true } as never,
      select: { id: true, name: true, ingredients: true },
    })) as { id: string; name: string; ingredients: unknown }[];
    console.log(`\nRicette attive in catalogo: ${ricette.length}\n`);

    const fieno = ricette.map((r) => ({ r, h: recipeHaystack(r.name, r.ingredients) }));
    let totaleInPiu = 0;
    let totaleDentro = 0;

    /**
     * ⚠️ **LA PAROLA INTERA, non solo la radice che ha colpito.**
     *
     * La prima versione stampava `← radice nocciol` e basta, e a leggere «Filetto di sgombro con
     * limone e olive ← radice nocciol» non si capiva **da dove** venisse: ho dovuto indovinare che
     * fosse «olive denocciolate», e indovinare è esattamente la cosa che oggi è già costata quattro
     * volte. Adesso l'elenco dice la parola del piatto che ha fatto scattare la regola: si legge e
     * si decide, senza ipotesi.
     */
    const parolaChePorta = (testo: string, pezzo: string): string => {
      const i = testo.indexOf(pezzo);
      if (i === -1) return pezzo;
      let a = i; while (a > 0 && /[a-z0-9]/.test(testo[a - 1])) a -= 1;
      let b = i + pezzo.length; while (b < testo.length && /[a-z0-9]/.test(testo[b])) b += 1;
      return testo.slice(a, b);
    };

    for (const allergene of DA_GUARDARE) {
      const chiavi = [...exclusionKeys([allergene])];
      const radici = chiavi.map((k) => radiceChiave(k)).filter((x): x is string => !!x);

      const prima = fieno.filter(({ h }) => chiavi.some((k) => h.includes(k)));
      /** Adesso la radice conta solo se **comincia una parola**: è la correzione del 20/8 sera. */
      const inPiu = fieno.filter(({ h }) => !chiavi.some((k) => h.includes(k)) && radici.some((r) => iniziaUnaParola(h, r)));
      totaleInPiu += inPiu.length;

      const quota = ((prima.length / (ricette.length || 1)) * 100).toFixed(1);
      console.log(`${allergene.padEnd(18)} toglieva ${String(prima.length).padStart(5)} ricette (${quota}%) · in più: ${inPiu.length}`);
      for (const { r, h } of inPiu) {
        const colpite = radici.filter((x) => iniziaUnaParola(h, x));
        const parole = [...new Set(colpite.map((x) => parolaChePorta(h, x)))];
        console.log(`      ⚠️  ${r.name}   ← «${parole.join('», «')}»  (radice ${colpite.join(', ')})`);
      }

      /**
       * ⚠️ **E la stessa domanda sulla chiave INTERA, che non ho toccato.** «uovo» sta dentro
       * «nuovo»: se succedesse, sarebbe un difetto più vecchio della radice e non l'avrei mai visto,
       * perché il conto «in più» misura solo quello che la radice aggiunge. Qui si guarda e basta:
       * correggere anche questo giro vorrebbe dire toccare il comportamento che regge le esclusioni
       * da mesi, e prima si legge quanto pesa.
       */
      /**
       * ⚠️ **RAGGRUPPATE, non una riga per ricetta.** La prima versione ne stampava una per piatto:
       * 212 righe da leggere per scoprire che erano **due parole**. La domanda è «quali parole», non
       * «quali piatti», e un elenco che costringe a contare a mano è un elenco che non si legge.
       */
      const coppie = new Map<string, number>();
      for (const { h } of fieno) {
        for (const k of chiavi) {
          if (k.includes(' ')) continue;
          const i = h.indexOf(k);
          if (i <= 0) continue;
          if (!/[a-z0-9]/.test(h[i - 1])) continue;
          if (h.split(/[^a-z0-9]+/).includes(k)) continue; // c'è anche da sola: allora è giusta
          const chiaveCoppia = `${k}|${parolaChePorta(h, k)}`;
          coppie.set(chiaveCoppia, (coppie.get(chiaveCoppia) ?? 0) + 1);
          totaleDentro += 1;
          break;
        }
      }
      for (const [coppia, quante] of [...coppie.entries()].sort((a, b) => b[1] - a[1])) {
        const [k, parola] = coppia.split('|');
        console.log(`      ⛔ chiave intera dentro una parola — ${allergene}: «${k}» dentro «${parola}»  ×${quante}`);
      }
    }

    console.log(`\nLa radice toglie ${totaleInPiu} righe in più (dopo la correzione «solo a inizio di parola», 20/8 sera).`);
    console.log('Vanno lette una per una: adesso ognuna dice la PAROLA del piatto che l\'ha fatta scattare.');
    console.log('Se il piatto contiene davvero l\'allergene è un difetto chiuso; se non c\'entra niente,');
    console.log('la parola che si vede dice quale regola va rivista — la lunghezza della radice è solo una');
    console.log('delle possibili leve, e il 20/8 era quella sbagliata.');
    console.log(`\nChiavi intere che combaciano dentro una parola più lunga: ${totaleDentro}.`);
    if (totaleDentro > 0) {
      console.log('⛔ Questo è un difetto PIÙ VECCHIO della radice, e non è stato toccato.');
      console.log('⚠️ E NON si corregge come la radice: qui il confine di parola TOGLIEREBBE protezione.');
      console.log('   «aceto» dentro «sottaceto» è giusto — il sottaceto l\'aceto ce l\'ha davvero —');
      console.log('   mentre «vino» dentro «bovino» non lo è. Le due parole si leggono e si decide una');
      console.log('   per una: è una lista corta, non una regola.\n');
    }
    else console.log('✅ Nessuna: il giro della chiave esatta non ha questo problema, almeno su questo catalogo.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
