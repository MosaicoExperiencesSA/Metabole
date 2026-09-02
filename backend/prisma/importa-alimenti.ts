/**
 * IMPORT DEGLI ALIMENTI COMPILATI DALLA NUTRIZIONISTA — 19/8.
 *
 * I dati stanno in `dati-alimenti.ts` — un modulo, non un JSON accanto: un file che in `dist/` non
 * c'è fa fallire lo script proprio il giorno che serve. Sono 32 righe, i buchi che
 * `npm run diag:crudo-cotto` aveva trovato. Due gruppi:
 *
 *   · **da aggiungere** — alimenti che in tabella non c'erano affatto (aglio, sale, limone, cipolla,
 *     brodo, aromi): Gaia su questi non sapeva dire niente, e nel conto dei macro non entravano;
 *   · **riga a crudo** — alimenti che in tabella c'erano **solo da cotto**, mentre nelle ricette le
 *     grammature sono a crudo (convenzione di Simone, 19/8).
 *
 * ## ⚠️ IL PUNTO DIFFICILE: `NutrientFact.name` È UNICO
 *
 * Metà del secondo gruppo — carote, spinaci, zucca, patate, ceci, lenticchie, broccoli, polenta,
 * pane di segale, pane di farro… — **esiste già con quel nome esatto**, come bollita o cotta. Non si
 * può inserire una seconda «carote» a crudo.
 *
 * La riga vecchia si **rinomina** aggiungendo il suo stato — «carote» → «carote bollite» — e il nome
 * nudo va alla riga a crudo. ⚠️ È la scelta giusta e non è indolore: una ricetta dice «carote», la
 * convenzione dice che sono a crudo, quindi il nome nudo **deve** portare al valore a crudo. Il nome
 * vecchio non si perde: diventa un **sinonimo** della riga rinominata, così chi chiede «le carote
 * bollite quante calorie hanno?» continua a trovarla.
 *
 * ⚠️ E le due righe con lo stesso sinonimo sono **esattamente** quello che serve a `scegliPerStato`:
 * da lì in avanti, a una domanda che non dice crudo o cotto, Gaia risponde «dipende» invece di dare
 * un numero. Prima non poteva: la riga era una sola.
 *
 * ## ⚠️ COSA NON FA
 *
 * Non tocca i **valori** di una riga che esiste già ed è già a crudo: quelli sono dati verificati, e
 * sovrascriverli con un file nuovo vorrebbe dire perdere in silenzio una correzione fatta a mano.
 * Si dice, e decide una persona.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run importa:alimenti              → prova a vuoto, non scrive niente
 *   CONFERMA=1 npm run importa:alimenti   → scrive
 */
import { PrismaClient } from '@prisma/client';
import { ALIMENTI_19_8, type RigaAlimento } from './dati-alimenti';
import { ALIMENTI_20_8 } from './dati-alimenti-20-8';
import { ALIMENTI_2_9 } from './dati-alimenti-2-9';
import { trovaGemelli, riempimenti } from '../src/nutrient-facts/gemelli-alimenti';
import { pianifica, type Conosciuta } from '../src/nutrient-facts/piano-alimenti';
import { statiCheTornanoIndietro, statoDalFoglio } from '../src/nutrient-facts/stato-dal-foglio';

const prisma = new PrismaClient();
const CONFERMA = process.env.CONFERMA === '1';

type Riga = RigaAlimento;



