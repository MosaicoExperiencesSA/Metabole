/**
 * LO STESSO PIATTO DUE VOLTE NELLA STESSA GIORNATA — sola lettura.
 *
 * ⛔ **NON CORREGGE NIENTE**, ed è il punto. La voce `stesso-piatto-spuntino-e-merenda` (aperta il
 * 2/9 dalla revisione avversariale) dice che il primo passo è **contarlo** sulle giornate già
 * scritte: «quanto spesso capita» decide dove va la correzione — dentro `dayCombo`, o in una
 * guardia a valle. Misurare prima di scegliere.
 *
 * Da dove nasce: dalla Fase 2 (1/9) `poolPerSlot` allarga il pool ai gemelli, quindi `morning_snack`
 * e `afternoon_snack` escono con la **stessa identica lista** — una merenda deve poter servire lo
 * spuntino. Ma `DayComboService.enumerate` è un prodotto cartesiano, `rank` e `greedy` non
 * penalizzano un `recipeId` ripetuto fra slot, e `coppiaDellaGiornata` guarda solo pranzo/cena e
 * **fra giornate diverse**. Niente vieta lo stesso piatto alle 10:30 e alle 17:00.
 *
 * ⚠️ **Il conto e il verdetto stanno in un modulo con le sue prove**
 * (`src/menu/piatti-doppi-nella-giornata.ts`), non qui: da questo numero dipende una scelta di
 * progetto, e una cosa che decide non sta in un file di `prisma/` che nessun test guarda.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:piatto-doppio                 → gli ultimi 30 giorni, fino a ieri
 *   GIORNI=90 npm run diag:piatto-doppio       → più indietro
 *   ESEMPI=30 npm run diag:piatto-doppio       → più giornate d'esempio (default 12)
 *   FUTURE=1 npm run diag:piatto-doppio        → conta anche le giornate già composte per domani
 */
import { PrismaClient } from '@prisma/client';
import {
  GIORNATE_MINIME, QUOTA_CHE_CAMBIA_LA_STRADA, contaDoppioni, doveCorreggere,
  type GiornataLetta, type PastoLetto,
} from '../src/menu/piatti-doppi-nella-giornata';

