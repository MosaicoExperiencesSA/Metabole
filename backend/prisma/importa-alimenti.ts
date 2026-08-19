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
import { normalizzaStato, STATI_A_CRUDO } from '../src/nutrient-facts/stato-alimento';
import { normalizzaNome } from '../src/nutrient-facts/valori-nutrizionali.service';

const prisma = new PrismaClient();
const CONFERMA = process.env.CONFERMA === '1';

type Riga = RigaAlimento;

/** Il nome che prende la riga vecchia quando le si toglie il nome nudo: «carote» → «carote bollite». */
function nomeConStato(nome: string, stato: string | null): string {
  const s = (stato ?? '').trim().toLowerCase();
  return s ? `${nome} ${s}` : `${nome} (vecchia)`;
}

async function main() {
  const righe = ALIMENTI_19_8;

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
  };
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
