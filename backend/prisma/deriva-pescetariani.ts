/**
 * I PANIERI PESCETARIANI SI DERIVANO — Fase 5 del piano panieri.
 *
 * Un paniere pescetariano di una famiglia è: il paniere VEGETARIANO della stessa famiglia, più i
 * piatti di PESCE di quello onnivoro.
 *
 * ⛔ **SOLA LETTURA finché non gli si dice `APPLICA=1`.** Senza, stampa il tabulato e non scrive
 * niente. Con, aggiunge righe a `paniere_ricetta` — e **soltanto** aggiunge: non cancella niente,
 * non tocca il catalogo, non crea nessuna ricetta.
 *
 * ⚠️ **È un'assegnazione, non una generazione.** Nessuna ricetta nuova: si dice che ricette che
 * esistono già appartengono anche a questo paniere. Nove panieri pescetariani su dieci erano vuoti
 * ed era atteso — nessuno li ha mai riempiti a mano, e riempirli a mano sarebbe stato riscrivere
 * piatti che ci sono.
 *
 * ⛔ **Il pesce si riconosce con l'elenco delle esclusioni**, quello che tiene al sicuro chi è
 * allergico (67 termini per «pesce», più crostacei e molluschi). Non ne esiste un secondo, ed è
 * voluto: due elenchi di pesci sono due elenchi che un giorno divergono, e quello sbagliato è
 * sempre quello che nessuno stava guardando.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run panieri:pesce             → tabulato, non scrive
 *   APPLICA=1 npm run panieri:pesce   → scrive le appartenenze derivate
 */
import { PrismaClient } from '@prisma/client';
import { FAMIGLIE } from '../src/catalog/appartenenza-panieri';
import { righeDerivate, verdettoPescetariano, type Verdetto } from '../src/catalog/paniere-pescetariano';

const prisma = new PrismaClient();
const APPLICA = process.env.APPLICA === '1';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

const nomiIngredienti = (v: unknown): string[] => (Array.isArray(v)
  ? (v as unknown[]).map((i) => String((i as { name?: unknown })?.name ?? '')).filter(Boolean)
  : []);

async function main() {
  riga('');
  riga('==================================================================');
  riga('  FASE 5 — i panieri pescetariani si derivano');
  riga(`  ${APPLICA ? '⚠️  APPLICA=1: SCRIVE le appartenenze derivate.' : 'Sola lettura: non scrive niente.'}`);
  riga('==================================================================');

  const [panieri, righeTutte, ricette] = await Promise.all([
    prisma.paniere.findMany({ select: { id: true, famiglia: true, regime: true } }) as unknown as
      Promise<{ id: string; famiglia: string; regime: string }[]>,
    prisma.paniereRicetta.findMany({
      select: { paniereId: true, recipeId: true, slot: true },
    }) as unknown as Promise<{ paniereId: string; recipeId: string; slot: string }[]>,
    prisma.recipe.findMany({ select: { id: true, name: true, ingredients: true } }) as unknown as
      Promise<{ id: string; name: string; ingredients: unknown }[]>,
  ]);

  /** Il verdetto si calcola UNA volta per ricetta: le stesse parole su 160.000 righe sono lavoro sprecato. */
  const verdettoDi = new Map<string, Verdetto>();
  for (const r of ricette) verdettoDi.set(r.id, verdettoPescetariano(r.name, nomiIngredienti(r.ingredients)));

  const idDi = new Map(panieri.map((p) => [`${p.famiglia}|${p.regime}`, p.id]));
  const righeDi = new Map<string, { slot: string; recipeId: string }[]>();
  for (const r of righeTutte) {
    const lista = righeDi.get(r.paniereId) ?? [];
    lista.push({ slot: r.slot, recipeId: r.recipeId });
    righeDi.set(r.paniereId, lista);
  }

  titolo('PANIERE PER PANIERE');
  riga('');
  riga('  ┌─ famiglia ─────────────────────────────┬ prima ┬ veget ┬ pesce ┬ dopo ─┐');

  let daScrivere: { paniereId: string; recipeId: string; slot: string }[] = [];
  let senzaPaniere = 0;
  let scartatePerCarne = 0;

  for (const famiglia of FAMIGLIE) {
    const idPesce = idDi.get(`${famiglia}|pescetarian`);
    const idVeg = idDi.get(`${famiglia}|vegetarian`);
    const idOnni = idDi.get(`${famiglia}|omnivore`);
    if (!idPesce) { senzaPaniere += 1; continue; }

    const gia = righeDi.get(idPesce) ?? [];
    const veg = idVeg ? righeDi.get(idVeg) ?? [] : [];
    const onni = idOnni ? righeDi.get(idOnni) ?? [] : [];

    const esito = righeDerivate({
      giaNelPescetariano: gia,
      dalVegetariano: veg,
      dallOnnivoro: onni,
      /** ⚠️ Una ricetta che non è in catalogo (cancellata) non è né carne né pesce: resta fuori. */
      verdetto: (id) => verdettoDi.get(id) ?? 'ne_carne_ne_pesce',
    });
    scartatePerCarne += esito.scartatePerCarne;

    const dalPesce = esito.daAggiungere.filter((r) => verdettoDi.get(r.recipeId) === 'pesce'
      && !veg.some((v) => v.slot === r.slot && v.recipeId === r.recipeId)).length;

    riga(`  │ ${famiglia.slice(0, 38).padEnd(38)} │ ${String(gia.length).padStart(5)} │ ${String(veg.length).padStart(5)} │ ${String(dalPesce).padStart(5)} │ ${String(gia.length + esito.daAggiungere.length).padStart(5)} │`);

    daScrivere = daScrivere.concat(esito.daAggiungere.map((r) => ({ paniereId: idPesce, recipeId: r.recipeId, slot: r.slot })));
  }
  riga('  └────────────────────────────────────────┴───────┴───────┴───────┴───────┘');

  riga('');
  riga(`  Appartenenze da aggiungere: ${daScrivere.length}`);
  riga(`  Piatti onnivori scartati perché contengono carne: ${scartatePerCarne}`);
  if (senzaPaniere) riga(`  ⚠️ Famiglie senza paniere pescetariano in tabella: ${senzaPaniere} — gira prima \`npm run panieri:riempi\`.`);

  if (!APPLICA) {
    riga('');
    riga('  Sola lettura. Per scrivere: APPLICA=1 npm run panieri:pesce');
    riga('');
    return;
  }

  if (!daScrivere.length) {
    riga('');
    riga('  Niente da aggiungere: i panieri pescetariani sono già derivati.');
    riga('');
    return;
  }

  /**
   * ⚠️ `skipDuplicates`: una riga già presente non è un errore, è il segno che questo passo è già
   * girato. Senza, il secondo giro fallirebbe tutto per la prima riga che trova.
   */
  const scritte = await prisma.paniereRicetta.createMany({ data: daScrivere as never, skipDuplicates: true });

  const dopo = await prisma.paniereRicetta.count({
    where: { paniere: { regime: 'pescetarian' } },
  });
  const prima = righeTutte.filter((r) => {
    const p = panieri.find((x) => x.id === r.paniereId);
    return p?.regime === 'pescetarian';
  }).length;

  riga('');
  riga(`  Scritte: ${scritte.count}`);
  riga(`  Controllo: righe pescetariane prima ${prima}, ora ${dopo}, attese ${prima + daScrivere.length}.`);
  riga(dopo === prima + daScrivere.length ? '  ✅ Il conto torna.' : '  ⛔ IL CONTO NON TORNA: qualcuno ha scritto in mezzo, o c\'erano doppioni. Guarda prima di rilanciare.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
