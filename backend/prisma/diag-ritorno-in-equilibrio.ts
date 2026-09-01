/**
 * CHI STA SU «RITORNO IN EQUILIBRIO» OGGI — sola lettura.
 *
 * ⚠️ Il piano (§6.1) dice che questa non è una famiglia di diete ma una **funzione**: *«per chi ha
 * già fatto un percorso con noi, un mese coi menu scelti tra quelli che hanno dato migliori
 * risultati e al cliente più graditi»*. Trasformarla vuol dire cambiare **da dove arrivano i
 * piatti** di chi ci sta sopra: invece del paniere, il suo storico personale.
 *
 * ⛔ **E questo è esattamente il tipo di cambio che oggi è già costato una volta**: la Fase 1 è
 * stata spostata su tutte le clienti dopo un confronto che guardava metà della domanda. Qui si
 * guarda prima: quante persone ci sono sopra, da quanto ricevono menu, e **quanto storico hanno**
 * — perché una funzione che compone dal passato su una cliente senza passato non compone niente.
 *
 * ⛔ **NON SCRIVE NIENTE.**
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:ritorno
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

const FAMIGLIA = 'Ritorno in Equilibrio';

async function main() {
  titolo(`CHI STA SU «${FAMIGLIA}»`);

  const diete = (await prisma.diet.findMany({
    where: { name: { startsWith: FAMIGLIA } },
    select: { id: true, name: true, regime: true, status: true },
  })) as unknown as { id: string; name: string; regime: string; status: string }[];

  riga('');
  riga(`  Varianti in catalogo con questo nome: ${diete.length}`);
  for (const d of diete) riga(`     · ${d.name.slice(0, 46).padEnd(46)} ${d.regime.padEnd(12)} ${d.status}`);

  const profili = (await prisma.clientProfile.findMany({
    where: { dietFamily: { startsWith: FAMIGLIA } },
    select: { userId: true, name: true, dietFamily: true, regime: true, planStartDate: true },
  })) as unknown as { userId: string; name: string | null; dietFamily: string | null; regime: string | null; planStartDate: Date | null }[];

  riga('');
  riga(`  Clienti col profilo su questa famiglia: ${profili.length}`);

  if (!profili.length) {
    riga('');
    riga('  ✅ Nessuna cliente ci sta sopra: la funzione si può costruire senza toccare nessuno.');
    riga('  ⚠️ E le varianti in catalogo, se ci sono, restano lì finché qualcuno non le chiude — è');
    riga('     la Fase 9, e vuole tempo umano, non codice.');
    riga('');
    return;
  }

  /**
   * ⚠️ **Quanto storico ha ciascuna**: è il numero che dice se la funzione può funzionare per lei.
   * Un mese composto dal passato su una cliente con dieci giornate alle spalle non è «un mese dei
   * suoi piatti migliori»: è dieci giornate ripetute tre volte.
   */
  riga('');
  riga('  ┌─ cliente ──────────────────────────┬ giornate ┬ con stelle ┬ ultima ─────┐');
  for (const p of profili) {
    const [giornate, stelle, ultima] = await Promise.all([
      prisma.menuDay.count({ where: { clientId: p.userId } }) as unknown as Promise<number>,
      prisma.recipeRating.count({ where: { clientId: p.userId } }) as unknown as Promise<number>,
      prisma.menuDay.findFirst({ where: { clientId: p.userId }, orderBy: { date: 'desc' }, select: { date: true } }) as unknown as
        Promise<{ date: Date } | null>,
    ]);
    riga(`  │ ${(p.name ?? p.userId.slice(0, 8)).slice(0, 34).padEnd(34)} │ ${String(giornate).padStart(8)} │ ${String(stelle).padStart(10)} │ ${(ultima ? ultima.date.toISOString().slice(0, 10) : 'mai').padStart(11)} │`);
  }
  riga('  └────────────────────────────────────┴──────────┴────────────┴─────────────┘');

  riga('');
  riga('  ⚠️ La colonna «giornate» dice se la funzione ha materiale con cui lavorare: un mese');
  riga('     composto dal passato su chi ha dieci giornate alle spalle non è «un mese dei suoi');
  riga('     piatti migliori», sono dieci giornate ripetute tre volte.');
  riga('  ⚠️ La colonna «con stelle» dice quanto pesa il gusto: senza voti, la metà della regola');
  riga('     non ha dati e si ridistribuisce sul risultato — la funzione gira lo stesso, ma sceglie');
  riga('     solo per quanto l\'hanno fatta scendere.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
