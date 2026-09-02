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
import { righeDalleGiornate } from '../src/catalog/pool-del-paniere';
import { confrontaLePoole, quantePerse } from '../src/catalog/confronto-dei-pool';

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

  /**
   * ⛔ **RIGHE GREZZE, non un pool costruito qui.** Fino al 2/9 questo ciclo costruiva la mappa
   * `slot → ricette` a mano, mentre il lato «giornate» passava da `poolPerSlot` — che dall'1/9
   * allarga ai gemelli, perché spuntino e merenda sono un paniere solo. Due sponde costruite in
   * due modi: il confronto misurava due cose diverse e ha detto «119 varianti perderebbero almeno
   * una ricetta» quando non era vero. Ora le costruisce tutte e due `confrontaLePoole`, e chi
   * chiama non ha più dove sbagliarle in modo diverso.
   */
  const righePerPaniere = new Map<string, { slot: string; recipeId: string }[]>();
  for (const a of appartenenze) {
    const k = `${a.paniere.famiglia}|${a.paniere.regime}`;
    righePerPaniere.set(k, [...(righePerPaniere.get(k) ?? []), { slot: a.slot, recipeId: a.recipeId }]);
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
  let perseTot = 0;
  let confrontate = 0;
  let nonMappabili = 0;

  for (const d of diete) {
    const esito = paniereDellaVariante(d);
    if (esito.tipo !== 'paniere') { nonMappabili += 1; continue; }
    const righeGiornate = righeDalleGiornate(perDieta.get(d.id) ?? []);
    const righePaniere = righePerPaniere.get(`${esito.famiglia}|${esito.regime}`) ?? [];
    confrontate += 1;

    /**
     * ⚠️ Le ricette che **non esistono più** non si contano come perse: la chiave esterna le
     * rifiuta di proposito, e `panieri:riempi` le dichiara già. Contarle qui vorrebbe dire far
     * sembrare rotta la migrazione per la cosa che è venuta a chiudere.
     */
    const esito2 = confrontaLePoole(righeGiornate, righePaniere, (id) => esiste.has(id));
    guadagnateTot += esito2.guadagnate;
    perseTot += quantePerse(esito2);
    if (esito2.perse.length) {
      varianteConPerdite += 1;
      /**
       * ⛔ **Le chiavi che il paniere HA**, stampate accanto alla perdita. Una perdita su
       * `afternoon_snack` vuol dire due cose diversissime a seconda che quella chiave nel paniere
       * ci sia (mancano dei piatti) o non ci sia affatto (nel paniere non c'è **nessuna** ricetta
       * di quel pasto, e la cliente resterebbe senza). Senza questa riga si va a cercare a occhio.
       */
      const chiaviPaniere = [...new Set(righePaniere.map((r) => r.slot))].sort().join(', ') || '(nessuna)';
      for (const p of esito2.perse) {
        if (perse.length >= ESEMPI) break;
        const ceLaChiave = righePaniere.some((r) => r.slot === p.slot);
        perse.push(
          `  · ${String(p.mancanti.length).padStart(4)} su «${p.slot}» — ${d.name} · ${d.regime} (${d.status})`
          + `\n        nel paniere: ${chiaviPaniere}${ceLaChiave ? '' : '   ⛔ «' + p.slot + '» NON c\'è: la cliente resterebbe senza questo pasto'}`
          + `\n        prime perse: ${p.mancanti.slice(0, 5).join(', ')}${p.mancanti.length > 5 ? ` … (+${p.mancanti.length - 5})` : ''}`,
        );
      }
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
    riga(`  ⛔ ${varianteConPerdite} varianti perderebbero almeno una ricetta (${perseTot} in tutto). NON spostare l'interruttore.`);
    riga('  ⚠️ Una ricetta che sta nelle giornate e non nel paniere è un piatto che sparisce dal menu');
    riga('  di una cliente senza che nessuno lo decida. Prima si capisce perché.');
    riga('');
    riga('  ⚠️ Sotto ogni riga: quali pasti il paniere HA, e le prime ricette perse. Una perdita su');
    riga('  un pasto che nel paniere ESISTE vuol dire «mancano dei piatti»; su un pasto che nel');
    riga('  paniere non c\'è affatto vuol dire «la cliente resterebbe senza quel pasto», ed è');
    riga('  segnalato a parte. Sono due lavori diversi.');
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
