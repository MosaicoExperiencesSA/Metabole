/**
 * CHI NON HA IL MENU DEI PROSSIMI GIORNI, E PERCHÉ — sola lettura.
 *
 * ⛔ **La domanda nasce l'1/9, e nasce da un mio errore.** Dopo aver cancellato quattro giornate
 * perché il motore le ricomponesse, il tabulato ha detto «✅ niente da rifare» — ed era vero e
 * insieme falsissimo: le giornate non c'erano **affatto**, e due clienti erano rimaste senza menu.
 * Una frase che dice «a posto» quando lo schermo è vuoto è il modo peggiore in cui un tabulato può
 * sbagliare, perché nessuno va a controllare dopo un ✅.
 *
 * ⚠️ Questo tabulato guarda l'altra metà: **chi dovrebbe avere un menu e non ce l'ha**, con il
 * motivo per cui il motore non gliene compone — o dicendo chiaramente che un motivo non c'è, che è
 * la risposta che manda a guardare altrove invece di rassicurare.
 *
 * ⛔ **NON SCRIVE NIENTE.**
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run diag:senza-menu
 *   CLIENTI=e791abde,c36d2d62 npm run diag:senza-menu   (solo queste, anche solo l'inizio dell'id)
 */
import { PrismaClient } from '@prisma/client';
import { toDateOnly } from '../src/common/date-only';
import { CAMPI_PER_RICOMPORRE, perchePotrebbeNonRicomporre, type ProfiloPerRicomporre } from '../src/menu/perche-non-ricompone';

const prisma = new PrismaClient();
const SOLO = (process.env.CLIENTI ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const ESEMPI = Math.max(1, Number(process.env.ESEMPI ?? 40) || 40);
const riga = (s = '') => console.log(s);

async function main() {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga('  CHI NON HA IL MENU DEI PROSSIMI GIORNI');
  riga('──────────────────────────────────────────────────────────────────');

  const oggi = toDateOnly();
  const profili = (await prisma.clientProfile.findMany({
    select: { ...CAMPI_PER_RICOMPORRE, name: true },
  })) as unknown as (ProfiloPerRicomporre & { name: string | null })[];

  const scelti = SOLO.length
    ? profili.filter((p) => SOLO.some((s) => p.userId.startsWith(s)))
    : profili;

  riga('');
  riga(`  Clienti guardate: ${scelti.length}${SOLO.length ? ` (filtrate su ${SOLO.join(', ')})` : ''}`);

  const senza: { chi: string; nome: string; motivo: string | null; ultimo: string | null }[] = [];
  for (const p of scelti) {
    const giorni = (await prisma.menuDay.count({ where: { clientId: p.userId, date: { gte: oggi } } })) as number;
    if (giorni > 0) continue;
    const motivo = await perchePotrebbeNonRicomporre(prisma as never, p, new Date());
    const ultimo = (await prisma.menuDay.findFirst({
      where: { clientId: p.userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    })) as { date: Date } | null;
    senza.push({
      chi: p.userId.slice(0, 8),
      nome: (p.name ?? '—').slice(0, 24),
      motivo,
      ultimo: ultimo ? ultimo.date.toISOString().slice(0, 10) : null,
    });
  }

  riga(`  …senza nessuna giornata da oggi in avanti: ${senza.length}`);

  if (!senza.length) {
    riga('');
    riga('  ✅ Tutte hanno almeno una giornata da oggi in poi.');
    riga('');
    return;
  }

  /**
   * ⚠️ **Le due colonne che contano sono separate apposta.** Chi ha un motivo noto (piano fermo,
   * visita scaduta, sospensione) è **atteso**: il motore fa il suo mestiere. Chi non ce l'ha è la
   * riga da guardare — una cliente che dovrebbe ricevere e non riceve, e nessuno sa perché.
   */
  const attese = senza.filter((s) => s.motivo !== null);
  const daGuardare = senza.filter((s) => s.motivo === null);

  riga(`  ┌ con un motivo noto (il motore fa il suo mestiere): ${attese.length}`);
  riga(`  └ ⛔ SENZA un motivo noto — queste vanno guardate:    ${daGuardare.length}`);

  if (daGuardare.length) {
    riga('');
    riga('  ⛔ Dovrebbero ricevere e non ricevono:');
    for (const s of daGuardare.slice(0, ESEMPI)) {
      riga(`     · ${s.chi}  ${s.nome.padEnd(24)}  ultimo menu: ${s.ultimo ?? 'mai'}`);
    }
    if (daGuardare.length > ESEMPI) riga(`     …e altre ${daGuardare.length - ESEMPI}.`);
    riga('');
    riga('  ⚠️ Se hai appena cancellato delle giornate per farle ricomporre, non tornano da sole:');
    riga('     le ricompone `deliverIfEligible`, che gira QUANDO LA CLIENTE APRE L\'APP (e al');
    riga('     salvataggio di una misura). ⛔ Il cron `daily` NON compone menu — valuta le regole e');
    riga('     scrive decisioni. Per non aspettare: «Rigenera menu» dalla scheda della cliente.');
  }

  if (attese.length) {
    riga('');
    riga('  Con un motivo noto:');
    const perMotivo = new Map<string, number>();
    for (const s of attese) perMotivo.set(s.motivo!, (perMotivo.get(s.motivo!) ?? 0) + 1);
    for (const [m, n] of [...perMotivo].sort((a, b) => b[1] - a[1])) riga(`     · ${String(n).padStart(4)}  ${m}`);
  }
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
