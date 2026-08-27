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
 * NB: la dieta della giornata è quella della tua **ultima giornata erogata** — il profilo non ha un
 * campo `dietId`, la dieta la abbina il motore ogni volta (`catalog/pick-diet.ts`), e al primo
 * lancio questo script si è fermato proprio lì. Se non hai menu passati si ripiega sulla prima
 * variante approvata che combacia col regime, dicendolo; se non ne esiste nessuna si ferma:
 * `MenuDay.dietId` è obbligatorio e inventare una dieta sarebbe peggio.
 */
import { PrismaClient } from '@prisma/client';
import { aGiorno } from '../src/common/date-only';
import { CAMPI_DEL_GIORNO, type GiornoDaValutare, codaDaRifare, ricetteDelGiorno } from '../src/vera/menu-da-rifare';
import { toDateOnly } from '../src/common/date-only';

const prisma = new PrismaClient();

const NOME_RICETTA = 'Pasta alla panna (collaudo)';
const NOME_GRUPPO = 'Grassi da cucina (collaudo)';

/**
 * «Oggi» è il giorno di **Europe/Rome**, non quello UTC — e non è una pignoleria: la prima versione
 * di questo script calcolava il giorno UTC e alle 00:32 italiane ha preparato la giornata dell'**8**
 * mentre l'app chiedeva quella del **9**. Risultato: «per cambiare un alimento mi serve il menu di
 * oggi, e adesso non lo vedo», su un menu appena creato.
 *
 * `toDateOnly()` è lo stesso helper che usa il backend (`src/common/date-only.ts`), e quel file
 * racconta per esteso lo stesso difetto sulle misure: fra mezzanotte e le 02:00 in Italia è già
 * domani mentre per UTC è ancora ieri. Usare l'helper e non ricalcolare la data è l'unico modo per
 * essere certi che script e app parlino dello stesso giorno.
 */
