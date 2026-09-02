/**
 * LE RICETTE ATTIVE SENZA ELENCO INGREDIENTI — sola lettura.
 *
 * ⛔ **Nasce da una riga sola, trovata il 2/9 guardando le sei ricette di pesce**: `6a5666fd`
 * «Branzino al forno con verdure rosse e limone» è **attiva** e ha l'elenco ingredienti **vuoto**.
 * Non è una stranezza da catalogo: è un piatto che una cliente può ricevere e non può cucinare,
 * perché non c'è scritto cosa ci va dentro.
 *
 * ## ⚠️ E soprattutto: è il buco della settimana appena passata
 *
 * Tutto il lavoro sui panieri guarda gli **ingredienti**. Con l'elenco vuoto:
 *
 * · `regime:contenuto` non trova né carne né pesce, quindi **niente da correggere**. ⚠️ Il nome la
 *   salva **solo in due regimi su quattro**: `classifica` guarda anche il nome e la mette fra le
 *   «dubbie — solo nel nome», ma su una ricetta già `omnivore` esce a «ok» prima di arrivarci, e
 *   una `pescetarian` non viene proprio interrogata (`corregge-regime-dal-contenuto` guarda solo
 *   `vegan`, `vegetarian`, `omnivore`). Il branzino è saltato fuori perché era etichettato vegano:
 *   se fosse stato pescetariano, no.
 * · ✅ **Il controllo del generatore non ne fa più di nuove** (dal 2/9): un piatto che torna dal
 *   modello senza elenco non viene preso, si riprova, e se il pasto resta vuoto lo dice
 *   (`pastiIncompleti`). ⚠️ Quelle già in catalogo restano: questo tabulato serve a contarle.
 * · ⛔ **Gli allergeni non si deducono**: `suggestAllergens([])` non rende niente. Una ricetta senza
 *   ingredienti è una ricetta senza allergeni dichiarati e senza allergeni deducibili — invisibile
 *   alla Fase 8 tanto quanto a una cliente allergica.
 * · ⚠️ Le esclusioni della cliente («non mi piace il finocchio») cercano nel nome **e** negli
 *   ingredienti: col secondo vuoto restano metà cieche.
 *
 * ⚠️ **Non tutte sono uguali, ed è il motivo per cui questo tabulato divide invece di contare.**
 * Una ricetta senza ingredienti e **fuori da ogni paniere** non la riceve nessuno: è sporcizia di
 * catalogo, si sistema con calma. Una **dentro un paniere** è già nel giro dei menu. Il conto che
 * conta è il secondo.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:senza-ingredienti              → il conto, diviso per gravità, coi nomi
 *   ESEMPI=60 npm run diag:senza-ingredienti    → più nomi (default 25)
 *   ANCHE_SPENTE=1 npm run diag:senza-ingredienti  → conta anche le ricette spente
 */
import { PrismaClient } from '@prisma/client';
import { eCarne, ePesce } from '../src/catalog/piatto-di-cosa';
import { statoElenco } from '../src/catalog/elenco-ingredienti';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 25) || 25);
const ANCHE_SPENTE = process.env.ANCHE_SPENTE === '1';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

type Ricetta = {
  id: string; name: string; regime: string; mealSlot: string;
  active: boolean; tags: string[]; ingredients: unknown; allergens: string[];
};

