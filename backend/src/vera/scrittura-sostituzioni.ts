/**
 * LA PORTA PER DECIDERE UNA SOSTITUZIONE — un token, non un `import` (voce 245).
 *
 * Stessa forma di `SCRITTURA_RICETTA` e `SCRITTURA_CLIENTE`, e per la stessa ragione pratica:
 * importare `FoodSwapsService` qui dentro trascinerebbe nel grafo di compilazione di ts-jest il
 * modulo delle sostituzioni e le sue notifiche, e i test di Vera smetterebbero di girare da soli
 * per colpa di un errore in un file che non c'entra.
 *
 * ⚠️ Il servizio vero resta **quello**, legato con `useExisting` in `VeraModule`: la riga si
 * aggiorna da `FoodSwapsService.aggiorna` — **lo stesso metodo del pulsante in scheda** — con lo
 * stesso audit e la stessa validazione dello stato. Una seconda porta per lo stesso dato è il
 * difetto che questa tabella ha già pagato due volte, e a voce sarebbe peggio: la strada nuova non
 * si vedrebbe da nessuna pagina.
 *
 * L'interfaccia dichiara **un metodo solo**, ed è anche il modo di dire — leggendo — che da qui non
 * si crea niente e non si promuove niente a regola: si conferma o si annulla una riga che esiste.
 */
export interface ScritturaSostituzioni {
  aggiorna(userId: string, id: string, dto: { stato?: string; nota?: string }): Promise<unknown>;
}

export const SCRITTURA_SOSTITUZIONI = 'VERA_SCRITTURA_SOSTITUZIONI';
