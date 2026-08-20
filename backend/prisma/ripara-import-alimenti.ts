/**
 * RIPARA LE DUE COSE CHE L'IMPORT DEL 20/8 HA LASCIATO STORTE.
 *
 * L'import è andato a buon fine — 264 righe create, 24 rinominate, tutto in transazione — ma la
 * prova a vuoto aveva mostrato due cose che non ho fatto in tempo a segnalare prima del `CONFERMA=1`.
 * ⚠️ **Nessuna delle due è una perdita di dati**: le righe vecchie sono state *rinominate*, non
 * cancellate, e il nome vecchio è rimasto come sinonimo. Sono due etichette, e si cambiano con un
 * `update` — che è molto meno invasivo di annullare 264 righe appena create.
 *
 * ## 1) «carota» ha lo stato `bollite`, e sono 1017 ricette
 *
 * Il foglio del 20/8 portava «carota» con lo stato `bollite`, ereditato dall'export originale dove
 * quella riga *era* la carota cotta. Il **valore** è giusto — 35 kcal è anche il valore a crudo,
 * e nel foglio «carota cruda» ha esattamente 35 — ma lo stato no. ⛔ E il nome esatto vince sul
 * sinonimo: da adesso le ricette che scrivono «carota» trovano un ingrediente «solo da cotto»,
 * mentre la convenzione dice che le grammature sono a crudo. Si cambia il campo `state`, e basta.
 *
 * ## 2) Undici righe si chiamano «X (vecchia)»
 *
 * ⛔ **Questo è un difetto mio nello script, non del foglio.** `nomeConStato` usa `(vecchia)` come
 * ripiego quando la riga vecchia non ha uno stato — e lo script tratta «senza stato» come «da
 * cotto», la sposta, e dà il nome nudo alla riga nuova. **Ma «non lo so» non è «cotto».** Stava
 * indovinando, e il prezzo è un nome che legge una persona: burro, mandorle, noci, mela, pera,
 * fragole, avocado, parmigiano, miele, pane integrale, ricotta di vacca stanno nella pagina Alimenti
 * con «(vecchia)» attaccato, e Gaia le può citare a una cliente.
 *
 * ⚠️ Qui lo script **non decide**: mette le due righe in colonna col loro valore e lascia scegliere.
 * Cancellare una riga di banca dati non è una cosa che faccio io.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run ripara:alimenti                    → guarda e stampa, non scrive
 *   CONFERMA=1 npm run ripara:alimenti         → corregge lo stato di «carota»
 *   CONFERMA=1 CANCELLA_VECCHIE=1 npm run ripara:alimenti
 *                                              → e cancella anche le 11 righe «(vecchia)»
 *
 * ⚠️ `CANCELLA_VECCHIE=1` si usa **solo dopo** aver letto l'elenco qui sotto riga per riga: cancella
 * righe vere, e i loro sinonimi passano alla riga nuova perché nessuna ricerca si rompa.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFERMA = process.env.CONFERMA === '1';
const CANCELLA = process.env.CANCELLA_VECCHIE === '1';

/** Il nome che l'import ha dato quando non sapeva lo stato. */
const CODA_VECCHIA = ' (vecchia)';

