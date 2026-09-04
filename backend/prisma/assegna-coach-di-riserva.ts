/**
 * LE CLIENTI RIMASTE SENZA COACH — elenco, e assegnazione alla coach di riserva.
 *
 * Simone, 4/9, dopo `diag:commerciale-e-coach` (Giusy: 0 clienti sue, 56 con la rete; 4 schede
 * senza coach; 2 clienti senza scheda profilo): *«tutte le clienti non assegnate ad una coach vanno
 * a Giusy»*, e vale anche per quelle che verranno, col parametro `coach_di_riserva`.
 *
 * ⚠️ **Il codice è corretto da oggi** — il questionario e la rimozione a mano applicano la regola
 * subito, e il giro notturno del cron ripesca il resto — ma il codice nuovo **non ripesca chi è già
 * passata di lì** prima che il parametro sia impostato. Questo script è **lo stesso giro del cron**
 * (`common/coach-di-riserva.ts`, stessa funzione, stesso registro), lanciato a mano con la lista
 * davanti: chi la legge vede i nomi PRIMA che vengano scritti.
 *
 * ⚠️ **Non sposta nessuno.** Chi ha già una coach non viene toccata: qui si riempie solo il vuoto.
 * Uno spostamento è un atto esplicito, non l'effetto di uno script.
 *
 * ⛔ **Prima va impostato il parametro**: Parametri → «Coach di riserva» → scegli la persona. Se è
 * ancora «nessuna», lo script lo dice e non scrive niente.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run assegna:coach-di-riserva              → mostra e basta, non scrive niente
 *   CONFERMA=1 npm run assegna:coach-di-riserva   → applica
 */
import { PrismaClient } from '@prisma/client';
import {
  PARAM_COACH_DI_RISERVA,
  RISERVA_SPENTA,
  assegnaLaRiserva,
  clientiSenzaCoach,
  giudicaLaRiserva,
} from '../src/common/coach-di-riserva';

const prisma = new PrismaClient();

function giorno(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  /** ⚠️ Stessa lettura del servizio: la riga assente vale «off», e il giudizio è quello di `giudicaLaRiserva`. */
  const riga = await prisma.configParam.findUnique({ where: { key: PARAM_COACH_DI_RISERVA }, select: { value: true } });
  const valore = riga?.value ?? RISERVA_SPENTA;
  const scheda = valore.trim() && valore.trim().toLowerCase() !== RISERVA_SPENTA
    ? ((await prisma.staff.findUnique({
      where: { id: valore.trim() },
      select: { id: true, userId: true, displayName: true, active: true, user: { select: { role: true, status: true, deletedAt: true, email: true } } },
    })) as never)
    : null;
  const riserva = giudicaLaRiserva(valore, scheda);

  if (riserva.esito === 'spenta') {
    console.log(`⛔ Il parametro \`${PARAM_COACH_DI_RISERVA}\` è «nessuna» (o non esiste ancora): non c'è nessuno a cui assegnare.`);
    console.log('   Parametri → «Coach di riserva» → scegli la persona, poi rilancia.');
    return;
  }
  if (riserva.esito === 'non_valida') {
    console.log(`⛔ Il parametro \`${PARAM_COACH_DI_RISERVA}\` vale "${riserva.valore}" ma ${riserva.motivo}: non scrivo niente.`);
    console.log('   Sistemalo da Parametri → «Coach di riserva», poi rilancia.');
    return;
  }
  console.log(`Coach di riserva: ${riserva.displayName} (ruolo ${riserva.role}, staff ${riserva.staffId})`);

  const senza = await clientiSenzaCoach(prisma as never);
  console.log(`\n=== CLIENTI VIVE SENZA NESSUNA COACH: ${senza.length} ===`);
  if (!senza.length) {
    console.log('nessuna — niente da fare.');
    return;
  }
  console.table(
    senza.map((c) => ({
      cliente: c.nome ?? '(senza nome)',
      email: c.email,
      registrata: giorno(c.registrataIl),
      questionario: giorno(c.questionarioIl),
      // ⚠️ Le clienti SENZA scheda profilo: oggi non entrano in nessun perimetro. Qui la scheda
      // viene creata con la sola assegnazione (vedi `assegnazione-profilo.ts`: è sicuro).
      scheda: c.haScheda ? '' : 'DA CREARE',
    })),
  );
  const senzaScheda = senza.filter((c) => !c.haScheda).length;
  if (senzaScheda) console.log(`⚠️ ${senzaScheda} di queste non hanno la scheda profilo: verrà creata con la sola coach.`);

  if (!conferma) {
    console.log('\n--- PROVA A VUOTO: non è stato scritto niente. ---');
    console.log('Per applicare:  CONFERMA=1 npm run assegna:coach-di-riserva');
    return;
  }

  const esito = await assegnaLaRiserva(
    prisma as never, riserva, senza, 'script',
    (r) => prisma.auditLog.create({ data: r as never }).then(() => undefined),
  );
  console.log(`\n✅ Assegnate: ${esito.assegnate} (schede create: ${esito.schedeCreate}) · già di qualcuno nel frattempo: ${esito.giaAssegnate}.`);
  console.log('⚠️ I perimetri della commerciale non cambiano da qui: quello è il passo dopo, e si fa quando questo numero non è più zero.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
