/**
 * LA CAMPAGNA: manda a chi serve la notifica che apre la ri-domanda con Gaia. **In prova, salvo
 * CONFERMA=1.**
 *
 * §7.4 dell'handoff. Template e regole da `assegna-senza-glutine.ts`, che sono le stesse di sempre:
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run chiedi:allergie              → elenca chi riceverebbe la notifica, non scrive niente
 *   CONFERMA=1 npm run chiedi:allergie   → manda le notifiche
 *
 * ⚠️ **Prima si conta.** `npm run conta:allergie` è la fotografia, e non scrive niente per
 * costruzione: il 13/8 ha detto 24 clienti su 48. Questo script è il passo dopo.
 *
 * ⚠️ **La regola di chi contattare non è qui.** È `common/da-ricontattare.ts`, la stessa funzione
 * della conta, e il sottoinsieme che riguarda la chat è `chat/campagna-allergie.ts`. Uno script che
 * si riscrive il criterio conta una popolazione e poi ne contatta un'altra, e quella su cui si è
 * deciso è la prima.
 *
 * ⚠️ E la lezione di `accendi-automazioni.ts`: uno script pensato per accenderne tre ne ha **spente
 * venti**, perché lavorava a opt-out. Qui si lavora a opt-in — si manda solo a chi risulta in una
 * delle due popolazioni — ma la prova va letta **riga per riga** prima di confermare lo stesso.
 *
 * ## Chi NON riceve niente da qui
 *
 * Le clienti che non hanno mai risposto (la popolazione più numerosa) le prende la scheda in home
 * dell'app, decisa da Simone il 13/8 e uscita con l'OTA della stessa sera. Mandare anche a loro una
 * notifica vorrebbe dire fare la stessa domanda per due strade: la seconda insegna solo a ignorare
 * le notifiche. Lo script le conta e le mostra, perché il numero serve a sapere se la scheda sta
 * funzionando — ma non le contatta.
 */
import { PrismaClient } from '@prisma/client';
import { EU_ALLERGEN_CODES } from '../src/catalog/allergens';
import { allergieDaCodificare } from '../src/common/allergie';
import { MotivoRicontatto, motivoRicontatto } from '../src/common/da-ricontattare';
import { POPOLAZIONI_IN_CAMPAGNA, invitaARidichiarare } from '../src/chat/campagna-allergie';

const prisma = new PrismaClient();

type Riga = {
  userId: string;
  name: string | null;
  allergies: string[];
  allergiesOther: string[];
  allergieDichiarateIl: Date | null;
  intolerances: string[];
  intolerancesOther: string[];
  onboardingCompletedAt: Date | null;
  user: { email: string; deletedAt: Date | null } | null;
};