const prisma = new PrismaClient();
const GIORNI = Math.max(1, Number(process.env.GIORNI ?? 30) || 30);
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 12) || 12);
const FUTURE = process.env.FUTURE === '1';
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};
const num = (n: number) => String(n).padStart(6);
const pct = (n: number, su: number) => (su > 0 ? `${((n / su) * 100).toFixed(1)}%` : '—');
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  titolo(`PIATTI DOPPI NELLA STESSA GIORNATA — ultimi ${GIORNI} giorni, sola lettura`);

  /**
   * ⛔ **Mezzanotte UTC, e un `lte`.** La colonna è `@db.Date`: un cutoff con l'ora dentro
   * (`Date.now() - GIORNI*86400000`) esclude il giorno più lontano, e **quale** giorno cade cambia
   * a seconda dell'ora in cui si lancia lo script — su un tabulato che deve reggere un confronto
   * «prima/dopo» è un numero che si muove da solo. È la convenzione di `diag-porzioni.ts`.
   *
   * ⚠️ E senza `lte` si leggerebbero le giornate **future**: `menu_days_delivered` ne compone in
   * anticipo, e ce ne sono di scritte e mai mostrate a nessuno. Contarle e chiamarle «erogate»
   * sarebbero tre affermazioni false sulla stessa colonna. Con `FUTURE=1` si guardano apposta.
   */
  const oggi = new Date();
  oggi.setUTCHours(0, 0, 0, 0);
  const da = new Date(oggi.getTime() - GIORNI * 86_400_000);
  const a = new Date(oggi.getTime() - 86_400_000);

  const righe = (await prisma.menuDay.findMany({
    where: { date: FUTURE ? { gte: da } : { gte: da, lte: a } },
    select: { clientId: true, date: true, meals: true },
    // ⚠️ `clientId` come seconda chiave: senza, a parità di data l'ordine non è garantito e gli
    //    **esempi cambiano fra due lanci sugli stessi dati** — la parte del tabulato che una persona
    //    va davvero a controllare nel database.
    orderBy: [{ date: 'desc' }, { clientId: 'asc' }],
  })) as unknown as { clientId: string; date: Date; meals: unknown }[];

  const giornate: GiornataLetta[] = righe.map((r) => ({
    clientId: r.clientId, data: r.date, pasti: ((r.meals as PastoLetto[]) ?? []),
  }));

  const c = contaDoppioni(giornate, ESEMPI);

  titolo('SU COSA HO MISURATO');
  riga('');
  riga(`  Periodo chiesto                      ${ymd(da)} → ${FUTURE ? 'oggi e oltre' : ymd(a)}`);
  riga(`  Giornate trovate                     ${num(c.giornate)}   ${c.dal ?? '—'} → ${c.al ?? '—'}`);
  riga(`  Clienti in quelle giornate           ${num(c.clientiLette)}`);
  /**
   * ⛔ **Il denominatore che conta**, e senza questa riga il tabulato mente per omissione: su una
   * giornata da tre pasti il doppione fra gemelli è **impossibile**, non raro.
   */
  riga(`  Di cui con spuntino E merenda        ${num(c.giornateARischioGemelli)}   ${pct(c.giornateARischioGemelli, c.giornate)}`);
  if (FUTURE) riga('  ⚠️ FUTURE=1: dentro ci sono anche giornate non ancora mostrate a nessuno.');

  titolo('QUANTE VOLTE CAPITA');
  riga('');
  riga(`  Giornate con un piatto ripetuto      ${num(c.giornateConDoppione)}   ${pct(c.giornateConDoppione, c.giornate)} di tutte`);
  riga(`  Clienti che ne hanno vista almeno una${num(c.clientiConDoppione)}   su ${c.clientiLette}`);

  riga('');
  riga('  Per causa (una giornata può contare in più di una riga):');
  riga(`    · spuntino ↔ merenda (l'allargamento) ${num(c.perSpecie.gemelli)}   ${pct(c.perSpecie.gemelli, c.giornateARischioGemelli)} delle giornate a rischio`);
  riga(`    · altre coppie di pasti (altra causa) ${num(c.perSpecie['altri-pasti'])}   ${pct(c.perSpecie['altri-pasti'], c.giornate)} di tutte`);
  riga(`    · misto (da guardare a mano)          ${num(c.perSpecie.misto)}`);
  riga('      ⚠️ «misto» serve la stessa ricetta in almeno TRE pasti: uno zero qui è quasi sempre');
  riga('         la forma della giornata, non una misura.');

  if (c.coppie.length) {
    riga('');
    riga('  Quali pasti, dalla combinazione più frequente:');
    for (const x of c.coppie.slice(0, 12)) riga(`    ${num(x.giornate)}  ${x.etichetta}`);
    if (c.coppie.length > 12) riga(`    …e altre ${c.coppie.length - 12} combinazioni meno frequenti.`);
  }

  if (c.esempi.length) {
    riga('');
    riga(`  Esempi (${c.esempi.length} righe, da al massimo ${ESEMPI} giornate diverse):`);
    for (const e of c.esempi) {
      riga(`    ${e.data}  cliente ${e.clientId.slice(0, 8)}  «${e.doppione.nome ?? e.doppione.recipeId}»`);
      riga(`                ${e.doppione.slot.join(' + ')}  [${e.doppione.specie}]`);
    }
  }

  titolo('COME SI LEGGE');
  riga('');
  /** ⚠️ Il verdetto lo dà `doveCorreggere`, che ha le sue prove: qui si stampa e basta. */
  const verdetto = doveCorreggere(c);
  const soglia = `${(QUOTA_CHE_CAMBIA_LA_STRADA * 100).toFixed(0)}%`;
  if (verdetto === 'non misurato') {
    if (c.giornate === 0) {
      riga('  ⚠️ Nessuna giornata nel periodo chiesto: alza GIORNI, o il periodo è vuoto.');
    } else {
      riga('  ⛔ Nessuna delle giornate lette aveva SIA lo spuntino SIA la merenda: il difetto non è');
      riga('     stato messo alla prova nemmeno una volta. ⚠️ Questo NON è «non capita» — è «non');
      riga('     misurato». Allarga GIORNI, o guarda in un periodo con clienti a cinque pasti.');
    }
  } else if (verdetto === 'campione troppo piccolo') {
    riga(`  ⚠️ Solo ${c.giornateARischioGemelli} giornate a rischio, sotto le ${GIORNATE_MINIME} che servono per dire qualcosa.`);
    riga(`     Su così poche, ${pct(c.perSpecie.gemelli, c.giornateARischioGemelli)} sta insieme sia a «sotto soglia» sia a «capita quasi sempre».`);
    riga('     Alza GIORNI e rilancia: un verdetto perentorio su questo campione avrebbe la faccia');
    riga('     di una misura senza esserlo.');
  } else if (verdetto === 'non serve') {
    riga(`  ✅ Su ${c.giornateARischioGemelli} giornate con tutti e due i pasti gemelli, nessun piatto ripetuto fra loro.`);
    riga('     Il difetto è possibile ma non capita: la voce si può chiudere con una guardia');
    riga('     leggera, o lasciare aperta e rimisurare fra un mese.');
  } else {
    riga(`  Fra spuntino e merenda capita nel ${pct(c.perSpecie.gemelli, c.giornateARischioGemelli)} delle giornate che hanno tutti e due.`);
    riga('');
    if (verdetto === 'nella composizione') {
      riga(`  ⛔ Sopra il ${soglia}: non è un caso limite, è una cosa che le clienti vedono. La correzione`);
      riga('     va nella COMPOSIZIONE (`dayCombo`), dove si sceglie la giornata intera: una guardia');
      riga('     a valle rifarebbe la scelta senza i vincoli di kcal e macro davanti.');
    } else {
      riga(`  ⚠️ Sotto il ${soglia}: capita, ma raramente. Una guardia a valle — «se un piatto compare`);
      riga('     due volte, il secondo slot ripesca dal pool» — costa meno di un vincolo dentro il');
      riga('     prodotto cartesiano, che ne moltiplica le combinazioni da scartare.');
    }
  }

  if (c.perSpecie['altri-pasti'] > 0) {
    riga('');
    riga(`  ⛔ E ${c.perSpecie['altri-pasti']} giornate hanno il piatto ripetuto fra pasti NON gemelli (colazione e cena,`);
    riga('     pranzo e spuntino…): quello non nasce dall\'allargamento, quindi non lo chiude la');
    riga('     stessa correzione, e non entra nel verdetto qui sopra. Va guardato a parte, partendo');
    riga('     dagli esempi.');
  }
  if (c.perSpecie.misto > 0) {
    riga('');
    riga(`  ⚠️ E ${c.perSpecie.misto} giornate sono «misto» — la stessa ricetta in tre o più pasti, alcuni gemelli`);
    riga('     e alcuni no. Sono poche per costruzione: si guardano una per una.');
  }
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
