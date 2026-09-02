/**
 * LE PAROLE CHE TOLGONO PIATTI CHE NON C'ENTRANO — sola lettura.
 *
 * ⛔ **Nasce da una giornata storta, e dalla domanda che nessuno strumento faceva.**
 *
 * Il 1/9 ho trovato **tre omonimi** nel vocabolario delle esclusioni, uno alla volta e tutti per
 * caso, leggendo output che parlavano d'altro:
 *
 *   · «cicoria amara cruda (**ricciolina**)»  → presa per una ricciola, che è un pesce
 *   · «funghi misti (champignon, **ostriche**)» → prese per molluschi
 *   · «**riso sushi**»                        → preso per sushi
 *
 * ⚠️ Le diagnostiche che c'erano guardano il verso opposto: `diag:allergeni` chiede *«quanti
 * allergeni NON riconosciamo»*, `diag:allergeni-piatto` chiede *«sta già arrivando nel piatto?»*.
 * Nessuna chiedeva **quali parole tolgono roba che non c'entra** — e quello è il difetto che non fa
 * rumore: una cliente allergica ai molluschi si vede sparire i piatti di funghi, e non se ne
 * accorge nessuno perché un menu più povero non è un errore, è solo un menu più povero.
 *
 * ## Come si legge
 *
 * Per ogni parola del vocabolario, i **contesti distinti** in cui compare nel catalogo: la parola
 * col suo vicinato. Si scorre una volta sola e gli omonimi saltano all'occhio, perché sono quelli
 * che leggendoli suonano sbagliati — «riso sushi» in mezzo a «sushi di tonno», «ostriche» dentro un
 * elenco di funghi.
 *
 * ⚠️ **Si guardano prima i contesti RARI**, non i frequenti: «salmone fresco» compare trecento
 * volte ed è ovvio, «riso sushi» tre volte ed è quello che fa danno. L'elenco esce dal più raro.
 *
 * ⛔ **E questo tabulato non corregge niente e non deve.** Il rimedio a un omonimo è dichiararlo in
 * `PAROLE_CHE_NON_SONO` o in `FRASI_CHE_NON_SONO` — a mano, una parola per volta, sapendo cosa si
 * sta facendo. Quel vocabolario tiene al sicuro chi è allergico: sbagliare di là non è un piatto in
 * meno, è una persona in pronto soccorso.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:omonimi                     → pesce, crostacei, molluschi (i tre di ieri)
 *   ALLERGENE=latte npm run diag:omonimi     → una categoria sola
 *   TUTTI=1 npm run diag:omonimi             → tutte le categorie
 *   RARI=6 npm run diag:omonimi              → mostra i contesti che compaiono al massimo 6 volte
 */
import { PrismaClient } from '@prisma/client';
import { exclusionKeys, hitsExclusion, radiceChiave, recipeHaystack } from '../src/menu/exclusions';

const prisma = new PrismaClient();
/** ⚠️ Sopra questa frequenza un contesto è la normalità, non una sorpresa: si nasconde per far leggere il resto. */
const RARI = Math.max(1, Number(process.env.RARI ?? 8) || 8);
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 12) || 12);
const TUTTI = process.env.TUTTI === '1';
const UNO = (process.env.ALLERGENE ?? '').trim();

const CATEGORIE_DI_IERI = ['pesce', 'crostacei', 'molluschi'];
const TUTTE = [
  'latte', 'glutine', 'uova', 'pesce', 'crostacei', 'molluschi', 'soia', 'sesamo',
  'arachidi', 'frutta a guscio', 'legumi', 'sedano', 'senape', 'lupini', 'solfiti',
];

const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

/**
 * Il vicinato di una parola: due parole prima, la parola, una dopo.
 *
 * ⚠️ Il vicinato è la cosa che distingue «riso **sushi**» da «**sushi** di tonno», e la parola da
 * sola non lo direbbe mai. È tutto il valore di questo tabulato.
 */
