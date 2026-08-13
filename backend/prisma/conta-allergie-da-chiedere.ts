/**
 * QUANTE CLIENTI VANNO RICONTATTATE SULLE ALLERGIE — e quali. **Non scrive niente, mai.**
 *
 * §7.1 dell'handoff: «⚠️ Prima di lanciare qualsiasi cosa, conta. Se la popolazione 3 sono 280
 * clienti su 315, non è una campagna: è un difetto del questionario da correggere prima.»
 *
 * Questo script è quella conta. Non ha un `CONFERMA=1` perché **non c'è niente da confermare**:
 * legge e stampa. La campagna vera è un altro lavoro, e comincia da qui.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run conta:allergie
 *
 * ## Le tre popolazioni, in ordine di urgenza
 *
 * 1. **Intolleranza ignota** — hanno `'other'` fra le intolleranze e non hanno mai detto cosa.
 *    Sono le più urgenti: il dato c'è, dice «altro», e non esclude niente. Fino al 13/8 il campo
 *    dove scriverlo non esisteva proprio, quindi **nessuna di loro ha potuto rispondere**.
 * 2. **Allergie da codificare** — hanno voci fuori dai 14 codici UE, mai tradotte. Sono le stesse
 *    che `personal-base` segnala come «allergie da codificare a mano»: la base personale sicura
 *    resta bloccata finché qualcuno non le guarda.
 * 3. **Non sappiamo** — questionario completato, allergie e intolleranze vuote, e nessuna data di
 *    dichiarazione. «Non ne ho» o «ho saltato la pagina»: indistinguibili.
 *
 * ⚠️ Le tre si **escludono a vicenda** in questo conteggio: una cliente compare una volta sola,
 * nella categoria più urgente che la riguarda. Sommare tre elenchi che si sovrappongono darebbe un
 * totale più grande delle clienti che esistono — ed è il genere di numero da cui poi si decide.
 *
 * ⚠️ Si contano solo le clienti **vive e con un percorso che conta**: chi ha l'account cancellato
 * non si ricontatta. Il conto serve a decidere se mandare una notifica a delle persone.
 */
import { PrismaClient } from '@prisma/client';
import { EU_ALLERGEN_CODES } from '../src/catalog/allergens';
import { allergieDaCodificare } from '../src/common/allergie';
import { contaRicontatti, motivoRicontatto } from '../src/common/da-ricontattare';

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

  const vive = tutte.filter((r) => r.user && !r.user.deletedAt);

  /**
   * ⚠️ La regola è la STESSA del prodotto, importata da `common/da-ricontattare.ts`, non riscritta
   * qui — ed è verificata da un test suo.
   *
   * Uno script che si riscrive il criterio conta una popolazione, e poi la campagna ne contatta
   * un'altra: due numeri diversi per la stessa domanda, e quello su cui si è deciso è il primo.
   * «È il modo in cui le migrazioni finiscono per creare dati che il codice non si aspetta»
   * (in testa a `assegna-senza-glutine.ts`).
   */
  const daCodificare = (r: Riga) => allergieDaCodificare(r.allergies, r.allergiesOther, EU_ALLERGEN_CODES);
  const conto = contaRicontatti(vive, EU_ALLERGEN_CODES);

  const p1 = vive.filter((r) => motivoRicontatto(r, EU_ALLERGEN_CODES) === 'intolleranza_ignota');
  const p2 = vive.filter((r) => motivoRicontatto(r, EU_ALLERGEN_CODES) === 'allergie_da_codificare');
  const p3 = vive.filter((r) => motivoRicontatto(r, EU_ALLERGEN_CODES) === 'mai_risposto');
  const aPosto = vive.filter((r) => motivoRicontatto(r, EU_ALLERGEN_CODES) === null);

  const quota = (n: number) => (vive.length ? `${Math.round((n / vive.length) * 100)}%` : '—');

  console.log('');
  console.log('==================================================================');
  console.log('  ALLERGIE E INTOLLERANZE — chi va ricontattata, e chi no');
  console.log('  Sola lettura: questo script non scrive niente.');
  console.log('==================================================================');
  console.log('');
  console.log(`Clienti con un profilo, account attivo: ${vive.length}`);
  console.log(`(profili totali, cancellate comprese: ${tutte.length})`);
  console.log('');
  console.log(`1. Intolleranza IGNOTA («Altro» e mai detto cosa)  ${p1.length}  (${quota(p1.length)})`);
  console.log(`2. Allergie DA CODIFICARE (testo libero)           ${p2.length}  (${quota(p2.length)})`);
  console.log(`3. NON SAPPIAMO (mai risposto alla domanda)        ${p3.length}  (${quota(p3.length)})`);
  console.log(`   — a posto, non si disturbano                    ${aPosto.length}  (${quota(aPosto.length)})`);
  console.log('');

  const elenco = (titolo: string, righe: Riga[], extra?: (r: Riga) => string) => {
    if (!righe.length) return;
    console.log(`--- ${titolo} (${righe.length}) ---`);
    // 40 righe per categoria: l'elenco serve a farsi un'idea e a controllarne qualcuna a campione,
    // non a lavorarle da terminale. Se ne mancano, il conteggio sopra lo dice.
    for (const r of righe.slice(0, 40)) console.log(`  ${etichetta(r)}${extra ? ` — ${extra(r)}` : ''}`);
    if (righe.length > 40) console.log(`  … e altre ${righe.length - 40}. Il numero che conta è quello sopra.`);
    console.log('');
  };

  elenco('1. Intolleranza ignota', p1, (r) => `intolleranze: ${r.intolerances.join(', ')}`);
  elenco('2. Allergie da codificare', p2, (r) => daCodificare(r).join(', '));
  elenco('3. Non sappiamo', p3);

  /**
   * ⚠️ LA RIGA DA LEGGERE PRIMA DI DECIDERE.
   *
   * Se la terza popolazione è la maggioranza, la conclusione **non** è «mandiamo una notifica a
   * tutte»: è che la pagina delle allergie del questionario non funziona. Una campagna su un
   * difetto di raccolta lo copre invece di chiuderlo, e fra sei mesi si rifà uguale.
   */
  console.log('==================================================================');
  if (vive.length && p3.length / vive.length > 0.5) {
    console.log('  ⚠️ ATTENZIONE: più di METÀ delle clienti non ha mai risposto.');
    console.log('  Questo non è il numero di una campagna, è il sintomo di una');
    console.log('  pagina del questionario che non raccoglie. Da sistemare PRIMA:');
    console.log('  chi ha compilato dopo il 13/8 ha l’opzione «Non ho allergie»,');
    console.log('  quindi il numero deve scendere da solo. Se non scende, il');
    console.log('  problema è a monte.');
  } else {
    console.log(`  Da ricontattare in tutto: ${conto.totaleDaRicontattare} clienti.`);
    console.log('  Le tre categorie NON si sovrappongono: ognuna compare una volta');
    console.log('  sola, in quella più urgente che la riguarda.');
  }
  console.log('==================================================================');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
