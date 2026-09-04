import { PrismaClient } from '@prisma/client';
import { allergeniFalsiDaTogliere, contaRiparazione, type RicettaDaRiparare } from '../src/catalog/allergeni-porta-unica';
import { allergenLabel } from '../src/catalog/allergens';

/**
 * ⛔ **LE RICETTE CHE HANNO UN ALLERGENE FALSO SCRITTO IN CATALOGO — e come si tolgono.**
 *
 * Il 4/9 `catalog/allergens.ts` ha smesso di avere una copia sua di «questa chiave vale?»: adesso
 * chiama la stessa funzione delle esclusioni, e nessuna ricetta nuova nasce con quei tag.
 * ⛔ **Ma correggere la funzione non riporta indietro quello che è già scritto** — lezione dell'1/9
 * sul riconoscitore della carne. `diag:chiave-doppia` ne aveva contate **190 su 23 726**, tutte col
 * tag scritto e tutte con la spunta.
 *
 * ⚠️ **Si toglie SOLO l'allergene di cui si sa il perché**, mai si riscrive l'elenco: il perché sta
 * su `allergeniFalsiDaTogliere`, e in due parole è che `setRecipeAllergens` esiste — gli allergeni
 * aggiunti a mano non si cancellano per riparare quelli sbagliati dalla macchina.
 *
 *     npm run ripara:allergeni-chiave              → guarda e basta
 *     CONFERMA=1 npm run ripara:allergeni-chiave   → scrive
 */

const prisma = new PrismaClient();
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

const SCRIVE = process.env.CONFERMA === '1';
const TETTO_RIGHE = Number(process.env.RIGHE ?? 40);

async function main() {
  riga('==================================================================');
  riga('  ALLERGENI FALSI SCRITTI IN CATALOGO — la coda della porta unica');
  riga(SCRIVE ? '  ⛔ CONFERMA=1: questo giro SCRIVE.' : '  Sola lettura. Per scrivere: CONFERMA=1');
  riga('==================================================================');

  /**
   * ⚠️ **Anche le SPENTE.** Una ricetta spenta col tag falso non fa danno oggi, ma il giorno che
   * qualcuno la riaccende — e le bozze si riaccendono, è il mestiere della coda di approvazione —
   * quel tag torna in gioco. Ripararla adesso costa una riga; scoprirla dopo costa un altro giro.
   */
  const ricette = (await prisma.recipe.findMany({
    select: { id: true, name: true, ingredients: true, allergens: true, allergensReviewed: true, active: true },
  })) as unknown as (RicettaDaRiparare & { active: boolean })[];

  /**
   * ⛔ **CHI HA SCELTO GLI ALLERGENI A MANO NON SI TOCCA.** `catalog.recipe.allergens.set` è la riga
   * che lascia `setRecipeAllergens`: se c'è, quella lista l'ha decisa una persona, e su «zucca
   * dorata + salsa Worcestershire» il tag «pesce» sono **le acciughe**, non la zucca. Dagli
   * ingredienti le due cose non si distinguono, e togliere è irreversibile.
   *
   * ⚠️ Il registro è la sola traccia che abbiamo di quel gesto, e basta: qui non serve sapere *cosa*
   * ha cambiato, solo *che* qualcuno l'ha fatto.
   */
  const aMano = new Set(((await prisma.auditLog.findMany({
    where: { action: 'catalog.recipe.allergens.set', entityType: 'recipe' } as never,
    select: { entityId: true },
  })) as { entityId: string | null }[]).map((x) => String(x.entityId ?? '')));

  const conRegistro = ricette.map((r) => ({ ...r, toccataAMano: aMano.has(r.id) }));
  const conto = contaRiparazione(conRegistro);
  /** ⚠️ Quelle che il criterio toglierebbe ma una persona ha toccato: si contano e si nominano. */
  const daGuardare = ricette.filter((r) => aMano.has(r.id) && allergeniFalsiDaTogliere({ ...r, toccataAMano: false }).length);

  titolo('I NUMERI');
  riga('');
  riga(`  Ricette esaminate (attive e spente)           ${String(conto.esaminate).padStart(7)}`);
  riga(`  ⛔ Con almeno un allergene falso SCRITTO       ${String(conto.daRiparare).padStart(7)}`);
  riga(`     …e di quelle, con la spunta di conferma    ${String(conto.confermate).padStart(7)}`);
  riga(`  ⚠️ Non toccate perche qualcuno le ha toccate  ${String(daGuardare.length).padStart(7)}`);
  if (daGuardare.length) {
    riga('     Su queste gli allergeni li ha scelti una persona: il tag puo essere suo, non della');
    riga('     macchina, e dagli ingredienti non si distingue. Le guarda lei, una per una:');
    for (const r of daGuardare.slice(0, TETTO_RIGHE)) riga(`       · ${r.name}`);
  }

  titolo(`LE COPPIE — ${conto.coppie.length}`);
  riga('');
  for (const c of conto.coppie.slice(0, TETTO_RIGHE)) {
    riga(`  · ${allergenLabel(c.allergen).padEnd(28)} «${c.chiave}» dentro «${c.parola}»   ${String(c.ricette).padStart(5)} ricette`);
    for (const e of c.esempi) riga(`        ${e}`);
  }
  if (conto.coppie.length > TETTO_RIGHE) riga(`\n  …e altre ${conto.coppie.length - TETTO_RIGHE}. Alza RIGHE per vederle.`);

  if (!SCRIVE) {
    riga('');
    riga('==================================================================');
    riga('  Fine. Niente è stato scritto. Per applicare:');
    riga('  CONFERMA=1 npm run ripara:allergeni-chiave');
    riga('==================================================================');
    return;
  }

  titolo('SCRITTURA');
  riga('');
  let toccate = 0;
  for (const r of conRegistro) {
    const falsi = allergeniFalsiDaTogliere(r);
    if (!falsi.length) continue;
    const daTogliere = new Set(falsi.map((f) => f.allergen));
    const restano = (r.allergens ?? []).map(String).filter((a) => !daTogliere.has(a));
    /**
     * ⛔ **`allergensReviewed` NON si tocca, ed è una decisione, non una dimenticanza.**
     *
     * Verrebbe da azzerarla: l'elenco è cambiato, e la spunta diceva «qualcuno ha guardato questo
     * elenco». ⚠️ Ma `personal-base.service.ts` scarta le ricette senza quella spunta: azzerarla
     * qui vorrebbe dire togliere **190 piatti dalle basi personali** di tutte le clienti, cioè
     * scambiare un allergene falso con nessun piatto. E la conferma era stata data su un elenco
     * che aveva scritto **questa stessa macchina**: quello che si toglie è roba sua, non di chi ha
     * premuto il pulsante.
     */
    await prisma.recipe.update({ where: { id: r.id }, data: { allergens: restano } as never });
    toccate += 1;
    if (toccate <= TETTO_RIGHE) {
      riga(`  · ${r.name}`);
      riga(`      tolti: ${falsi.map((f) => `${allergenLabel(f.allergen)} (${f.parola})`).join(', ')}`);
    }
  }
  riga('');
  riga('==================================================================');
  riga(`  Scritte ${toccate} ricette. ⚠️ La spunta di conferma NON è stata toccata: il perché sta`);
  riga('  nel commento di questo script, e riguarda le basi personali.');
  riga('==================================================================');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
