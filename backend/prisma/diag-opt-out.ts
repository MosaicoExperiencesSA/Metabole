/**
 * ⛔ **IL WEBHOOK DI BREVO ARRIVA DAVVERO?** (6/11/2026)
 *
 * Il pannello Consegnabilità di Brevo dava un bounce del 7,37% (7/10–5/11) con l'invito a Gaia che
 * manda ogni giorno a lead vecchi. Le esclusioni ci sono nel codice (`marketing_opt_out`, scritta dal
 * webhook), ma servono solo se Brevo il webhook lo chiama: quello delle email transazionali — da cui
 * parte l'invito — si configura a parte da quello delle campagne. Se è assente, chi rimbalza resta
 * in coda e riceve anche il promemoria dopo 15 giorni.
 *
 * Lo script mette a confronto gli inviti mandati negli ultimi 30 giorni con le righe di opt-out
 * scritte nello stesso periodo. Con un bounce del 7% su qualche migliaio di inviti, ZERO righe
 * `hard_bounce` vuol dire che il webhook non arriva. In fondo, i domini della coda che resta.
 *
 * ⚠️ **Non scrive niente.**
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:opt-out
 */
import { PrismaClient } from '@prisma/client';
import { promises as dns } from 'dns';

const prisma = new PrismaClient();
const GIORNI = 30;

function dominio(email: string): string {
  const i = email.lastIndexOf('@');
  return i < 0 ? '(senza @)' : email.slice(i + 1).trim().toLowerCase();
}