async function main() {
  /**
   * ⚠️ **I DUE ELENCHI INSIEME, e nell'ordine in cui sono stati compilati.**
   *
   * Le 32 righe del 19/8 e le 245 del 20/8 si sovrappongono su una ventina di nomi (limone, cipolla,
   * sedano, carote…) e **con numeri diversi**: il limone è 11 kcal nel primo foglio e 29 nel secondo.
   * Non è un problema da risolvere qui, ed è il motivo per cui questo script non sovrascrive mai una
   * riga già a crudo: stampa i due numeri accanto e lascia decidere a una persona. Rilanciarlo non
   * fa danni — la seconda volta trova tutto già a posto e non scrive niente.
   */
  const righe = [...ALIMENTI_19_8, ...ALIMENTI_20_8, ...ALIMENTI_2_9];

  console.log('');
  console.log('==================================================================');
  console.log('  ALIMENTI — import del foglio compilato dalla nutrizionista');
  console.log(CONFERMA ? '  ⚠️  CONFERMA=1: SCRIVO.' : '  Prova a vuoto: non scrivo niente.');
  console.log('==================================================================');
  console.log('');

  if (!primaGuardaSeSonoInventati(righe)) return;

  /**
   * ⛔ **E POI: LO STATO CHE FA TORNARE INDIETRO IL LAVORO** — controllo aggiunto il 2/9.
   *
   * Il foglio di quel giorno scrive «crudo / naturale» su 238 righe di 262. `normalizzaStato` rende
   * `altro` — cioè «non lo so» — a qualunque valore che contenga una barra, e la regola è giusta:
   * una riga che dichiara due stati sta dichiarando la propria ambiguità. ⛔ Ma importarlo così
   * vorrebbe dire che **il 91% degli alimenti appena compilati** entra in tabella con la condizione
   * che li rimette nell'elenco «Alimenti da correggere» da cui il foglio è nato: il lavoro di chi
   * l'ha riempito tornerebbe indietro da solo, senza un errore e senza che nessuno se ne accorga.
   *
   * `stato-dal-foglio.ts` traduce le scritture conosciute; questo controllo dice se ne è arrivata
   * una nuova. ⚠️ Si guarda **prima** di leggere la tabella, come quello sui numeri inventati: un
   * import che parte e poi si accorge è un import che ha già scritto.
   */
  const statiRotti = statiCheTornanoIndietro(righe);
  if (statiRotti.length) {
    console.log('⛔ FERMO. Ci sono stati che il motore leggerà come «non lo so»:');
    console.log('');
    for (const r of statiRotti.slice(0, 30)) {
      console.log(`  · ${r.name}: «${r.state}» → il motore legge «${r.letto}»`);
    }
    if (statiRotti.length > 30) console.log(`  … e altri ${statiRotti.length - 30}.`);
    console.log('');
    console.log('  Queste righe entrerebbero in tabella senza stato, e si rimetterebbero da sole');
    console.log('  nell\'elenco «Alimenti da correggere». Aggiungi la scrittura a STATI_DEL_FOGLIO');
    console.log('  in `src/nutrient-facts/stato-dal-foglio.ts` — dopo aver chiesto a chi ha');
    console.log('  compilato cosa intendeva, che è la parte che uno script non può indovinare.');
    console.log('');
    return;
  }

  const tutti = (await prisma.nutrientFact.findMany({
    select: { id: true, name: true, synonyms: true, state: true, kcal: true } as never,
  })) as Conosciuta[];

  const piano = pianifica(righe, tutti);
  for (const m of piano.mosse) console.log(m.messaggio);

  console.log('');
  console.log(`Righe nel foglio: ${righe.length} · da creare: ${piano.creati} · da rinominare: ${piano.rinominati} · saltate: ${piano.saltati}`);

  if (!CONFERMA) {
    console.log('\nProva a vuoto: non ho scritto niente. Rileggi l\'elenco riga per riga, poi CONFERMA=1.\n');
    return;
  }

  /**
   * ⚠️ **Tutto o niente.** Prima le scritture partivano una dopo l'altra, e la prova a vuoto del
   * 20/8 ha mostrato che ce n'era una destinata a fallire (un nome duplicato, per via della mappa
   * che non si aggiornava): senza transazione sarebbe morta a metà, lasciando in tabella righe
   * rinominate senza la loro riga a crudo — cioè ricette che puntano a un nome che non c'è più.
   * Una tabella a metà è peggio di una tabella vecchia, perché non si sa più a che punto era.
   */
  await prisma.$transaction(async (tx) => {
    for (const m of piano.mosse) {
      if (m.tipo === 'salta') continue;
      if (m.tipo === 'rinomina-e-crea') {
        await tx.nutrientFact.update({
          where: { id: m.id },
          data: { name: m.nuovoNome, synonyms: m.sinonimi } as never,
        });
      }
      await tx.nutrientFact.create({ data: { ...datiDi(m.riga) } as never });
    }
  }, { timeout: 120_000 });
  console.log('\nFatto. ⚠️ Rilancia `npm run diag:crudo-cotto`: le liste 1 e 3b devono essersi accorciate.\n');
}

