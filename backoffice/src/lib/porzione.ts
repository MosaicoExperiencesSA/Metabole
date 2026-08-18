/**
 * LA SOGLIA DELLA PORZIONE, TERZA COPIA — e la prima che qualcuno aveva scritto a mano.
 *
 * Sotto questo fattore non si dice niente e non si mostra niente: un ×1,03 su 80 g di farro sono due
 * grammi, e un avviso che compare per due grammi si impara a saltare.
 *
 * ⚠️ Lo stesso numero vive in altri due posti, e i tre **devono** coincidere:
 *  - `backend/src/menu/porzione-scalata.ts` (`PORZIONE_DA_DIRE`) — decide se la scheda ricetta mostra
 *    le grammature scalate;
 *  - `app/src/lib/meals.ts` (`PORZIONE_DA_DIRE`) — decide la riga sotto il nome del piatto.
 *
 * Qui il numero era **scritto a mano** dentro `ClientDetail.tsx` (`meal.porzione > 1.05`), fuori da
 * qualunque test: il giorno che la nutrizionista chiedesse di alzarlo, la pastiglia «×1,1» nella
 * scheda cliente e la riga nell'app avrebbero detto due cose diverse **sullo stesso pasto** — e la
 * scheda è proprio il posto dove si va a capire se un 891 kcal è un errore di catalogo o una
 * porzione scalata. Trovato rileggendo la sera del 18/8.
 */
export const PORZIONE_DA_DIRE = 1.05;
