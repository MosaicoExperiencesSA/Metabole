/**
 * CONTROLLO: ci sono richieste di cancellazione aperte? Chi, e quando scadono?
 *
 * Nasce da una necessità immediata: la revoca del consenso si prova su un account vero, e una
 * prova lasciata a metà **non si vede da nessuna parte**. Il termine è di trenta giorni, il cron
 * gira ogni notte in silenzio, e al 31° giorno quell'account viene anonimizzato per davvero — con
 * i menu, le misure e le conversazioni. Nessuno riceve un avviso, perché il sistema sta facendo
 * esattamente quello che gli è stato chiesto.
 *
 * Serve anche dopo, ed è il motivo per cui è uno script e non un messaggio in chat: è l'unico
 * posto da cui si può rispondere alla domanda «stanotte cosa cancella?» prima che la risposta
 * diventi irreversibile.
 *
 *   npm run diag:cancellazioni                 → elenca tutto, non tocca niente
 *   FERMA=<id-richiesta> npm run diag:cancellazioni
 *                                              → sospende QUELLA richiesta (per chiudere una prova)
 *
 * `FERMA` fa la stessa cosa del link nella mail: mette la richiesta in `suspended` e **rimette il
 * consenso**. Non fa tutto il resto che fa il servizio (la mail alla cliente), perché serve a
 * chiudere una prova nostra, non a gestire un caso reale: se la richiesta è di una cliente vera,
 * il pulsante nella sua mail resta la strada giusta — è una sua decisione.
 *
 * Il rinnovo automatico, se era stato disdetto dalla revoca, **non torna** nemmeno qui: rimetterlo
 * in piedi da uno script vorrebbe dire riabbonare qualcuno senza chiederglielo.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FERMA = (process.env.FERMA ?? '').trim();

const giorno = 86_400_000;
const soloData = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

/** Giorni che restano, per giorni di calendario. Negativi = il termine è già passato. */
const giorniA = (scadenza: Date): number => {
  const oggi = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const fine = Date.UTC(scadenza.getUTCFullYear(), scadenza.getUTCMonth(), scadenza.getUTCDate());
  return Math.round((fine - oggi) / giorno);
};

