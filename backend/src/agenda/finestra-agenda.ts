/**
 * ⚠️ **QUANTI GIORNI DI AGENDA SI MOSTRANO, SCRITTO UNA VOLTA SOLA.**
 *
 * Il numero stava a mano in due file: `agenda.controller.ts` (l'anteprima del nutrizionista) e
 * `prenotazioni.service.ts` (quello che vede la cliente). Sono la stessa finestra vista dai due lati
 * — è la ragione per cui `orariLiberi` è una funzione sola — e due `30` scritti separatamente sono
 * due numeri che un giorno divergono, con l'anteprima che mostra una settimana che alla cliente non
 * si può prenotare.
 *
 * ⚠️ **Non è `ORIZZONTE_GIORNI`** (`agenda.service.ts`), che è un'altra cosa: quello è il tetto
 * massimo oltre il quale `orariLiberi` taglia qualunque richiesta, anche una con gli estremi scritti
 * a mano. Questo è la vista **predefinita**, e sta sotto quel tetto.
 */
export const GIORNI_ANTEPRIMA_AGENDA = 30;
