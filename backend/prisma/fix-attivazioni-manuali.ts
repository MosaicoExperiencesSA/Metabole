/**
 * RIPARAZIONE: attivazioni manuali che gonfiano il FATTURATO dei grafici.
 *
 * IL DIFETTO (8/8/2026, secondo richiamo di Simone). Un piano attivato a mano dalla scheda cliente
 * non è una vendita: nessuno ha incassato niente. La prima correzione teneva pulito il conto
 * economico — la riga di ricavo nel `ledgerEntry` non si scrive più — ma **i grafici del fatturato
 * non leggono il ledger**: sommano `payment.amountCents` di tutti i pagamenti `approved`
 * (`analytics.service.ts`, `dashboard.service.ts`). Con l'importo pieno lì, «Fatturato / mese» e
 * «Fatturato cumulato» mostravano soldi mai incassati.
 *
 * Da oggi il codice registra **importo 0** su quelle attivazioni. Questo script serve per quelle
 * già registrate prima: portarle a 0 è l'unico modo perché i grafici tornino veri.
 *
 * ⚠️ PERCHÉ NON AZZERA IN BLOCCO. `method: 'manual'` non distingue le due cose: lo usano sia
 * l'attivazione interna dalla scheda cliente sia la **vendita vera** registrata da Acquisti (un
 * bonifico incassato e gestito a mano). La distinzione (`origine`) esiste solo nell'audit, e solo
 * da oggi. Azzerare tutto farebbe sparire incassi reali dai libri — un danno peggiore di quello che
 * si sta riparando. Quindi lo script **elenca** e tu scegli gli id: nessuna euristica decide al
 * posto tuo su dei soldi.
 *
 * Quando disponibile, accanto a ogni riga viene stampato quello che dice l'audit
 * (`commerce.purchase.manual` → `origine`): «scheda_cliente» è un candidato certo, «acquisti» è una
 * vendita da NON toccare, «—» vuol dire che l'audit non lo sa e la decisione è tua.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run fix:attivazioni-manuali                                   → elenca, non scrive niente
 *   CONFERMA=1 PAGAMENTI=<id>,<id> npm run fix:attivazioni-manuali    → porta a 0 SOLO quegli id
 *
 * Cosa scrive, sui pagamenti indicati: `amountCents = 0`, la descrizione diventa parlante
 * («attivazione interna, senza incasso (listino … €)») e resta una riga di audit
 * `commerce.purchase.manual.azzerato` con l'importo di prima. L'abbonamento, i menu e la cronologia
 * della cliente non si toccano: cambia solo il numero che le somme del fatturato vanno a leggere.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
const giorno = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';
  const scelti = (process.env.PAGAMENTI ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const pagamenti = (await prisma.payment.findMany({
    where: { method: 'manual' as never, status: 'approved' as never, amountCents: { gt: 0 } },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      amountCents: true,
      description: true,
      createdAt: true,
      approvedAt: true,
      client: { select: { email: true, clientProfile: { select: { name: true } } } },
    },
  })) as {
    id: string;
    amountCents: number;
    description: string;
    createdAt: Date;
    approvedAt: Date | null;
    client: { email: string; clientProfile: { name: string | null } | null } | null;
  }[];

  // Che cosa dice l'audit di ognuno: da oggi `origine` c'è, prima no.
  const audit = (await prisma.auditLog.findMany({
    where: { action: 'commerce.purchase.manual', entityId: { in: pagamenti.map((p) => p.id) } } as never,
    select: { entityId: true, metadata: true },
  })) as { entityId: string | null; metadata: unknown }[];
  const origineDi = new Map<string, string>();
  for (const a of audit) {
    const o = (a.metadata as { origine?: string } | null)?.origine;
    if (a.entityId && o) origineDi.set(a.entityId, o);
  }

  if (!pagamenti.length) {
    console.log('Nessuna attivazione manuale con importo maggiore di zero. Niente da fare.');
    return;
  }

  console.log(`\nAttivazioni manuali approvate con importo > 0: ${pagamenti.length}\n`);
  let totale = 0;
  for (const p of pagamenti) {
    totale += p.amountCents;
    const chi = p.client?.clientProfile?.name || p.client?.email || '—';
    const origine = origineDi.get(p.id) ?? '—';
    const marchio = origine === 'scheda_cliente' ? ' ← da azzerare' : origine === 'acquisti' ? ' ← vendita vera, NON toccare' : '';
    console.log(`  ${p.id}  ${giorno(p.approvedAt ?? p.createdAt)}  ${euro(p.amountCents).padStart(12)}  ${chi}`);
    console.log(`      «${p.description}»  · origine: ${origine}${marchio}`);
  }
  console.log(`\n  Totale che oggi entra nei grafici del fatturato: ${euro(totale)}`);

  if (!scelti.length) {
    console.log(
      '\nPer azzerarne qualcuno indica gli id, uno per uno:\n' +
        '  CONFERMA=1 PAGAMENTI=<id>,<id> npm run fix:attivazioni-manuali\n' +
        'Non c\'è un modo automatico: «manuale» comprende anche le vendite vere registrate da Acquisti.\n',
    );
    return;
  }

  const daFare = pagamenti.filter((p) => scelti.includes(p.id));
  const sconosciuti = scelti.filter((id) => !pagamenti.some((p) => p.id === id));
  if (sconosciuti.length) {
    console.log(`\n⚠️  Questi id non sono fra le attivazioni manuali con importo > 0, li salto: ${sconosciuti.join(', ')}`);
  }
  if (!daFare.length) {
    console.log('\nNiente da azzerare.');
    return;
  }

  console.log(`\n${conferma ? 'AZZERO' : 'AZZEREREI'} ${daFare.length} pagamenti (${euro(daFare.reduce((a, p) => a + p.amountCents, 0))}):`);
  for (const p of daFare) {
    console.log(`  ${p.id}  ${euro(p.amountCents)} → 0,00 €`);
    if (!conferma) continue;
    await prisma.payment.update({
      where: { id: p.id },
      data: {
        amountCents: 0,
        description: `${p.description.replace(/\s+—\s+attivazione interna.*$/, '')} — attivazione interna, senza incasso (listino ${euro(p.amountCents)})`,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: 'commerce.purchase.manual.azzerato',
        entityType: 'payment',
        entityId: p.id,
        metadata: {
          prezzoListinoCents: p.amountCents,
          amountCents: 0,
          motivo: 'attivazione interna: non è una vendita, non deve entrare nei grafici del fatturato',
        } as never,
      } as never,
    });
  }

  if (!conferma) {
    console.log('\nProva: non ho scritto niente. Rilancia con CONFERMA=1 per applicare.\n');
  } else {
    console.log('\nFatto. I grafici del fatturato si aggiornano al prossimo caricamento della pagina.\n');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