const etichetta = (r: Riga) => `${r.name ?? '—'} <${r.user?.email ?? 'senza email'}>`;

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const tutte = (await prisma.clientProfile.findMany({
    select: {
      userId: true,
      name: true,
      allergies: true,
      allergiesOther: true,
      allergieDichiarateIl: true,
      intolerances: true,
      intolerancesOther: true,
      onboardingCompletedAt: true,
      user: { select: { email: true, deletedAt: true } },
    },
  })) as unknown as Riga[];

  // Chi ha l'account cancellato non si ricontatta: qui si sta decidendo di mandare una notifica a
  // delle persone, non di aggiornare una tabella.
  const vive = tutte.filter((r) => r.user && !r.user.deletedAt);
  const con = new Map<MotivoRicontatto, Riga[]>();
  for (const r of vive) {
    const m = motivoRicontatto(r, EU_ALLERGEN_CODES);
    if (!con.has(m)) con.set(m, []);
    con.get(m)!.push(r);
  }
  const di = (m: MotivoRicontatto) => con.get(m) ?? [];

  console.log('');
  console.log('==================================================================');
  console.log('  RI-DOMANDA SULLE ALLERGIE — la campagna in chat con Gaia');
  console.log(conferma ? '  ⚠️  CONFERMA=1: le notifiche vengono MANDATE.' : '  Prova: non scrivo niente.');
  console.log('==================================================================');
  console.log('');
  console.log(`Clienti con un profilo, account attivo: ${vive.length}`);
  console.log('');
  console.log(`1. Intolleranza IGNOTA («Altro» e mai detto cosa)  ${di('intolleranza_ignota').length}  → notifica`);
  console.log(`2. Allergie DA CODIFICARE (testo libero)           ${di('allergie_da_codificare').length}  → notifica`);
  console.log(`3. NON SAPPIAMO (mai risposto)                     ${di('mai_risposto').length}  → scheda in home, NON da qui`);
  console.log(`   — a posto, non si disturbano                    ${di(null).length}`);
  console.log('');

  /**
   * ⚠️ La riga da leggere prima di confermare (la stessa di `conta-allergie-da-chiedere.ts`).
   *
   * Se la terza popolazione non scende nei giorni dopo l'OTA, la conclusione non è «mandiamo la
   * notifica anche a loro»: è che la scheda in home non sta funzionando, e una campagna su un
   * difetto di raccolta lo copre invece di chiuderlo.
   */
  if (di('mai_risposto').length) {
    console.log(`   ↑ Le ${di('mai_risposto').length} della terza riga le sta chiedendo la scheda in home (OTA del 13/8).`);
    console.log('     Se fra qualche giorno questo numero non scende, il problema è lì, non qui.');
    console.log('');
  }

  const daContattare = POPOLAZIONI_IN_CAMPAGNA.flatMap((m) => di(m).map((r) => ({ r, m })));
  if (!daContattare.length) {
    console.log('Nessuna cliente da contattare. Niente da fare.\n');
    return;
  }

  const conto = { inviata: 0, gia_chiesta: 0, fuori_campagna: 0, non_serve: 0 } as Record<string, number>;
  for (const { r, m } of daContattare) {
    // ⚠️ La stessa funzione del prodotto, non una `notification.create` riscritta qui: è lei che sa
    // com'è fatto il payload (titolo e corpo DENTRO, e solo stringhe nelle chiavi della push) e
    // che tiene il freno del «gliel'ho già chiesto».
    const esito = await invitaARidichiarare(prisma as never, r.userId, m, { prova: !conferma });
    conto[esito.esito] = (conto[esito.esito] ?? 0) + 1;
    const dettaglio =
      m === 'allergie_da_codificare'
        ? allergieDaCodificare(r.allergies, r.allergiesOther, EU_ALLERGEN_CODES).join(', ')
        : r.intolerances.join(', ');
    const segno = esito.esito === 'gia_chiesta' ? '✓ già chiesto' : conferma ? '→ notifica mandata' : '→ riceverebbe la notifica';
    console.log(`  ${etichetta(r)}  ·  ${m}  ·  «${dettaglio}»  ${segno}`);
  }

  console.log('');
  console.log(`Da contattare: ${conto.inviata ?? 0}. Già contattate in passato: ${conto.gia_chiesta ?? 0}.`);
  if (!conferma) {
    console.log('\nProva: non ho scritto niente e nessuna cliente ha ricevuto niente.');
    console.log('Rilancia con CONFERMA=1 dopo aver letto l\'elenco qui sopra riga per riga.\n');
  } else {
    console.log(
      '\nFatto. Il tocco sulla notifica porta in chat con la domanda già scritta da Gaia.\n' +
        '⚠️ Il dialogo scade dopo un\'ora: chi apre la notifica il giorno dopo lo trova RIAPERTO,\n' +
        '   non ripreso — ed è voluto, perché il motivo si rilegge dal profilo ogni volta.\n' +
        '⚠️ Quello che Gaia non riesce a tradurre arriva alla NUTRIZIONISTA, non alla coach: è lei\n' +
        '   l\'unica che può codificare un\'allergia scritta a mano (§5 dell\'handoff).\n',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
