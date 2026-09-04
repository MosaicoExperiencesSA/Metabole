/**
 * ⛔ **CARNE E PESCE A COLAZIONE, SPUNTINO E MERENDA — quanti sono, dove, e cosa resta togliendoli.**
 *
 * Simone, 31/8: *«carne, pesce e verdure evitiamole nelle colazioni, merende e spuntini»*. La
 * regola è stata scritta quel giorno, ma applicata in **un posto solo**: l'agente che *genera* i
 * piatti leggeri nuovi. ⛔ Su quello che era già in catalogo non l'ha mai passata nessuno — e il
 * 4/9 lui l'ha visto in pagina: «Basso indice glicemico · Onnivoro · Colazione» con dentro branzino
 * al vapore, burger di merluzzo, dentice, filetto di trota, salmone affumicato. Il motore da quel
 * paniere ci pesca.
 *
 * ⛔ **E il numero che decide non è quanti ne escono: è quanti ne RESTANO.** Una colazione che
 * rimane con tre piatti serve alla cliente lo stesso piatto a giorni alterni, e dopo tre giorni
 * smette di aprire l'app. Sotto `MINIMO_PER_CELLA` la cella si nomina e **non si tocca**: prima va
 * riempita.
 *
 * ⚠️ **Le verdure si contano e non si tolgono**, ed è una scelta scritta nel modulo: «Avocado
 * toast» e «Crepes con spinaci» sono colazioni normali, e `diCosaE` le legge come verdura per via
 * dell'ingrediente più pesante.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:colazioni-con-carne             → tabulato, non scrive
 *   APPLICA=1 npm run diag:colazioni-con-carne   → toglie le righe dalle celle sopra la soglia
 *
 * ⚠️ `APPLICA=1` **non cancella nessuna ricetta**: toglie solo l'appartenenza a quella cella di
 * quel paniere. A pranzo e a cena quei piatti restano dove sono.
 */
import { PrismaClient } from '@prisma/client';
import { nomiIngredienti } from '../src/catalog/elenco-ingredienti';
import {
  guardaLeCelle, celleDaPulire, celleTroppoVuote, MINIMO_PER_CELLA,
  PASTI_SENZA_CARNE_PESCE_VERDURA, type Cella,
} from '../src/catalog/colazione-senza-carne-e-pesce';

const prisma = new PrismaClient();
const APPLICA = process.env.APPLICA === '1';
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 12) || 12);

const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

/** I grammi di un ingrediente, quando ci sono: servono a `diCosaE`, che senza non indovina. */
function pesati(ingredients: unknown): { name: string; grammi: number | null }[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map((i) => {
    const o = (i ?? {}) as { name?: unknown; qty?: unknown };
    const g = typeof o.qty === 'number' ? o.qty : Number(o.qty);
    return { name: typeof o.name === 'string' ? o.name : '', grammi: Number.isFinite(g) ? g : null };
  }).filter((x) => x.name);
}

