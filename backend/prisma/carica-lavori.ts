/**
 * IL PRIMO CARICAMENTO DELLA PAGINA «LAVORI» — da quello che era già scritto nei documenti.
 *
 * Richiesta di Simone (13/8): «una pagina con l'elenco dei lavori da fare, e una volta fatto
 * mettiamo la spunta». Questo script la riempie la prima volta: oggi quell'elenco vive sparso fra
 * `metabole-backlog.md`, i `DA_RIPRENDERE`, i documenti delle decisioni e l'handoff delle allergie.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run carica:lavori           # dice cosa scriverebbe, e non scrive
 *   CONFERMA=1 npm run carica:lavori
 *
 * ⚠️ **NON aggiorna mai una voce che esiste già.** Se la trova per `chiave`, la salta e lo dice.
 * Il motivo è la lezione di `accendi-automazioni.ts`, che pensato per accenderne tre ne ha spente
 * venti: uno script rilanciato deve poter solo AGGIUNGERE. Qui, in più, la voce che trova potrebbe
 * essere stata spuntata o riscritta a mano — e rilanciare la riporterebbe indietro senza dirlo.
 *
 * ⚠️ Le voci nate a mano dalla pagina hanno `chiave` a `null` e questo script non le vede mai.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

import { VOCI_INIZIALI, type Voce } from '../src/lavori/voci-iniziali';
/**
 * ⛔ **Questo import mancava, e lo script era rotto.** `datiSpunta` era usato più sotto senza essere
 * importato: `ts-node --transpile-only` non se ne accorge (i tipi non li guarda), quindi il difetto
 * non usciva alla prova a vuoto — usciva **con `CONFERMA=1`**, e solo sul ramo che spunta una voce
 * che il file dichiara finita. Cioè: si rompeva a metà lavoro, la prima volta che serviva davvero.
 * Trovato il 20/8 sera con `tsc --noEmit`, che sui file di `prisma/` nessuno guardava.
 */
import { datiSpunta } from '../src/lavori/lavoro';

/** Una voce dello storico estratta dal REGISTRO: entra già spuntata, con la sua data. */
type VoceStorica = Voce & { data: string };

/**
 * ⚠️ L'elenco NON è più qui: sta in `src/lavori/voci-iniziali.ts`, perché dal 13/8 lo legge anche il
 * pulsante della pagina. Due copie della stessa lista è il modo in cui la shell e la pagina
 * finiscono per caricare cose diverse.
 */
const VOCI = VOCI_INIZIALI;

async function main() {
  const conferma = process.env.CONFERMA === '1';
  console.log(conferma ? '✍️  SCRITTURA (CONFERMA=1)' : '👀 PROVA — non scrivo niente. Per scrivere: CONFERMA=1 npm run carica:lavori');
  console.log('');

  /**
   * ⚠️ LO STORICO è un ESTRATTO del `REGISTRO.md`, non una copia. Titolo e prime righe di ogni voce,
   * con la data e la squadra che l'ha scritta; il dettaglio vero resta nel registro, che è la fonte.
   * Il file è generato dal registro e vive accanto a questo script perché su Render la cartella
   * `progetto/` non c'è: uno script che legge un file che in produzione non esiste è uno script che
   * funziona solo sul portatile di chi l'ha scritto.
   */
  const storico = JSON.parse(readFileSync(join(__dirname, 'lavori-storico.json'), 'utf-8')) as VoceStorica[];
  const tutte: (Voce & { data?: string })[] = [...VOCI, ...storico];

  let aggiunte = 0;
  let saltate = 0;
  let spuntate = 0;
  for (const v of tutte) {
    const gia = await prisma.lavoro.findUnique({ where: { chiave: v.chiave }, select: { id: true, titolo: true, fatto: true } });
    if (gia) {
      /**
       * L'AGGIORNAMENTO DELLO STATO (richiesta di Simone, 13/8 sera): il file può CHIUDERE una
       * voce ancora aperta — `fatta: true` è la notizia «questa consegna l'ha finita» — ma MAI
       * riaprirne una spuntata: la pagina resta lo stato vivo. Titolo e testo restano comunque
       * intoccati: potrebbero essere stati riscritti a mano.
       */
      if (v.fatta === true && !gia.fatto) {
        spuntate++;
        console.log(`✓ la spunto: il file la dichiara finita  [${v.chiave}]`);
        if (conferma) {
          await prisma.lavoro.update({ where: { id: gia.id }, data: datiSpunta(true, null, new Date()) });
        }
        continue;
      }
      saltate++;
      console.log(`· già presente, la lascio com'è  [${v.chiave}]${gia.fatto ? ' (spuntata)' : ''}`);
      continue;
    }
    aggiunte++;
    const storica = !!v.data;
    if (!storica) console.log(`+ ${v.categoria} — ${v.titolo}`);
    if (conferma) {
      const { data, fatta, ...campi } = v;
      const nasceChiusa = storica || fatta === true;
      await prisma.lavoro.create({
        // ⚠️ Le voci storiche (e quelle che il file dichiara già finite) entrano GIÀ SPUNTATE,
        // con la data del registro se c'è e senza un nome: chi le ha scritte è la squadra.
        data: { ...campi, fatto: nasceChiusa, fattoIl: nasceChiusa ? new Date(data ? `${data}T12:00:00Z` : Date.now()) : null },
      });
    }
  }

  console.log('');
  console.log(`Aperte dai documenti: ${VOCI.length} · storiche dal REGISTRO: ${storico.length} · da aggiungere: ${aggiunte} · già presenti: ${saltate} · spuntate dal file: ${spuntate}`);
  if (!conferma && aggiunte > 0) console.log('Nessuna scritta: rilancia con CONFERMA=1 se l\'elenco qui sopra ti torna.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