async function main() {
  console.log('\n=== Metabole · richieste di cancellazione ===\n');

  const richieste = (await prisma.deletionRequest.findMany({
    orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }],
    take: 200,
  })) as {
    id: string;
    clientId: string;
    requestedAt: Date;
    scheduledFor: Date;
    status: string;
    suspendedAt: Date | null;
    completedAt: Date | null;
    warnedAt: Date | null;
    report: unknown;
  }[];

  if (richieste.length === 0) {
    console.log('Nessuna richiesta di cancellazione, in nessuno stato. Niente in sospeso.\n');
    return;
  }

  // I nomi in un colpo solo: su una lista di 200 righe, una query per riga sarebbe uno spreco.
  const utenti = (await prisma.user.findMany({
    where: { id: { in: [...new Set(richieste.map((r) => r.clientId))] } },
    select: { id: true, email: true, firstName: true, lastName: true, deletedAt: true },
  })) as { id: string; email: string; firstName: string | null; lastName: string | null; deletedAt: Date | null }[];
  const chi = new Map(utenti.map((u) => [u.id, u]));

  const aperte = richieste.filter((r) => r.status === 'pending');

  for (const r of richieste) {
    const u = chi.get(r.clientId);
    const nome = u ? `${[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'} <${u.email}>` : `(utenza non trovata: ${r.clientId})`;
    const giorni = giorniA(r.scheduledFor);
    const quando =
      r.status !== 'pending'
        ? ''
        : giorni < 0
          ? `  ⚠️  TERMINE PASSATO DA ${-giorni} GIORNI: la cancella il prossimo cron`
          : giorni === 0
            ? '  ⚠️  SCADE OGGI: la cancella il cron di stanotte'
            : `  fra ${giorni} giorni`;

    const stato =
      r.status === 'pending' ? '🟠 APERTA' :
      r.status === 'suspended' ? '🟢 fermata' :
      r.status === 'done' ? '⚫️ eseguita' : `   ${r.status}`;

    console.log(`${stato}  ${nome}`);
    console.log(`   id: ${r.id}`);
    console.log(`   revocato il ${soloData(r.requestedAt)} · cancellazione prevista ${soloData(r.scheduledFor)}${quando}`);
    if (r.warnedAt) console.log(`   ultimo avviso mandato il ${soloData(r.warnedAt)}`);
    if (r.suspendedAt) console.log(`   fermata il ${soloData(r.suspendedAt)}`);
    if (r.completedAt) {
      const conteggi = (r.report ?? {}) as Record<string, number>;
      const righe = Object.entries(conteggi).map(([k, v]) => `${k}: ${v}`).join(' · ');
      console.log(`   eseguita il ${soloData(r.completedAt)}${righe ? ` → ${righe}` : ''}`);
      if (u && !u.deletedAt) {
        // Se la richiesta è «eseguita» ma l'utenza non risulta anonimizzata, qualcosa non ha
        // funzionato: è il caso in cui il report dice una cosa e il database un'altra.
        console.log('   ⚠️  ma l\'utenza NON risulta anonimizzata (deletedAt vuoto): da guardare.');
      }
    }
    console.log('');
  }

  console.log(`Totale: ${richieste.length} · aperte: ${aperte.length}\n`);

  if (aperte.length > 0 && !FERMA) {
    console.log('Se una di queste è una PROVA e va chiusa, fermala così (una alla volta):');
    for (const r of aperte) console.log(`   FERMA=${r.id} npm run diag:cancellazioni`);
    console.log('\nSe invece è la richiesta di una cliente vera, lasciala: il pulsante nella sua');
    console.log('mail è la strada giusta, perché fermarla è una sua decisione.\n');
  }

  if (!FERMA) return;

  const bersaglio = richieste.find((r) => r.id === FERMA);
  if (!bersaglio) {
    console.error(`\n⛔ Nessuna richiesta con id ${FERMA}.\n`);
    process.exitCode = 1;
    return;
  }
  if (bersaglio.status !== 'pending') {
    console.log(`\nLa richiesta ${FERMA} è già «${bersaglio.status}»: non c'è niente da fermare.\n`);
    return;
  }

  await prisma.deletionRequest.update({
    where: { id: FERMA },
    data: { status: 'suspended', suspendedAt: new Date(), suspendedBy: bersaglio.clientId },
  });

  // Il consenso torna attivo, come fa il link della mail: lasciarlo revocato darebbe un account
  // fermo, senza menu e senza spiegazione.
  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: bersaglio.clientId },
    select: { consents: true },
  })) as { consents: unknown } | null;
  const consensi = { ...((profilo?.consents ?? {}) as Record<string, unknown>) };
  const precedente = (consensi.healthDataConsent ?? {}) as Record<string, unknown>;
  consensi.healthDataConsent = {
    ...precedente,
    accepted: true,
    at: precedente.at ?? new Date().toISOString(),
    revokedAt: null,
  };
  await prisma.clientProfile.updateMany({
    where: { userId: bersaglio.clientId },
    data: { consents: consensi as never },
  });

  await prisma.auditLog.create({
    data: {
      action: 'privacy.cancellazione.sospesa',
      actorId: bersaglio.clientId,
      entityType: 'deletion_request',
      entityId: FERMA,
      metadata: { da: 'script diag:cancellazioni' } as never,
    },
  }).catch(() => undefined);

  console.log(`\n✅ Richiesta ${FERMA} fermata, consenso rimesso attivo.`);
  console.log('   Il rinnovo automatico, se era stato disdetto dalla revoca, resta disdetto:');
  console.log('   riabbonare qualcuno da uno script sarebbe peggio del disagio di rifarlo a mano.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