async function main(): Promise<void> {
  const dal = new Date(Date.now() - GIORNI * 24 * 3600 * 1000);

  const tutte = await prisma.marketingOptOut.findMany({ select: { email: true, reason: true, createdAt: true } });
  const perMotivo = new Map<string, { totale: number; recenti: number; ultima: Date | null }>();
  for (const r of tutte) {
    const k = r.reason ?? '(senza motivo)';
    const v = perMotivo.get(k) ?? { totale: 0, recenti: 0, ultima: null };
    v.totale++;
    if (r.createdAt >= dal) v.recenti++;
    if (!v.ultima || r.createdAt > v.ultima) v.ultima = r.createdAt;
    perMotivo.set(k, v);
  }
  console.log(`\nmarketing_opt_out: ${tutte.length} righe in tutto`);
  for (const [k, v] of [...perMotivo].sort((a, b) => b[1].totale - a[1].totale)) {
    console.log(`  ${k.padEnd(16)} ${String(v.totale).padStart(6)}  (ultimi ${GIORNI} giorni: ${v.recenti})  ultima: ${v.ultima?.toISOString().slice(0, 16) ?? '-'}`);
  }

  const inviti = await prisma.gaiaInvite.findMany({
    where: { sentAt: { gte: dal } },
    select: { email: true, reminderSentAt: true },
  });
  const motivoDi = new Map(tutte.map((r) => [r.email.toLowerCase(), r.reason ?? '(senza motivo)']));
  const esclusi = new Map<string, number>();
  let promemoriaAEsclusi = 0;
  for (const i of inviti) {
    const m = i.email ? motivoDi.get(i.email.toLowerCase()) : undefined;
    if (!m) continue;
    esclusi.set(m, (esclusi.get(m) ?? 0) + 1);
    if (i.reminderSentAt) promemoriaAEsclusi++;
  }
  const rimbalzi = (esclusi.get('hard_bounce') ?? 0) + (esclusi.get('invalid_email') ?? 0) + (esclusi.get('blocked') ?? 0);
  console.log(`\nInviti a Gaia mandati negli ultimi ${GIORNI} giorni: ${inviti.length}`);
  console.log(`  di cui poi finiti in opt-out: ${[...esclusi.values()].reduce((a, b) => a + b, 0)}`);
  for (const [k, n] of esclusi) console.log(`    ${k.padEnd(16)} ${n}`);
  console.log(`  rimbalzati e bloccati: ${rimbalzi} (${inviti.length ? ((100 * rimbalzi) / inviti.length).toFixed(2) : '0'}%)`);
  console.log(`  promemoria partiti verso indirizzi poi esclusi: ${promemoriaAEsclusi}`);

  if (inviti.length >= 200 && rimbalzi === 0) {
    console.log('\n⛔ VERDETTO: nessun rimbalzo registrato su centinaia di inviti — il webhook TRANSAZIONALE di Brevo non arriva.');
    console.log('   Va aggiunto su Brevo: Transazionale > Impostazioni > Webhook, con hard_bounce, invalid_email, blocked, spam, unsubscribed.');
  } else if (inviti.length) {
    console.log('\n✅ Il webhook arriva: i rimbalzi vengono registrati e quegli indirizzi escono dalla coda.');
  }

  const coda = await prisma.crmRecord.findMany({
    where: { stage: 'lead_in', clientId: null, gaiaInvite: { is: null }, email: { contains: '@' } },
    select: { email: true },
  });
  const perDominio = new Map<string, number>();
  let giaEsclusi = 0;
  for (const c of coda) {
    if (!c.email) continue;
    if (motivoDi.has(c.email.toLowerCase())) { giaEsclusi++; continue; }
    const d = dominio(c.email);
    perDominio.set(d, (perDominio.get(d) ?? 0) + 1);
  }
  console.log(`\nCoda dell'invito (Nuovo contatto senza invito): ${coda.length}, di cui ${giaEsclusi} già in opt-out`);
  console.log('  primi 15 domini:');
  for (const [d, n] of [...perDominio].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`    ${d.padEnd(24)} ${n}`);

  // Quanti sono DAVVERO: indirizzi diversi, scritti bene, su un dominio che riceve posta (record MX).
  // ⚠️ Un MX buono dice che il DOMINIO riceve posta, non che la CASELLA esiste: mario.rossi@libero.it
  // chiusa nel 2015 passa questo controllo. Quello lo sa solo un servizio di verifica.
  const SINTASSI = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const diversi = new Set<string>();
  let scrittiMale = 0;
  for (const c of coda) {
    const e = (c.email ?? '').trim().toLowerCase();
    if (!e || motivoDi.has(e)) continue;
    if (!SINTASSI.test(e)) { scrittiMale++; continue; }
    diversi.add(e);
  }
  const domini = [...new Set([...diversi].map(dominio))];
  const senzaPosta = new Set<string>();
  const nonRisposto = new Set<string>();
  let i = 0;
  const lavora = async () => {
    while (i < domini.length) {
      const d = domini[i++];
      try {
        const mx = await dns.resolveMx(d);
        if (!mx.length) senzaPosta.add(d);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'ENOTFOUND' || code === 'ENODATA') senzaPosta.add(d);
        else nonRisposto.add(d);
      }
    }
  };
  await Promise.all(Array.from({ length: 20 }, lavora));
  let suSenzaPosta = 0;
  const perDominioMorto = new Map<string, number>();
  for (const e of diversi) {
    const d = dominio(e);
    if (!senzaPosta.has(d)) continue;
    suSenzaPosta++;
    perDominioMorto.set(d, (perDominioMorto.get(d) ?? 0) + 1);
  }
  console.log(`\nQuanti sono davvero (escluso chi è già in opt-out):`);
  console.log(`  indirizzi diversi scritti bene: ${diversi.size}  (righe in coda: ${coda.length})`);
  console.log(`  scritti male (senza @, senza punto, spazi): ${scrittiMale}`);
  console.log(`  domini diversi: ${domini.length}, di cui senza posta: ${senzaPosta.size}, non verificati (DNS lento): ${nonRisposto.size}`);
  console.log(`  indirizzi su domini senza posta: ${suSenzaPosta}`);
  console.log(`  ➜ indirizzi che possono ricevere posta: ${diversi.size - suSenzaPosta}`);
  console.log('  domini senza posta più frequenti (spesso errori di battitura):');
  for (const [d, n] of [...perDominioMorto].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`    ${d.padEnd(24)} ${n}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
