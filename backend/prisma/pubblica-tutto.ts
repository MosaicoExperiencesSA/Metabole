/**
 * APPROVA E PUBBLICA tutto quello che è stato generato.
 *
 * Nasce dall'8/8: dopo aver pubblicato una famiglia si continuano a generare le settimane
 * 5, 6, 7… Ogni settimana nuova nasce **in bozza**: le sue ricette hanno `active = false` e
 * gli allergeni non confermati. La dieta però è già `approved`, quindi dal backoffice sembra
 * tutto a posto — e intanto le clienti continuano a ricevere solo i piatti vecchi, perché il
 * motore pesca le ricette attive.
 *
 * Questo comando fa, su tutte le diete in una volta, quello che il pulsante «Valida e pubblica
 * tutte le varianti» fa su una famiglia:
 *   1. attiva tutte le ricette usate dalle giornate della dieta;
 *   2. segna gli allergeni come confermati;
 *   3. approva i gruppi di equivalenza della dieta;
 *   4. se la dieta è ancora bozza o in revisione, la porta ad approvata;
 *   5. la rende visibile alle clienti (schermo 16) quando il gate di sicurezza è superato.
 *
 * ## Che cosa NON tocca
 *
 * Le diete **archiviate** (`rejected`): sono state messe fuori apposta, ripubblicarle
 * significherebbe rimetterle in mano alle clienti senza che nessuno l'abbia chiesto.
 * E le diete **senza giornate**: non c'è niente da pubblicare, sono gusci vuoti.
 *
 * ⚠️ Il punto 2 va detto chiaro: marcare gli allergeni «confermati» in blocco vuol dire
 * dichiarare che qualcuno li ha guardati. Il pulsante nel backoffice fa esattamente la stessa
 * cosa, ma su una famiglia per volta e con davanti chi l'ha appena generata. Qui si fa su
 * tutto il catalogo: lanciarlo è una responsabilità del nutrizionista, non una pulizia
 * tecnica. Per questo di default non scrive niente.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run pubblica:tutto                              → mostra che cosa farebbe
 *   npm run pubblica:tutto -- "Basso indice glicemico"  → solo quella famiglia
 *   CONFERMA=1 npm run pubblica:tutto -- "Basso indice glicemico"
 *   CONFERMA=1 npm run pubblica:tutto                   → tutto il catalogo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Le ricette usate dalle giornate della dieta (è la definizione che usa il backoffice). */
async function ricetteDellaDieta(dietId: string): Promise<string[]> {
  const templates = (await prisma.dietDayTemplate.findMany({
    where: { dietId },
    select: { meals: true },
  })) as { meals: unknown }[];
  const ids = new Set<string>();
  for (const t of templates) {
    for (const m of (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : [])) {
      if (m.recipeId) ids.add(m.recipeId);
    }
  }
  return [...ids];
}

