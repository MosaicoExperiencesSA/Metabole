/**
 * ⛔ **LE RIGHE DI PANIERE RIMASTE NELLA CELLA SBAGLIATA.**
 *
 * Simone, 4/9 sera, guardando una frittata da **cena** dentro `Basso indice glicemico · Onnivoro ·
 * Colazione`: *«il nutrizionista è entrato in una ricetta che aveva già messo come cena, ha
 * risalvato e resta nel paniere delle colazioni... perché?»*.
 *
 * Perché `Recipe.mealSlot` e `PaniereRicetta.slot` sono due colonne diverse, e fino al 4/9
 * `updateRecipe` scriveva solo la prima: ogni ricetta spostata di pasto in passato ha lasciato le
 * sue righe dov'erano. La correzione chiude la falla **in avanti**; questo script ripara **il
 * passato**, che altrimenti resta storto per sempre — e nessuno lo vede, perché la scheda mostra il
 * pasto giusto.
 *
 * ⛔ **E il motore pesca da lì**: una riga storta è un piatto da cena proposto a colazione.
 *
 * ## ⛔ Quello che NON si sposta
 *
 * Le righe che finirebbero **dentro** colazione, spuntino o merenda con un piatto di carne o pesce
 * non si spostano: sarebbe riaprire la porta che il 4/9 è stata chiusa in quattro punti. Si contano
 * e si nominano, e si guardano con `npm run diag:colazioni-con-carne`.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:pasti-disallineati              → tabulato, NON scrive
 *   APPLICA=1 npm run diag:pasti-disallineati    → rimette le righe nella cella giusta
 *   ESEMPI=40 npm run diag:pasti-disallineati    → più righe negli elenchi (default 20)
 */
import { PrismaClient } from '@prisma/client';
import { slotCapofila, etichettaSlot } from '../src/common/slot-pasto';
import { fuoriPostoNelPasto } from '../src/catalog/colazione-senza-carne-e-pesce';
import { cosaFareDelleRighe } from '../src/catalog/ricetta-che-cambia-pasto';

const prisma = new PrismaClient();
const APPLICA = process.env.APPLICA === '1';
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 20) || 20);

