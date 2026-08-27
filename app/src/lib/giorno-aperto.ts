import { api, isOspite } from '../api/client';

/**
 * ⛔ **«HO APERTO QUESTO GIORNO»** — il segnale che l'app manda quando la cliente sta guardando il
 * menu di un giorno preciso (26/8, voce `visto-non-vuol-dire-aperto`).
 *
 * ## Perché esiste
 *
 * Il server aveva un solo dato, `viewedAt`, e lo scriveva su **tutti** i giorni della finestra a
 * ogni apertura dell'app: bastava aprire l'app una volta perché tutto il futuro risultasse «letto».
 * Su quel dato si regge «rifai i giorni già preparati» — quindi la nutrizionista che dettava
 * «niente pesce» leggeva «non ho toccato niente» mentre il branzino era nel menu di domani.
 *
 * ⚠️ **«Aperto» vuol dire che quel giorno è sullo schermo, coi pasti dentro**: la Home mostra quello
 * di oggi, il Menu mostra quello selezionato. Non vuol dire «l'app gliel'ha scaricato», che è la
 * domanda a cui `viewedAt` rispondeva — e che resta vera per conto suo.
 *
 * ## Tre precauzioni, e tutte e tre sono state pagate una volta
 *
 * ⚠️ **Una volta per giorno, finché l'app resta aperta**: si scorre il calendario avanti e indietro,
 * e ogni tocco farebbe una chiamata. Il server la scriverebbe una volta sola comunque (`first write
 * wins`), ma il traffico sarebbe suo malgrado.
 *
 * ⛔ **Dopo un errore si aspetta prima di riprovare.** La prima stesura toglieva il giorno
 * dall'elenco appena la chiamata falliva — e siccome `Menu.tsx` chiama questa funzione **a ogni
 * disegno**, con il server irraggiungibile diventava una richiesta per fotogramma: un anello caldo
 * sul telefono di chi ha già la rete che non va. `ATTESA_DOPO_UN_ERRORE` è il freno.
 * ⚠️ **Il rimando dipende da un disegno che potrebbe non arrivare**, e va detto: se lei resta ferma
 * su quella schermata e poi chiude l'app, quel segnale è perso e per il server quel giorno resta
 * «non lo so». Nessuno lo rifarà da solo, che è il degrado dalla parte giusta: si perde un
 * automatismo, non un menu.
 *
 * ⛔ **L'elenco è di CHI È COLLEGATO ADESSO.** «Passa all'altro profilo» cambia utente senza
 * ricaricare la pagina (madre e figlia sullo stesso telefono): con un elenco unico, il 27 già
 * segnato per la prima avrebbe zittito il segnale della seconda, e i suoi menu sarebbero rimasti
 * «non lo so» per sempre. `dimenticaAperture()` si chiama al logout e al cambio profilo.
 *
 * ⛔ **CHI GUARDA CON «ENTRA COME» NON APRE NIENTE.** Il backoffice apre questa stessa app con un
 * token di sola lettura sull'account di una cliente: senza questo controllo, una coach che dà
 * un'occhiata al menu di Anna le segnerebbe quei giorni come **aperti da lei**, e da quel momento
 * nessuna correzione automatica glieli toccherebbe più. Il segnale dice «l'ha aperto la cliente»:
 * se a guardare non è lei, non è successo niente.
 *
 * ⚠️ **Non fallisce mai in faccia a nessuno.** Se la chiamata va storta, il menu si legge lo stesso:
 * al massimo quel giorno resta «non lo so» per il server, e nessuno lo rifarà — il degrado dalla
 * parte giusta. Nessun `alert`, nessuno stato rotto.
 */
const ATTESA_DOPO_UN_ERRORE = 60_000;

/** I giorni già mandati (o in volo) per l'utente collegato adesso. */
const gia = new Set<string>();
/** Quando si può riprovare, per i giorni la cui chiamata è andata storta. */
const riprovaDopo = new Map<string, number>();

/** Si cambia utente: quello che sapevamo del precedente non vale più. */
export function dimenticaAperture(): void {
  gia.clear();
  riprovaDopo.clear();
}

export function segnaGiornoAperto(giornoIso: string | null | undefined): void {
  if (isOspite()) return; // «Entra come»: sta guardando lo staff, non la cliente
  const giorno = (giornoIso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) return;
  if (gia.has(giorno)) return;
  const attesa = riprovaDopo.get(giorno);
  if (attesa !== undefined && Date.now() < attesa) return;
  riprovaDopo.delete(giorno);
  gia.add(giorno);
  void api('/me/menu/aperto', { method: 'POST', body: JSON.stringify({ giorno }) }).catch(() => {
    // ⚠️ Si toglie dall'elenco — un errore di rete non deve far perdere il segnale per sempre — ma
    // non prima di `ATTESA_DOPO_UN_ERRORE`, altrimenti il prossimo disegno riprova subito.
    gia.delete(giorno);
    riprovaDopo.set(giorno, Date.now() + ATTESA_DOPO_UN_ERRORE);
  });
}
