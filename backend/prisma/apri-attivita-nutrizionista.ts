/**
 * ⛔ **APRE ALLA NUTRIZIONISTA LA PAGINA DELLE ATTIVITÀ — una volta sola, su un ambiente già vivo.**
 *
 * ## Il fatto (22/8)
 *
 * Dal 21/8 quattro tipi di attività nascono addosso alla nutrizionista — digiuno estremo, finestra
 * non traducibile, pasti non serviti, calorie che restano corte — e la push le arriva davvero, con
 * scritto **«La trovi in Dashboard»**. La Dashboard le rispondeva **403**: il suo ruolo non era fra
 * quelli di `coach-tasks.controller.ts` e non aveva il permesso di pagina `coach_tasks`.
 *
 * ⚠️ Avvisare qualcuno di una cosa che non può guardare è **peggio** che non avvisarlo: sa che c'è
 * qualcosa su una sua cliente e non ha modo di vedere cosa.
 *
 * ## ⛔ Perché serve uno script, e non basta cambiare i default
 *
 * `DEFAULT_PERMISSIONS` (in `permissions/pages.ts`) vale **solo quando la riga non c'è**: il guardiano
 * legge prima `role_page_permission` e il default è il ripiego. Ma il seed scrive **tutte** le
 * combinazioni ruolo × pagina al primo avvio, comprese quelle negate — quindi in un ambiente già
 * partito la riga `(nutritionist, coach_tasks)` esiste già, con `canView = false`, e vince sul
 * default nuovo.
 *
 * ⚠️ È esattamente il modo in cui una correzione passa i test e non cambia niente in produzione. Il
 * default corretto serve agli ambienti nuovi; questo script serve a quello che c'è.
 *
 * ## ⚠️ E anche i RUOLI PERSONALIZZATI (aggiunto in revisione, 22/8)
 *
 * `PageGuard` guarda `user.role`, che per un ruolo personalizzato contiene il **ruolo di base**:
 * l'API quindi si aprirebbe. Ma `/me/permissions` — da cui il backoffice costruisce il menu e le
 * rotte — usa `customRoleKey ?? role`, cioè la riga del ruolo personalizzato. Una «Nutrizionista
 * junior» creata prima di oggi ha già la sua riga a `false`, e `syncDefaults` non la tocca più:
 * risultato, API aperta e **voce di menu assente**. Perciò questo script cicla anche su
 * `customRole` con `baseRole` fra i ruoli della nutrizionista.
 *
 * ## ⚠️ Non calpesta una scelta fatta da una persona
 *
 * Accende **solo** le righe ancora ferme al default seminato (`canView` e `canManage` tutti e due
 * falsi). Se qualcuno in pagina Permessi aveva già messo mano a quella riga, lo script **non tocca
 * niente** e lo dice: una scelta di Simone non si sovrascrive da uno script, si racconta.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run apri:attivita-nutrizionista
 */
import { PrismaClient } from '@prisma/client';
import { RUOLI_NUTRIZIONISTA } from '../src/common/ruoli-nutrizionista';

const prisma = new PrismaClient();

const PAGINA = 'coach_tasks';

async function main() {
  console.log(`\n${'='.repeat(74)}`);
  console.log('ATTIVITÀ COACH — apertura alla nutrizionista (permesso di pagina «coach_tasks»)');
  console.log('='.repeat(74));

  let accese = 0;
  let giaOk = 0;
  let lasciateStare = 0;

  const personalizzati = (await prisma.customRole.findMany({
    where: { baseRole: { in: [...RUOLI_NUTRIZIONISTA] } } as never,
    select: { key: true, label: true },
  })) as unknown as { key: string; label: string | null }[];
  if (personalizzati.length) {
    console.log(`\nRuoli personalizzati basati sulla nutrizionista: ${personalizzati.map((r) => r.key).join(', ')}`);
  }
  const chiaviPersonalizzate = new Set(personalizzati.map((r) => r.key));
  const daGuardare = [...RUOLI_NUTRIZIONISTA, ...chiaviPersonalizzate];

  console.log('');
  for (const ruolo of daGuardare) {
    const personalizzato = chiaviPersonalizzate.has(ruolo);
    const riga = (await prisma.rolePagePermission.findUnique({
      where: { role_pageKey: { role: ruolo, pageKey: PAGINA } },
      select: { canView: true, canManage: true },
    })) as { canView: boolean; canManage: boolean } | null;

    if (!riga) {
      /**
       * ⚠️ Per un **ruolo di sistema** nessuna riga vuol dire «vale il default nuovo», che adesso è
       * aperto: `page.guard.ts` ripiega su `DEFAULT_PERMISSIONS[user.role]`. Non se ne scrive una.
       *
       * ⛔ Per un **ruolo personalizzato** no, ed è il contrario di quello che diceva la prima
       * stesura di questo script: `/me/permissions` — da cui il backoffice costruisce menu e rotte —
       * legge **solo** righe di banca dati, senza nessun ripiego sui default. «Nessuna riga» per
       * `nutrizionista-junior` significa **voce di menu assente**, cioè precisamente il caso che
       * questo script esiste per risolvere. Quindi la riga si crea.
       */
      if (!personalizzato) {
        console.log(`   ${ruolo.padEnd(26)} — nessuna riga: vale il default nuovo (aperta). Niente da fare.`);
        giaOk += 1;
        continue;
      }
      await prisma.rolePagePermission.create({
        data: { role: ruolo, pageKey: PAGINA, canView: true, canManage: true } as never,
      });
      console.log(`   ${ruolo.padEnd(26)} ✅ CREATA e accesa: per un ruolo personalizzato il default non vale.`);
      accese += 1;
      continue;
    }
    if (riga.canView && riga.canManage) {
      console.log(`   ${ruolo.padEnd(26)} ✅ già aperta (vede e gestisce). Niente da fare.`);
      giaOk += 1;
      continue;
    }
    if (riga.canView || riga.canManage) {
      // ⛔ Mezza accesa = qualcuno ci ha messo mano. Non si indovina cosa voleva.
      console.log(
        `   ${ruolo.padEnd(26)} ⚠️  NON toccata: qualcuno l'ha già impostata a mano `
        + `(vede: ${riga.canView}, gestisce: ${riga.canManage}). Se serve, sistemala in pagina Permessi.`,
      );
      lasciateStare += 1;
      continue;
    }

    await prisma.rolePagePermission.update({
      where: { role_pageKey: { role: ruolo, pageKey: PAGINA } },
      data: { canView: true, canManage: true },
    });
    console.log(`   ${ruolo.padEnd(26)} ✅ ACCESA (vede e gestisce): era ferma al default seminato.`);
    accese += 1;
  }

  console.log('');
  console.log(`Accese adesso: ${accese} · già a posto: ${giaOk} · lasciate stare: ${lasciateStare}`);
  console.log('');
  console.log('⚠️ Vede SOLO i suoi quattro tipi di attività, e SOLO sulle sue clienti: il filtro');
  console.log('   è in `coach-tasks.service.ts` (`filtroNutrizionista`), non nel permesso di pagina.');
  if (lasciateStare) {
    console.log('');
    console.log('⚠️ Qualche riga era stata impostata a mano e NON è stata toccata: aprila dalla');
    console.log('   pagina Permessi del backoffice, o quella nutrizionista continuerà a prendere 403.');
  }
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
