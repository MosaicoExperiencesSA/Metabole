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
import { confrontaLePoole, perchePersa, quantePerse, type PercheP } from '../src/catalog/confronto-dei-pool';

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
    prisma.recipe.findMany({ select: { id: true, name: true, regime: true, active: true } }) as unknown as
      Promise<{ id: string; name: string; regime: string; active: boolean }[]>,
  ]);

  const esiste = new Set(ricetteVive.map((r) => r.id));
  const laRicetta = new Map(ricetteVive.map((r) => [r.id, r]));
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
  /**
   * ⛔ **Le perse si contano per MOTIVO, non solo in totale.** Il 2/9 il verdetto diceva «625
   * perse» e mandava a cercare un guasto: la quasi totalità erano piatti di pesce etichettati
   * `vegan`, che `regime:contenuto` ha riclassificato e che nelle giornate sono rimasti. Quelli
   * spariscono **apposta** — è il fine della riforma, non un danno.
   */
  const perMotivo = new Map<PercheP, number>();
  const daGuardare: string[] = [];
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
        const ceLaChiave = righePaniere.some((r) => r.slot === p.slot);
        for (const id of p.mancanti) {
          const r = laRicetta.get(id);
          const motivo = perchePersa(r, esito.regime);
          perMotivo.set(motivo, (perMotivo.get(motivo) ?? 0) + 1);
          /**
           * ⛔ **Solo le «da guardare» si stampano una per una.** Le altre hanno una spiegazione
           * che vale per tutte, e un elenco di 600 righe uguali nasconde le tre che contano.
           */
          if (motivo === 'da guardare' && daGuardare.length < ESEMPI) {
            daGuardare.push(
              `  · «${r?.name ?? '(ricetta sparita)'}» [${id.slice(0, 8)}]`
              + `\n      regime della ricetta: ${r?.regime ?? '?'} · paniere: ${esito.regime} · ${r?.active === false ? 'SPENTA' : 'attiva'}`
              + `\n      su «${p.slot}» in ${d.name} · ${d.regime}${ceLaChiave ? '' : '   ⛔ «' + p.slot + '» NON c\'è nel paniere: la cliente resterebbe senza questo pasto'}`,
            );
          }
        }
        if (perse.length < ESEMPI) {
          perse.push(
            `  · ${String(p.mancanti.length).padStart(4)} su «${p.slot}» — ${d.name} · ${d.regime} (${d.status})`
            + `\n        nel paniere: ${chiaviPaniere}${ceLaChiave ? '' : '   ⛔ «' + p.slot + '» NON c\'è: la cliente resterebbe senza questo pasto'}`,
          );
        }
      }
    }
  }

  titolo('IL VERDETTO');
  riga('');
  riga(`  Varianti confrontate                     ${confrontate}`);
  riga(`  …che non versano in nessun paniere       ${nonMappabili}  (le famiglie del §2.1)`);
  riga('');
  /**
   * ⛔ **IL VERDETTO GUARDA LE «DA GUARDARE», NON IL TOTALE** — corretto il 2/9 mentre lo scrivevo.
   *
   * La prima stesura decideva su `varianteConPerdite`: avrebbe stampato «⛔ NON spostare
   * l'interruttore» in cima e, dodici righe sotto, «✅ l'interruttore si può spostare». Due
   * verdetti opposti nello stesso tabulato, e chi legge crede al primo — che è il modo più
   * elegante di far fermare un lavoro finito.
   *
   * ⚠️ Le perse per **regime diverso** non sono un costo della riforma: sono il **fine**. Contarle
   * insieme alle altre voleva dire chiedere il permesso di fare la cosa che si stava facendo.
   */
  const rd = perMotivo.get('regime diverso') ?? 0;
  const sp = perMotivo.get('spenta') ?? 0;
  const dg = perMotivo.get('da guardare') ?? 0;

  if (perseTot === 0) {
    riga('  ✅ NESSUNA ricetta si perde: tutto quello che una cliente può ricevere oggi lo può');
    riga('  ricevere anche leggendo dal paniere. `panieri_sorgente_pool` si può spostare su `paniere`.');
  } else {
    riga(`  ${varianteConPerdite} varianti leggono dal paniere qualcosa di diverso da oggi: ${perseTot} ricette in meno.`);
    riga('');
    riga('  PERCHÉ — ed è qui che si decide, non nel numero sopra:');
    riga('');
    riga(`  · regime diverso dal paniere   ${String(rd).padStart(5)}   ✅ spariscono APPOSTA`);
    riga('      Sono i piatti che `regime:contenuto` ha riclassificato — il pesce etichettato');
    riga('      vegano — e che nelle giornate sono rimasti, perché quelle sono un JSON che nessuno');
    riga('      ha ripulito. Oggi una cliente vegana quel pesce LO RICEVE; col paniere smette.');
    riga('      È la cosa che tutto questo lavoro serviva a ottenere: non è un costo, è il fine.');
    riga(`  · spente                        ${String(sp).padStart(5)}   ✅ non le riceve nessuno comunque`);
    riga(`  · DA GUARDARE                   ${String(dg).padStart(5)}   ${dg ? '⛔ queste sì' : '✅ nessuna'}`);
    riga('      Regime giusto, attive, e nel paniere non ci sono: mancano davvero.');
    riga('');
    if (dg === 0) {
      riga('  ✅ NESSUNA ricetta sparisce senza una ragione: quello che si perde è esattamente quello');
      riga('  che non doveva più arrivare. `panieri_sorgente_pool` si può spostare su `paniere`.');
    } else {
      riga(`  ⛔ ${dg} ricette sparirebbero SENZA una ragione. NON spostare l'interruttore.`);
      riga('  ⚠️ Regime giusto, attive, e nel paniere non ci sono: prima si capisce perché.');
      riga('');
      daGuardare.forEach(riga);
      if (dg > ESEMPI) riga(`  … e altre ${dg - ESEMPI} (ESEMPI=${dg} per vederle tutte)`);
    }
    riga('');
    riga('  Le varianti toccate, per contesto (quali pasti ha il paniere):');
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
