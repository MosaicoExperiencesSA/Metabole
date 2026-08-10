/**
 * CONTROLLO: perché quella scheda col piano scaduto è ancora dov'è?
 *
 * Domanda di Simone dell'11/8, guardando la colonna «Prova»: Anna Lisa con la pastiglia «piano
 * scaduto» e ferma lì da 23 giorni — «non avevamo detto che dopo x giorni di piano scaduto passavano
 * in automatico in percorso concluso?».
 *
 * L'automazione esiste (`CrmService.chiudiPercorsiConclusi`, nel cron notturno) e ha **quattro
 * condizioni**, tutte volute. Il problema è che quando una scheda non si sposta non c'è modo di sapere
 * quale delle quattro l'ha fermata: la board mostra solo il risultato.
 *
 *  1. il piano deve essere finito da almeno `path_ended_days` giorni (default 7) — la pastiglia «piano
 *     scaduto» invece compare dal primo giorno di scadenza, quindi fra il giorno 1 e il giorno 7 quello
 *     che si vede è **atteso**;
 *  2. non deve esistere un abbonamento **attivo o in attesa** — un bonifico non ancora approvato è una
 *     persona che sta tornando;
 *  3. la scadenza deve stare nella finestra fra 7 e **120 giorni** fa: le schede più vecchie non si
 *     toccano più, per non far comparire in blocco decine di «concluse» come se fosse successo oggi;
 *  4. la scheda non deve essere già più avanti nella pipeline (non si retrocede mai).
 *
 * Questo script prende ogni cliente con un piano scaduto e dice **quale** delle quattro si applica,
 * invece di lasciarlo dedurre. Non tocca niente: legge e stampa.
 *
 *   npm run diag:percorsi-conclusi
 *   EMAIL=<email> npm run diag:percorsi-conclusi     → una cliente sola
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EMAIL = (process.env.EMAIL ?? '').trim().toLowerCase();
const GIORNO = 86_400_000;

const giorno = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
  const soglia = await prisma.configParam.findUnique({ where: { key: 'path_ended_days' } });
  const giorniSoglia = Math.max(1, Number(soglia?.value ?? 7) || 7);
  const oggi = Date.now();

  const stati = (await prisma.pipelineStage.findMany({ select: { key: true, label: true, order: true } })) as {
    key: string; label: string; order: number;
  }[];
  const etichetta = new Map(stati.map((s) => [s.key, s.label]));
  const ordine = new Map(stati.map((s) => [s.key, s.order]));
  const ordinePathEnded = ordine.get('path_ended');

  if (ordinePathEnded === undefined) {
    console.log('⚠️  Lo stato «path_ended» non esiste più nella pipeline: l\'automazione non ha dove spostare le schede.');
    return;
  }

  const abbonamenti = (await prisma.subscription.findMany({
    where: {
      endDate: { not: null, lte: new Date(oggi) },
      ...(EMAIL ? { client: { email: EMAIL } } : {}),
    } as never,
    select: {
      clientId: true,
      status: true,
      endDate: true,
      plan: { select: { name: true } },
      client: { select: { email: true, clientProfile: { select: { name: true, assignedCoach: { select: { displayName: true } } } } } },
    },
    orderBy: { endDate: 'desc' },
  } as never)) as unknown as {
    clientId: string;
    status: string;
    endDate: Date | null;
    plan: { name: string } | null;
    client: { email: string; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null } | null } | null;
  }[];

  if (abbonamenti.length === 0) {
    console.log(EMAIL ? `Nessun piano scaduto per ${EMAIL}.` : 'Nessun piano scaduto.');
    return;
  }

  /** Un cliente può avere più abbonamenti scaduti: conta il più recente. */
  const perCliente = new Map<string, (typeof abbonamenti)[number]>();
  for (const a of abbonamenti) if (!perCliente.has(a.clientId)) perCliente.set(a.clientId, a);

  const clientIds = [...perCliente.keys()];
  const [vivi, schede] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        clientId: { in: clientIds },
        OR: [{ status: 'pending' }, { status: 'active', OR: [{ endDate: null }, { endDate: { gte: new Date(oggi) } }] }],
      } as never,
      select: { clientId: true, status: true, endDate: true, plan: { select: { name: true } } },
    }),
    prisma.crmRecord.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, stage: true },
    }),
  ]);
  const vivoDi = new Map((vivi as { clientId: string; status: string; endDate: Date | null; plan: { name: string } | null }[]).map((v) => [v.clientId, v]));
  const stageDi = new Map((schede as { clientId: string | null; stage: string }[]).map((r) => [r.clientId ?? '', r.stage]));

  const gruppi: Record<string, string[]> = {
    daSpostare: [], troppoPresto: [], rinnovoInCorso: [], troppoVecchia: [], giaAvanti: [], senzaScheda: [],
  };

  for (const [clientId, a] of perCliente) {
    const nome = a.client?.clientProfile?.name ?? a.client?.email ?? clientId.slice(0, 8);
    const coach = a.client?.clientProfile?.assignedCoach?.displayName ?? 'nessuna coach';
    const giorniScaduto = a.endDate ? Math.floor((oggi - a.endDate.getTime()) / GIORNO) : 0;
    const stage = stageDi.get(clientId);
    const riga = `${nome} <${a.client?.email ?? '—'}> · piano «${a.plan?.name ?? '?'}» finito il ${giorno(a.endDate)} (${giorniScaduto} gg) · stato «${stage ? etichetta.get(stage) ?? stage : 'nessuna scheda'}» · ${coach}`;

    if (!stage) { gruppi.senzaScheda.push(riga); continue; }
    const vivo = vivoDi.get(clientId);
    if (vivo) {
      gruppi.rinnovoInCorso.push(`${riga} → ha un abbonamento «${vivo.status}»${vivo.plan ? ` su «${vivo.plan.name}»` : ''}`);
      continue;
    }
    if (giorniScaduto < giorniSoglia) { gruppi.troppoPresto.push(`${riga} → mancano ${giorniSoglia - giorniScaduto} gg alla soglia`); continue; }
    if (giorniScaduto > 120) { gruppi.troppoVecchia.push(riga); continue; }
    const suo = ordine.get(stage);
    if (suo !== undefined && suo >= ordinePathEnded) { gruppi.giaAvanti.push(riga); continue; }
    gruppi.daSpostare.push(riga);
  }

  const blocco = (titolo: string, spiegazione: string, righe: string[]) => {
    console.log(`\n=== ${titolo} (${righe.length}) ===`);
    console.log(`   ${spiegazione}`);
    if (righe.length === 0) console.log('   nessuna');
    for (const r of righe.slice(0, 40)) console.log(`   ${r}`);
    if (righe.length > 40) console.log(`   … e altre ${righe.length - 40}`);
  };

  blocco(
    'DA SPOSTARE al prossimo giro del cron',
    'Nessuna condizione le ferma: stanotte passano in «Percorso concluso» e la coach riceve l\'avviso.',
    gruppi.daSpostare,
  );
  blocco(
    'Troppo presto',
    `Il piano è scaduto ma non da ${giorniSoglia} giorni. La pastiglia «piano scaduto» compare dal primo giorno: qui non c'è niente di rotto.`,
    gruppi.troppoPresto,
  );
  blocco(
    'Sta tornando',
    'Ha un abbonamento attivo o un pagamento in attesa: per scelta non si archivia chi sta rinnovando.',
    gruppi.rinnovoInCorso,
  );
  blocco(
    'Fuori finestra (oltre 120 giorni)',
    'Non si toccano più: spostarle adesso farebbe comparire decine di «concluse» tutte insieme. Si spostano a mano, se serve.',
    gruppi.troppoVecchia,
  );
  blocco('Già in «Percorso concluso» o oltre', 'Niente da fare: l\'automazione non retrocede mai una scheda.', gruppi.giaAvanti);
  blocco('Senza scheda nel CRM', 'Un piano scaduto senza scheda CRM: non c\'è niente da spostare. Vale la pena capire come è nata.', gruppi.senzaScheda);

  console.log(`\nSoglia in configurazione: path_ended_days = ${giorniSoglia} giorni.`);
  console.log('Dettaglio di una sola: EMAIL=<email> npm run diag:percorsi-conclusi\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
