/**
 * RIPARAZIONE: segnalazioni aperte che non sono di nessuno.
 *
 * ## Che cosa è andato storto
 *
 * Fino all'8/8 due dei punti in cui nascono le segnalazioni più gravi — `signals` (calo rapido) e
 * `engine` (guardrail di sicurezza) — scrivevano la riga a mano, con
 * `assignedToId: profile?.assignedNutritionistId`. Quel campo è **vuoto per quasi tutte le
 * clienti**, perché una nutrizionista assegnata non ce l'ha nessuna: c'è un solo nutrizionista, il
 * capo. Risultato: segnalazioni **senza destinatario e senza una notifica**, visibili solo a chi
 * apriva l'elenco di sua iniziativa.
 *
 * Il caso che l'ha fatto scoprire: una cliente con «Calo rapido: 2,87 kg/settimana» — soglia 1.5,
 * quindi quasi il doppio — aperta il **22 luglio** e ancora lì tre settimane dopo. Il motore aveva
 * fatto il suo lavoro; mancava chi lo ascoltasse.
 *
 * Il codice è corretto (entrambi passano ora da `apriSegnalazione`), ma **vale da adesso**: le righe
 * già scritte restano orfane. Questo script le adotta.
 *
 * ## Cosa fa, esattamente
 *
 * Per ogni segnalazione `open`/`in_progress` con `assignedToId` vuoto usa **la stessa** logica del
 * codice vivo (`decidiDestinatari` + `avvisaSegnalazione`, importate da `apri-segnalazione.ts`, non
 * ricopiate): la assegna a chi di dovere — la persona del ruolo primario, o chi ne risponde — e
 * manda le notifiche, «Nutrizionista richiesto» alla coach compresa quando il nutrizionista manca.
 *
 * Non chiude niente, non cambia stato, non tocca il testo: una segnalazione la si chiude quando è
 * stata gestita, e a deciderlo è una persona.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run fix:segnalazioni              → mostra e basta, non scrive niente
 *   CONFERMA=1 npm run fix:segnalazioni   → assegna e avvisa
 */
import { PrismaClient } from '@prisma/client';
import {
  avvisaSegnalazione,
  decidiDestinatari,
  type PrismaPerSegnalazione,
} from '../src/escalations/apri-segnalazione';
import { ESCALATION_CATEGORY_LABEL, type EscalationCategory } from '../src/escalations/escalation-routing';

const prisma = new PrismaClient();

const giorni = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const orfane = (await prisma.escalation.findMany({
    where: { status: { in: ['open', 'in_progress'] as never }, assignedToId: null },
    select: { id: true, clientId: true, category: true, reason: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })) as never as {
    id: string; clientId: string; category: string; reason: string | null; createdAt: Date;
  }[];

  if (orfane.length === 0) {
    console.log('Nessuna segnalazione orfana: tutte hanno un destinatario ✓');
    return;
  }

  const daAdottare: { riga: (typeof orfane)[number]; decisione: Awaited<ReturnType<typeof decidiDestinatari>> }[] = [];
  const senzaNessuno: Record<string, unknown>[] = [];

  for (const e of orfane) {
    const decisione = await decidiDestinatari(prisma as never as PrismaPerSegnalazione, e.clientId, e.category as EscalationCategory);
    const prendeInCarico = decisione.assegnato ?? decisione.ripiego?.id ?? null;
    const riga = {
      cliente: decisione.nomeCliente ?? e.clientId.slice(0, 8),
      tipo: ESCALATION_CATEGORY_LABEL[e.category as EscalationCategory] ?? e.category,
      aperta: `${e.createdAt.toISOString().slice(0, 10)} (${giorni(e.createdAt)} gg)`,
      motivo: (e.reason ?? '').slice(0, 60),
    };
    if (!prendeInCarico) {
      // Nessuno da assegnare vuol dire che manca la persona che risponde di quel ruolo: è un
      // problema di organico, non di dati, e uno script non lo può risolvere inventando un nome.
      senzaNessuno.push(riga);
      continue;
    }
    daAdottare.push({ riga: e, decisione });
    console.log(
      `· ${riga.cliente} · ${riga.tipo} · aperta il ${riga.aperta} → ` +
      `${decisione.assegnato ? 'assegnata al ruolo previsto' : 'presa in carico da chi ne risponde'}` +
      `${decisione.serveNutrizionista ? ' · «Nutrizionista richiesto» alla coach' : ''}`,
    );
  }

  console.log(
    `\nSegnalazioni aperte senza destinatario: ${orfane.length} · ` +
    `adottabili: ${daAdottare.length} · senza nessuno a cui darle: ${senzaNessuno.length}`,
  );
  if (senzaNessuno.length) {
    console.log(
      '\n--- NON assegnabili: manca chi risponde di quel ruolo ---\n' +
      'Non è un problema di dati: serve la persona (capo nutrizionista o coordinatrice coach).\n',
    );
    console.table(senzaNessuno);
  }
  if (daAdottare.length === 0) return;

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run fix:segnalazioni');
    return;
  }

  let fatte = 0;
  for (const { riga, decisione } of daAdottare) {
    try {
      await prisma.escalation.update({
        where: { id: riga.id },
        data: { assignedToId: decisione.assegnato ?? decisione.ripiego?.id },
      });
      await avvisaSegnalazione(prisma as never as PrismaPerSegnalazione, decisione, {
        clientId: riga.clientId,
        category: riga.category as EscalationCategory,
        reason: riga.reason ?? undefined,
        escalationId: riga.id,
      });
      fatte++;
    } catch (err) {
      console.log(`⚠️  ${riga.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\n✓ ${fatte} segnalazioni assegnate e notificate. Ora sono nella coda di qualcuno.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