const oggi = (): Date => toDateOnly();

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
    select: {
      allergies: true,
      intolerances: true,
      dislikedFoods: true,
      regime: true,
      dietStyle: true,
      dietFamily: true,
      mealsPerDay: true,
      objective: true,
      pathType: true,
    },
  })) as {
    allergies: string[];
    intolerances: string[];
    dislikedFoods: string[];
    regime: string | null;
    dietStyle: string | null;
    dietFamily: string | null;
    mealsPerDay: number | null;
    objective: string | null;
    pathType: string | null;
  } | null;

  /**
   * QUALE DIETA usare per la giornata. `MenuDay.dietId` è obbligatorio, e il profilo **non** ha un
   * `dietId`: la dieta non è un campo della cliente, è la variante di catalogo che il motore
   * abbina ogni volta a partire da regime, stile, famiglia, pasti e obiettivo (vedi
   * `catalog/pick-diet.ts`). Ci ho sbattuto il naso al primo lancio.
   *
   * Qui non si rifà quell'abbinamento: si prende la dieta **dell'ultima giornata già erogata** a
   * questa cliente, che è per definizione quella giusta per lei. Se non ha mai avuto un menu si
   * ripiega sulla prima variante approvata che combacia col suo regime — e lo si dice, perché in
   * quel caso la giornata di collaudo non è rappresentativa del suo piano.
   */
  const ultimaGiornata = (await prisma.menuDay.findFirst({
    where: { clientId: user.id },
    orderBy: { date: 'desc' },
    select: { dietId: true, diet: { select: { name: true } } },
  })) as { dietId: string; diet: { name: string } | null } | null;

  let dietId = ultimaGiornata?.dietId ?? null;
  let dietaNome = ultimaGiornata?.diet?.name ?? null;
  let dietaDiRipiego = false;
  if (!dietId && profilo?.regime) {
    const ripiego = (await prisma.diet.findFirst({
      where: {
        status: 'approved' as never,
        regime: profilo!.regime,
        ...(profilo!.dietStyle ? { style: profilo!.dietStyle } : {}),
        ...(profilo!.mealsPerDay ? { mealsPerDay: profilo!.mealsPerDay, fasting: false } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    })) as { id: string; name: string } | null;
    if (ripiego) {
      dietId = ripiego.id;
      dietaNome = ripiego.name;
      dietaDiRipiego = true;
    }
  }

  console.log(`\n=== Collaudo cambio panna · ${email} ===`);

  // ---------- PULIZIA ----------
  if (pulisci) {
    const ricetta = await prisma.recipe.findFirst({ where: { name: NOME_RICETTA }, select: { id: true } });
    const gruppo = await prisma.equivalenceGroup.findFirst({ where: { name: NOME_GRUPPO }, select: { id: true } });
    /**
     * ⛔ **SI CANCELLA UNA CODA, non le giornate col piatto di collaudo dentro** (24/8).
     *
     * Qui si cancellavano i giorni che contengono la ricetta di collaudo, **sparsi**, su una cliente
     * vera. Il motore riparte dall'**ultimo** giorno in calendario e appende da lì: ogni giorno
     * cancellato che ne lasciava uno più avanti restava vuoto **per sempre** — «menu in
     * preparazione», su una persona, per aver ripulito un collaudo. La regola sta in
     * `src/vera/menu-da-rifare.ts`, con il perché per esteso.
     *
     * ⚠️ La coda si taglia **solo da oggi in avanti**: cancellare una giornata già passata
     * riscriverebbe la storia di una cliente e sposterebbe il conteggio dei giorni di piano.
     *
     * ⚠️ **Ma le giornate passate si CONTANO lo stesso**, e questa è la ragione che il commento
     * vecchio di questo blocco portava con sé: il primo giro ne aveva creata una col giorno sbagliato
     * (UTC invece di Europe/Rome), quindi una giornata di collaudo può stare **ieri**. Guardando solo
     * il futuro sarebbe rimasta lì per sempre — e senza la sua ricetta (vedi sotto), che è peggio.
     */
    const oggi = aGiorno(new Date());
    const tutte = (await prisma.menuDay.findMany({
      where: { clientId: user.id },
      orderBy: { date: 'asc' },
      select: CAMPI_DEL_GIORNO as never,
    })) as GiornoDaValutare[];
    const haLaRicetta = (g: GiornoDaValutare) => !!ricetta && ricetteDelGiorno(g.meals).includes(ricetta.id);
    const futuri = tutte.filter((g) => g.date.getTime() >= oggi.getTime());
    const passateColPiatto = tutte.filter((g) => g.date.getTime() < oggi.getTime() && haLaRicetta(g));
    const esito = ricetta ? codaDaRifare(futuri, haLaRicetta) : ({ esito: 'niente' } as const);
    const daCancellare = esito.esito === 'coda' ? esito.giorni : [];

    /**
     * ⛔ **LA RICETTA SI TOGLIE SOLO SE NON LA CONTIENE PIÙ NESSUN GIORNO** (24/8, seconda revisione).
     *
     * Prima della correzione della coda questo caso non poteva esistere: le giornate col piatto di
     * collaudo si cancellavano **sempre** per prime. Adesso possono restare in piedi (ramo bloccato,
     * o una giornata passata) — e cancellare la ricetta lasciandole lì significa un `MenuDay` con
     * dentro il `recipeId` di una ricetta che non esiste più. `MenuDay.meals` è JSON, non c'è nessuna
     * chiave esterna: il `delete` passa liscio.
     *
     * ⚠️ Cosa vede la cliente: **il piatto nell'app c'è** (nome e kcal stanno nello snapshot), ma la
     * lista della spesa lo salta **in silenzio** — `aggregaSpesa` non trova gli ingredienti e mette
     * `[]`. Un piatto senza spesa, senza una riga che lo dica, per aver ripulito un collaudo.
     */
    const restaAppesa = passateColPiatto.length > 0 || esito.esito === 'bloccata' || esito.esito === 'non_lo_so';

    console.log(`  ricetta di collaudo: ${ricetta ? 'presente' : 'assente'}`);
    console.log(`  gruppo di collaudo:  ${gruppo ? 'presente' : 'assente'}`);
    console.log(
      `  giornate da rifare:   ${daCancellare.length ? daCancellare.map((g) => g.date.toISOString().slice(0, 10)).join(', ') : 'nessuna'}`,
    );
    if (passateColPiatto.length) {
      console.log(
        `  ⚠️ giornate PASSATE col piatto di collaudo: ${passateColPiatto.map((g) => g.date.toISOString().slice(0, 10)).join(', ')}` +
          ' — non le tocco (riscriverei la storia della cliente e sposterei il conteggio dei giorni di piano).',
      );
    }
    if (esito.esito === 'non_lo_so') {
      console.log(
        `  ⚠️ NON cancello i giorni futuri: dal ${esito.dalGiorno.toISOString().slice(0, 10)} non so dire se ` +
          'la cliente li ha già aperti (app non aggiornata quando sono stati composti), e nel dubbio non li tocco.',
      );
    }
    if (esito.esito === 'bloccata') {
      console.log(
        `  ⚠️ NON cancello i giorni futuri: il menu del ${esito.apertoIl.toISOString().slice(0, 10)} l'ha già aperto ` +
          'in app, e cancellare la coda lasciandolo lì aprirebbe un buco che non si richiude. ' +
          'Da rifare con «Rigenera menu» dalla scheda, che però rifà anche quel giorno.',
      );
    }
    if (restaAppesa) {
      console.log(
        '  ⚠️ Quindi la RICETTA di collaudo NON la cancello: resta referenziata da una giornata che non ' +
          'ho potuto togliere, e cancellarla la farebbe sparire dalla lista della spesa in silenzio. ' +
          'La disattivo (`active: false`), così non entra più in nessun menu nuovo e resta leggibile.',
      );
    }
    if (!conferma) {
      console.log('\nProva: non ho scritto niente. Rilancia con PULISCI=1 CONFERMA=1.\n');
      return;
    }
    if (daCancellare.length) {
      await prisma.menuDay.deleteMany({ where: { id: { in: daCancellare.map((g) => g.id) } } });
    }
    if (gruppo) await prisma.equivalenceGroup.delete({ where: { id: gruppo.id } });
    if (ricetta) {
      if (restaAppesa) {
        await prisma.recipe.update({ where: { id: ricetta.id }, data: { active: false } });
      } else {
        await prisma.recipe.delete({ where: { id: ricetta.id } }).catch(() => {
          console.log('  (la ricetta ha valutazioni collegate: la disattivo invece di cancellarla)');
          return prisma.recipe.update({ where: { id: ricetta.id }, data: { active: false } });
        });
      }
    }
    console.log(
      restaAppesa
        ? '\nFatto in parte: gruppo rimosso e ricetta disattivata. Le giornate elencate qui sopra restano ' +
          'com\'erano — vanno guardate a mano.\n'
        : '\nFatto: ambiente di collaudo rimosso. Il menu vero si rigenera dal backoffice con «Rigenera menu».\n',
    );
    return;
  }

  // ---------- PREPARAZIONE ----------
  if (!dietId) {
    console.error(
      'Non trovo una dieta da usare per la giornata: questa cliente non ha menu passati e nessuna\n' +
        'variante approvata combacia col suo regime. `MenuDay.dietId` è obbligatorio e inventarne una\n' +
        'qui vorrebbe dire scrivere un dato falso. Attiva un piano (o pubblica la variante) e rilancia.',
    );
    process.exit(1);
  }

  // Le esclusioni del profilo possono far scartare il sostituto: meglio saperlo prima di provare,
  // che è esattamente il caso di Giusy (allergia al latte → burro escluso, e giustamente).
  const esclusioni = [...(profilo?.allergies ?? []), ...(profilo?.intolerances ?? []), ...(profilo?.dislikedFoods ?? [])];
  const problema = esclusioni.filter((t) => /latt|milk|dairy|burro/i.test(t ?? ''));
  if (problema.length) {
    console.log(
      `\n⚠️  Attenzione: in scheda hai ${problema.map((p) => `«${p}»`).join(', ')}. Il filtro degli allergeni\n` +
        '   scarterà il burro (correttamente) e Gaia proporrà l\'olio evo, che è in grammi: il caso\n' +
        '   «70 ml → 70 g» si vede comunque, ma con l\'olio.',
    );
  }

  console.log(
    `  dieta della giornata: ${dietaNome ?? dietId}` +
      (dietaDiRipiego ? ' ⚠️ di ripiego (non hai menu passati): non rispecchia il tuo piano' : ' (dalla tua ultima giornata)'),
  );
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
      dietId,
      level: 1,
      meals: pasti as never,
      status: 'delivered',
      visibleFrom: oggi(),
    } as never,
    update: { meals: pasti as never, status: 'delivered', visibleFrom: oggi(), dietId } as never,
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
