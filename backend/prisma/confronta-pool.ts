/**
 * IL POOL DALLE GIORNATE CONTRO IL POOL DAL PANIERE — sola lettura.
 *
 * È la verifica che la Fase 1 del piano pretende prima di spostare l'interruttore: *«serve un
 * confronto prima/dopo per cella: quante ricette per slot aveva la variante, quante ne ha il
 * paniere. Se il conto non torna, la migrazione si ferma.»*
 *
 * ⛔ **NON SCRIVE NIENTE**, e non tocca l'interruttore: legge le due sorgenti e le mette una accanto
 * all'altra. `panieri_sorgente_pool` si sposta a mano, dopo aver letto questo.
 *
 * ## Cosa vuol dire «torna»
 *
 * ⚠️ **Non l'uguaglianza dei numeri.** Su strada B (§1.6) molte varianti versano nello stesso
 * paniere, quindi il pool dal paniere è quasi sempre **più grande** — ed è il punto di tutta la
 * riforma: la Mediterranea vegana eredita i pranzi vegani scritti per la DASH vegana.
 *
 * ⛔ Quello che deve tornare è l'altro verso: **ogni ricetta che oggi una cliente può ricevere deve
 * poterla ricevere anche domani.** Una ricetta che sta nelle giornate e non nel paniere è un piatto
 * che sparisce dal suo menu senza che nessuno lo decida — ed è l'unico errore che questo confronto
 * esiste per trovare. Le PERSE si stampano per prime.
 *
 * ⚠️ Le ricette che il paniere aggiunge si contano ma non allarmano: sono il guadagno atteso. Si
 * guardano solo se sono zero — vorrebbe dire che la migrazione non ha unito niente.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run panieri:confronta            → tutte le varianti
 *   ESEMPI=40 npm run panieri:confronta  → più righe (default 20)
 */
import { PrismaClient } from '@prisma/client';
import { paniereDellaVariante } from '../src/catalog/appartenenza-panieri';
import { poolPerSlot, righeDalleGiornate } from '../src/catalog/pool-del-paniere';

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
  riga('');
  riga('==================================================================');
  riga('  POOL: dalle GIORNATE contro dal PANIERE — sola lettura');
  riga('==================================================================');

  const [diete, giornate, appartenenze, ricetteVive] = await Promise.all([
    prisma.diet.findMany({ select: { id: true, name: true, regime: true, status: true } }) as unknown as
      Promise<{ id: string; name: string; regime: string; status: string }[]>,
    prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } }) as unknown as
      Promise<{ dietId: string; meals: unknown }[]>,
    prisma.paniereRicetta.findMany({
      select: { slot: true, recipeId: true, paniere: { select: { famiglia: true, regime: true } } },
    }) as unknown as Promise<{ slot: string; recipeId: string; paniere: { famiglia: string; regime: string } }[]>,
    prisma.recipe.findMany({ select: { id: true } }) as unknown as Promise<{ id: string }[]>,
  ]);

  const esiste = new Set(ricetteVive.map((r) => r.id));
  const perDieta = new Map<string, { meals: unknown }[]>();
  for (const g of giornate) perDieta.set(g.dietId, [...(perDieta.get(g.dietId) ?? []), { meals: g.meals }]);

  const perPaniere = new Map<string, Map<string, Set<string>>>();
  for (const a of appartenenze) {
    const k = `${a.paniere.famiglia}|${a.paniere.regime}`;
    const pool = perPaniere.get(k) ?? new Map<string, Set<string>>();
    if (!pool.has(a.slot)) pool.set(a.slot, new Set());
    pool.get(a.slot)!.add(a.recipeId);
    perPaniere.set(k, pool);
  }

  riga('');
  riga(`Varianti: ${diete.length}.  Appartenenze in tabella: ${appartenenze.length}.`);
  if (!appartenenze.length) {
    riga('');
    riga('⛔ La tabella dei panieri è VUOTA: prima `npm run panieri:riempi` con APPLICA=1.');
    riga('   Senza, questo confronto direbbe che sparisce tutto — vero e inutile.');
    return;
  }

  const perse: string[] = [];
  let varianteConPerdite = 0;
  let guadagnateTot = 0;
  let confrontate = 0;
  let nonMappabili = 0;

  for (const d of diete) {
    const esito = paniereDellaVariante(d);
    if (esito.tipo !== 'paniere') { nonMappabili += 1; continue; }
    const daGiornate = poolPerSlot(righeDalleGiornate(perDieta.get(d.id) ?? []));
    const daPaniere = perPaniere.get(`${esito.famiglia}|${esito.regime}`) ?? new Map<string, Set<string>>();
    confrontate += 1;

    let persePerVariante = 0;
    for (const [slot, ids] of daGiornate) {
      const la = daPaniere.get(slot) ?? new Set<string>();
      /**
       * ⚠️ Le ricette che **non esistono più** non si contano come perse: la chiave esterna le
       * rifiuta di proposito, e `panieri:riempi` le dichiara già. Contarle qui vorrebbe dire far
       * sembrare rotta la migrazione per la cosa che è venuta a chiudere.
       */
      const mancanti = [...ids].filter((id) => esiste.has(id) && !la.has(id));
      if (mancanti.length) {
        persePerVariante += mancanti.length;
        if (perse.length < ESEMPI) {
          perse.push(`  · ${String(mancanti.length).padStart(4)} su «${slot}» — ${d.name} · ${d.regime} (${d.status})`);
        }
      }
    }
    if (persePerVariante) varianteConPerdite += 1;
    for (const [slot, ids] of daPaniere) {
      const qua = daGiornate.get(slot) ?? new Set<string>();
      guadagnateTot += [...ids].filter((id) => !qua.has(id)).length;
    }
  }

  titolo('IL VERDETTO');
  riga('');
  riga(`  Varianti confrontate                     ${confrontate}`);
  riga(`  …che non versano in nessun paniere       ${nonMappabili}  (le famiglie del §2.1)`);
  riga('');
  if (!varianteConPerdite) {
    riga('  ✅ NESSUNA ricetta si perde: tutto quello che una cliente può ricevere oggi lo può');
    riga('  ricevere anche leggendo dal paniere. `panieri_sorgente_pool` si può spostare su `paniere`.');
  } else {
    riga(`  ⛔ ${varianteConPerdite} varianti perderebbero almeno una ricetta. NON spostare l'interruttore.`);
    riga('  ⚠️ Una ricetta che sta nelle giornate e non nel paniere è un piatto che sparisce dal menu');
    riga('  di una cliente senza che nessuno lo decida. Prima si capisce perché.');
    riga('');
    perse.forEach(riga);
  }
  riga('');
  riga(`  Ricette che il paniere AGGIUNGE (guadagno atteso della strada B): ${guadagnateTot}.`);
  riga('  ⚠️ Non allarmano: sono il senso della riforma — la Mediterranea vegana eredita i pranzi');
  riga('  vegani scritti per la DASH vegana. Si guardano solo se sono zero.');
  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
