/**
 * ⛔ **CHI PUÒ CAMBIARE I PASTI E IL DIGIUNO, ADESSO, IN PRODUZIONE** — e a quante clienti i due
 * campi non tornano fra loro.
 *
 * Serve a una decisione sola, e va guardato **prima** di considerare chiusa la correzione del 28/8
 * che ha messo `pathType` e `mealsPerDay` sotto il permesso «Cambia tipo di dieta».
 *
 * ## Perché non basta leggere i default nel codice
 *
 * `DEFAULT_PERMISSIONS` dà la casella anche a coach e coordinatrice (dal 9/8, richiesta delle
 * coach: *«per spostare una cliente da 3 a 5 pasti doveva chiedere a qualcun altro»*). ⚠️ Ma
 * `syncDefaults` **crea solo le righe che mancano e non tocca mai quelle esistenti**: in un ambiente
 * nato prima del 9/8 la riga della coach può essere ferma al default vecchio (*spenta*), e da oggi
 * quella coach i pasti non li sposta più. Il codice non lo può sapere: lo sa solo la tabella.
 *
 * ## E il secondo numero, che è quello che poteva far danno
 *
 * La scheda del backoffice **deduceva** `mealsPerDay` dal percorso a ogni salvataggio. Finché quel
 * campo era fuori dalla guardia non importava; da oggi conta, e conta per le clienti in cui il
 * valore scritto in banca dati **non coincide** con quello dedotto (l'onboarding preferisce il
 * numero risposto a quello dedotto, e la vecchia schermata «Quanti pasti» è esistita). ⚠️ La
 * deduzione è stata ristretta al solo caso in cui il percorso cambia davvero — questa conta dice
 * **quante clienti** sarebbero state coinvolte, cioè quanto era grosso il rischio evitato.
 *
 * ⚠️ **Non scrive niente.**
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:permesso-tipo-dieta
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_PERMISSIONS } from '../src/permissions/pages';

const prisma = new PrismaClient();

/** La deduzione che faceva la scheda del backoffice, com'era scritta lì. */
const PASTI_DAL_PERCORSO: Record<string, number> = {
  classic3: 3,
  five: 5,
  intermittent_fasting: 3,
  supplements: 5,
};

async function main(): Promise<void> {
  const righe = (await prisma.rolePagePermission.findMany({
    where: { pageKey: 'change_diet_type' },
    orderBy: { role: 'asc' },
  })) as { role: string; canView: boolean; canManage: boolean }[];

  console.log('\n«Cambia tipo di dieta» — chi ce l\'ha DAVVERO in questo database\n');
  if (!righe.length) {
    console.log('⚠️ Nessuna riga: valgono i default del codice per tutti i ruoli.');
  } else {
    console.table(
      righe.map((r) => {
        const perDefault = (DEFAULT_PERMISSIONS as Record<string, Record<string, { manage?: boolean }>>)[r.role]
          ?.change_diet_type?.manage;
        return {
          ruolo: r.role,
          'può cambiare': r.canManage ? 'sì' : 'NO',
          'default del codice': perDefault === undefined ? '—' : perDefault ? 'sì' : 'no',
          // ⚠️ La colonna che conta: dove il database dice il contrario del codice, il codice non è
          // la risposta — e chiunque legga solo `pages.ts` si farà l'idea sbagliata.
          diverso: perDefault !== undefined && perDefault !== r.canManage ? '⛔ SÌ' : '',
        };
      }),
    );
  }
  const coach = righe.find((r) => r.role === 'coach');
  if (coach && !coach.canManage) {
    console.log(
      '\n⛔ LA COACH NON CE L\'HA. Dal 28/8 pasti e percorso stanno dietro questa casella, quindi da\n' +
        '   adesso non li sposta più — mentre il default del 9/8 dice che le servono. Va deciso:\n' +
        '   accendere la casella per la coach, oppure lasciare che passi dal nutrizionista.',
    );
  } else if (coach) {
    console.log('\n✅ La coach ce l\'ha: per lei non cambia niente, e continua a spostare i pasti come prima.');
  }

  const profili = (await prisma.clientProfile.findMany({
    select: { userId: true, name: true, pathType: true, mealsPerDay: true },
  })) as { userId: string; name: string | null; pathType: string | null; mealsPerDay: number | null }[];

  const discordi = profili.filter((p) => {
    const dedotto = p.pathType ? PASTI_DAL_PERCORSO[p.pathType] : undefined;
    return dedotto !== undefined && p.mealsPerDay !== null && p.mealsPerDay !== dedotto;
  });
  const senzaPasti = profili.filter((p) => p.mealsPerDay === null).length;

  console.log(
    `\nClienti in cui i pasti scritti NON coincidono con quelli dedotti dal percorso: ` +
      `${discordi.length} su ${profili.length}.`,
  );
  if (discordi.length) {
    console.table(
      discordi.slice(0, 30).map((p) => ({
        cliente: p.name ?? p.userId,
        percorso: p.pathType,
        'pasti scritti': p.mealsPerDay,
        'pasti dedotti': PASTI_DAL_PERCORSO[p.pathType!],
      })),
    );
    console.log(
      '⚠️ Sono le clienti su cui la scheda avrebbe riscritto i pasti a ogni salvataggio — e da oggi\n' +
        '   avrebbe chiesto il permesso e rifatto i menu futuri per una modifica che nessuno ha fatto.\n' +
        '   La deduzione è stata ristretta al solo cambio di percorso: questo numero è il rischio evitato.',
    );
  }
  if (senzaPasti) console.log(`⚠️ Senza nessun numero di pasti scritto: ${senzaPasti}. Per loro non si deduce niente.`);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
