/**
 * CARNE E PESCE DOVE NON DEVONO STARE — sola lettura, e li NOMINA.
 *
 * Nato l'1/9 da una riga di `diag:pescetariane` che parlava d'altro: *«Mediterranea × vegetarian:
 * **5 piatti con carne** su 1244 attivi»*. In un paniere vegetariano la risposta giusta è zero, e
 * cinque non è un dettaglio di una migrazione pescetariana — è **quello che una vegetariana può
 * ricevere nel piatto**, che è un problema più grosso e di altre persone.
 *
 * ⛔ **E le due spiegazioni possibili sono opposte, per questo i piatti si NOMINANO.**
 *
 * 1. **Sono davvero con carne**: una ricetta vegetariana sbagliata, o messa nel paniere sbagliato.
 *    Va corretta, e intanto una cliente vegetariana può riceverla.
 * 2. **È il riconoscitore a sbagliare** (`piatto-di-cosa.ts` → `eCarne`): allora il difetto è mio e
 *    più largo, perché **è lo stesso riconoscitore che ha derivato i panieri pescetariani** — 1355
 *    ricette scartate come «carne» nella Fase 5. Un falso positivo qui vuol dire piatti buoni
 *    buttati là, in silenzio.
 *
 * ⚠️ Un conto non distingue le due. Solo i nomi lo fanno, e li deve leggere una persona: «Bresaola
 * di manzo» è il caso 1, «Insalata di bovino… no, di *vino* cotto» è il caso 2 — e non è
 * un'invenzione: il 23/8 «bovino» faceva scattare i solfiti perché contiene «vino».
 *
 * ⚠️ Nel paniere VEGANO si guarda anche il pesce: là la soglia è zero per tutti e due.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:carne-fuori-posto            → tutti i panieri vegani e vegetariani
 *   ESEMPI=60 npm run diag:carne-fuori-posto  → più nomi (default 25)
 *   TUTTI=1 npm run diag:carne-fuori-posto    → anche i panieri pescetariani (dove la carne è
 *                                               ugualmente vietata, ma il pesce no)
 */
import { PrismaClient } from '@prisma/client';
import { eCarne, ePesce } from '../src/catalog/piatto-di-cosa';
import { ricettaVaBene } from '../src/common/regimi';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 25) || 25);
const TUTTI = process.env.TUTTI === '1';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

/** ⚠️ Gli stessi regimi e la stessa domanda di `verdettoPescetariano`: nome + TUTTI gli ingredienti. */
const REGIMI_DA_GUARDARE = TUTTI ? ['vegan', 'vegetarian', 'pescetarian'] : ['vegan', 'vegetarian'];
const nomiIngredienti = (ing: unknown): string[] =>
  (Array.isArray(ing) ? (ing as { name?: string }[]) : [])
    .map((x) => (typeof x?.name === 'string' ? x.name : ''))
    .filter((x) => x !== '');