async function main() {
  console.log('');
  console.log('==================================================================');
  console.log('  RIPARA — le due cose lasciate storte dall\'import del 20/8');
  console.log(CONFERMA ? '  ⚠️  CONFERMA=1: SCRIVO.' : '  Prova a vuoto: non scrivo niente.');
  console.log('==================================================================');

  // ---------- 1) «carota» ----------
  console.log('\n1) LO STATO DI «carota»\n');
  const carota = (await prisma.nutrientFact.findUnique({
    where: { name: 'carota' },
    select: { id: true, name: true, state: true, kcal: true } as never,
  })) as { id: string; name: string; state: string | null; kcal: number | null } | null;

  if (!carota) {
    console.log('   · la riga «carota» non c\'è: niente da fare.');
  } else if (!/bollit|cott|lessat/i.test(carota.state ?? '')) {
    console.log(`   ✅ già a posto: «carota» ha stato «${carota.state ?? 'senza stato'}».`);
  } else {
    console.log(`   ⛔ «carota» ha stato «${carota.state}» con ${carota.kcal ?? '?'} kcal.`);
    console.log('      35 kcal è anche il valore a crudo (nel foglio «carota cruda» ha lo stesso numero):');
    console.log('      si cambia SOLO lo stato, il valore non si tocca.');
    console.log('      → «crudo»');
    if (CONFERMA) {
      await prisma.nutrientFact.update({ where: { id: carota.id }, data: { state: 'crudo' } as never });
      console.log('      ✍️  fatto.');
    }
  }

  // ---------- 2) le righe «(vecchia)» ----------
  console.log('\n2) LE RIGHE CHIAMATE «(vecchia)»\n');
  const tutte = (await prisma.nutrientFact.findMany({
    select: { id: true, name: true, synonyms: true, state: true, kcal: true, verifiedById: true } as never,
  })) as { id: string; name: string; synonyms: string[]; state: string | null; kcal: number | null; verifiedById: string | null }[];

  const vecchie = tutte.filter((r) => r.name.endsWith(CODA_VECCHIA));
  if (!vecchie.length) {
    console.log('   ✅ nessuna.');
  }
  const perNome = new Map(tutte.map((r) => [r.name, r]));

  for (const v of vecchie) {
    const nudo = v.name.slice(0, -CODA_VECCHIA.length);
    const nuova = perNome.get(nudo);
    console.log(`   «${v.name}»  ${v.kcal ?? '?'} kcal, stato «${v.state ?? 'senza stato'}»${v.verifiedById ? ' · CONFERMATA da un nutrizionista' : ''}`);
    console.log(`      la nuova «${nudo}»: ${nuova ? `${nuova.kcal ?? '?'} kcal, stato «${nuova.state ?? 'senza stato'}»` : '⚠️  NON C\'È'}`);
    console.log(`      sinonimi della vecchia: ${v.synonyms.length ? v.synonyms.join(', ') : '(nessuno)'}`);
    if (v.verifiedById) console.log('      ⛔ questa riga l\'ha CONFERMATA una persona: non si cancella senza chiederglielo.');
    if (!CANCELLA || !CONFERMA || !nuova || v.verifiedById) { console.log(''); continue; }
    /**
     * ⚠️ I sinonimi della vecchia passano alla nuova **prima** di cancellare: sono i modi in cui
     * qualcuno cerca quell'alimento, e perderli vorrebbe dire che una ricerca che funzionava smette
     * di funzionare senza che nessuno se ne accorga.
     */
    const uniti = [...new Set([...(nuova.synonyms ?? []), ...v.synonyms, v.name])].filter((s) => s !== nudo);
    await prisma.nutrientFact.update({ where: { id: nuova.id }, data: { synonyms: uniti } as never });
    await prisma.nutrientFact.delete({ where: { id: v.id } });
    console.log(`      ✍️  cancellata; i suoi ${v.synonyms.length} sinonimi sono passati a «${nudo}».`);
    console.log('');
  }

  console.log('');
  if (!CONFERMA) {
    console.log('Prova a vuoto: non ho scritto niente.');
    console.log('  CONFERMA=1 npm run ripara:alimenti                        → sistema lo stato di «carota»');
    console.log('  CONFERMA=1 CANCELLA_VECCHIE=1 npm run ripara:alimenti     → e cancella le righe «(vecchia)»');
    console.log('⚠️ La seconda dopo aver letto l\'elenco qui sopra riga per riga.\n');
  } else if (!CANCELLA && vecchie.length) {
    console.log(`⚠️ Le ${vecchie.length} righe «(vecchia)» sono ancora lì: decidi tu, poi CANCELLA_VECCHIE=1.\n`);
  } else {
    console.log('Fatto. ⚠️ Rilancia `npm run diag:crudo-cotto`.\n');
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
