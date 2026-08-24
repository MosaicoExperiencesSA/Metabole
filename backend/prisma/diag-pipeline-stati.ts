/**
 * LE COLONNE DELLA PIPELINE, NELL'ORDINE VERO — 20/8.
 *
 * L'avanzamento automatico (`commerce/avanza-stato.ts`) **non fa mai retrocedere** una scheda: il
 * confronto è sull'`order` della colonna. Vuol dire che la posizione di una colonna non è un fatto
 * estetico — decide se un passaggio automatico avviene o no.
 *
 * ⚠️ E una colonna creata dal backoffice nasce **in fondo** (`order = max + 1`). Se ci si appoggia
 * un'automazione senza spostarla, succedono due cose insieme, tutte e due mute:
 *  · le schede ci finiscono dentro anche da «Acquisito» o «Percorso concluso», perché in fondo si
 *    va sempre — e la board mostra una cliente che ha comprato in fondo alla fila;
 *  · da lì non escono più da sole, perché ogni altro stato ha un `order` più basso.
 *
 * Questo elenco serve a vedere quelle due cose prima che succedano. Non scrive niente.
 *
 *   npm run diag:pipeline-stati
 */
import { PrismaClient } from '@prisma/client';
import { STATO_PRIMO_ACCESSO } from '../src/commerce/primo-accesso';

const prisma = new PrismaClient();

/** Gli stati scritti da un'automazione, e da dove. Se manca la colonna, quel passaggio non avviene. */
const SCRITTI_DAL_CODICE: { key: string; da: string }[] = [
  { key: 'lead_in', da: 'registrazione, import, lead a mano' },
  { key: STATO_PRIMO_ACCESSO, da: 'registrazione e accesso della cliente' },
  { key: 'questionnaire_done', da: 'fine del questionario' },
  { key: 'trial', da: 'attivazione di un prodotto gratuito' },
  { key: 'paid', da: 'primo pagamento' },
  { key: 'path_ended', da: 'piano scaduto da una settimana' },
  { key: 'non_seguita', da: 'piano scaduto da una settimana, e nemmeno una misura mentre correva' },
];

async function main() {
  const stati = (await prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } })) as {
    key: string; label: string; order: number; isSystem: boolean;
  }[];
  const conte = (await prisma.crmRecord.groupBy({ by: ['stage'], _count: { _all: true } })) as unknown as {
    stage: string; _count: { _all: number };
  }[];
  const quante = new Map(conte.map((c) => [c.stage, c._count._all]));
  const perKey = new Map(stati.map((s) => [s.key, s]));

  console.log('');
  console.log('LE COLONNE, NELL\'ORDINE IN CUI SI VEDONO SULLA BOARD');
  console.log('─────────────────────────────────────────────────────────────────────');
  for (const s of stati) {
    const auto = SCRITTI_DAL_CODICE.find((a) => a.key === s.key);
    const n = quante.get(s.key) ?? 0;
    console.log(
      `  ${String(s.order).padStart(2)}  ${s.label.padEnd(30)} ${s.key.padEnd(28)} ` +
        `${String(n).padStart(5)} schede${s.isSystem ? '  [sistema]' : ''}${auto ? `  ← ${auto.da}` : ''}`,
    );
  }

  const orfane = conte.filter((c) => !perKey.has(c.stage));
  if (orfane.length) {
    console.log('');
    console.log('⚠️  SCHEDE IN UNA COLONNA CHE NON ESISTE PIÙ (l\'admin l\'ha eliminata):');
    for (const o of orfane) console.log(`     «${o.stage}» — ${o._count._all} schede. Non si vedono sulla board.`);
  }

  console.log('');
  console.log('I PASSAGGI AUTOMATICI');
  console.log('─────────────────────────────────────────────────────────────────────');
  let problemi = 0;
  for (const a of SCRITTI_DAL_CODICE) {
    const s = perKey.get(a.key);
    if (!s) {
      console.log(`  ⛔ «${a.key}» NON ESISTE — il passaggio «${a.da}» non avviene, e non protesta.`);
      problemi += 1;
      continue;
    }
    console.log(`  ✅ «${s.label}» (posto ${s.order}) ← ${a.da}`);
  }

  /**
   * ⚠️ LA COSA CHE NESSUN ALTRO CONTROLLO VEDE: l'ordine fra i passaggi automatici.
   * Se «primo accesso» sta dopo «questionario completato», chi accede non arriva più al secondo,
   * perché l'avanzamento non torna indietro. Nessun errore, nessun log: la colonna si riempie e
   * l'altra resta vuota.
   */
  const ordineGiusto = [ 'lead_in', STATO_PRIMO_ACCESSO, 'questionnaire_done', 'trial', 'path_ended', 'non_seguita' ];
  console.log('');
  console.log('L\'ORDINE FRA I PASSAGGI AUTOMATICI (questo è quello che si rompe in silenzio)');
  console.log('─────────────────────────────────────────────────────────────────────');
  let precedente: { key: string; order: number; label: string } | null = null;
  for (const k of ordineGiusto) {
    const s = perKey.get(k);
    if (!s) continue;
    if (precedente && s.order <= precedente.order) {
      console.log(
        `  ⛔ «${s.label}» (posto ${s.order}) NON sta dopo «${precedente.label}» (posto ${precedente.order}).`,
      );
      console.log(`     Una scheda arrivata in «${precedente.label}» non passerà mai a «${s.label}» da sola.`);
      console.log('     Si sistema trascinando la colonna sulla board, non da qui.');
      problemi += 1;
    } else {
      console.log(`  ✅ «${s.label}» (posto ${s.order}) sta dopo ${precedente ? `«${precedente.label}»` : 'l\'inizio'}.`);
    }
    precedente = s;
  }

  console.log('');
  console.log(problemi === 0 ? '✅ Nessun problema: i passaggi automatici possono avvenire tutti.' : `⛔ ${problemi} cose da sistemare.`);
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