async function main() {
  titolo('CARNE (E PESCE) DOVE NON DEVONO STARE — sola lettura');
  riga('');
  riga(`  Panieri guardati: ${REGIMI_DA_GUARDARE.join(', ')}.`);

  const [righe, ricette] = await Promise.all([
    prisma.paniereRicetta.findMany({
      select: { recipeId: true, slot: true, paniere: { select: { famiglia: true, regime: true } } },
    }) as unknown as Promise<{ recipeId: string; slot: string; paniere: { famiglia: string; regime: string } }[]>,
    /** ⚠️ Solo le ATTIVE: una bozza spenta non arriva nel piatto di nessuno (§2.4, chiuso l'1/9). */
    /**
     * ⚠️ **E il `regime` della ricetta**, aggiunto l'1/9: è il dato che dice quale dei due è rotto.
     * Se il branzino è marcato `omnivore` ed è finito in un paniere vegano, a sbagliare è chi ha
     * riempito il paniere — e si chiude con un controllo al momento della scrittura. Se invece è
     * marcato `vegan`, il difetto è nella **ricetta** e nessun filtro sul paniere lo troverebbe:
     * andrebbe corretta in catalogo, una per una.
     */
    prisma.recipe.findMany({
      where: { active: true },
      select: { id: true, name: true, ingredients: true, regime: true },
    }) as unknown as Promise<{ id: string; name: string; ingredients: unknown; regime: string }[]>,
  ]);

  const perId = new Map(ricette.map((r) => [r.id, r]));
  const trovate: {
    chiave: string; nome: string; cosa: 'carne' | 'pesce'; slot: string; perche: string;
    regime: string; regimeVaBene: boolean;
  }[] = [];
  const perCella = new Map<string, { carne: number; pesce: number; totale: number }>();
  /** ⚠️ I due conti che decidono la correzione: chi ha il regime sbagliato e chi no. */
  let regimeIncompatibile = 0;
  let regimeCompatibile = 0;

  for (const r of righe) {
    if (!REGIMI_DA_GUARDARE.includes(r.paniere.regime)) continue;
    const ric = perId.get(r.recipeId);
    if (!ric) continue;
    const chiave = `${r.paniere.famiglia} × ${r.paniere.regime}`;
    const conto = perCella.get(chiave) ?? { carne: 0, pesce: 0, totale: 0 };
    conto.totale += 1;
    const pezzi = [ric.name, ...nomiIngredienti(ric.ingredients)];
    const carne = pezzi.find((p) => eCarne(p));
    /** ⚠️ Il pesce si guarda **solo nel vegano**: nel vegetariano e nel pescetariano non è un errore. */
    const pesce = r.paniere.regime === 'vegan' ? pezzi.find((p) => ePesce(p)) : undefined;
    const vaBene = ricettaVaBene(ric.regime, r.paniere.regime);
    const comune = { chiave, nome: ric.name, slot: r.slot, regime: ric.regime, regimeVaBene: vaBene };
    if (carne || pesce) { if (vaBene) regimeCompatibile += 1; else regimeIncompatibile += 1; }
    if (carne) { conto.carne += 1; trovate.push({ ...comune, cosa: 'carne', perche: carne }); }
    else if (pesce) { conto.pesce += 1; trovate.push({ ...comune, cosa: 'pesce', perche: pesce }); }
    perCella.set(chiave, conto);
  }

  titolo('1. QUANTE, PER CELLA');
  riga('');
  const sporche = [...perCella.entries()].filter(([, c]) => c.carne + c.pesce > 0);
  if (!sporche.length) {
    riga('  ✅ Nessun piatto con carne (né pesce nei vegani) in questi panieri. La soglia è zero, ed è rispettata.');
  } else {
    for (const [chiave, c] of sporche.sort((a, b) => (b[1].carne + b[1].pesce) - (a[1].carne + a[1].pesce))) {
      riga(`  · ${chiave.padEnd(38)} carne ${String(c.carne).padStart(4)}  pesce ${String(c.pesce).padStart(4)}   su ${c.totale} attivi`);
    }
  }

  titolo('2. QUALE DEI DUE È ROTTO — e questo decide la correzione');
  riga('');
  riga(`  Piatti segnalati in tutto                        ${trovate.length}`);
  riga(`  · col REGIME della ricetta incompatibile         ${regimeIncompatibile}`);
  riga(`  · col regime della ricetta COMPATIBILE           ${regimeCompatibile}`);
  riga('');
  riga('  ⚠️ I primi sono un errore di RIEMPIMENTO: la ricetta si dichiara onnivora e qualcuno');
  riga('  l\'ha messa in un paniere vegano. Si chiudono con un controllo alla scrittura — che la');
  riga('  pagina Panieri ha già e `riempi-panieri` no.');
  riga('  ⛔ I secondi sono un errore di CATALOGO: la ricetta dice di essere vegana e contiene');
  riga('  pesce. Nessun filtro sul paniere li troverebbe, e vanno corretti uno per uno.');

  titolo('3. QUALI SONO — e questa è la parte che si legge a mano');
  riga('');
  if (!trovate.length) {
    riga('  ✅ Niente da nominare.');
  } else {
    riga('  ⚠️ Si leggono UNO PER UNO, e la domanda è sempre la stessa: «è davvero carne?».');
    riga('  Se sì, la ricetta o la sua appartenenza vanno corrette. Se no, sbaglia il riconoscitore');
    riga('  — e allora sbaglia anche dove nessuno lo sta guardando: è lo stesso che ha derivato i');
    riga('  panieri pescetariani, scartando 1355 ricette come «carne».');
    riga('');
    for (const t of trovate.slice(0, ESEMPI)) {
      riga(`  · [${t.cosa}] ${t.chiave} · ${t.slot}   ricetta dichiarata «${t.regime}»${t.regimeVaBene ? '' : '  ⛔ INCOMPATIBILE'}`);
      riga(`      «${t.nome}»`);
      riga(`      ha fatto scattare: «${t.perche}»`);
    }
    if (trovate.length > ESEMPI) riga(`  … e altre ${trovate.length - ESEMPI}. ESEMPI=${trovate.length} per vederle tutte.`);
  }

  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
