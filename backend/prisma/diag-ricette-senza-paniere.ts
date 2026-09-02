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
  /**
   * ⛔ **L'ALLARME SI STAMPA SOLO QUANDO SCATTA, e il 2/9 si stampava sempre.**
   *
   * Il testo qui sotto descrive un guasto preciso — il pesce uscito dai panieri vegani e non
   * entrato in quelli pescetariani — e compariva anche quando il risultato era buono: «pescetarian
   * 16%, il più basso dei quattro», e sotto un blocco che spiega un disastro. Chi legge o si
   * spaventa per niente, o impara a saltare il blocco: tutte e due le cose sono peggio del silenzio.
   *
   * ⚠️ La condizione è **sproporzionato rispetto agli altri**, non «alto»: fuori dai panieri c'è
   * sempre un quinto del catalogo — sono le ricette delle varianti che in nessun paniere versano,
   * le famiglie della Fase 9 — e quella è la normalità, non il segnale.
   */
  const pescetariane = perRegime.get('pescetarian') ?? 0;
  const totPescetariane = totali.get('pescetarian') ?? 0;
  const quotaPesce = totPescetariane ? pescetariane / totPescetariane : 0;
  const altre = [...perRegime.entries()].filter(([rg]) => rg !== 'pescetarian');
  const quotaAltre = altre.length
    ? altre.reduce((s2, [rg, n]) => s2 + n / (totali.get(rg) || 1), 0) / altre.length
    : 0;
  riga('');
  if (totPescetariane && quotaPesce > quotaAltre * 2) {
    riga('  ⛔ «pescetarian» è sproporzionato rispetto agli altri regimi: è successo quello che questo');
    riga('  tabulato viene a cercare — il pesce è uscito dai panieri vegani e non è entrato in quelli');
    riga('  pescetariani, perché la derivazione lo cerca nel paniere ONNIVORO, dove non è mai stato.');
    riga('  La strada è `APPLICA=1 npm run panieri:riempi`: quello script non scarta più la ricetta');
    riga('  che non c\'entra col paniere — la porta in quello della STESSA FAMIGLIA col suo regime.');
  } else {
    riga('  ✅ Nessun regime si è staccato: le quote sono in linea fra loro.');
    riga('  ⚠️ Che un quinto del catalogo stia fuori dai panieri è la normalità, non un guasto: sono');
    riga('  le ricette delle varianti che in nessun paniere versano — le famiglie della Fase 9.');
  }

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