function contesto(testo: string, dove: number, quanto: number): string {
  const prima = testo.slice(0, dove).split(/\s+/).slice(-2).join(' ');
  const dopo = testo.slice(dove + quanto).split(/\s+/).slice(0, 2).join(' ');
  /** ⚠️ La parola trovata si marca: senza, in una riga di sei parole non si capisce quale sia. */
  return `${prima} [${testo.slice(dove, dove + quanto)}] ${dopo}`.trim().replace(/\s+/g, ' ');
}

async function main() {
  const categorie = UNO ? [UNO] : TUTTI ? TUTTE : CATEGORIE_DI_IERI;
  titolo('LE PAROLE CHE TOLGONO PIATTI CHE NON C\'ENTRANO — sola lettura');
  riga('');
  riga(`  Categorie guardate: ${categorie.join(', ')}.`);
  riga(`  Si mostrano i contesti che compaiono al massimo ${RARI} volte (RARI=… per cambiare).`);

  const ricette = (await prisma.recipe.findMany({
    where: { active: true },
    select: { name: true, ingredients: true },
  })) as unknown as { name: string; ingredients: unknown }[];
  riga(`  Ricette attive lette: ${ricette.length}.`);
  riga('  ⚠️ Il testo è nome + ingredienti attaccati, quindi una parola può comparire due volte di');
  riga('  fila («sushi di tonno» + «tonno fresco»): non è un doppione, è il nome che incontra la lista.');

  for (const cat of categorie) {
    const chiavi = [...exclusionKeys([cat])];
    if (!chiavi.length) { riga(''); riga(`  ⚠️ «${cat}» non è una categoria del vocabolario: saltata.`); continue; }

    /** chiave → contesto → quante volte. */
    const perChiave = new Map<string, Map<string, number>>();
    let colpite = 0;
    for (const r of ricette) {
      const testo = recipeHaystack(r.name, r.ingredients);
      const k = hitsExclusion(testo, chiavi);
      if (!k) continue;
      colpite += 1;
      /**
       * ⚠️ Si cerca prima la parola intera e poi la radice, **nello stesso ordine di
       * `hitsExclusion`**: se qui si cercasse solo la parola intera, gli omonimi della radice — che
       * sono quelli che fanno più danno, «ricciolina» docet — non comparirebbero mai.
       */
      const r1 = radiceChiave(k);
      let dove = testo.indexOf(k);
      let quanto = k.length;
      if (dove === -1 && r1) { dove = testo.indexOf(r1); quanto = r1.length; }
      if (dove === -1) continue;
      const c = contesto(testo, dove, quanto);
      const dentro = perChiave.get(k) ?? new Map<string, number>();
      dentro.set(c, (dentro.get(c) ?? 0) + 1);
      perChiave.set(k, dentro);
    }

    titolo(`${cat.toUpperCase()} — ${colpite} ricette colpite, ${perChiave.size} parole del vocabolario in uso`);
    if (!perChiave.size) { riga(''); riga('  Nessuna ricetta colpita.'); continue; }

    const righe = [...perChiave.entries()]
      .map(([k, ctx]) => ({
        chiave: k,
        rari: [...ctx.entries()].filter(([, n]) => n <= RARI).sort((a, b) => a[1] - b[1]),
        totale: [...ctx.values()].reduce((s, n) => s + n, 0),
      }))
      .filter((x) => x.rari.length)
      .sort((a, b) => a.totale - b.totale);

    if (!righe.length) { riga(''); riga(`  ✅ Nessun contesto raro: ogni parola compare più di ${RARI} volte, e sono tutti casi normali.`); continue; }
    riga('');
    riga('  ⚠️ Si leggono UNO PER UNO, e la domanda è una sola: «questo piatto contiene davvero');
    riga(`  ${cat}?». Se no, la parola va dichiarata omonima in \`exclusions.ts\` — a mano.`);
    for (const x of righe) {
      riga('');
      riga(`  · «${x.chiave}»  (${x.totale} ricette in tutto)`);
      for (const [c, n] of x.rari.slice(0, ESEMPI)) riga(`      ${String(n).padStart(3)}×  …${c}…`);
      if (x.rari.length > ESEMPI) riga(`      … e altri ${x.rari.length - ESEMPI} contesti rari.`);
    }
  }

  riga('');
  riga('  Fine. Niente è stato scritto.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
