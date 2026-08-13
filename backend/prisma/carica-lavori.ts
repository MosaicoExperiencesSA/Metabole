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

type Voce = {
  chiave: string; titolo: string; dettaglio: string; categoria: string; ordine: number;
  /** ⚠️ Il rosso della pagina: «finché questa non si chiude, dietro c'è una fila ferma». Non «urgente». */
  blocca?: boolean;
};

/** Una voce dello storico estratta dal REGISTRO: entra già spuntata, con la sua data. */
type VoceStorica = Voce & { data: string };

/**
 * Le categorie servono a separare il lavoro FERMO da quello da fare: in un elenco misto una
 * decisione clinica in attesa sembra codice non scritto.
 */
const NOCANTY = 'Aspetta Nocanty';
const SIMONE = 'Aspetta Simone';
const CODICE = 'Da fare — codice';
const MANUTENZIONE = 'Manutenzione';
const DATI = 'Dati e catalogo';

const VOCI: Voce[] = [
  {
    chiave: 'nocanty-solfiti',
    blocca: true,
    titolo: 'L\'elenco dei solfiti da escludere',
    dettaglio:
      'Oggi l\'esclusione testuale ha solo la parola letterale «solfiti», dichiarato nel codice e in un test. I solfiti non si scrivono negli ingredienti: stanno nel vino, nell\'aceto balsamico, nella frutta disidratata, in certi salumi. Quell\'elenco decide quali piatti si tolgono dal piatto di una cliente, e in eccesso si sbaglia facilmente. Handoff allergie §1.2.',
    categoria: NOCANTY,
    ordine: 10,
  },
  {
    chiave: 'nocanty-soglia-visita',
    blocca: true,
    titolo: 'Quando far partire «serve la visita» in automatico',
    dettaglio:
      'Allergia dichiarata → richiesta di visita: il MODO di rispondere ora c\'è (via libera clinico, 13/8), la soglia è materia clinica. Handoff §8.',
    categoria: NOCANTY,
    ordine: 20,
  },
  {
    chiave: 'nocanty-freno-forte',
    blocca: true,
    titolo: 'Il «freno forte» per le allergie non confermate',
    dettaglio:
      '`allergieDichiarateIl` c\'è e si scrive, ma nessun comportamento parte da lì. Forma minima e sicura proposta: personal-base segnala la cliente come da rivedere e nella scheda compare «allergie non confermate». ⚠️ Non bloccare il piano di 315 clienti perché un campo nuovo è vuoto.',
    categoria: NOCANTY,
    ordine: 30,
  },
  {
    chiave: 'nocanty-scala-passi',
    titolo: 'La scala dei passi: 6.000 sedentaria → 12.000 molto attiva',
    dettaglio:
      '+5% ogni due settimane, tetto a +40% (decisione dell\'8 del 12/8). Per chi ha problemi cardiaci, articolari o è in gravidanza prescrivere passi è materia clinica.',
    categoria: NOCANTY,
    ordine: 40,
  },
  {
    chiave: 'nocanty-peso-efficacia',
    titolo: 'Il peso dell\'efficacia nei menu (`menu_select_w_eff`)',
    dettaglio:
      'Con i pesi di default un piatto a 5★ ora pareggia un piatto efficacissimo bocciato a 1★ (prima vinceva sempre l\'efficacia). È una manopola dei Parametri, e la gira lei.',
    categoria: NOCANTY,
    ordine: 50,
  },
  {
    chiave: 'nocanty-kcal-conferma',
    titolo: '§15.2 punto 1 — il numero di kcal per «Conferma»',
    dettaglio: 'Il pulsante «Conferma» che applica la proposta aspetta la soglia in kcal.',
    categoria: NOCANTY,
    ordine: 60,
  },
  {
    chiave: 'deploy-allergie-idoneita',
    blocca: true,
    titolo: 'Deploy: migrazione + backend su Render, poi backoffice su Vercel',
    dettaglio:
      '⚠️ L\'ordine conta: migrazione → backend (deve reggere l\'app vecchia) → backoffice → OTA. Le migrazioni del 13/8 sono additive.',
    categoria: SIMONE,
    ordine: 10,
  },
  {
    chiave: 'conta-allergie',
    blocca: true,
    titolo: 'Lanciare `npm run conta:allergie` sulla shell di Render',
    dettaglio:
      'È in sola lettura e non scrive niente. ⚠️ Va letto PRIMA di decidere qualsiasi campagna: se la terza popolazione è la maggioranza, quella non è una campagna ma una pagina del questionario che non raccoglie. Blocca il §7.',
    categoria: SIMONE,
    ordine: 20,
  },
  {
    chiave: 'ota-2-1-8',
    titolo: 'OTA dell\'app: si riparte da 2.1.8',
    dettaglio:
      '⚠️ Non prima che il backend sia in produzione e verificato, e il numero di versione non si riusa mai.',
    categoria: SIMONE,
    ordine: 30,
  },
  {
    chiave: 'decisione-blocco-percorso',
    titolo: 'Decidere se bloccare il percorso senza via libera clinico',
    dettaglio:
      'Oggi non si blocca niente, ed è una scelta scritta: bloccare vorrebbe dire sospendere piani attivi a clienti paganti. Il blocco, se sarà blocco, è una consegna sua.',
    categoria: SIMONE,
    ordine: 40,
  },
  {
    chiave: 'whatsapp-numero',
    titolo: 'Numero WhatsApp dedicato, verificato su Meta Business',
    dettaglio:
      'È la parte lenta delle credenziali via WhatsApp: il passo 1 (link al posto della password) è fatto dal 7/8, il resto aspetta il numero — non il codice.',
    categoria: SIMONE,
    ordine: 60,
  },
  {
    chiave: 'par7-ridomanda-chat',
    titolo: '§7 — la ri-domanda sulle allergie in chat con Gaia',
    dettaglio:
      '⚠️ Non si comincia senza aver letto l\'output di `conta:allergie`. Modello da copiare: `menu/data-inizio-chat.ts` (non «Conosciamoci»). Trappole già mappate: un solo flusso aperto per volta, scadenza a un\'ora (si riapre, non si riprende), niente pulsanti in chat, risposte libere da far confermare, transazione + audit perché è un dato sanitario.',
    categoria: CODICE,
    ordine: 10,
  },
  {
    chiave: 'visita-calendario',
    titolo: 'La visita nel calendario quando l\'esito è «serve una visita»',
    dettaglio: 'Oggi la decisione si registra ma la visita si prenota a mano.',
    categoria: CODICE,
    ordine: 20,
  },
  {
    chiave: 'coda-da-validare-b-c',
    titolo: 'Coda «Da validare» (§15.2): restano le consegne B e C',
    dettaglio: 'La A è stata consegnata l\'11/8. ⚠️ Il livello 2 non esiste (315 diete a livello 1): la voce 1 si fa in percentuale.',
    categoria: CODICE,
    ordine: 30,
  },
  {
    chiave: 'vera-verifica-mac',
    blocca: true,
    titolo: 'Vera Consegna 2: `npm run typecheck` e `app.module.spec` nel terminale del Mac',
    dettaglio:
      '⚠️ Prima serve `npx prisma generate`: il client generato sul Mac è più vecchio dello schema, e senza rigenerarlo il type-check mostra errori che non esistono.',
    categoria: MANUTENZIONE,
    ordine: 10,
  },
  {
    chiave: 'rimuovi-traccia-diet-family',
    titolo: '19/8 — rimuovere la diagnostica `traccia-diet-family`',
    dettaglio:
      'Tre file, non uno: `src/prisma/traccia-diet-family.ts`, il suo `.spec` e l\'aggancio in `src/prisma/prisma.service.ts`.',
    categoria: MANUTENZIONE,
    ordine: 20,
  },
  {
    chiave: 'ios-target-15',
    titolo: 'iOS: alzare il deployment target da 13.0 a 15.0',
    dettaglio:
      'Oggi non blocca, ma dalla primavera 2027 gli upload vengono rifiutati. Va fatto fare a `scripts/install-ios.mjs`, perché `ios/` viene rigenerato e la modifica si perderebbe.',
    categoria: MANUTENZIONE,
    ordine: 30,
  },
  {
    chiave: 'aggiornamenti-grossi',
    titolo: 'Aggiornamenti grossi: React 18, Vite 5, Prisma 6, Capacitor 6',
    dettaglio: 'Da fare in una sessione tranquilla, non insieme ad altro.',
    categoria: MANUTENZIONE,
    ordine: 40,
  },
  {
    chiave: 'varianti-3-pasti',
    titolo: 'Generare le varianti a 3 pasti e digiuno per le famiglie esistenti',
    dettaglio:
      'Il codice è pronto dal 17/7: restano i DATI. Si aprono le famiglie nel wizard, si spuntano «3 pasti» e «Digiuno intermittente», «Genera tutte le varianti» (aggiunge solo le mancanti), poi validare e pubblicare. Le vecchie diete «Digiuno intermittente (16:8)» a 5 pasti vanno archiviate a mano.',
    categoria: DATI,
    ordine: 10,
  },
];

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
  for (const v of tutte) {
    const gia = await prisma.lavoro.findUnique({ where: { chiave: v.chiave }, select: { id: true, titolo: true, fatto: true } });
    if (gia) {
      // ⚠️ Non si aggiorna: potrebbe essere stata spuntata o riscritta a mano.
      saltate++;
      console.log(`· già presente, la lascio com'è  [${v.chiave}]${gia.fatto ? ' (spuntata)' : ''}`);
      continue;
    }
    aggiunte++;
    const storica = !!v.data;
    if (!storica) console.log(`+ ${v.categoria} — ${v.titolo}`);
    if (conferma) {
      const { data, ...campi } = v;
      await prisma.lavoro.create({
        // ⚠️ Le voci storiche entrano GIÀ SPUNTATE, con la data del registro e senza un nome: chi
        // le ha scritte è la squadra, ed è nella categoria. Inventare un autore sarebbe peggio.
        data: { ...campi, fatto: storica, fattoIl: storica ? new Date(`${data}T12:00:00Z`) : null },
      });
    }
  }

  console.log('');
  console.log(`Aperte dai documenti: ${VOCI.length} · storiche dal REGISTRO: ${storico.length} · da aggiungere: ${aggiunte} · già presenti: ${saltate}`);
  if (!conferma && aggiunte > 0) console.log('Nessuna scritta: rilancia con CONFERMA=1 se l\'elenco qui sopra ti torna.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
