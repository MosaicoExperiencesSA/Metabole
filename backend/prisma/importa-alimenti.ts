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
import { normalizzaStato, STATI_A_CRUDO } from '../src/nutrient-facts/stato-alimento';
import { normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';

const prisma = new PrismaClient();
const CONFERMA = process.env.CONFERMA === '1';

type Riga = RigaAlimento;

/**
 * Il nome che prende la riga vecchia quando le si toglie il nome nudo: «carote» → «carote (da cotto)».
 *
 * ⚠️ **Prima incollava la parola dello stato così com'era**, e la prova a vuoto del 20/8 ha mostrato
 * cosa ne usciva: «broccoli bollito», «barbabietola bollito», «spinaci bollito», «polenta cotto»,
 * «fagioli neri bollito», «spaghetti integrali bollito». In italiano lo stato si accorda con
 * l'alimento, e l'alimento cambia genere e numero: non c'è una regola che ci arrivi da sola, e
 * indovinarla sbaglierebbe sul primo nome nuovo.
 *
 * ⛔ E non è una questione di eleganza: **questi nomi li legge una persona** — stanno nella pagina
 * Alimenti, e Gaia li può citare a una cliente («le barbabietola bollito hanno…»). Un nome storto
 * in banca dati si corregge solo con un'altra migrazione.
 *
 * `(da cotto)` è sempre grammaticale, per qualunque alimento, ed è **la frase che il prodotto già
 * usa**: «Solo da cotto» è l'etichetta dell'elenco «Alimenti da correggere». Gli altri stati
 * restano fra parentesi come sono, che è già corretto perché non si accordano con niente.
 */
function nomeConStato(nome: string, stato: string | null): string {
  const s = (stato ?? '').trim().toLowerCase();
  if (!s) return `${nome} (vecchia)`;
  const daCotto = s.startsWith('bollit') || s.startsWith('cott') || s.startsWith('lessat');
  return daCotto ? `${nome} (da cotto)` : `${nome} (${s})`;
}

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
  const righe = [...ALIMENTI_19_8, ...ALIMENTI_20_8];

  console.log('');
  console.log('==================================================================');
  console.log('  ALIMENTI — import del foglio compilato dalla nutrizionista');
  console.log(CONFERMA ? '  ⚠️  CONFERMA=1: SCRIVO.' : '  Prova a vuoto: non scrivo niente.');
  console.log('==================================================================');
  console.log('');

  const tutti = (await prisma.nutrientFact.findMany({
    select: { id: true, name: true, synonyms: true, state: true, kcal: true } as never,
  })) as { id: string; name: string; synonyms: string[]; state: string | null; kcal: number | null }[];
  const perNome = new Map(tutti.map((a) => [normalizzaNome(a.name), a]));

  let creati = 0; let rinominati = 0; let saltati = 0;
  const daFare: (() => Promise<void>)[] = [];

  for (const r of righe) {
    if (r.kcal === null) {
      console.log(`⚠️  SALTO «${r.name}»: senza kcal non si carica (è l'unico campo che non si può indovinare).`);
      saltati += 1;
      continue;
    }
    const esistente = perNome.get(normalizzaNome(r.name));

    if (!esistente) {
      console.log(`+ nuova   «${r.name}»  (${r.state ?? 'senza stato'}, ${r.kcal} kcal)  [${r.foglio}]`);
      creati += 1;
      daFare.push(async () => {
        await prisma.nutrientFact.create({ data: { ...datiDi(r) } as never });
      });
      continue;
    }

    const statoVecchio = normalizzaStato(esistente.state);
    if (STATI_A_CRUDO.includes(statoVecchio)) {
      /**
       * ⚠️ Esiste già ed è già a crudo: i valori NON si toccano. Sono dati verificati, e
       * sovrascriverli con un file nuovo vorrebbe dire perdere in silenzio una correzione fatta a
       * mano. Si dice, e decide una persona.
       */
      console.log(`· c'è già a crudo, non tocco  «${esistente.name}»  (in tabella ${esistente.kcal ?? '?'} kcal, nel foglio ${r.kcal})`);
      saltati += 1;
      continue;
    }

    /**
     * ⚠️ IL CASO CHE VALE LO SCRIPT: la riga esiste **da cotto** e occupa il nome nudo. Si rinomina
     * («carote» → «carote bollite»), il nome vecchio le resta come **sinonimo**, e il nome nudo va
     * alla riga a crudo — perché è quello che scrivono le ricette, e le ricette sono a crudo.
     */
    const nuovoNome = nomeConStato(esistente.name, esistente.state);
    if (perNome.has(normalizzaNome(nuovoNome))) {
      console.log(`⚠️  SALTO «${r.name}»: «${nuovoNome}» esiste già, e rinominare creerebbe un doppione. Guardala a mano.`);
      saltati += 1;
      continue;
    }
    console.log(`~ rinomino  «${esistente.name}» → «${nuovoNome}»  (resta come sinonimo)`);
    console.log(`+ e creo    «${r.name}»  (${r.state ?? 'senza stato'}, ${r.kcal} kcal)`);
    rinominati += 1; creati += 1;
    daFare.push(async () => {
      await prisma.nutrientFact.update({
        where: { id: esistente.id },
        data: {
          name: nuovoNome,
          // ⚠️ Il nome vecchio diventa un sinonimo: chi chiedeva «carote» continua a trovarla, e
          // adesso trova DUE righe con stati diversi — che è ciò che fa dire «dipende» a Gaia.
          synonyms: [...new Set([...(esistente.synonyms ?? []), esistente.name])],
        } as never,
      });
      await prisma.nutrientFact.create({ data: { ...datiDi(r) } as never });
    });
  }

  console.log('');
  console.log(`Righe nel foglio: ${righe.length} · da creare: ${creati} · da rinominare: ${rinominati} · saltate: ${saltati}`);

  if (!CONFERMA) {
    console.log('\nProva a vuoto: non ho scritto niente. Rileggi l\'elenco riga per riga, poi CONFERMA=1.\n');
    return;
  }
  for (const f of daFare) await f();
  console.log('\nFatto. ⚠️ Rilancia `npm run diag:crudo-cotto`: le liste 1 e 3b devono essersi accorciate.\n');
}

function datiDi(r: Riga) {
  return {
    name: r.name,
    synonyms: r.synonyms ?? [],
    category: r.category,
    state: r.state,
    kcal: r.kcal,
    protein: r.protein,
    carbs: r.carbs,
    sugars: r.sugars,
    fat: r.fat,
    fiber: r.fiber,
    source: r.source,
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