async function main(): Promise<void> {
  const nome = process.argv.slice(2).join(' ').trim();
  const conferma = process.env.CONFERMA === '1';

  const diete = (await prisma.diet.findMany({
    where: nome ? { name: nome } : {},
    select: {
      id: true, name: true, style: true, regime: true, objective: true,
      mealsPerDay: true, fasting: true, status: true, clientVisible: true,
    },
    orderBy: [{ name: 'asc' }, { regime: 'asc' }, { objective: 'asc' }],
  })) as {
    id: string; name: string; style: string; regime: string; objective: string | null;
    mealsPerDay: number; fasting: boolean | null; status: string; clientVisible: boolean;
  }[];

  if (diete.length === 0) {
    console.log(nome ? `Nessuna dieta con nome "${nome}".` : 'Nessuna dieta in catalogo.');
    return;
  }

  // Chi firma l'approvazione: il capo nutrizionista. Se non c'è, si approva lo stesso ma
  // senza firma (il campo resta com'era) — meglio di non pubblicare per un dettaglio.
  const capo = (await prisma.staff.findFirst({
    where: { user: { role: 'head_nutritionist' } },
    select: { id: true, displayName: true },
  })) as { id: string; displayName: string } | null;

  // Almeno un gruppo di equivalenza approvato in tutto il sistema: è il gate che decide se
  // una dieta può diventare visibile alle clienti.
  let gruppiApprovatiTot = await prisma.equivalenceGroup.count({ where: { status: 'approved' as never } });

  const tabella: Record<string, unknown>[] = [];
  const saltate: string[] = [];
  let ricetteAttivate = 0;
  let allergeniConfermati = 0;
  let gruppiApprovati = 0;
  let pubblicate = 0;
  let reseVisibili = 0;

  for (const d of diete) {
    const tag = `${d.name} · ${d.regime} · ${d.objective ?? '—'} · ${d.fasting ? 'digiuno' : `${d.mealsPerDay} pasti`}`;

    if (d.status === 'rejected') { saltate.push(`${tag} (archiviata)`); continue; }

    const ids = await ricetteDellaDieta(d.id);
    if (ids.length === 0) { saltate.push(`${tag} (nessuna giornata generata)`); continue; }

    const ricette = (await prisma.recipe.findMany({
      where: { id: { in: ids } },
      select: { id: true, active: true, allergensReviewed: true },
    })) as { id: string; active: boolean; allergensReviewed: boolean }[];
    const daAttivare = ricette.filter((r) => !r.active).length;
    const daConfermare = ricette.filter((r) => !r.allergensReviewed).length;
    const gruppiDaApprovare = await prisma.equivalenceGroup.count({
      where: { productId: d.id, status: { not: 'approved' as never } },
    });
    const daPubblicare = ['draft', 'in_review'].includes(d.status);
    const daRendereVisibile = !d.clientVisible;

    const niente = daAttivare === 0 && daConfermare === 0 && gruppiDaApprovare === 0 && !daPubblicare && !daRendereVisibile;
    tabella.push({
      dieta: tag,
      stato: d.status + (d.clientVisible ? ' · visibile' : ' · NON visibile'),
      ricette: ricette.length,
      'da attivare': daAttivare || '',
      'allergeni da confermare': daConfermare || '',
      'gruppi da approvare': gruppiDaApprovare || '',
      azione: niente ? 'già a posto ✓' : daPubblicare ? 'valida e PUBBLICA' : 'valida (già pubblicata)',
    });
    if (niente) continue;

    ricetteAttivate += daAttivare;
    allergeniConfermati += daConfermare;
    gruppiApprovati += gruppiDaApprovare;
    if (daPubblicare) pubblicate += 1;

    if (!conferma) continue;

    if (daAttivare > 0 || daConfermare > 0) {
      await prisma.recipe.updateMany({ where: { id: { in: ids } }, data: { active: true, allergensReviewed: true } as never });
    }
    if (gruppiDaApprovare > 0) {
      await prisma.equivalenceGroup.updateMany({ where: { productId: d.id }, data: { status: 'approved' as never } });
      gruppiApprovatiTot += gruppiDaApprovare;
    }
    if (daPubblicare) {
      await prisma.diet.update({
        where: { id: d.id },
        data: { status: 'approved' as never, approvedAt: new Date(), ...(capo ? { approvedById: capo.id } : {}) } as never,
      });
    }
    // Visibile alle clienti: stesso gate di `assertActivatable` — allergeni tutti confermati
    // (ora lo sono) e almeno un gruppo di equivalenza approvato nel sistema.
    if (gruppiApprovatiTot > 0 && !d.clientVisible) {
      await prisma.diet.update({ where: { id: d.id }, data: { clientVisible: true } as never });
      reseVisibili += 1;
    }
  }

  console.table(tabella);
  if (saltate.length) {
    console.log(`\nSaltate (${saltate.length}): ${saltate.join(' · ')}`);
    console.log('Le archiviate restano fuori apposta; quelle senza giornate vanno generate prima (schermo 15).');
  }

  const daFare = ricetteAttivate + allergeniConfermati + gruppiApprovati + pubblicate;
  if (daFare === 0) {
    console.log('\nNiente da fare: tutto quello che è stato generato è già attivo e pubblicato ✓');
    return;
  }

  console.log(
    `\nRiepilogo: ${ricetteAttivate} ricette da attivare · ${allergeniConfermati} allergeni da confermare · ` +
    `${gruppiApprovati} gruppi da approvare · ${pubblicate} diete da pubblicare.`,
  );
  if (capo) console.log(`Firma l'approvazione: ${capo.displayName}.`);
  else console.log('⚠️  Nessun capo nutrizionista in anagrafica: le diete verranno approvate senza firma.');

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run pubblica:tutto' + (nome ? ` -- "${nome}"` : ''));
    return;
  }
  console.log(`\n✓ Fatto. ${reseVisibili} diete rese visibili alle clienti.`);
  console.log('Le ricette delle settimane nuove sono ora attive: da domani entrano nei menu.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
