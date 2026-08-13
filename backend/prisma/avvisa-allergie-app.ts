/**
 * LA PUSH A TUTTI GLI ALTRI — il complemento della campagna in chat. **In prova, salvo CONFERMA=1.**
 *
 * Decisione di Simone del 13/8 (`Decisioni_Simone_20260813.md` §13): la campagna allergie va a
 * tutti i 48, non solo ai 27 utili. Questo script copre chi NON è nelle popolazioni della campagna
 * in chat (`POPOLAZIONI_IN_CAMPAGNA`): quelle ricevono la loro notifica da `chiedi:allergie`, e
 * nessuno deve riceverne due.
 *
 * USO (shell di Render, dentro ~/project/src/backend — DOPO chiedi:allergie):
 *   npm run avvisa:allergie              → elenca chi riceverebbe la push, non scrive niente
 *   CONFERMA=1 npm run avvisa:allergie   → manda push + notifica in app
 *
 * ## I due testi
 *
 * - **Mai risposto** → la push li porta ad aprire l'app: in home trovano la scheda che fa la
 *   domanda (OTA 13/8). La push dice cosa troveranno, NON fa la domanda: una risposta data nella
 *   push si perderebbe.
 * - **Già a posto** → informativa: le dichiarazioni sono registrate e si vedono nel profilo.
 *   Nessuna domanda da rifare.
 *
 * ## ⚠️ Perché `notificaUtente` e non `notification.create`
 *
 * È la funzione del prodotto (in app + push vera via FCM): la campagna in chat aveva solo la riga
 * in app, e per gente che l'app non la apre da settimane la campanella non suona. Il `kind`
 * `allergie_avviso` non è in `INTENTO_PER_NOTIZIA` né ha `counterpart`: il tocco apre l'app sulla
 * home — che è esattamente dove sta la scheda.
 */
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EU_ALLERGEN_CODES } from '../src/catalog/allergens';
import { MotivoRicontatto, motivoRicontatto } from '../src/common/da-ricontattare';
import { POPOLAZIONI_IN_CAMPAGNA } from '../src/chat/campagna-allergie';
import { notificaUtente } from '../src/notifications/notifica-utente';
import { PushService } from '../src/notifications/push.service';

const prisma = new PrismaClient();

export const TIPO_AVVISO = 'allergie_avviso';

/** Il testo per chi non ha mai risposto: dice cosa trova, non fa la domanda. */
export const TESTO_MAI_RISPOSTO = {
  title: 'Una domanda veloce sulle allergie',
  body: 'Apri l’app: in home trovi una domanda su allergie e intolleranze. Bastano due tocchi, e i tuoi menu ne tengono conto da subito.',
};

/** Il testo per chi ha già risposto: informa, non richiede. */
export const TESTO_A_POSTO = {
  title: 'Allergie e intolleranze, ora nel profilo',
  body: 'Le tue allergie e intolleranze sono registrate e da oggi le vedi nel tuo profilo, con i cibi da evitare. Se qualcosa non torna, scrivici in chat.',
};

type Riga = {
  userId: string;
  name: string | null;
  allergies: string[];
  allergiesOther: string[];
  allergieDichiarateIl: Date | null;
  intolerances: string[];
  intolerancesOther: string[];
  onboardingCompletedAt: Date | null;
  user: { email: string; deletedAt: Date | null } | null;
};

const etichetta = (r: Riga) => `${r.name ?? '—'} <${r.user?.email ?? 'senza email'}>`;

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const tutte = (await prisma.clientProfile.findMany({
    select: {
      userId: true, name: true,
      allergies: true, allergiesOther: true, allergieDichiarateIl: true,
      intolerances: true, intolerancesOther: true, onboardingCompletedAt: true,
      user: { select: { email: true, deletedAt: true } },
    },
  })) as unknown as Riga[];

  const vive = tutte.filter((r) => r.user && !r.user.deletedAt);
  // Il COMPLEMENTO della campagna in chat: chi è in quelle popolazioni ha già la sua notifica
  // da `chiedi:allergie`, e due notifiche sulla stessa cosa sono il modo di farsi ignorare.
  const daAvvisare = vive
    .map((r) => ({ r, m: motivoRicontatto(r, EU_ALLERGEN_CODES) }))
    .filter(({ m }) => !POPOLAZIONI_IN_CAMPAGNA.includes(m as never));

  console.log('');
  console.log('==================================================================');
  console.log('  PUSH ALLERGIE A TUTTI GLI ALTRI — il complemento della campagna');
  console.log(conferma ? '  ⚠️  CONFERMA=1: le push vengono MANDATE.' : '  Prova: non scrivo niente.');
  console.log('==================================================================');
  console.log('');
  console.log(`Clienti attive: ${vive.length}. In campagna chat (escluse da qui): ${vive.length - daAvvisare.length}.`);
  console.log('');

  const push = new PushService(prisma as never, new ConfigService());
  const conto = { mandate: 0, gia_avvisate: 0 } as Record<string, number>;

  for (const { r, m } of daAvvisare) {
    const maiRisposto = (m as MotivoRicontatto) === 'mai_risposto';
    // «Già avvisata» = la notifica stessa, per tipo: qui «già chiesto» è per sempre.
    const gia = await prisma.notification.findFirst({
      where: { type: TIPO_AVVISO, userId: r.userId },
      select: { id: true },
    });
    const testo = maiRisposto ? TESTO_MAI_RISPOSTO : TESTO_A_POSTO;
    const segno = gia ? '✓ già avvisata' : conferma ? '→ push mandata' : '→ riceverebbe la push';
    console.log(`  ${etichetta(r)}  ·  ${maiRisposto ? 'mai risposto → scheda in home' : 'già a posto → informativa'}  ${segno}`);
    if (gia) { conto.gia_avvisate += 1; continue; }
    if (!conferma) { conto.mandate += 1; continue; }
    // ⚠️ La funzione del prodotto: riga in app + push vera. `kind` senza rotta = si apre la home.
    await notificaUtente(prisma as never, push, {
      userId: r.userId,
      type: TIPO_AVVISO,
      title: testo.title,
      body: testo.body,
      payload: { kind: TIPO_AVVISO, clientId: r.userId },
    });
    conto.mandate += 1;
  }

  console.log('');
  console.log(`Da mandare: ${conto.mandate}. Già avvisate in passato: ${conto.gia_avvisate}.`);
  if (!conferma) {
    console.log('\nProva: non ho scritto niente e nessuno ha ricevuto niente.');
    console.log('Rilancia con CONFERMA=1 dopo aver letto l\'elenco riga per riga.');
    console.log('⚠️ Prima però lancia chiedi:allergie: chi è in campagna deve avere la SUA notifica, non questa.\n');
  } else {
    console.log('\nFatto. Il tocco sulla push apre l\'app sulla home: chi non ha mai risposto ci trova la scheda.\n');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