const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main(): Promise<void> {
  titolo('RIGHE DI PANIERE NELLA CELLA SBAGLIATA');
  riga('');
  riga(APPLICA ? '  ⛔ APPLICA=1: le righe verranno RIMESSE nella cella del loro pasto.' : '  ⚠️ Sola lettura: non scrive niente.');

  const righe = (await prisma.paniereRicetta.findMany({
    select: {
      id: true, recipeId: true, slot: true, paniereId: true,
      paniere: { select: { famiglia: true, regime: true } },
      recipe: { select: { name: true, mealSlot: true, ingredients: true, active: true } },
    },
  })) as unknown as {
    id: string; recipeId: string; slot: string; paniereId: string;
    paniere: { famiglia: string; regime: string };
    recipe: { name: string; mealSlot: string; ingredients: unknown; active: boolean } | null;
  }[];

  /** Le righe raggruppate per ricetta: la decisione si prende su tutte insieme, come al salvataggio. */
  const perRicetta = new Map<string, typeof righe>();
  for (const r of righe) {
    if (!r.recipe) continue;
    perRicetta.set(r.recipeId, [...(perRicetta.get(r.recipeId) ?? []), r]);
  }

  const daSpostare: { id: string; a: string }[] = [];
  const daTogliere: string[] = [];
  /** ⛔ Quelle che non si spostano perché entrerebbero in un pasto leggero con carne o pesce. */
  const bloccate: string[] = [];
  const esempi: string[] = [];
  /** ⚠️ Contate qui dentro, non ricalcolate dopo con una riga illeggibile: due conti divergono. */
  let ricetteStorte = 0;

  for (const [recipeId, sue] of perRicetta) {
    const ric = sue[0].recipe!;
    const destinazione = slotCapofila(ric.mealSlot);
    const storte = sue.filter((r) => slotCapofila(r.slot) !== destinazione);
    if (!storte.length) continue;
    ricetteStorte += 1;

    const vietato = fuoriPostoNelPasto(
      { id: recipeId, name: ric.name, ingredients: ric.ingredients },
      destinazione,
    );
    if (vietato) {
      bloccate.push(`${ric.name} → ${etichettaSlot(destinazione)}: ${vietato}`);
      continue;
    }

    const esito = cosaFareDelleRighe(sue.map((r) => ({ id: r.id, paniereId: r.paniereId, slot: r.slot })), ric.mealSlot);
    for (const id of esito.daSpostare) daSpostare.push({ id, a: destinazione });
    daTogliere.push(...esito.daTogliere);
    if (esempi.length < ESEMPI) {
      const dove = storte.map((r) => `${r.paniere.famiglia} · ${r.paniere.regime} · ${etichettaSlot(r.slot)}`);
      esempi.push(
        `  «${ric.name}»${ric.active ? '' : ' (bozza)'} è ${etichettaSlot(ric.mealSlot)}, ma sta in:\n`
        + dove.map((d) => `        ${d}`).join('\n'),
      );
    }
  }

  titolo('QUANTE SONO');
  riga('');
  riga(`  Righe di paniere in tutto                    ${righe.length}`);
  riga(`  Ricette con almeno una riga storta           ${ricetteStorte}`);
  riga(`  Righe da rimettere a posto                   ${daSpostare.length}`);
  riga(`  Righe da togliere (doppione a destinazione)  ${daTogliere.length}`);
  riga(`  ⛔ Ricette che NON si spostano                ${bloccate.length}`);
  riga('');
  riga('  ⚠️ Una riga storta è un piatto proposto nel pasto sbagliato: la scheda mostra il pasto');
  riga('     giusto, e il motore pesca dalla cella. Nessuno dei due dice che non coincidono.');

  if (bloccate.length) {
    titolo('⛔ QUESTE NON SI SPOSTANO: entrerebbero in un pasto leggero');
    riga('');
    riga('  ⚠️ Spostarle vorrebbe dire riaprire la porta chiusa il 4/9 in quattro punti. Le loro');
    riga('     righe restano dove sono: si guardano con `npm run diag:colazioni-con-carne`.');
    riga('');
    for (const b of bloccate.slice(0, ESEMPI)) riga(`  · ${b}`);
    if (bloccate.length > ESEMPI) riga(`  …e altre ${bloccate.length - ESEMPI}.`);
  }

  if (esempi.length) {
    titolo(`QUALI SONO — le prime ${ESEMPI}`);
    riga('');
    for (const e of esempi) { riga(e); riga(''); }
  }

  if (!APPLICA) {
    titolo('COME SI LEGGE');
    riga('');
    riga('  ⚠️ Ogni riga va letta: se una ricetta risulta di un pasto che non è il suo, il problema');
    riga('     è il pasto della ricetta, non la riga del paniere — e allora si corregge la scheda.');
    riga('');
    riga(`  Per rimettere a posto ${daSpostare.length} righe (e toglierne ${daTogliere.length} doppie):`);
    riga('     APPLICA=1 npm run diag:pasti-disallineati');
    riga('  ⚠️ Non cancella nessuna ricetta: sposta l\'appartenenza nella cella del pasto giusto.');
    return;
  }

  titolo('SCRITTURA');
  riga('');
  /**
   * ⚠️ **Una `updateMany` per destinazione**, non una per riga: sono cinque gruppi al massimo, e
   * quattromila chiamate singole su Render sono un quarto d'ora di attesa per lo stesso risultato.
   */
  let spostate = 0;
  for (const slot of [...new Set(daSpostare.map((x) => x.a))]) {
    const ids = daSpostare.filter((x) => x.a === slot).map((x) => x.id);
    const esito = await prisma.paniereRicetta.updateMany({ where: { id: { in: ids } }, data: { slot } });
    spostate += esito.count;
    riga(`  ${etichettaSlot(slot)}: ${esito.count} righe rimesse a posto.`);
  }
  const tolte = daTogliere.length
    ? (await prisma.paniereRicetta.deleteMany({ where: { id: { in: daTogliere } } })).count
    : 0;
  riga('');
  riga(`  Totale: ${spostate} spostate, ${tolte} tolte perché doppie.`);
  riga(`  ⛔ Le ${bloccate.length} ricette che entrerebbero in un pasto leggero non sono state toccate.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => { void prisma.$disconnect(); });
