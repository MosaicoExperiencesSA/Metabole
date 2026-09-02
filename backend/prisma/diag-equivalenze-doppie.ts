/**
 * I GRUPPI DI EQUIVALENZA CON LO STESSO NOME — sola lettura.
 *
 * ⛔ **NON UNISCE NIENTE.** Dice quanti sono, quali si possono unire da soli e quali no, e perché.
 * L'unione è un passo a parte, e si scrive dopo aver guardato questo.
 *
 * ⛔ **Il danno che i doppioni fanno già adesso, e che non si vede dalla pagina.**
 * `menu/sostituzione-chat.service.ts` cerca il gruppo dei grassi **per nome** fra gli approvati,
 * ordinati per data, e prende **il primo**. Con sei omonimi approvati, i pesi scritti nel secondo
 * non li legge nessuno: la cliente riceve «questo gruppo non ha i pesi» mentre i pesi ci sono, nel
 * gruppo accanto. Non è disordine, è lavoro fatto che non arriva.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:equivalenze-doppie              → il conto, diviso fra «si uniscono» e «da guardare»
 *   ESEMPI=40 npm run diag:equivalenze-doppie    → più famiglie (default 15)
 */
import { PrismaClient } from '@prisma/client';
import { alimenti, famiglieDiOmonimi, type Gruppo } from '../src/catalog/gruppi-omonimi';

const prisma = new PrismaClient();
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 15) || 15);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('GRUPPI DI EQUIVALENZA OMONIMI — sola lettura, non unisce niente');

  const [gruppi, diete] = await Promise.all([
    prisma.equivalenceGroup.findMany({
      select: { id: true, name: true, productId: true, status: true, members: true, createdAt: true },
    }) as unknown as Promise<Gruppo[]>,
    prisma.diet.findMany({ select: { id: true, name: true } }) as unknown as
      Promise<{ id: string; name: string }[]>,
  ]);
  const nomeDieta = new Map(diete.map((d) => [d.id, d.name]));
  const ambito = (g: Gruppo) => (g.productId ? (nomeDieta.get(g.productId) ?? g.productId.slice(0, 8)) : 'globale');

  const famiglie = famiglieDiOmonimi(gruppi);
  const doppioni = famiglie.reduce((n, f) => n + f.gruppi.length - 1, 0);
  const sicure = famiglie.filter((f) => f.verdetto === 'sicura');
  const daGuardare = famiglie.filter((f) => f.verdetto === 'da guardare');

  riga('');
  riga(`  Gruppi in tabella                    ${String(gruppi.length).padStart(5)}`);
  riga(`  Nomi che compaiono più di una volta  ${String(famiglie.length).padStart(5)}`);
  riga(`  Righe in più (quante sparirebbero)   ${String(doppioni).padStart(5)}`);

  /**
   * ⛔ **La cosa che vale la pena sapere per prima**: quanti nomi hanno più di un gruppo APPROVATO.
   * Sono quelli su cui `sostituzione-chat` sta già oggi leggendo solo il primo.
   */
  const conPiuApprovati = famiglie.filter((f) => f.gruppi.filter((g) => g.status === 'approved').length > 1);
  if (conPiuApprovati.length > 0) {
    riga('');
    riga(`  ⛔ ${conPiuApprovati.length} nomi hanno più di un gruppo APPROVATO.`);
    riga('     Su questi la ricerca per nome legge solo il più vecchio: quello che sta scritto');
    riga('     negli altri non arriva a nessuna cliente, e nessuna schermata lo dice.');
  }

  titolo(`SI UNISCONO DA SOLE — ${sicure.length} famiglie`);
  riga('');
  riga('  Stesso ambito, stesso stato, nessun conflitto sui pesi.');
  riga('');
  if (sicure.length === 0) riga('  (nessuna)');
  for (const f of sicure.slice(0, ESEMPI)) {
    riga(`  · «${f.nome}» — ${f.gruppi.length} gruppi (${ambito(f.gruppi[0])}, ${f.gruppi[0].status})`);
    riga(`      resterebbe 1 gruppo con ${f.alimentiUniti.length} alimenti (+${f.aggiunti} rispetto al più vecchio)`);
    riga(`      ${f.alimentiUniti.slice(0, 8).join(', ')}${f.alimentiUniti.length > 8 ? ` … (+${f.alimentiUniti.length - 8})` : ''}`);
  }
  if (sicure.length > ESEMPI) riga(`  … e altre ${sicure.length - ESEMPI} (ESEMPI=${sicure.length} per vederle tutte)`);

  titolo(`DA GUARDARE PRIMA — ${daGuardare.length} famiglie`);
  riga('');
  riga('  ⛔ Qui unire non è pulizia. Un gruppo legato a una dieta vale SOLO per quella: unirlo a');
  riga('  quello di un\'altra rende gli alimenti dell\'una equivalenti anche nell\'altra, ed è una');
  riga('  decisione di nutrizione. Idem per i pesi dei grassi, che finiscono nei grammi di una persona.');
  riga('');
  if (daGuardare.length === 0) riga('  (nessuna)');
  for (const f of daGuardare.slice(0, ESEMPI)) {
    riga(`  · «${f.nome}» — ${f.gruppi.length} gruppi`);
    for (const m of f.motivi) riga(`      ⛔ ${m}`);
    for (const g of f.gruppi) {
      riga(`      · ${g.id.slice(0, 8)}  ${ambito(g).padEnd(28)} ${g.status.padEnd(9)} ${alimenti(g.members).length} alimenti`);
    }
  }
  if (daGuardare.length > ESEMPI) riga(`  … e altre ${daGuardare.length - ESEMPI} (ESEMPI=${daGuardare.length} per vederle tutte)`);

  riga('');
  riga('==================================================================');
  riga('  Fine. Niente è stato scritto.');
  riga('==================================================================');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
