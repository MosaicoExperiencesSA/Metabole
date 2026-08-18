/**
 * DIAGNOSTICA: **quante giornate escono sotto il fabbisogno, e di chi** — sola lettura.
 *
 * Legge gli eventi `daily_kcal_below_target` che l'erogazione scrive dal 17/8 (voce 260), e li
 * mette in una tabella. È il numero da cui parte la Consegna 2 del foglio delle porzioni
 * (`progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`): prima si sa **quante sono e chi sono**, poi si
 * cambia un grammo a qualcuno.
 *
 * ⚠️ Serve anche a rispondere con dei numeri alle due domande cliniche aperte del foglio: **che tetto
 * dare al moltiplicatore**, e **cosa fare quando il tetto non basta**. Con `TETTO=1.6` la tabella dice
 * quante clienti quel tetto copre e quante restano corte — e di quanto.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:kcal                 → ultimi 14 giorni, tetto 1,8
 *   GIORNI=30 npm run diag:kcal       → finestra più lunga
 *   TETTO=1.6 npm run diag:kcal       → prova un tetto diverso
 *   SOLO=a@b.it npm run diag:kcal     → una cliente sola
 *
 * ⚠️ NON scrive niente, e non ricalcola niente: mostra quello che il motore ha già deciso al momento
 * dell'erogazione. Se una cliente non compare, per lei l'erogazione non è passata in questa finestra
 * (o le sue giornate erano dentro la banda) — non vuol dire che stia bene: vuol dire che non lo
 * sappiamo da qui.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Una giornata sotto target, come l'ha scritta il motore. */
interface GiornataEvento {
  data: string;
  kcal: number;
  scostamentoPct: number;
  quotaDelTarget: number;
}

interface DatiEvento {
  targetKcal?: number;
  targetSource?: string;
  tolleranzaPct?: number;
  giorni?: GiornataEvento[];
  slotSaltati?: string[];
  finestra?: string | null;
  pastiEsclusi?: string[];
  dietId?: string;
}

const num = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

