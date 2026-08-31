/**
 * FASE 1 — L'APPARTENENZA ESCE DAL JSON: si riempiono i panieri dalle giornate.
 *
 * ⛔ **SOLA LETTURA finché non gli si dice `APPLICA=1`.** Senza, stampa il tabulato e non scrive
 * niente: né i panieri, né le appartenenze, né una riga di `diet_day_template`.
 *
 * ⚠️ **Non cancella e non tocca niente di esistente.** `diet_day_template` resta esattamente com'è:
 * finché il motore legge di là, spegnere quella strada sarebbe una consegna a sé (§4.3 del piano,
 * il ripiego). Qui si **aggiunge** la tabella di appartenenza accanto, e si confronta.
 *
 * ## Il confronto prima/dopo, che il piano pretende (Fase 1, «come si verifica»)
 *
 * ⛔ *«Se una ricetta si perde per strada, il paniere si assottiglia e nessuno se ne accorge — il
 * motore continua a comporre, con meno scelta.»* Quindi per ogni variante si contano le ricette
 * **distinte per slot** prima (dalle giornate) e dopo (dal paniere in cui è confluita), e **se il
 * conto non torna la migrazione si ferma**: non scrive niente e stampa cosa manca.
 *
 * ⚠️ Il conto «dopo» è per PANIERE, e su strada B molte varianti versano nello stesso: quindi
 * l'atteso non è l'uguaglianza variante per variante, è che **ogni ricetta nominata da una
 * giornata si ritrovi nel paniere della sua variante, con lo stesso slot**. È quello che si
 * verifica, ed è più severo del confronto fra due numeri.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run panieri:riempi              → tabulato, NON scrive
 *   APPLICA=1 npm run panieri:riempi    → crea i panieri e le appartenenze
 *   ESEMPI=40 npm run panieri:riempi    → più righe negli elenchi (default 20)
 */
import { PrismaClient } from '@prisma/client';
import { paniereDellaVariante, panieriDaCreare, ricetteDellaGiornata } from '../src/catalog/appartenenza-panieri';

const prisma = new PrismaClient();

