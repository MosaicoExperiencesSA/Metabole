/**
 * LE RICETTE CHE NON STANNO IN NESSUN PANIERE — sola lettura.
 *
 * ⛔ **Nasce da una conseguenza della sequenza che ho dato io l'1/9, e va guardata prima di dire
 * che il lavoro è finito.**
 *
 * `regime:contenuto` ha spostato ~531 ricette di pesce da `vegan`/`vegetarian` a `pescetarian`.
 * `panieri:pulisci` le ha tolte dai panieri vegani e vegetariani, dove non potevano stare. Giusto
 * tutte e due. ⚠️ **Ma quelle ricette stavano SOLO lì**: nelle giornate delle diete vegane. Nel
 * paniere onnivoro non c'erano mai state, e `panieri:pesce` deriva il pescetariano **da quello**.
 *
 * Risultato possibile: il pesce non è più nel posto sbagliato e non è ancora in quello giusto —
 * cioè non è da nessuna parte, e non lo riceve più nessuno. Questo tabulato lo dice.
 *
 * ⚠️ **Una ricetta fuori dai panieri non è di per sé un difetto**: il catalogo è più grande delle
 * dieci famiglie, e una ricetta nata per una variante che non versa in nessun paniere sta fuori di
 * suo. Quello che conta è **quante sono per regime**, e se il numero è cambiato di colpo.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:orfane              → il conto per regime, coi nomi
 *   ESEMPI=60 npm run diag:orfane    → più nomi (default 20)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 20) || 20);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('RICETTE ATTIVE CHE NON STANNO IN NESSUN PANIERE — sola lettura');

  const [ricette, righe] = await Promise.all([
    prisma.recipe.findMany({
      where: { active: true },
      select: { id: true, name: true, regime: true, mealSlot: true },
    }) as unknown as Promise<{ id: string; name: string; regime: string; mealSlot: string }[]>,
    prisma.paniereRicetta.findMany({ select: { recipeId: true } }) as unknown as
      Promise<{ recipeId: string }[]>,
  ]);

  const dentro = new Set(righe.map((r) => r.recipeId));
  const fuori = ricette.filter((r) => !dentro.has(r.id));

  riga('');
  riga(`  Ricette attive in catalogo        ${ricette.length}`);
  riga(`  · in almeno un paniere            ${ricette.length - fuori.length}`);
  riga(`  · in NESSUN paniere               ${fuori.length}`);

  titolo('PER REGIME — ed è qui che si vede se qualcosa si è staccato');
  riga('');
  const perRegime = new Map<string, number>();
  for (const r of fuori) perRegime.set(r.regime || '(vuoto)', (perRegime.get(r.regime || '(vuoto)') ?? 0) + 1);
  const totali = new Map<string, number>();
  for (const r of ricette) totali.set(r.regime || '(vuoto)', (totali.get(r.regime || '(vuoto)') ?? 0) + 1);
  for (const [rg, n] of [...perRegime.entries()].sort((a, b) => b[1] - a[1])) {
    const tot = totali.get(rg) ?? 0;
    const pct = tot ? Math.round((n / tot) * 100) : 0;
    riga(`  · ${rg.padEnd(14)} ${String(n).padStart(6)} su ${String(tot).padStart(6)}  (${pct}%)`);
  }
  riga('');
  riga('  ⛔ Se «pescetarian» è alto ed è quasi tutto il suo totale, è successo quello che questo');
  riga('  tabulato viene a cercare: il pesce è uscito dai panieri vegani e non è entrato in quelli');
  riga('  pescetariani, perché la derivazione lo cerca nel paniere ONNIVORO, dove non è mai stato.');
  riga('  La strada è rilanciare `APPLICA=1 npm run panieri:riempi`: dal rilascio dell\'1/9 quello');
  riga('  script non scarta più la ricetta che non c\'entra col paniere — la porta nel paniere della');
  riga('  STESSA FAMIGLIA che le corrisponde.');

  const pesce = fuori.filter((r) => r.regime === 'pescetarian');
  if (pesce.length) {
    titolo(`LE PESCETARIANE FUORI (${pesce.length})`);
    riga('');
    for (const r of pesce.slice(0, ESEMPI)) riga(`  · [${r.mealSlot}] «${r.name}»`);
    if (pesce.length > ESEMPI) riga(`  … e altre ${pesce.length - ESEMPI}.`);
  }

  riga('');
  riga('  Fine. Niente è stato scritto.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