async function main(): Promise<void> {
  const giorniFinestra = num(process.env.GIORNI, 14);
  const tetto = num(process.env.TETTO, 1.8);
  const solo = new Set(
    (process.env.SOLO ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
  );
  const da = new Date(Date.now() - giorniFinestra * 86_400_000);

  const eventi = (await prisma.analyticsEvent.findMany({
    where: { name: 'daily_kcal_below_target', receivedAt: { gte: da } },
    orderBy: { receivedAt: 'desc' },
    select: { userId: true, data: true, receivedAt: true },
  })) as { userId: string | null; data: unknown; receivedAt: Date }[];

  if (eventi.length === 0) {
    console.log(
      `Nessuna giornata sotto il fabbisogno negli ultimi ${giorniFinestra} giorni ✓\n` +
        '⚠️ Se il segnale è stato rilasciato da poco, può voler dire solo che l\'erogazione non è\n' +
        '   ancora passata per nessuno: `deliverIfEligible` gira quando la cliente apre l\'app.',
    );
    return;
  }

  /** L'evento PIÙ RECENTE per cliente: quello vecchio racconta una situazione già cambiata. */
  const ultimoPerCliente = new Map<string, DatiEvento>();
  const quanteVolte = new Map<string, number>();
  for (const e of eventi) {
    if (!e.userId) continue;
    quanteVolte.set(e.userId, (quanteVolte.get(e.userId) ?? 0) + 1);
    if (!ultimoPerCliente.has(e.userId)) ultimoPerCliente.set(e.userId, (e.data ?? {}) as DatiEvento);
  }

  const utenti = (await prisma.user.findMany({
    where: { id: { in: [...ultimoPerCliente.keys()] } },
    select: { id: true, email: true, clientProfile: { select: { name: true } } },
  })) as unknown as { id: string; email: string; clientProfile: { name: string | null } | null }[];
  const perId = new Map(utenti.map((u) => [u.id, u]));

  type Riga = {
    cliente: string;
    email: string;
    perche: string;
    'quota peggiore': string;
    'fattore necessario': string;
    'col tetto': string;
    giornate: number;
    erogazioni: number;
  };
  const righe: Riga[] = [];
  let coperte = 0;
  let scoperte = 0;

  for (const [userId, d] of ultimoPerCliente) {
    const u = perId.get(userId);
    const email = u?.email ?? '(utente sparito)';
    if (solo.size && !solo.has(email.toLowerCase())) continue;

    const giorni = Array.isArray(d.giorni) ? d.giorni : [];
    if (!giorni.length) continue;
    // La giornata PEGGIORE: è quella che decide se il tetto basta.
    const peggiore = giorni.reduce((p, g) => (g.quotaDelTarget < p.quotaDelTarget ? g : p));
    const fattore = peggiore.quotaDelTarget > 0 ? 1 / peggiore.quotaDelTarget : Infinity;
    const basta = fattore <= tetto;
    if (basta) coperte++;
    else scoperte++;

    /** Perché le manca: la finestra del digiuno, gli spuntini tolti, o nessuno dei due. */
    const motivi: string[] = [];
    if (d.finestra) motivi.push(`digiuno: ${d.finestra}`);
    if (d.pastiEsclusi?.length) motivi.push(`spuntini tolti: ${d.pastiEsclusi.join(', ')}`);
    if (!motivi.length) motivi.push('nessuna esclusione: è il catalogo');

    righe.push({
      cliente: u?.clientProfile?.name ?? '(senza nome)',
      email,
      perche: motivi.join(' · '),
      'quota peggiore': `${Math.round(peggiore.quotaDelTarget * 100)}%`,
      'fattore necessario': Number.isFinite(fattore) ? `×${fattore.toFixed(2)}` : '—',
      'col tetto': basta ? `basta (≤ ×${tetto})` : `NON basta: resta al ${Math.round(peggiore.quotaDelTarget * tetto * 100)}%`,
      giornate: giorni.length,
      erogazioni: quanteVolte.get(userId) ?? 0,
    });
  }

  righe.sort((a, b) => parseInt(a['quota peggiore']) - parseInt(b['quota peggiore']));

  if (!righe.length) {
    console.log(
      solo.size
        ? `Nessuna di queste email ha giornate sotto il fabbisogno negli ultimi ${giorniFinestra} giorni.\n` +
            '⚠️ Controlla come sono scritte: un refuso qui ha la stessa faccia di «va tutto bene».'
        : `Nessuna giornata sotto il fabbisogno negli ultimi ${giorniFinestra} giorni ✓`,
    );
    return;
  }

  console.log(
    `Ultimi ${giorniFinestra} giorni · ${eventi.length} erogazioni con almeno una giornata sotto il ` +
      `fabbisogno · ${righe.length} client${righe.length === 1 ? 'e' : 'i'} coinvolt${righe.length === 1 ? 'a' : 'e'}.\n`,
  );
  console.table(righe);

  console.log(
    `\nCol tetto ×${tetto}: **${coperte} coperte**, **${scoperte} ancora corte**.\n` +
      '⚠️ «quota peggiore» è quanto della giornata arriva davvero nel piatto (65% = manca un terzo).\n' +
      '⚠️ «erogazioni» è quante volte il segnale è scattato per quella cliente: è un conteggio di\n' +
      '   consegne, non di giornate — la stessa giornata può essere stata contata una volta sola.\n' +
      '⚠️ Chi non compare NON è detto che stia bene: vuol dire che in questa finestra o non le è stata\n' +
      '   erogata una giornata sotto banda, o non le è stata erogata affatto.',
  );

  const senzaEsclusioni = righe.filter((r) => r.perche.startsWith('nessuna esclusione'));
  if (senzaEsclusioni.length) {
    console.log(
      `\n⚠️ ${senzaEsclusioni.length} client${senzaEsclusioni.length === 1 ? 'e' : 'i'} sotto target ` +
        'SENZA digiuno e SENZA spuntini tolti: lì il moltiplicatore di porzione non c\'entra, è il\n' +
        '   catalogo che non ha giornate nella banda. Vanno guardate con `npm run diag:varieta`.',
    );
  }

  console.log('\nFine. Questo script non ha scritto niente.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Errore:', (e as Error)?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
