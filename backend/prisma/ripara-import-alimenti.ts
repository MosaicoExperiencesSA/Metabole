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
 *   CONFERMA=1 RIMETTI_A_POSTO=1 npm run ripara:alimenti
 *                                              → e rimette a posto le 11 righe «(vecchia)»
 *
 * ⚠️ **«Rimette a posto» vuol dire togliere la COPIA, non l'originale.** L'esito del 20/8 sera ha
 * mostrato che quelle undici righe hanno gli **stessi identici valori** delle nuove e in più **la
 * firma di un nutrizionista**: la riga nuova non aggiunge niente, e la sola differenza è che non è
 * firmata. Quindi si cancella la nuova, la vecchia torna a chiamarsi col nome nudo, e i sinonimi si
 * uniscono. ⛔ Lo fa **solo** dove i valori combaciano campo per campo e la firma ce l'ha la
 * vecchia; in tutti gli altri casi stampa e non tocca.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFERMA = process.env.CONFERMA === '1';
/**
 * ⚠️ Si chiamava `CANCELLA_VECCHIE`, e faceva la cosa sbagliata: cancellava le righe vecchie. L'esito
 * del 20/8 sera ha mostrato che quelle undici righe hanno **gli stessi identici valori** delle nuove
 * e in più **la firma di un nutrizionista**: la copia da togliere è quella nuova, non l'originale.
 * Il nome della variabile è cambiato con il comportamento — una variabile che dice una cosa e ne fa
 * un'altra è peggio di nessuna variabile.
 */
const RIMETTI = process.env.RIMETTI_A_POSTO === '1';

/** Il nome che l'import ha dato quando non sapeva lo stato. */
const CODA_VECCHIA = ' (vecchia)';

