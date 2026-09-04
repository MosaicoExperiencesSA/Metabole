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
  guardaLeCelle, celleDaPulire, celleTroppoVuote, daTogliere, MINIMO_PER_CELLA,
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
      recipe: { select: { name: true, ingredients: true, active: true } },
    },
  })) as unknown as {
    id: string; recipeId: string; slot: string; paniereId: string;
    paniere: { famiglia: string; regime: string; stato: string };
    recipe: { name: string; ingredients: unknown; active: boolean };
  }[];

  /**
   * ⛔ **ANCHE LE BOZZE — e la prima stesura le saltava tutte.**
   *
   * Il filtro era `r.recipe?.active`, col commento «una bozza spenta non arriva nel piatto di
   * nessuno». È vero **oggi** e falso **domani**: una bozza sta nel paniere, e il giorno che
   * qualcuno la valida — che è il senso della pagina Panieri, dove il filtro «Mostra solo in bozza»
   * esiste apposta — quel branzino entra in colazione senza che nessuno lo riguardi.
   *
   * ⚠️ Simone, 4/9, dopo aver lanciato `APPLICA=1` e aver riaperto la pagina con quel filtro: *«da
   * qui non ha tolto pesce, carne, molluschi e crostacei»*. Le celle attive erano pulite, quelle in
   * bozza intatte — e la matrice le mostra una accanto all'altra, quindi sembrava che la pulizia
   * non avesse fatto niente.
   *
   * ⚠️ Le due categorie si **contano separate** più sotto: «ho tolto N righe» e «ne stavano
   * arrivando N nel piatto delle clienti» non sono la stessa frase.
   */
  const vive = righe.filter((r) => r.recipe);
  const attive = righe.filter((r) => r.recipe?.active).length;
  const perCella = new Map<string, Cella & { righeId: Map<string, string>; stato: string }>();
  for (const r of vive) {
    const chiave = `${r.paniereId}·${r.slot}`;
    if (!perCella.has(chiave)) {
      perCella.set(chiave, {
        paniereId: r.paniereId,
        etichetta: `${r.paniere.famiglia} · ${r.paniere.regime}${r.paniere.stato === 'attivo' ? '' : ` (${r.paniere.stato})`}`,
        slot: r.slot,
        piatti: [],
        righeId: new Map(),
        stato: r.paniere.stato,
      });
    }
    const c = perCella.get(chiave) as Cella & { righeId: Map<string, string>; stato: string; piatti: unknown[] };
    (c.piatti as unknown[]).push({
      id: r.recipeId,
      nome: r.recipe.name,
      ingredienti: nomiIngredienti(r.recipe.ingredients),
      pesati: pesati(r.recipe.ingredients),
      /** ⚠️ Decide se la riga pesa sulla soglia: le bozze si tolgono sempre, vedi `daTogliere`. */
      attivo: r.recipe.active,
    });
    c.righeId.set(r.recipeId, r.id);
  }

  const celle = [...perCella.values()];
  const esiti = guardaLeCelle(celle);
  const daPulire = celleDaPulire(esiti);
  const troppoVuote = celleTroppoVuote(esiti);
  const fuoriPostoInTutto = esiti.reduce((n, e) => n + e.fuoriPosto.length, 0);
  const daTogliereInTutto = esiti.reduce((n, e) => n + daTogliere(e).length, 0);

  titolo('QUANTI SONO');
  riga('');
  riga(`  Righe di paniere guardate                    ${vive.length}  (${attive} ricette attive, ${vive.length - attive} in bozza)`);
  riga(`  Celle (paniere × pasto)                      ${celle.length}`);
  riga(`  Piatti di carne o pesce lì dentro            ${fuoriPostoInTutto}`);
  riga(`  …di cui si tolgono davvero                   ${daTogliereInTutto}`);
  riga(`  Celle in cui c'è qualcosa da togliere        ${daPulire.length}`);
  riga(`  ⛔ Celle le cui ATTIVE resterebbero sotto ${MINIMO_PER_CELLA}   ${troppoVuote.length}`);
  riga('');
  riga('  ⚠️ Le BOZZE si tolgono sempre: non arrivano nel piatto di nessuna cliente, quindi');
  riga('     toglierle non svuota niente — e lasciarle vorrebbe dire che quel branzino entra in');
  riga('     colazione il giorno che qualcuno le valida. La soglia protegge le ATTIVE.');
  riga('');
  /**
   * ⛔ **BOZZA O ATTIVO, DETTO PRIMA DI APPLICARE** — perché sono due cose diverse. Un paniere in
   * bozza non compone menu di nessuno: pulirlo non cambia niente oggi, cambia il giorno in cui
   * qualcuno lo accende. Un paniere attivo sta già pescando adesso.
   *
   * ⚠️ Simone, 4/9: *«bozze o attive»* — si puliscono tutti e due. Il numero si stampa lo stesso,
   * perché «ho tolto 400 righe» e «ne stavano arrivando 400 nel piatto delle clienti» non sono la
   * stessa frase, e chi legge il registro fra sei mesi deve poterle distinguere.
   *
   * ⛔ **E gli stati sono TRE, non due**: `bozza | attivo | chiuso` (schema). La prima stesura
   * contava «tutto ciò che non è attivo» e lo stampava come «in bozza» — un paniere chiuso finiva
   * dentro quella parola. È il difetto che qui si tratta come il peggiore di tutti: una riga che
   * afferma una cosa che i dati non dicono, in un numero che qualcuno rileggerà fra sei mesi. Lo
   * ha trovato una revisione avversariale prima di lanciare `APPLICA=1`.
   */
  const quanti = (elenco: readonly { paniereId: string; slot: string }[], stato: string) =>
    elenco.filter((e) => perCella.get(`${e.paniereId}·${e.slot}`)?.stato === stato).length;
  const altri = daPulire.length - quanti(daPulire, 'attivo') - quanti(daPulire, 'bozza') - quanti(daPulire, 'chiuso');
  riga(`  Di quelle da pulire: ${quanti(daPulire, 'attivo')} in panieri ATTIVI, ${quanti(daPulire, 'bozza')} in bozza, ${quanti(daPulire, 'chiuso')} chiusi.`);
  /** ⚠️ Uno stato che non conosciamo non si nasconde in una delle tre cifre: si nomina. */
  if (altri) riga(`  ⚠️ e ${altri} in panieri con uno stato che questo script non conosce.`);

  if (troppoVuote.length) {
    titolo('⛔ QUESTE NON SI TOCCANO: prima vanno riempite');
    riga('');
    for (const e of troppoVuote) {
      const attiviFuori = e.fuoriPosto.filter((f) => f.attivo).length;
      const bozzeFuori = e.fuoriPosto.length - attiviFuori;
      riga(`  ${e.etichetta} · ${e.slot}: ${e.attivi} attive, ${attiviFuori} di carne o pesce`);
      riga(`      togliendole ne resterebbero ${e.restanoAttivi}, sotto ${MINIMO_PER_CELLA}: restano dove sono.`);
      /** ⚠️ Le bozze della stessa cella invece si tolgono: dirlo qui evita la contraddizione. */
      if (bozzeFuori) riga(`      ⚠️ ma ${bozzeFuori} bozze fuori posto di questa cella SI TOLGONO: non arrivano a nessuno.`);
    }
    riga('');
    riga('  ⚠️ Una colazione che resta con pochi piatti serve lo stesso piatto a giorni alterni.');
    riga('     Il branzino a colazione è sbagliato; una colazione che non c\'è è peggio.');
  }

  titolo(`QUALI SONO — le prime ${ESEMPI} celle`);
  riga('');
  for (const e of [...daPulire].sort((a, b) => daTogliere(b).length - daTogliere(a).length).slice(0, ESEMPI)) {
    /**
     * ⛔ **Il numero è quello che resta DAVVERO, non `restanoAttivi`.**
     *
     * `restanoAttivi` risponde a «quante ne resterebbero togliendo tutte le fuori posto», ed è la
     * domanda che decide la soglia. Ma sotto soglia si tolgono **solo le bozze**, quindi stamparlo
     * qui prometteva una pulizia più grande di quella che poi succede — e contraddiceva
     * l'elenco delle righe stampato subito sotto. Trovato da una revisione prima della consegna.
     */
    const attiveTolte = daTogliere(e).filter((f) => f.attivo).length;
    riga(`  ${e.etichetta} · ${e.slot}  (${e.quanti} piatti, ${e.attivi} attive → ne restano ${e.attivi - attiveTolte} attive)`);
    for (const f of daTogliere(e)) {
      riga(`     · «${f.nome}»${f.attivo ? '' : '  (bozza)'}`);
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
     * ⚠️ **Il numero qui è quello che verrebbe tolto DAVVERO**, non il totale: nelle celle sotto la
     * soglia le righe attive non si toccano, e stampare il totale prometterebbe una pulizia più
     * grande di quella che poi succede.
     *
     * ⛔ **E le celle NON sono «sopra la soglia»**: `celleDaPulire` include anche quelle sotto, che
     * hanno delle bozze da togliere. L'aggettivo vecchio contraddiceva il conteggio — trovato da
     * una revisione prima della consegna.
     */
    const togliDavvero = daTogliereInTutto;
    riga(`  Per togliere ${togliDavvero} righe da ${daPulire.length} cell${daPulire.length === 1 ? 'a' : 'e'}:`);
    riga('     APPLICA=1 npm run diag:colazioni-con-carne');
    riga('  ⚠️ Non cancella nessuna ricetta: toglie l\'appartenenza a quella cella. A pranzo e a cena restano.');
    return;
  }

  const righeDaTogliere: string[] = [];
  for (const e of daPulire) {
    const c = perCella.get(`${e.paniereId}·${e.slot}`);
    for (const f of daTogliere(e)) {
      const id = c?.righeId.get(f.id);
      if (id) righeDaTogliere.push(id);
    }
  }
  titolo('SCRITTURA');
  riga('');
  const esito = await prisma.paniereRicetta.deleteMany({ where: { id: { in: righeDaTogliere } } });
  riga(`  Righe tolte: ${esito.count} (proposte: ${righeDaTogliere.length})`);
  riga('  ⚠️ Nessuna ricetta cancellata: solo l\'appartenenza a quelle celle.');
  riga(`  ⛔ In ${troppoVuote.length} celle le ricette ATTIVE fuori posto non sono state toccate:`);
  riga(`     toglierle lascerebbe la cella sotto ${MINIMO_PER_CELLA} piatti attivi. Le bozze di quelle`);
  riga('     celle invece sì: non arrivano a nessuno, e toglierle non svuota niente.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => { void prisma.$disconnect(); });
