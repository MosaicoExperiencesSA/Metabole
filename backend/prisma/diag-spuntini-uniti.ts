/**
 * QUANTO CRESCE IL PANIERE DEGLI SPUNTINI — sola lettura.
 *
 * ⚠️ Decisione di Simone dell'1/9 (Fase 2 del piano): **un piatto pensato per le 10:30 va bene
 * anche alle 17**. Da quella riga spuntino e merenda pescano dallo stesso paniere. Questo tabulato
 * dice, paniere per paniere, cosa vede uno spuntino prima e dopo l'unione.
 *
 * ⛔ **NON SCRIVE NIENTE.** In catalogo non è cambiata una riga: le ricette hanno ancora il loro
 * `mealSlot`, l'unione avviene quando si sceglie. Questo conta l'effetto, non lo produce.
 *
 * ⚠️ La colonna che conta è **il minore dei due**: un paniere con 80 spuntini e 4 merende, prima,
 * lasciava la merenda con 4 piatti da girare per 84 giornate — cioè la stessa cosa venti volte.
 * Dopo l'unione ne ha 84. È lì che la decisione si vede, non nella somma.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:spuntini            → tutti i panieri che hanno almeno uno dei due pasti
 *   ESEMPI=60 npm run diag:spuntini  → più righe (default 30)
 */
import { PrismaClient } from '@prisma/client';
import { SLOT_SCAMBIABILI } from '../src/common/slot-pasto';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 30) || 30);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

const [MATTINA, POMERIGGIO] = SLOT_SCAMBIABILI[0];

async function main() {
  titolo('SPUNTINO E MERENDA — cosa vede il paniere prima e dopo l\'unione');

  const righe = (await prisma.paniereRicetta.findMany({
    where: { slot: { in: [MATTINA, POMERIGGIO] } },
    select: { slot: true, recipeId: true, paniere: { select: { famiglia: true, regime: true } } },
  })) as { slot: string; recipeId: string; paniere: { famiglia: string; regime: string } }[];

  if (!righe.length) {
    riga('');
    riga('  Nessuna riga di spuntino o merenda nei panieri.');
    riga('  ⚠️ Se `npm run panieri:riempi` è già passato, vuol dire che nessuna variante');
    riga('     ha questi pasti nelle sue giornate — cosa che sarebbe una notizia.');
    return;
  }

  const celle = new Map<string, { famiglia: string; regime: string; mattina: Set<string>; pomeriggio: Set<string> }>();
  for (const r of righe) {
    const k = `${r.paniere.famiglia}|${r.paniere.regime}`;
    const c = celle.get(k) ?? { famiglia: r.paniere.famiglia, regime: r.paniere.regime, mattina: new Set<string>(), pomeriggio: new Set<string>() };
    (r.slot === MATTINA ? c.mattina : c.pomeriggio).add(r.recipeId);
    celle.set(k, c);
  }

  const elenco = [...celle.values()]
    .map((c) => {
      const unito = new Set([...c.mattina, ...c.pomeriggio]).size;
      const minore = Math.min(c.mattina.size, c.pomeriggio.size);
      return { ...c, spuntini: c.mattina.size, merende: c.pomeriggio.size, unito, minore, guadagno: unito - minore };
    })
    .sort((a, b) => b.guadagno - a.guadagno || `${a.famiglia}|${a.regime}`.localeCompare(`${b.famiglia}|${b.regime}`));

  riga('');
  riga(`  Panieri con almeno uno dei due pasti: ${elenco.length}`);
  riga(`  Panieri dove uno dei due era VUOTO: ${elenco.filter((e) => e.minore === 0).length}`);
  riga('');
  riga('  ┌─ famiglia × regime ────────────────────────┬ spunt ┬ meren ┬ unito ┐');
  for (const e of elenco.slice(0, ESEMPI)) {
    const nome = `${e.famiglia} · ${e.regime}`.slice(0, 42).padEnd(42);
    riga(`  │ ${nome} │ ${String(e.spuntini).padStart(5)} │ ${String(e.merende).padStart(5)} │ ${String(e.unito).padStart(5)} │`);
  }
  riga('  └────────────────────────────────────────────┴───────┴───────┴───────┘');
  if (elenco.length > ESEMPI) riga(`  …e altri ${elenco.length - ESEMPI}. Alza ESEMPI per vederli.`);

  const primaPeggiore = elenco.reduce((s, e) => s + e.minore, 0);
  const dopo = elenco.reduce((s, e) => s + e.unito, 0);
  riga('');
  riga(`  Sommando il pasto messo peggio di ogni paniere: prima ${primaPeggiore} piatti, dopo ${dopo}.`);
  riga('  ⚠️ È il numero onesto: la varietà di una cliente la decide il pasto più povero che riceve,');
  riga('     non la media.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