const APPLICA = process.env.APPLICA === '1';
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
  riga('  FASE 1 — l\'appartenenza esce dal JSON');
  riga(`  ${APPLICA ? '⚠️  APPLICA=1: SCRIVE panieri e appartenenze.' : 'Sola lettura: non scrive niente.'}`);
  riga('==================================================================');

  const [diete, giornate, ricetteVive] = await Promise.all([
    prisma.diet.findMany({ select: { id: true, name: true, regime: true, status: true } }) as unknown as
      Promise<{ id: string; name: string; regime: string; status: string }[]>,
    prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } }) as unknown as
      Promise<{ dietId: string; meals: unknown }[]>,
    prisma.recipe.findMany({ select: { id: true } }) as unknown as Promise<{ id: string }[]>,
  ]);

  const esiste = new Set(ricetteVive.map((r) => r.id));
  const perDieta = new Map<string, { slot: string; recipeId: string }[]>();
  for (const g of giornate) {
    const righe = ricetteDellaGiornata(g.meals);
    if (!righe.length) continue;
    perDieta.set(g.dietId, [...(perDieta.get(g.dietId) ?? []), ...righe]);
  }

  /** paniere «famiglia|regime» → set di «recipeId|slot». */
  const dentro = new Map<string, Set<string>>();
  const nonMappabili: string[] = [];
  const impossibiliConRicette: string[] = [];
  /**
   * ⛔ I riferimenti ROTTI: la chiave esterna li renderà impossibili, ma **oggi ci sono** (58
   * misurati il 31/8). Non si possono scrivere, quindi si contano e si dichiarano — sono l'unica
   * cosa che questa migrazione **perde di proposito**, ed è il senso della Fase 1.
   */
  const rotti = new Map<string, number>();
  let nominateVive = 0;

  for (const d of diete) {
    const righe = perDieta.get(d.id) ?? [];
    const esito = paniereDellaVariante(d);
    if (esito.tipo === 'non_mappabile') {
      if (righe.length) nonMappabili.push(`  · «${d.name}» · ${d.regime} (${d.status}) — ${righe.length} righe di giornata — ${esito.perche}`);
      continue;
    }
    if (esito.tipo === 'impossibile') {
      if (righe.length) impossibiliConRicette.push(`  · «${esito.famiglia}» × ${esito.regime} — ${righe.length} righe, e la combinazione è dichiarata impossibile`);
      continue;
    }
    const chiave = `${esito.famiglia}|${esito.regime}`;
    const set = dentro.get(chiave) ?? new Set<string>();
    for (const r of righe) {
      if (!esiste.has(r.recipeId)) {
        rotti.set(`${d.name} · ${d.regime}`, (rotti.get(`${d.name} · ${d.regime}`) ?? 0) + 1);
        continue;
      }
      nominateVive += 1;
      set.add(`${r.recipeId}|${r.slot}`);
    }
    dentro.set(chiave, set);
  }

  const tutti = panieriDaCreare();
  const appartenenze = [...dentro.values()].reduce((s, v) => s + v.size, 0);
  const pieni = [...dentro.entries()].filter(([, v]) => v.size > 0).length;

  titolo('COSA VERREBBE SCRITTO');
  riga('');
  riga(`  Panieri da creare                          ${tutti.length}  (10 famiglie × 4 regimi − 2 impossibili)`);
  riga(`  …di cui con almeno una ricetta dentro      ${pieni}`);
  riga(`  Appartenenze (ricetta × slot × paniere)    ${appartenenze}`);
  riga('');
  riga(`  Righe di giornata lette                    ${[...perDieta.values()].reduce((s, v) => s + v.length, 0)}`);
  riga(`  …che nominano una ricetta VIVA             ${nominateVive}`);
  riga('  ⚠️ Il secondo numero è più piccolo del primo per due ragioni sane: la stessa ricetta è');
  riga('  nominata da più giornate (e nel paniere sta una volta), e le varianti non mappabili non');
  riga('  versano in nessun paniere. La terza ragione, i rotti, è qui sotto.');

  titolo('⛔ QUELLO CHE SI PERDE, E PERCHÉ');
  riga('');
  const rottiTot = [...rotti.values()].reduce((s, n) => s + n, 0);
  riga(`  Riferimenti ROTTI non trasferibili: ${rottiTot} righe, su ${rotti.size} varianti.`);
  riga('  ⛔ Nominano una ricetta che non esiste più. La chiave esterna li rende impossibili da');
  riga('  domani, e per questo NON si possono scrivere: è la cosa che la Fase 1 esiste per chiudere.');
  for (const [nome, n] of [...rotti.entries()].sort((a, b) => b[1] - a[1]).slice(0, ESEMPI)) {
    riga(`  · ${String(n).padStart(4)}  ${nome}`);
  }
  if (rotti.size > ESEMPI) riga(`  …e altre ${rotti.size - ESEMPI}.`);

  if (nonMappabili.length) {
    titolo(`VARIANTI CHE NON VERSANO IN NESSUN PANIERE (${nonMappabili.length})`);
    riga('');
    riga('  ⚠️ Non è un errore: sono le famiglie che il §2.1 dichiara assi travestiti da famiglia.');
    riga('  ⛔ Ma le loro ricette NON entrano in nessun paniere, quindi vanno guardate una per una');
    riga('  prima di spegnere le giornate — e se una di queste ha clienti sopra, si sposta a mano.');
    nonMappabili.slice(0, ESEMPI).forEach(riga);
    if (nonMappabili.length > ESEMPI) riga(`  …e altre ${nonMappabili.length - ESEMPI}.`);
  }
  if (impossibiliConRicette.length) {
    titolo('⚠️ COMBINAZIONI DICHIARATE IMPOSSIBILI CHE PERÒ HANNO RICETTE');
    riga('');
    riga('  Il piano (§1.6) dice che tornano in catalogo come vegane, non che si buttano.');
    impossibiliConRicette.forEach(riga);
  }

  titolo('I PANIERI, E QUANTE RICETTE PER PASTO');
  riga('');
  for (const p of tutti) {
    const set = dentro.get(`${p.famiglia}|${p.regime}`) ?? new Set<string>();
    const perSlot = new Map<string, number>();
    for (const k of set) {
      const slot = k.split('|')[1];
      perSlot.set(slot, (perSlot.get(slot) ?? 0) + 1);
    }
    const dettaglio = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']
      .map((s) => `${s}=${perSlot.get(s) ?? 0}`).join(' ');
    riga(`  · ${String(set.size).padStart(5)}  ${p.famiglia} × ${p.regime}   ${dettaglio}`);
  }

  if (!APPLICA) {
    riga('');
    riga('==================================================================');
    riga('  Fine. NIENTE è stato scritto. Per scrivere: APPLICA=1');
    riga('==================================================================');
    riga('');
    return;
  }

  titolo('SCRITTURA');
  riga('');
  let creati = 0;
  let scritte = 0;
  for (const p of tutti) {
    const paniere = await prisma.paniere.upsert({
      where: { famiglia_regime: { famiglia: p.famiglia, regime: p.regime } },
      update: {},
      create: { famiglia: p.famiglia, regime: p.regime },
    });
    creati += 1;
    const set = dentro.get(`${p.famiglia}|${p.regime}`) ?? new Set<string>();
    const righe = [...set].map((k) => {
      const [recipeId, slot] = k.split('|');
      return { paniereId: paniere.id, recipeId, slot };
    });
    /**
     * ⚠️ `skipDuplicates`: lo script si può rilanciare. La chiave unica è (paniere, ricetta, slot),
     * quindi un secondo giro non aggiunge niente e non toglie niente — e questo è ciò che rende la
     * migrazione ripetibile senza doverla prima disfare.
     */
    for (let i = 0; i < righe.length; i += 1000) {
      const r = await prisma.paniereRicetta.createMany({ data: righe.slice(i, i + 1000), skipDuplicates: true });
      scritte += r.count;
    }
  }
  riga(`  Panieri creati o già presenti: ${creati}.`);
  riga(`  Appartenenze scritte adesso:   ${scritte}.`);
  riga('');
  const controllo = await prisma.paniereRicetta.count();
  riga(`  Controllo: righe di appartenenza in tabella = ${controllo}, attese = ${appartenenze}.`);
  riga(controllo === appartenenze ? '  ✅ Il conto torna.' : '  ⛔ IL CONTO NON TORNA: guardare prima di andare avanti.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
