/**
 * LE SCHEDE CHE SONO TORNATE INDIETRO SULLA BOARD — 20/8.
 *
 * ## Il fatto, che viene dalla lettura del codice e non da un ragionamento
 *
 * Nel CRM ci sono **due porte** per spostare una scheda in automatico, e si comportano al contrario:
 *
 *  · `autoAdvanceIfEarlier` → `commerce/avanza-stato.ts`: **non fa mai retrocedere**. La usano il
 *    questionario, la prova, il percorso concluso e (da oggi) il primo accesso. Il commento che le
 *    sta sopra dice perché: «riportarla indietro cancellerebbe il lavoro di chi ha spostato la
 *    scheda a mano, e la coach si ritroverebbe in colonna una cliente che aveva già lavorato».
 *  · `autoAdvance` → `crm.service.ts`: **scrive e basta**, senza guardare dov'era. La usa un punto
 *    solo, `commerce.service.ts`, a **ogni pagamento sopra lo zero** — non solo il primo.
 *
 * ⚠️ Quindi il rinnovo del mese porta la scheda a «Acquisito» **anche se era a «Prima visita» o a
 * «Follow-up»**, che sulla board stanno dopo. È la cosa esatta che l'altra porta esiste per
 * impedire, fatta dal punto che la fa più spesso.
 *
 * ⛔ **Quanto questo pesi davvero non lo so, e non lo deduco.** Dipende da quante clienti rinnovano
 * dopo essere andate avanti, ed è un numero che sta in banca dati. Questo elenco lo tira fuori. La
 * correzione non è stata fatta: prima il numero.
 *
 * ## Come si riconosce una scheda tornata indietro
 *
 * `stageDates` tiene la data di **ogni** colonna in cui la scheda è passata. Se una scheda ha la
 * data di una colonna che sta DOPO quella in cui si trova adesso, in quella colonna c'è stata, e
 * poi è tornata indietro. Non è una stima: è scritto nella scheda.
 *
 * ⚠️ Non distingue chi l'ha riportata indietro — il pagamento o una persona che l'ha trascinata a
 * mano. Il confronto fra le date lo suggerisce (se l'ultima data è quella di «Acquisito», ed è
 * arrivata dopo, il sospetto è il pagamento) ma non lo dimostra, e qui non si finge di dimostrarlo.
 *
 *   npm run diag:pipeline-indietro
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Tappa = { at?: string; byUserId?: string | null };

async function main() {
  const stati = (await prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } })) as {
    key: string; label: string; order: number;
  }[];
  const ordine = new Map(stati.map((s) => [s.key, s.order]));
  const etichetta = new Map(stati.map((s) => [s.key, s.label]));

  const schede = (await prisma.crmRecord.findMany({
    where: { clientId: { not: null } },
    select: { id: true, name: true, email: true, stage: true, stageDates: true },
  })) as { id: string; name: string | null; email: string | null; stage: string; stageDates: unknown }[];

  console.log('');
  console.log(`Schede con un cliente collegato: ${schede.length}`);
  console.log('');

  const tornate: { chi: string; adesso: string; era: string; quando: string | null; ultima: string | null }[] = [];
  for (const s of schede) {
    const ora = ordine.get(s.stage);
    if (ora === undefined) continue; // colonna eliminata: se ne occupa diag:pipeline-stati
    const tappe = (s.stageDates ?? {}) as Record<string, Tappa>;
    /** La colonna più avanti in cui questa scheda è passata, secondo quello che ha scritto lei. */
    let piuAvanti: { key: string; at: string | null } | null = null;
    for (const [k, v] of Object.entries(tappe)) {
      const o = ordine.get(k);
      if (o === undefined || o <= ora) continue;
      if (!piuAvanti || (ordine.get(k) ?? 0) > (ordine.get(piuAvanti.key) ?? 0)) {
        piuAvanti = { key: k, at: v?.at ?? null };
      }
    }
    if (!piuAvanti) continue;
    tornate.push({
      chi: s.name || s.email || s.id,
      adesso: etichetta.get(s.stage) ?? s.stage,
      era: etichetta.get(piuAvanti.key) ?? piuAvanti.key,
      quando: piuAvanti.at,
      ultima: (tappe[s.stage] as Tappa | undefined)?.at ?? null,
    });
  }

  if (tornate.length === 0) {
    console.log('✅ Nessuna scheda è tornata indietro. La porta che scrive senza guardare non ha ancora fatto danni.');
    console.log('');
    return;
  }

  console.log(`⚠️  ${tornate.length} schede su ${schede.length} stanno in una colonna PRIMA di una in cui erano già passate.`);
  console.log('');
  const perCoppia = new Map<string, number>();
  for (const t of tornate) perCoppia.set(`${t.era} → ${t.adesso}`, (perCoppia.get(`${t.era} → ${t.adesso}`) ?? 0) + 1);
  console.log('  Da dove a dove:');
  for (const [k, n] of [...perCoppia.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)} × ${k}`);

  console.log('');
  console.log('  Le prime 25, per nome:');
  for (const t of tornate.slice(0, 25)) {
    const dopo = t.quando && t.ultima ? (t.ultima > t.quando ? ' (la data di adesso è POSTERIORE: rimessa indietro)' : '') : '';
    console.log(`    ${t.chi.padEnd(30)} era «${t.era}» → adesso «${t.adesso}»${dopo}`);
  }
  if (tornate.length > 25) console.log(`    … e altre ${tornate.length - 25}. (Taglio a 25 per leggibilità, il conto sopra è intero.)`);
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
