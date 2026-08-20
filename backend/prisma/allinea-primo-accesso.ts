/**
 * LE CLIENTI CHE SONO GIÀ ENTRATE — 20/8.
 *
 * L'automazione del primo accesso (`commerce/primo-accesso.ts`) scatta al prossimo accesso. Da sola
 * lascerebbe la colonna quasi vuota per settimane: chi è entrata ieri e resta collegata non rifà
 * l'accesso, e chi è entrata a giugno non si sa quando tornerà.
 *
 * ⚠️ **La cosa peggiore non è la colonna vuota, è la colonna vuota che sembra piena.** Una board che
 * mostra tre schede in «Primo accesso effettuato» quando le clienti entrate sono duecento non dice
 * «l'automazione è nuova», dice «solo tre sono entrate» — ed è una risposta falsa a chi telefona.
 *
 * Il passato sta già scritto da qualche parte: nel registro (`AuditLog`), che segna ogni
 * `auth.login` e ogni `auth.register`. Non serve dedurlo, si legge.
 *
 * ⛔ **`auth.master_login` NO.** È l'assistenza che entra nell'account, non la cliente. Sono azioni
 * diverse nel registro proprio perché sono cose diverse.
 *
 *   npm run allinea:primo-accesso              → prova a vuoto
 *   CONFERMA=1 npm run allinea:primo-accesso   → scrive
 */
import { PrismaClient } from '@prisma/client';
import { segnaPrimoAccesso, STATO_PRIMO_ACCESSO } from '../src/commerce/primo-accesso';

const prisma = new PrismaClient();
const CONFERMA = process.env.CONFERMA === '1';

async function main() {
  console.log('');
  console.log(CONFERMA ? '⚠️  CONFERMA=1: SCRIVO.' : 'Prova a vuoto: non scrivo niente.');
  console.log('');

  const stato = await prisma.pipelineStage.findUnique({ where: { key: STATO_PRIMO_ACCESSO } });
  if (!stato) {
    console.log(`⛔ La colonna «${STATO_PRIMO_ACCESSO}» non esiste. Controlla con \`npm run diag:pipeline-stati\`.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Colonna trovata: «${stato.label}», posto ${stato.order}.`);

  /**
   * ⚠️ Le clienti, non lo staff: la board CRM è delle clienti. E `deletedAt` fuori: una scheda che
   * si muove per un account cancellato è una riga che ricompare senza che nessuno l'abbia toccata.
   */
  const clienti = (await prisma.user.findMany({
    where: { role: 'client', deletedAt: null },
    select: { id: true, email: true, firstName: true },
  })) as { id: string; email: string; firstName: string | null }[];

  const entrati = (await prisma.auditLog.findMany({
    where: { action: { in: ['auth.login', 'auth.register'] }, actorId: { in: clienti.map((c) => c.id) } },
    select: { actorId: true },
    distinct: ['actorId'],
  })) as { actorId: string | null }[];
  const chiEntrato = new Set(entrati.map((e) => e.actorId).filter(Boolean) as string[]);

  console.log(`Clienti: ${clienti.length} · con un accesso o una registrazione nel registro: ${chiEntrato.size}`);
  console.log('');

  let mosse = 0; let ferme = 0;
  for (const c of clienti) {
    if (!chiEntrato.has(c.id)) continue;
    const chi = c.firstName || c.email;
    if (!CONFERMA) {
      /**
       * ⚠️ A vuoto si guarda **senza scrivere**: si ripete a mano il confronto che farebbe
       * `avanzaStatoSeIndietro`, cioè l'`order` di adesso contro quello della colonna. Chiamare la
       * funzione vera «tanto poi non salvo» vorrebbe dire provare una cosa diversa da quella che
       * succede davvero — un test double che si comporta diversamente dall'originale.
       */
      const scheda = await prisma.crmRecord.findUnique({ where: { clientId: c.id }, select: { stage: true } });
      const attuale = scheda
        ? await prisma.pipelineStage.findUnique({ where: { key: scheda.stage }, select: { order: true, label: true } })
        : null;
      if (attuale && attuale.order >= stato.order) { ferme += 1; continue; }
      console.log(`~ ${chi}: ${attuale ? `«${attuale.label}»` : scheda ? `«${scheda.stage}» (colonna sparita)` : 'nessuna scheda'} → «${stato.label}»`);
      mosse += 1;
      continue;
    }
    if (await segnaPrimoAccesso(prisma as never, c.id)) { console.log(`✔ ${chi}`); mosse += 1; } else ferme += 1;
  }

  console.log('');
  console.log(`Da spostare: ${mosse} · già lì o più avanti: ${ferme}`);
  if (!CONFERMA) console.log('\nProva a vuoto: non ho scritto niente. Rileggi l\'elenco, poi CONFERMA=1.\n');
  else console.log('\nFatto.\n');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