async function main() {
  titolo('RICETTE SENZA ELENCO INGREDIENTI — sola lettura, non scrive niente');

  const [ricette, righe] = await Promise.all([
    prisma.recipe.findMany({
      where: ANCHE_SPENTE ? {} : { active: true },
      select: { id: true, name: true, regime: true, mealSlot: true, active: true, tags: true, ingredients: true, allergens: true },
      orderBy: { name: 'asc' },
    }) as unknown as Promise<Ricetta[]>,
    prisma.paniereRicetta.findMany({ select: { recipeId: true } }) as unknown as
      Promise<{ recipeId: string }[]>,
  ]);

  const inPaniere = new Set(righe.map((r) => r.recipeId));
  const rotte = ricette
    .map((r) => ({ r, stato: statoElenco(r.ingredients) }))
    .filter((x) => x.stato !== 'ok');

  riga('');
  riga(`  Ricette guardate${ANCHE_SPENTE ? ' (attive e spente)' : ' (solo attive)'}   ${String(ricette.length).padStart(6)}`);
  riga(`  · con un elenco ingredienti usabile          ${String(ricette.length - rotte.length).padStart(6)}`);
  riga(`  · SENZA                                      ${String(rotte.length).padStart(6)}`);

  if (rotte.length === 0) {
    riga('');
    riga('  ✅ Nessuna. Ogni ricetta dice cosa ci va dentro.');
    return;
  }

  titolo('COM’È FATTO IL VUOTO — «senza nomi» è il caso che inganna');
  riga('');
  const perStato = new Map<string, number>();
  for (const x of rotte) perStato.set(x.stato, (perStato.get(x.stato) ?? 0) + 1);
  for (const [s, n] of [...perStato.entries()].sort((a, b) => b[1] - a[1])) {
    riga(`  · ${s.padEnd(12)} ${String(n).padStart(6)}`);
  }

  /**
   * ⛔ **La divisione che conta**: dentro un paniere = già nel giro dei menu. Fuori = non la riceve
   * nessuno finché qualcuno non la ci mette. Sono due lavori con due fretti diverse, e contarli
   * insieme fa sembrare urgente tutto o niente.
   */
  const dentro = rotte.filter((x) => inPaniere.has(x.r.id) && x.r.active);
  const fuori = rotte.filter((x) => !inPaniere.has(x.r.id) || !x.r.active);

  titolo('QUANTO È GRAVE — e sono due lavori, non uno');
  riga('');
  riga(`  ⛔ ATTIVE E DENTRO A UN PANIERE   ${String(dentro.length).padStart(6)}   una cliente le può ricevere`);
  riga(`  ⚠️  fuori dai panieri o spente     ${String(fuori.length).padStart(6)}   sporcizia di catalogo, con calma`);

  /**
   * ⚠️ **Il nome è l'unica rete rimasta.** Con l'elenco vuoto, `regime:contenuto` e il controllo del
   * generatore possono lavorare solo sul nome: quelle qui sotto sono le ricette in cui il nome dice
   * «carne» o «pesce» e il contenuto non dice niente. Se il regime non combacia, è un piatto fuori
   * posto che nessun controllo automatico può confermare — va aperto a mano.
   */
  const sospette = dentro.filter((x) => eCarne(x.r.name) || ePesce(x.r.name));
  if (sospette.length > 0) {
    titolo('⛔ IL NOME DICE CARNE O PESCE, E DENTRO NON C’È SCRITTO NIENTE');
    riga('');
    riga('  Nessun controllo automatico può decidere queste: l’elenco ingredienti è la prova, e manca.');
    riga('');
    for (const x of sospette.slice(0, ESEMPI)) {
      const cosa = eCarne(x.r.name) ? 'carne' : 'pesce';
      riga(`  · ${x.r.id.slice(0, 8)}  ${x.r.regime.padEnd(12)} ${x.r.mealSlot.padEnd(10)} [${cosa}] ${x.r.name}`);
    }
    if (sospette.length > ESEMPI) riga(`  … e altre ${sospette.length - ESEMPI} (ESEMPI=${sospette.length} per vederle tutte)`);
  }

  titolo('LE ALTRE, ATTIVE E DENTRO A UN PANIERE');
  riga('');
  const idSospette = new Set(sospette.map((x) => x.r.id));
  const restanti = dentro.filter((x) => !idSospette.has(x.r.id));
  if (restanti.length === 0) riga('  (nessuna)');
  for (const x of restanti.slice(0, ESEMPI)) {
    const all = x.r.allergens.length > 0 ? `allergeni: ${x.r.allergens.join(',')}` : 'nessun allergene dichiarato';
    riga(`  · ${x.r.id.slice(0, 8)}  ${x.r.regime.padEnd(12)} ${x.r.mealSlot.padEnd(10)} ${x.r.name}`);
    riga(`      ${x.stato} · ${all}`);
  }
  if (restanti.length > ESEMPI) riga(`  … e altre ${restanti.length - ESEMPI} (ESEMPI=${restanti.length} per vederle tutte)`);

  /**
   * ⚠️ **Da dove vengono.** Il tag `gen:` dice che l'ha scritta il generatore: se le ricette rotte
   * sono quasi tutte generate, il difetto è a monte e va chiuso lì, non a mano una per una — è la
   * stessa lezione dei 175 piatti fuori regime.
   */
  titolo('DA DOVE VENGONO — se sono quasi tutte generate, il difetto è a monte');
  riga('');
  const generate = rotte.filter((x) => x.r.tags.some((t) => t.startsWith('gen:'))).length;
  riga(`  · scritte dal generatore (tag \`gen:\`)   ${String(generate).padStart(6)} su ${rotte.length}`);
  riga(`  · scritte a mano o importate            ${String(rotte.length - generate).padStart(6)} su ${rotte.length}`);

  if (dentro.length > 0) {
    riga('');
    riga('──────────────────────────────────────────────────────────────────');
    riga(`  ⛔ ${dentro.length} ricette attive in un paniere non dicono cosa ci va dentro.`);
    riga('     Una cliente le può ricevere e non le può cucinare, gli allergeni non si');
    riga('     deducono, e il controllo del generatore non le può giudicare.');
    riga('──────────────────────────────────────────────────────────────────');
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