/**
 * ⛔ **PRIMA DI GUARDARE LA TABELLA: il foglio si è inventato dei numeri?**
 *
 * Il 20/8 il foglio delle 245 righe è arrivato con 173 righe che sono la copia esatta di un'altra
 * riga — 99 alimenti diversi (tahina, ghee, miele, tempeh, branzino, fichi secchi, patate dolci…)
 * tutti a «25 kcal, 1.5 proteine, 3.5 carboidrati, 2.5 zuccheri, 0.3 grassi, 2.2 fibre». Il
 * controllo di coerenza che avevo fatto passare al foglio ne aveva segnalata **una**: guardava una
 * riga per volta, e una riga vera copiata resta coerente con sé stessa. La copia si vede solo
 * mettendo le righe accanto, ed è quello che fa `trovaGemelli`.
 *
 * ⚠️ Si guarda **prima** di leggere la tabella, non dopo: un import che parte e poi si accorge è un
 * import che ha già scritto.
 *
 * Torna `false` se c'è da fermarsi.
 */
function primaGuardaSeSonoInventati(righe: RigaAlimento[]): boolean {
  const gruppi = trovaGemelli(righe);
  for (const g of gruppi) {
    if (g.radiceComune) {
      console.log(`· stessi valori ma è lo stesso alimento («${g.radiceComune}…»), va bene: ${g.nomi.join(', ')}`);
    }
  }
  const copiati = riempimenti(gruppi);
  if (copiati.length === 0) return true;

  const coinvolte = copiati.reduce((s, g) => s + g.nomi.length, 0);
  console.log('');
  console.log('⛔ MI FERMO: nel foglio ci sono valori copiati da una riga all\'altra.');
  console.log(`   ${coinvolte} righe su ${righe.length} hanno i valori identici a quelli di un altro alimento.`);
  console.log('');
  for (const g of copiati) {
    console.log(`   ${g.nomi.length} alimenti a «${g.valori}» (kcal/proteine/carboidrati/zuccheri/grassi/fibre):`);
    console.log(`     ${g.nomi.join(', ')}`);
    console.log('');
  }
  console.log('   Questi numeri non descrivono questi alimenti: sono un riempimento. Caricarli');
  console.log('   vorrebbe dire che Gaia li cita a una cliente come se fossero misurati.');
  console.log('   Il foglio va rifatto su queste righe. Poi si rilancia.');
  if (process.env.CARICA_ANCHE_I_COPIATI === '1') {
    console.log('');
    console.log('   ⚠️ CARICA_ANCHE_I_COPIATI=1: vado avanti lo stesso, e resta scritto qui che è stato fatto.');
    console.log('');
    return true;
  }
  console.log('');
  console.log('   (Se sai che è un falso allarme: CARICA_ANCHE_I_COPIATI=1.)');
  console.log('');
  process.exitCode = 1;
  return false;
}

function datiDi(r: Riga) {
  return {
    name: r.name,
    synonyms: r.synonyms ?? [],
    category: r.category,
    kcal: r.kcal,
    protein: r.protein,
    carbs: r.carbs,
    sugars: r.sugars,
    fat: r.fat,
    fiber: r.fiber,
    source: r.source,
    /**
     * ⚠️ **Lo stato passa dalla traduzione del foglio** (2/9): il foglio scrive «crudo / naturale»,
     * e `normalizzaStato` legge `altro` a qualunque cosa contenga una barra. Senza questa riga il
     * 91% degli alimenti del foglio nuovo entrerebbe come «non lo so», cioè si rimetterebbe da solo
     * nell'elenco «Alimenti da correggere» da cui il foglio è nato.
     */
    state: statoDalFoglio(r.state),
    /**
     * ⚠️ **La nota di chi ha compilato** (2/9), con lo stesso `undefined` dell'IG: i fogli vecchi
     * non ce l'hanno e non devono prendersi un `null` scritto apposta.
     */
    ...(r.note !== undefined ? { note: r.note } : {}),
    // ⚠️ L'indice glicemico c'è solo sul foglio del 20/8: `undefined` non arriva a Prisma, quindi le
    // righe vecchie restano come sono invece di prendersi dei `null` scritti apposta.
    ...(r.glycemicIndex !== undefined ? { glycemicIndex: r.glycemicIndex } : {}),
    ...(r.glycemicIndexMin !== undefined ? { glycemicIndexMin: r.glycemicIndexMin } : {}),
    ...(r.glycemicIndexMax !== undefined ? { glycemicIndexMax: r.glycemicIndexMax } : {}),
    ...(r.glycemicIndexReliability !== undefined ? { glycemicIndexReliability: r.glycemicIndexReliability } : {}),
  };
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
