/**
 * RINOMINARE UN PRODOTTO **ANCHE NELLO STORICO**.
 *
 * Richiesta di Simone dell'11/8: «Il prodotto Prova Gratuita dobbiamo chiamarla Auto Apprendimento
 * Gaia anche su tutti quelli che lo hanno già attivato», e poi «correggiamo anche le vecchie».
 *
 * ## Perché non basta rinominare la riga in Gestione negozio
 *
 * Il nome del piano vive in un posto solo (`plan.name`) e tutto quello che lo legge via relazione —
 * abbonamenti, scheda cliente, Acquisti, pipeline — si aggiorna da sé nel momento in cui lo cambi.
 * Non si aggiorna quello che ne ha preso una **copia** al momento dell'acquisto: la descrizione dei
 * pagamenti («Abbonamento Prova Gratuita») è testo congelato, scritto una volta e mai più riletto
 * dal piano. È giusto che sia così — una ricevuta non deve cambiare da sola sotto gli occhi di chi
 * l'ha ricevuta — ma vuol dire che dopo un rinomino Acquisti e Contabilità continuano a mostrare il
 * nome vecchio per sempre, e nessuno capisce perché.
 *
 * Questo script allinea quelle copie. Tocca **solo** le descrizioni che contengono il nome vecchio,
 * e solo la parte del testo che è il nome: «Abbonamento Prova Gratuita — attivazione interna, senza
 * incasso (listino 349,00 €)» diventa «Abbonamento Auto Apprendimento Gaia — attivazione interna,
 * senza incasso (listino 349,00 €)». Il resto della frase, gli importi e le date non si toccano.
 *
 * ## Come si usa
 *
 *   npm run rinomina:prodotto                                   → PROVA a vuoto, non scrive niente
 *   SCRIVI=1 npm run rinomina:prodotto                          → scrive
 *   DA="Prova Gratuita" A="Auto Apprendimento Gaia" SCRIVI=1 npm run rinomina:prodotto
 *
 * Senza `SCRIVI=1` stampa esattamente cosa cambierebbe e si ferma: su una tabella di contabilità è
 * il minimo. Ed è **ripetibile**: girato due volte, la seconda non trova più niente da fare.
 *
 * Il nome del piano nel negozio lo cambia Simone a mano (è una riga, e la decisione è sua): questo
 * script si occupa dello storico. Se il piano ha ancora il nome vecchio lo dice e non si blocca —
 * l'ordine fra le due cose non conta.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DA = (process.env.DA ?? 'Prova Gratuita').trim();
const A = (process.env.A ?? 'Auto Apprendimento Gaia').trim();
const SCRIVI = process.env.SCRIVI === '1';

/** Sostituisce il nome vecchio col nuovo, ignorando maiuscole e minuscole. */
const rinomina = (testo: string): string => {
  const escape = DA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return testo.replace(new RegExp(escape, 'gi'), A);
};

async function main() {
  if (!DA || !A) {
    console.log('⚠️  Servono DA e A. Esempio: DA="Prova Gratuita" A="Auto Apprendimento Gaia"');
    return;
  }
  if (DA.toLowerCase() === A.toLowerCase()) {
    console.log('Il nome vecchio e quello nuovo sono uguali: niente da fare.');
    return;
  }

  console.log(`\n«${DA}»  →  «${A}»`);
  console.log(SCRIVI ? 'Modalità: SCRITTURA\n' : 'Modalità: prova a vuoto (aggiungi SCRIVI=1 per scrivere)\n');

  // 1) Il piano nel negozio: non lo cambia questo script, ma dire com'è messo evita il dubbio.
  const piani = (await prisma.plan.findMany({
    where: { OR: [{ name: { contains: DA, mode: 'insensitive' } }, { name: { contains: A, mode: 'insensitive' } }] } as never,
    select: { id: true, name: true, priceCents: true, active: true },
  })) as { id: string; name: string; priceCents: number; active: boolean }[];

  console.log('=== Il prodotto in Gestione negozio ===');
  if (piani.length === 0) {
    console.log(`   Nessun piano si chiama «${DA}» né «${A}». Controlla il nome esatto in Gestione negozio.`);
  }
  for (const p of piani) {
    const stato = p.name.toLowerCase().includes(A.toLowerCase()) ? 'già rinominato ✅' : 'ANCORA col nome vecchio';
    console.log(`   «${p.name}» · ${(p.priceCents / 100).toFixed(2).replace('.', ',')} € · ${p.active ? 'attivo' : 'non attivo'} → ${stato}`);
  }

  // 2) Le descrizioni congelate dei pagamenti: è la parte che questo script sistema.
  const pagamenti = (await prisma.payment.findMany({
    where: { description: { contains: DA, mode: 'insensitive' } } as never,
    select: { id: true, description: true, amountCents: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })) as { id: string; description: string; amountCents: number; status: string; createdAt: Date }[];

  console.log(`\n=== Descrizioni dei pagamenti da allineare (${pagamenti.length}) ===`);
  if (pagamenti.length === 0) console.log('   nessuna: lo storico è già a posto.');

  /** Le descrizioni si ripetono: si mostrano i testi DIVERSI, non 4.000 righe uguali. */
  const perTesto = new Map<string, number>();
  for (const p of pagamenti) perTesto.set(p.description, (perTesto.get(p.description) ?? 0) + 1);
  for (const [testo, quante] of [...perTesto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`   ${String(quante).padStart(5)} ×  «${testo}»`);
    console.log(`            →  «${rinomina(testo)}»`);
  }
  if (perTesto.size > 20) console.log(`   … e altri ${perTesto.size - 20} testi diversi`);

  if (!SCRIVI) {
    console.log('\nNiente è stato scritto. Ripeti con SCRIVI=1 per applicare.\n');
    return;
  }

  // Una `updateMany` per TESTO e non una per riga: i testi diversi sono una decina, i pagamenti
  // possono essere migliaia, e diecimila update per un rinomino non hanno senso.
  let aggiornati = 0;
  for (const testo of perTesto.keys()) {
    const res = await prisma.payment.updateMany({
      where: { description: testo },
      data: { description: rinomina(testo) },
    });
    aggiornati += res.count;
  }
  console.log(`\n✅ Descrizioni aggiornate: ${aggiornati}`);
  console.log('   Gli importi, le date e gli stati non sono stati toccati.');
  console.log('   Se il piano in Gestione negozio ha ancora il nome vecchio, cambialo da lì.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
