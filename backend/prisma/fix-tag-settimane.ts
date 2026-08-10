/**
 * CORREZIONE UNA-TANTUM: il tag `sett:N` deve dire DOVE la ricetta è usata.
 *
 * Simone, 11/8: «io sto impazzendo perché quel tag per me è dove viene utilizzato, non mi interessa
 * quando è stato creato». Ed era il difetto: il tag lo scriveva il generatore **alla nascita** della
 * ricetta, quindi registrava in quale generazione era stata prodotta. Un piatto creato generando la
 * settimana 1 e poi usato nella settimana 2 continuava a portare `sett:1`, e guardando il catalogo si
 * leggeva «tutte nella prima settimana» su una dieta distribuita su due.
 *
 * Da adesso il generatore scrive quel tag leggendolo dalle **giornate** (`engine-rules.service.ts` →
 * `sincronizzaTagSettimane`). Questo comando fa la stessa cosa su quello che c'è già.
 *
 * Che cosa cambia, riga per riga:
 *  · una ricetta usata nella settimana 3 → `sett:3`, qualunque cosa dicesse prima;
 *  · una ricetta usata in più settimane → più tag (`sett:1`, `sett:4`): non è un caso da nascondere,
 *    è il modo più rapido di vedere se il ciclo si ripete invece di allungarsi;
 *  · una ricetta che **nessuna giornata usa** → perde ogni `sett:*`. Sono le orfane, generate e fuori
 *    dal ciclo: dire «settimana 1» su un piatto che nessuno serve è l'informazione falsa da cui è
 *    nato tutto questo.
 *
 * Gli altri tag (`gen:*`, `dieta:*`, quelli scritti a mano) non si toccano.
 *
 * USO (shell di Render, dentro la cartella del backend):
 *   npm run fix:tag-settimane                 → mostra cosa cambierebbe, non scrive
 *   CONFERMA=1 npm run fix:tag-settimane      → applica
 */
import { PrismaClient } from '@prisma/client';
import { eTagSettimana, settimaneDiUtilizzo, sincronizzaTagSettimane, tagSettimana } from '../src/menu/tag-settimane';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const usi = await settimaneDiUtilizzo(prisma as never);
  const ricette = (await prisma.recipe.findMany({ select: { id: true, name: true, tags: true } })) as {
    id: string; name: string; tags: string[];
  }[];

  const daCorreggere: { nome: string; prima: string; dopo: string }[] = [];
  let orfane = 0;
  for (const r of ricette) {
    const attuali = r.tags ?? [];
    const settimane = usi.get(r.id) ?? [];
    const nuovi = [...attuali.filter((t) => !eTagSettimana(t)), ...settimane.map(tagSettimana)];
    if ([...attuali].sort().join('|') === [...nuovi].sort().join('|')) continue;
    if (settimane.length === 0) orfane += 1;
    daCorreggere.push({
      nome: r.name,
      prima: attuali.filter(eTagSettimana).join(', ') || '—',
      dopo: settimane.map(tagSettimana).join(', ') || '— (nessuna giornata la usa)',
    });
  }

  console.log(`\nRicette in catalogo: ${ricette.length}`);
  console.log(`Da correggere: ${daCorreggere.length} (di cui ${orfane} fuori dal ciclo, che perdono il tag)\n`);
  if (daCorreggere.length === 0) {
    console.log('I tag delle settimane sono già allineati alle giornate. Niente da fare.\n');
    return;
  }
  console.table(daCorreggere.slice(0, 40));
  if (daCorreggere.length > 40) console.log(`… e altre ${daCorreggere.length - 40}`);

  if (!conferma) {
    console.log('\nNiente è stato scritto. Ripeti con CONFERMA=1 per applicare.\n');
    return;
  }

  const esito = await sincronizzaTagSettimane(prisma as never);
  console.log(
    `\n✅ Tag allineati alle giornate: ${esito.corrette} corrette, ${esito.giaGiuste} già giuste, ` +
      `${esito.orfaneRipulite} orfane ripulite.`,
  );
  console.log('   Gli altri tag (gen:*, dieta:*, quelli scritti a mano) non sono stati toccati.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