async function main(): Promise<void> {
  titolo('CARNE E PESCE NEI PASTI LEGGERI — colazione, spuntino, merenda');
  riga('');
  riga(`  Pasti guardati: ${PASTI_SENZA_CARNE_PESCE_VERDURA.join(', ')}`);
  riga(`  Soglia: sotto ${MINIMO_PER_CELLA} piatti rimasti la cella NON si pulisce.`);
  riga(APPLICA ? '  ⛔ APPLICA=1: le righe sopra la soglia verranno TOLTE.' : '  ⚠️ Sola lettura: non scrive niente.');

  const righe = (await prisma.paniereRicetta.findMany({
    where: { slot: { in: [...PASTI_SENZA_CARNE_PESCE_VERDURA] } },
    select: {
      id: true, recipeId: true, slot: true, paniereId: true,
      paniere: { select: { famiglia: true, regime: true, stato: true } },
      /** ⚠️ Solo le ATTIVE: una bozza spenta non arriva nel piatto di nessuno. */
      recipe: { select: { name: true, ingredients: true, active: true } },
    },
  })) as unknown as {
    id: string; recipeId: string; slot: string; paniereId: string;
    paniere: { famiglia: string; regime: string; stato: string };
    recipe: { name: string; ingredients: unknown; active: boolean };
  }[];

  const vive = righe.filter((r) => r.recipe?.active);
  const perCella = new Map<string, Cella & { righeId: Map<string, string> }>();
  for (const r of vive) {
    const chiave = `${r.paniereId}·${r.slot}`;
    if (!perCella.has(chiave)) {
      perCella.set(chiave, {
        paniereId: r.paniereId,
        etichetta: `${r.paniere.famiglia} · ${r.paniere.regime}${r.paniere.stato === 'attivo' ? '' : ` (${r.paniere.stato})`}`,
        slot: r.slot,
        piatti: [],
        righeId: new Map(),
      });
    }
    const c = perCella.get(chiave) as Cella & { righeId: Map<string, string>; piatti: unknown[] };
    (c.piatti as unknown[]).push({
      id: r.recipeId,
      nome: r.recipe.name,
      ingredienti: nomiIngredienti(r.recipe.ingredients),
      pesati: pesati(r.recipe.ingredients),
    });
    c.righeId.set(r.recipeId, r.id);
  }

  const celle = [...perCella.values()];
  const esiti = guardaLeCelle(celle);
  const daPulire = celleDaPulire(esiti);
  const troppoVuote = celleTroppoVuote(esiti);
  const fuoriPostoInTutto = esiti.reduce((n, e) => n + e.fuoriPosto.length, 0);

  titolo('QUANTI SONO');
  riga('');
  riga(`  Righe di paniere guardate (ricetta attiva)   ${vive.length}`);
  riga(`  Celle (paniere × pasto)                      ${celle.length}`);
  riga(`  Piatti di carne o pesce lì dentro            ${fuoriPostoInTutto}`);
  riga(`  Celle che si possono pulire                  ${daPulire.length}`);
  riga(`  ⛔ Celle che resterebbero sotto la soglia     ${troppoVuote.length}`);

  if (troppoVuote.length) {
    titolo('⛔ QUESTE NON SI TOCCANO: prima vanno riempite');
    riga('');
    for (const e of troppoVuote) {
      riga(`  ${e.etichetta} · ${e.slot}: ${e.quanti} piatti, ${e.fuoriPosto.length} da togliere → ne resterebbero ${e.restano}`);
    }
    riga('');
    riga('  ⚠️ Una colazione che resta con pochi piatti serve lo stesso piatto a giorni alterni.');
    riga('     Il branzino a colazione è sbagliato; una colazione che non c\'è è peggio.');
  }

  titolo(`QUALI SONO — le prime ${ESEMPI} celle`);
  riga('');
  for (const e of [...daPulire].sort((a, b) => b.fuoriPosto.length - a.fuoriPosto.length).slice(0, ESEMPI)) {
    riga(`  ${e.etichetta} · ${e.slot}  (${e.quanti} piatti → ne restano ${e.restano})`);
    for (const f of e.fuoriPosto) {
      riga(`     · «${f.nome}»`);
      riga(`         ${f.motivo}: «${f.prova}»${f.diCosa ? `  · l'ingrediente principale dice: ${f.diCosa}` : ''}`);
    }
    if (e.verdure) riga(`     ⚠️ e ${e.verdure} piatti di verdura, che si contano e NON si tolgono.`);
    riga('');
  }
  if (daPulire.length > ESEMPI) riga(`  …e altre ${daPulire.length - ESEMPI}. Alza ESEMPI per vederle.`);

  if (!APPLICA) {
    titolo('COME SI LEGGE');
    riga('');
    riga('  ⚠️ Ogni riga sopra va letta: la domanda è «questo piatto a colazione ci sta?».');
    riga('     Se una riga non c\'entra niente, sbaglia il riconoscitore — e allora sbaglia anche');
    riga('     dove nessuno lo sta guardando. Dillo prima di applicare.');
    riga('');
    /**
     * ⚠️ **Il numero qui è quello che verrebbe tolto DAVVERO**, non il totale: le righe delle celle
     * sotto la soglia non si toccano, e stampare il totale prometterebbe una pulizia più grande di
     * quella che poi succede.
     */
    const togliDavvero = daPulire.reduce((n, e) => n + e.fuoriPosto.length, 0);
    riga(`  Per togliere ${togliDavvero} righe da ${daPulire.length} cell${daPulire.length === 1 ? 'a' : 'e'} sopra la soglia:`);
    riga('     APPLICA=1 npm run diag:colazioni-con-carne');
    riga('  ⚠️ Non cancella nessuna ricetta: toglie l\'appartenenza a quella cella. A pranzo e a cena restano.');
    return;
  }

  const daTogliere: string[] = [];
  for (const e of daPulire) {
    const c = perCella.get(`${e.paniereId}·${e.slot}`);
    for (const f of e.fuoriPosto) {
      const id = c?.righeId.get(f.id);
      if (id) daTogliere.push(id);
    }
  }
  titolo('SCRITTURA');
  riga('');
  const esito = await prisma.paniereRicetta.deleteMany({ where: { id: { in: daTogliere } } });
  riga(`  Righe tolte: ${esito.count} (proposte: ${daTogliere.length})`);
  riga('  ⚠️ Nessuna ricetta cancellata: solo l\'appartenenza a quelle celle.');
  riga(`  ⛔ Le ${troppoVuote.length} celle sotto la soglia NON sono state toccate.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => { void prisma.$disconnect(); });