interface Riga {
  id: string; name: string; synonyms: string[]; state: string | null; category: string | null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
  source: string | null; verifiedById: string | null; verifiedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}

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
    select: {
      id: true, name: true, synonyms: true, state: true, category: true, kcal: true, protein: true,
      carbs: true, fat: true, fiber: true, source: true, verifiedById: true, verifiedAt: true,
      createdAt: true, updatedAt: true,
    } as never,
  })) as Riga[];

  const vecchie = tutte.filter((r) => r.name.endsWith(CODA_VECCHIA));
  if (!vecchie.length) {
    console.log('   ✅ nessuna.');
  }
  const perNome = new Map(tutte.map((r) => [r.name, r]));

  /**
   * ⚠️ **TUTTI I CAMPI DELLE DUE RIGHE, non solo le kcal.**
   *
   * La prima versione stampava nome, kcal e stato, e l'esito del 20/8 sera ha mostrato una cosa che
   * non tornava: l'import aveva scritto `+ e creo «burro» (crudo, 758 kcal)` ma la riga nuova
   * risultava **senza stato**. Con tre campi si può solo fare un'ipotesi; con tutti i campi e la
   * **data di creazione** si legge chi è chi. Un elenco che costringe a indovinare è un elenco che
   * non ha misurato niente — è la stessa lezione della radice `nocciol` di stasera.
   */
  const quando = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 19) : '—');
  const descrivi = (r: Riga | undefined, etichetta: string) => {
    if (!r) { console.log(`      ${etichetta}: ⚠️  NON C'È`); return; }
    console.log(`      ${etichetta}`);
    console.log(`         id ${r.id}`);
    console.log(`         stato «${r.state ?? 'NULL'}» · categoria «${r.category ?? 'NULL'}»`);
    console.log(`         ${r.kcal ?? '?'} kcal · prot ${r.protein ?? '?'} · carb ${r.carbs ?? '?'} · gras ${r.fat ?? '?'} · fibr ${r.fiber ?? '?'}`);
    console.log(`         fonte: ${r.source ?? 'NULL'}`);
    console.log(`         confermata: ${r.verifiedById ? `SÌ, il ${quando(r.verifiedAt)}` : 'no'}`);
    console.log(`         creata il ${quando(r.createdAt)} · modificata il ${quando(r.updatedAt)}`);
    console.log(`         sinonimi: ${r.synonyms.length ? r.synonyms.join(', ') : '(nessuno)'}`);
  };

  for (const v of vecchie) {
    const nudo = v.name.slice(0, -CODA_VECCHIA.length);
    const nuova = perNome.get(nudo);
    console.log(`   ── ${nudo} ${'─'.repeat(Math.max(0, 56 - nudo.length))}`);
    descrivi(v, `VECCHIA — «${v.name}»`);
    descrivi(nuova, `NUOVA   — «${nudo}»`);
    /**
     * ⚠️ Il consiglio si stampa solo quando i numeri **combaciano davvero**, campo per campo: se
     * combaciano, la riga nuova non porta niente che la vecchia non avesse già, e l'unica differenza
     * è che la vecchia ha la firma di un nutrizionista. Se non combaciano, non c'è un consiglio
     * automatico: le due righe dicono cose diverse e le guarda una persona.
     */
    if (nuova) {
      const ugualiValori = ['kcal', 'protein', 'carbs', 'fat', 'fiber'].every((c) => (v as never)[c] === (nuova as never)[c]);
      if (ugualiValori && v.verifiedById && !nuova.verifiedById) {
        console.log('      ⛔ STESSI VALORI, e la firma ce l\'ha la VECCHIA: la nuova non aggiunge niente.');
        console.log('         Il verso giusto è tenere la vecchia e togliere il doppione, non il contrario.');
      } else if (!ugualiValori) {
        console.log('      ⚠️  I valori NON combaciano: le due righe dicono cose diverse, decide una persona.');
      }
    }
    if (v.verifiedById) console.log('      ⛔ questa riga l\'ha CONFERMATA una persona: non si cancella con una variabile d\'ambiente.');
    if (!RIMETTI || !CONFERMA || !nuova) { console.log(''); continue; }
    const ugualiValori = ['kcal', 'protein', 'carbs', 'fat', 'fiber'].every((c) => (v as never)[c] === (nuova as never)[c]);
    if (!ugualiValori) { console.log('      · valori diversi: non tocco niente.\n'); continue; }
    if (!v.verifiedById || nuova.verifiedById) { console.log('      · non è il caso «firma sulla vecchia»: non tocco niente.\n'); continue; }
    /**
     * ⚠️ **SI TOGLIE LA COPIA, NON L'ORIGINALE.** I valori sono identici campo per campo: la riga
     * nuova non porta niente che la vecchia non avesse già, e l'unica differenza è che la vecchia ha
     * la firma di un nutrizionista. Rimettere a posto vuol dire cancellare **la nuova** e ridare il
     * nome nudo alla vecchia — l'opposto di quello che faceva la prima versione di questo script,
     * che avrebbe buttato via la firma e tenuto la copia.
     *
     * I sinonimi si uniscono prima: sono i modi in cui qualcuno cerca quell'alimento.
     */
    const uniti = [...new Set([...v.synonyms, ...(nuova.synonyms ?? [])])].filter((x) => x !== nudo);
    await prisma.$transaction(async (tx) => {
      await tx.nutrientFact.delete({ where: { id: nuova.id } });
      await tx.nutrientFact.update({ where: { id: v.id }, data: { name: nudo, synonyms: uniti } as never });
    });
    console.log(`      ✍️  tolto il doppione senza firma; «${v.name}» è tornata a chiamarsi «${nudo}» e tiene la sua conferma.`);
    console.log('');
  }

  console.log('');
  if (!CONFERMA) {
    console.log('Prova a vuoto: non ho scritto niente.');
    console.log('  CONFERMA=1 npm run ripara:alimenti                        → sistema lo stato di «carota»');
    console.log('  CONFERMA=1 RIMETTI_A_POSTO=1 npm run ripara:alimenti     → e rimette a posto le righe «(vecchia)»');
    console.log('⚠️ La seconda dopo aver letto l\'elenco qui sopra riga per riga.\n');
  } else if (!RIMETTI && vecchie.length) {
    console.log(`⚠️ Le ${vecchie.length} righe «(vecchia)» sono ancora lì: decidi tu, poi RIMETTI_A_POSTO=1.\n`);
  } else {
    console.log('Fatto. ⚠️ Rilancia `npm run diag:crudo-cotto`.\n');
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
