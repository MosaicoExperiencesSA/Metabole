/**
 * CHI NON CI PUÒ STARE ESCE DAL PANIERE — la pulizia che il riempimento non fa.
 *
 * ⛔ **Nasce da un errore mio dell'1/9.** Avevo scritto, in fondo a `regime:contenuto`, che dopo la
 * correzione delle etichette bastava rilanciare `panieri:riempi` perché il pesce uscisse dai
 * panieri vegani. **Non è vero**: quello script solo AGGIUNGE — `createMany` con `skipDuplicates`
 * — ed è quello che lo rende ripetibile senza doverlo prima disfare. Una riga sbagliata, una volta
 * scritta, ci resta per sempre finché qualcuno non la toglie apposta. Questo è quel qualcuno.
 *
 * ⚠️ **Il giudizio non è nuovo**: `ricettaVaBene` di `common/regimi.ts`, la stessa funzione che usa
 * il motore e che la pagina Panieri applica quando una nutrizionista aggiunge un piatto a mano. Qui
 * si applica all'indietro, a quello che è già dentro.
 *
 * ⛔ **E SI CONTA PRIMA DI TOGLIERE, cella per cella.** Togliere righe restringe il pool di tutte
 * le clienti di quel paniere insieme: è la stessa lezione della Fase 1 e del §2.4. Sotto la soglia
 * lo script **si ferma e non scrive**, invece di svuotare un pasto e lasciarlo scoprire ai menu.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run panieri:pulisci                  → sola lettura: cosa toglierebbe, cella per cella
 *   SOGLIA=20 npm run panieri:pulisci        → soglia diversa (default 30)
 *   APPLICA=1 npm run panieri:pulisci        → toglie davvero, se nessuna casella va sotto soglia
 *   FORZA=1 APPLICA=1 npm run panieri:pulisci → toglie anche se qualcuna ci va (si dichiara)
 */
import { PrismaClient } from '@prisma/client';
import { cosaTogliere } from '../src/catalog/pulizia-del-paniere';

const prisma = new PrismaClient();
const SOGLIA = Math.max(1, Number(process.env.SOGLIA ?? 30) || 30);
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 25) || 25);
const APPLICA = process.env.APPLICA === '1';
const FORZA = process.env.FORZA === '1';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('CHI NON CI PUÒ STARE ESCE DAL PANIERE — sola lettura salvo APPLICA=1');
  riga('');
  riga(`  Soglia per casella (cella × pasto): ${SOGLIA} piatti.`);

  const [righe, ricette] = await Promise.all([
    prisma.paniereRicetta.findMany({
      select: { id: true, slot: true, recipeId: true, paniere: { select: { famiglia: true, regime: true } } },
    }) as unknown as Promise<{ id: string; slot: string; recipeId: string; paniere: { famiglia: string; regime: string } }[]>,
    prisma.recipe.findMany({ select: { id: true, name: true, regime: true, active: true } }) as unknown as
      Promise<{ id: string; name: string; regime: string; active: boolean }[]>,
  ]);
  /**
   * ⛔ **IL GIUDIZIO NON STA QUI**, e non è una questione di ordine: sta in
   * `catalog/pulizia-del-paniere.ts`, con le sue prove. Questo script CANCELLA righe in produzione,
   * e un mese fa `rifai:troppi-pasti` avrebbe aperto buchi permanenti nei menu di due clienti — a
   * fermarlo non è stata una rilettura, è stata una sentinella. La differenza è che il giudizio di
   * quello stava dentro lo script, dove nessuna prova arriva.
   *
   * ⚠️ Qui restano il **quando** scrivere e il **come dirlo**, che sono le due cose che una prova
   * non copre comunque.
   */
  const { daTogliere, caselleSotto } = cosaTogliere(
    righe.map((r) => ({ id: r.id, slot: r.slot, recipeId: r.recipeId, famiglia: r.paniere.famiglia, regime: r.paniere.regime })),
    ricette,
    SOGLIA,
  );

  titolo('1. QUANTE, E DA DOVE');
  riga('');
  riga(`  Righe di appartenenza in tabella   ${righe.length}`);
  riga(`  · da togliere (regime incompatibile) ${daTogliere.length}`);
  if (!daTogliere.length) {
    riga('');
    riga('  ✅ Niente da togliere: in ogni paniere ci sono solo ricette che ci possono stare.');
    riga('');
    return;
  }
  const perCella = new Map<string, number>();
  for (const t of daTogliere) perCella.set(t.chiave, (perCella.get(t.chiave) ?? 0) + 1);
  riga('');
  for (const [c, n] of [...perCella.entries()].sort((a, b) => b[1] - a[1])) {
    riga(`     · ${String(n).padStart(5)}  ${c}`);
  }

  titolo('2. COSA RESTA — la parte che decide se si può');
  riga('');
  const sotto = caselleSotto;
  if (!sotto.length) {
    riga(`  ✅ NESSUNA casella scende sotto ${SOGLIA} togliendo quelle righe.`);
  } else {
    riga(`  ⛔ ${sotto.length} caselle scenderebbero sotto ${SOGLIA}:`);
    riga('');
    /** ⚠️ Già in ordine dalla più povera: l'ordinamento è nel modulo, e ha la sua prova. */
    for (const c of sotto.slice(0, ESEMPI)) {
      riga(`     · ${c.chiave} · ${c.slot.padEnd(15)} ${String(c.prima).padStart(5)} → ${String(c.dopo).padStart(5)}`);
    }
  }

  titolo('3. QUALI SONO');
  riga('');
  for (const t of daTogliere.slice(0, ESEMPI)) {
    riga(`  · «${t.nome}»  (dichiarata «${t.regime}») da ${t.chiave} · ${t.slot}`);
  }
  if (daTogliere.length > ESEMPI) riga(`  … e altre ${daTogliere.length - ESEMPI}. ESEMPI=${daTogliere.length} per vederle tutte.`);

  if (!APPLICA) {
    riga('');
    riga('  Sola lettura: niente è stato scritto. Per togliere: APPLICA=1');
    riga('');
    return;
  }
  /**
   * ⛔ **Il freno.** Una casella sotto soglia vuol dire che da domani quelle clienti rivedono gli
   * stessi piatti, e non lo saprebbe nessuno finché non se ne accorgono mangiando. Si può passare
   * sopra, ma **dichiarandolo** — non per distrazione.
   */
  if (sotto.length && !FORZA) {
    riga('');
    riga(`  ⛔ NON TOLGO NIENTE: ${sotto.length} caselle andrebbero sotto ${SOGLIA}.`);
    riga('  Prima si riempiono quelle caselle, oppure si dichiara di volerlo fare lo stesso:');
    riga('     FORZA=1 APPLICA=1 npm run panieri:pulisci');
    riga('');
    return;
  }

  titolo('SCRITTURA');
  riga('');
  let tolte = 0;
  const ids = daTogliere.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 500) {
    const r = await prisma.paniereRicetta.deleteMany({ where: { id: { in: ids.slice(i, i + 500) } } });
    tolte += r.count;
  }
  riga(`  ✅ Tolte ${tolte} appartenenze.`);
  if (sotto.length) riga(`  ⚠️ E ${sotto.length} caselle sono sotto ${SOGLIA}: era dichiarato con FORZA=1, e vanno riempite.`);
  riga('');
  riga('  ⚠️ Ora `npm run diag:carne-fuori-posto` deve trovare solo il mucchio dubbio.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
