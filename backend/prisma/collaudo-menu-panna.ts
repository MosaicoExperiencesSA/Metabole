/**
 * COLLAUDO OTA: prepara sul tuo profilo un menu con la PANNA, per provare il cambio in chat.
 *
 * Serve per verificare in mano, sull'app vera, le tre cose uscite l'8/8:
 *  1. il pulsante «Sostituisci un ingrediente» apre la chat con Gaia già avviata;
 *  2. il cambio concordato entra davvero nel menu della giornata;
 *  3. l'unità cambia col sostituto: «70 ml panna fresca → 70 g burro», non «70 ml di burro».
 *
 * Perché serve uno script e non basta un menu qualsiasi: la panna in **ml** è il caso che fa
 * emergere il punto 3, e il cambio funziona solo se esiste un **gruppo di equivalenza approvato**
 * che copre la panna (senza, Gaia passa la mano alla nutrizionista — è il comportamento giusto ma
 * non collauda niente). Questo script mette in piedi entrambe le condizioni, e sa disfare quello
 * che ha fatto.
 *
 * ⚠️ SCRIVE SU UN PROFILO VERO. Usalo sul tuo, non su quello di una cliente: il giro di collaudo
 * modifica il menu della giornata di chi lo prova.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run collaudo:menu-panna -- tua@email.it                → mostra cosa farebbe, non scrive
 *   CONFERMA=1 npm run collaudo:menu-panna -- tua@email.it     → prepara il menu di oggi
 *   PULISCI=1 CONFERMA=1 npm run collaudo:menu-panna -- tua@email.it  → rimuove ricetta e gruppo
 *
 * Cosa crea, tutto riconoscibile dal nome «(collaudo)» e tutto rimovibile con PULISCI=1:
 *  - una ricetta «Pasta alla panna (collaudo)» con `panna fresca 70 ml`, `pasta 80 g`,
 *    `parmigiano 10 g` — inattiva (`active: false`), così il motore non la propone a nessun altro;
 *  - un gruppo di equivalenza approvato «Grassi da cucina (collaudo)» = panna fresca / burro /
 *    olio evo. È **globale** (productId null) perché deve valere sulla tua dieta qualunque sia:
 *    finché resta, quel gruppo vale anche per le altre clienti, ed è la ragione per cui va
 *    ripulito appena hai finito;
 *  - la giornata di OGGI con quella ricetta a cena, `status: 'delivered'` e `visibleFrom` oggi.
 *    Se una giornata di oggi esiste già, la **sostituisce** (e con PULISCI=1 la cancella: se era
 *    un menu vero, si rigenera dal backoffice con «Rigenera menu»).
 *
 * NB: la giornata usa la dieta già assegnata al tuo profilo. Se non ce n'è una, lo script si
 * fermerà dicendolo: `MenuDay.dietId` è obbligatorio e inventare una dieta sarebbe peggio.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOME_RICETTA = 'Pasta alla panna (collaudo)';
const NOME_GRUPPO = 'Grassi da cucina (collaudo)';

const oggi = (): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

async function main(): Promise<void> {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  const conferma = process.env.CONFERMA === '1';
  const pulisci = process.env.PULISCI === '1';
  if (!email) {
    console.error('Uso: npm run collaudo:menu-panna -- tua@email.it   (aggiungi CONFERMA=1 per scrivere)');
    process.exit(1);
  }

  const user = (await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, role: true },
  })) as { id: string; email: string; role: string } | null;
  if (!user) {
    console.error(`Nessun utente con email ${email}.`);
    process.exit(1);
  }
  if (user.role !== 'client') {
    console.error(`${email} ha ruolo «${user.role}»: il menu esiste solo per le clienti. Usa un account cliente.`);
    process.exit(1);
  }

  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: user.id },
    select: { dietId: true, allergies: true, intolerances: true, dislikedFoods: true },
  })) as { dietId: string | null; allergies: string[]; intolerances: string[]; dislikedFoods: string[] } | null;

  console.log(`\n=== Collaudo cambio panna · ${email} ===`);

  // ---------- PULIZIA ----------
  if (pulisci) {
    const ricetta = await prisma.recipe.findFirst({ where: { name: NOME_RICETTA }, select: { id: true } });
    const gruppo = await prisma.equivalenceGroup.findFirst({ where: { name: NOME_GRUPPO }, select: { id: true } });
    const giornata = await prisma.menuDay.findFirst({ where: { clientId: user.id, date: oggi() }, select: { id: true, meals: true } });
    const usaLaRicetta =
      !!ricetta &&
      !!giornata &&
      ((giornata.meals as { recipeId?: string }[]) ?? []).some((m) => m?.recipeId === ricetta.id);

    console.log(`  ricetta di collaudo: ${ricetta ? 'presente' : 'assente'}`);
    console.log(`  gruppo di collaudo:  ${gruppo ? 'presente' : 'assente'}`);
    console.log(`  giornata di oggi:    ${giornata ? (usaLaRicetta ? 'è quella del collaudo → la cancello' : '⚠️ NON è quella del collaudo → la lascio stare') : 'assente'}`);
    if (!conferma) {
      console.log('\nProva: non ho scritto niente. Rilancia con PULISCI=1 CONFERMA=1.\n');
      return;
    }
    if (giornata && usaLaRicetta) await prisma.menuDay.delete({ where: { id: giornata.id } });
    if (gruppo) await prisma.equivalenceGroup.delete({ where: { id: gruppo.id } });
    if (ricetta) await prisma.recipe.delete({ where: { id: ricetta.id } }).catch(() => {
      console.log('  (la ricetta ha valutazioni collegate: la disattivo invece di cancellarla)');
      return prisma.recipe.update({ where: { id: ricetta.id }, data: { active: false } });
    });
    console.log('\nFatto: ambiente di collaudo rimosso. Il menu vero si rigenera dal backoffice con «Rigenera menu».\n');
    return;
  }

  // ---------- PREPARAZIONE ----------
  if (!profilo?.dietId) {
    console.error(
      'Il profilo non ha una dieta assegnata, e `MenuDay` ne pretende una. Assegnala dalla scheda cliente\n' +
        '(o attiva un piano) e rilancia: inventarne una qui vorrebbe dire scrivere un dato falso.',
    );
    process.exit(1);
  }

  // Le esclusioni del profilo possono far scartare il sostituto: meglio saperlo prima di provare,
  // che è esattamente il caso di Giusy (allergia al latte → burro escluso, e giustamente).
  const esclusioni = [...(profilo.allergies ?? []), ...(profilo.intolerances ?? []), ...(profilo.dislikedFoods ?? [])];
  const problema = esclusioni.filter((t) => /latt|milk|dairy|burro/i.test(t ?? ''));
  if (problema.length) {
    console.log(
      `\n⚠️  Attenzione: in scheda hai ${problema.map((p) => `«${p}»`).join(', ')}. Il filtro degli allergeni\n` +
        '   scarterà il burro (correttamente) e Gaia proporrà l\'olio evo, che è in grammi: il caso\n' +
        '   «70 ml → 70 g» si vede comunque, ma con l\'olio.',
    );
  }

  console.log(`  dieta del profilo: ${profilo.dietId}`);
  console.log(`  giornata da preparare: ${oggi().toISOString().slice(0, 10)} (cena = ${NOME_RICETTA})`);
  console.log(`  ricetta: panna fresca 70 ml · pasta 80 g · parmigiano 10 g`);
  console.log(`  gruppo di equivalenza approvato: panna fresca / burro / olio evo`);

  if (!conferma) {
    console.log('\nProva: non ho scritto niente. Rilancia con CONFERMA=1 per preparare il menu.\n');
    return;
  }

  // 1. Ricetta di collaudo (idempotente sul nome). `active: false`: non deve finire nei menu di
  //    nessun altro — al servizio del cambio in chat serve solo poterla leggere per id.
  const ingredienti = [
    { name: 'pasta', qty: 80, unit: 'g' },
    { name: 'panna fresca', qty: 70, unit: 'ml' },
    { name: 'parmigiano', qty: 10, unit: 'g' },
  ];
  const esistente = await prisma.recipe.findFirst({ where: { name: NOME_RICETTA }, select: { id: true } });
  const ricetta = esistente
    ? await prisma.recipe.update({
        where: { id: esistente.id },
        data: { ingredients: ingredienti as never, kcal: 620, active: false },
      })
    : await prisma.recipe.create({
        data: {
          name: NOME_RICETTA,
          regime: 'omnivore',
          mealSlot: 'dinner' as never,
          kcal: 620,
          ingredients: ingredienti as never,
          macros: { protein_g: 18, carbs_g: 62, fat_g: 28 } as never,
          difficulty: 'semplice',
          active: false,
          allergens: ['latte', 'glutine'],
          allergensReviewed: true,
        },
      });

  // 2. Gruppo di equivalenza approvato che copre la panna. Senza questo il cambio non parte.
  const gruppoEsistente = await prisma.equivalenceGroup.findFirst({ where: { name: NOME_GRUPPO }, select: { id: true } });
  if (gruppoEsistente) {
    await prisma.equivalenceGroup.update({
      where: { id: gruppoEsistente.id },
      data: { members: { items: ['panna fresca', 'burro', 'olio evo'] } as never, status: 'approved', productId: null },
    });
  } else {
    await prisma.equivalenceGroup.create({
      data: {
        name: NOME_GRUPPO,
        productId: null,
        members: { items: ['panna fresca', 'burro', 'olio evo'] } as never,
        status: 'approved',
      },
    });
  }

  // 3. La giornata di oggi, visibile subito. `upsert` sulla coppia (cliente, data): se una
  //    giornata c'è già viene sostituita — è un ambiente di collaudo, non un menu da conservare.
  const pasti = [
    { slot: 'breakfast', recipeId: ricetta.id, name: NOME_RICETTA, kcal: 620 },
    { slot: 'dinner', recipeId: ricetta.id, name: NOME_RICETTA, kcal: 620 },
  ];
  await prisma.menuDay.upsert({
    where: { clientId_date: { clientId: user.id, date: oggi() } } as never,
    create: {
      clientId: user.id,
      date: oggi(),
      dietId: profilo.dietId,
      level: 1,
      meals: pasti as never,
      status: 'delivered',
      visibleFrom: oggi(),
    } as never,
    update: { meals: pasti as never, status: 'delivered', visibleFrom: oggi(), dietId: profilo.dietId } as never,
  });

  console.log(
    '\n✅ Pronto. Sull\'app (riavviata, versione 2.1.3):\n' +
      '   1) apri il Menu: a cena trovi «Pasta alla panna (collaudo)»;\n' +
      '   2) dalla home premi «Sostituisci un ingrediente» → si apre la chat con Gaia già avviata;\n' +
      '   3) scrivi «la panna», poi rispondi «1» (non ce l\'ho in casa: vale solo per oggi);\n' +
      '   4) conferma con «sì» e ricontrolla il Menu: deve leggersi «70 ml panna fresca → 70 g burro».\n' +
      '\n   Quando hai finito, ripulisci (il gruppo di equivalenza è globale e vale per tutte):\n' +
      `   PULISCI=1 CONFERMA=1 npm run collaudo:menu-panna -- ${email}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
