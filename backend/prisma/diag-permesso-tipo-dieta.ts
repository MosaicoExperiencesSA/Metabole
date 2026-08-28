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
import { isCoachLike } from '../src/common/coach-team';
/**
 * ⚠️ **La stessa condizione di `perimetroClienti`, chiamata e non ricopiata.** Quella funzione mette
 * un limite ai ruoli «tipo coach» e al nutrizionista, e a nessun altro. ⛔ Non si usa
 * `vedeTutteLeClienti`, che risponde a un'**altra** domanda e diverge di proposito su marketing e
 * capo marketing (lo dice `perimetro-clienti.ts`): con quella, questa colonna scriverebbe «solo le
 * sue» per due ruoli che le vedono tutte — una diagnostica che sottostima proprio il raggio che
 * serve a misurare.
 */
const haUnPerimetro = (role: string): boolean => isCoachLike(role) || role === 'nutritionist';

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
        const suo = (DEFAULT_PERMISSIONS as Record<string, Record<string, { manage?: boolean }>>)[r.role];
        const perDefault = suo?.change_diet_type?.manage;
        /**
         * ⛔ **«IL CODICE NON LO PREVEDE» È UNA DIVERGENZA, e la prima stesura la taceva** (28/8,
         * corretta dopo la prima passata in produzione).
         *
         * La colonna confrontava solo quando il default esisteva: per un ruolo a cui `pages.ts` la
         * casella **non la dà affatto** — `undefined` — restava vuota. È esattamente la riga che
         * andava guardata: in produzione `sales` risulta acceso, e nel codice non compare da nessuna
         * parte. Un confronto che sta zitto proprio sul caso che non hai previsto è un confronto che
         * ti fa leggere la tabella con sollievo.
         */
        const divergenza =
          perDefault === undefined
            ? r.canManage
              ? '⛔ ACCESO E NON PREVISTO'
              : ''
            : perDefault !== r.canManage
              ? // ⛔ **NEI DUE VERSI.** La prima correzione di questa colonna aveva messo un
                // `r.canManage ? … : ''` davanti a tutto, e così spegneva proprio il caso opposto:
                // «il codice gliela dà, il database gliel'ha tolta» — un ruolo che dovrebbe poter
                // cambiare il tipo di dieta e non può, sparito dalla colonna. Nella stessa modifica
                // che diceva «un confronto che sta zitto sul caso che non hai previsto ti fa leggere
                // la tabella con sollievo».
                `⛔ DIVERSO DAL CODICE (il codice dice ${perDefault ? 'sì' : 'no'})`
              : '';
        return {
          ruolo: r.role,
          'può cambiare': r.canManage ? 'sì' : 'NO',
          'default del codice': perDefault === undefined ? '— (mai dato)' : perDefault ? 'sì' : 'no',
          /**
           * ⚠️ **E su quante clienti**, perché il permesso da solo non dice il danno: chi non ha un
           * perimetro apre la scheda di **qualunque** cliente, non solo delle sue. Una casella clinica
           * accesa su un ruolo senza perimetro vale su tutte.
           *
           * ⛔ **La domanda è «ha un perimetro?», e la risposta la dà `perimetroClienti`**, non
           * `vedeTutteLeClienti`: le due divergono di proposito (lo dice `perimetro-clienti.ts`) su
           * marketing e capo marketing, che nella prima non hanno limiti e nella seconda non
           * compaiono. Usando la seconda, questa colonna avrebbe scritto «solo le sue» per due ruoli
           * che le vedono **tutte** — cioè una diagnostica che sottostima il raggio proprio nella
           * colonna che serve a misurarlo.
           */
          'su quali clienti': haUnPerimetro(r.role) ? 'solo le sue' : 'TUTTE',
          'apre la scheda': suo?.clients ? 'sì' : '— (non previsto)',
          diverso: divergenza,
        };
      }),
    );
  }
  /**
   * ⛔ Le righe accese che il codice non prevede: sono quelle che nessuno ha deciso di proposito, o
   * che qualcuno ha acceso una volta e nessuno ha più guardato. Si dicono per nome, non si lasciano
   * dentro una tabella da leggere riga per riga.
   */
  const impreviste = righe.filter(
    (r) =>
      r.canManage &&
      (DEFAULT_PERMISSIONS as Record<string, Record<string, { manage?: boolean }>>)[r.role]?.change_diet_type
        ?.manage === undefined,
  );
  if (impreviste.length) {
    console.log(
      `\n⛔ ACCESA su ${impreviste.length} ruol${impreviste.length === 1 ? 'o' : 'i'} a cui il codice non la dà: ` +
        `${impreviste.map((r) => r.role).join(', ')}.\n` +
        '   Vuol dire che qualcuno l\'ha accesa a mano, o che viene da un default vecchio che non esiste più.\n' +
        '   ⚠️ Da oggi quella casella copre anche i pasti e il DIGIUNO INTERMITTENTE, ed è una decisione\n' +
        '   clinica: va guardata riga per riga, non lasciata com\'è perché «c\'era già».',
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
