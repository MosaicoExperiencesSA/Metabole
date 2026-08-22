/**
 * ⛔ **CHI È «LA NUTRIZIONISTA», in un posto solo.**
 *
 * Nasce il 22/8, in revisione, da un difetto che era esattamente questo: l'elenco dei tipi di
 * attività che nascono addosso a lei stava in un file (`avvisi-attivita.ts`), e l'elenco dei ruoli
 * che possono **aprire** quell'elenco stava in un altro (`coach-tasks.controller.ts`). I due non si
 * parlavano, e per un giorno la push le è arrivata mandandola davanti a un 403.
 *
 * ⚠️ Perciò la costante è una, e la usano tutti e tre i punti: la guardia del controller, il filtro
 * del servizio, i test. *Se due punti rispondono alla stessa domanda, uno dei due deve chiamare
 * l'altro.*
 *
 * ## ⚠️ I ruoli personalizzati SONO coperti — e qui c'era scritto il contrario
 *
 * La prima stesura dichiarava come «limite» che un ruolo personalizzato costruito sopra
 * `nutritionist` non fosse riconosciuto. **Non è vero, ed è stato misurato in revisione il 22/8**:
 * `UsersService.resolveRole` scrive nella colonna `role` il **`baseRole`** del ruolo personalizzato
 * e mette la chiave a parte, in `customRoleKey`. Quindi `eNutrizionista(user.role)` risponde `true`
 * anche per «Nutrizionista junior», e lo stesso vale per `isCoachLike` in `coach-team.ts`.
 *
 * ⛔ Un limite dichiarato e falso è peggio di un limite non dichiarato: manda il prossimo a mettere
 * una toppa dove non serve, e a non guardare dove serve.
 *
 * ⚠️ **Dove serve davvero**: il permesso di *pagina*. `PageGuard` cerca la riga con `user.role`
 * (il base), mentre `/me/permissions` — da cui il backoffice costruisce menu e rotte — usa
 * `customRoleKey ?? role`. Per un ruolo personalizzato l'API si apre e la **voce di menu no**,
 * finché la sua riga in `role_page_permission` non viene accesa: se ne occupa
 * `npm run apri:attivita-nutrizionista`, che cicla anche sui ruoli personalizzati.
 */
export const RUOLI_NUTRIZIONISTA = ['nutritionist', 'head_nutritionist'] as const;

export type RuoloNutrizionista = (typeof RUOLI_NUTRIZIONISTA)[number];

export function eNutrizionista(role: string | null | undefined): boolean {
  return role === 'nutritionist' || role === 'head_nutritionist';
}
