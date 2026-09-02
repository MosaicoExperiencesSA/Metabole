/**
 * ⛔ **QUANDO LA BASE PERSONALE VA RIFATTA — in un posto solo.**
 *
 * La base personale (`ClientMenuPool`) è l'elenco delle ricette che una cliente **può** ricevere,
 * costruito da `buildPersonalBase` a partire dal suo profilo. Da lì pescano il cambio di piatto in
 * chat e la giornata dettata dalla nutrizionista: se il profilo cambia e la base no, quelle due
 * porte servono piatti scelti secondo i dati **di ieri**.
 *
 * ## ⛔ Il difetto trovato il 2/9: due porte sulla stessa colonna, e una sola rifaceva
 *
 * `diag:fase9` ha mostrato Rosa, Arianna e Carla sulla famiglia **nuova** con la base **vecchia**
 * (una non l'aveva proprio). Non era un caso: sono state spostate dalla **scheda del backoffice**,
 * e `clients.service.updateClient` — la porta dello staff — non conosceva nemmeno
 * `PersonalBaseService`. La ricostruzione c'era **solo** in `profile.service.updateProfile`, cioè
 * quando è la cliente a toccare i suoi dati dall'app.
 *
 * ⚠️ È lo stesso schema del difetto dei panieri dell'1/9 — «due porte sulla stessa tabella, e solo
 * una controllava» — e per questo la condizione adesso sta qui, non copiata in due `if`.
 *
 * ## ⛔ L'elenco NON è «i campi della dieta»: è quello che la costruzione LEGGE
 *
 * `profile.service` guardava quattro campi (`regime`, `dietStyle`, `dietFamily`, `mealsPerDay`) e
 * `buildPersonalBase` ne legge **dieci**. ⚠️ Qui ne stanno **nove**: fuori resta
 * `assignedNutritionistId`, che serve solo a sapere **a chi** mandare la segnalazione quando la
 * base si blocca, non a decidere quali ricette sono sicure — metterlo farebbe ricostruire a ogni
 * riassegnazione, per niente. Mancavano invece:
 *
 * · **`pathType`** — 3 o 5 pasti: cambia la struttura, quindi le ricette;
 * · **`objective`** — dimagrimento o mantenimento: cambia la variante servita;
 * · **`allergies` e `allergiesOther`** — ⛔ e questo è il peggiore. La base è l'elenco delle
 *   ricette **sicure**: un'allergia aggiunta dalla scheda che non la rifà lascia dentro i piatti
 *   che la contengono, e chi pesca di lì non lo sa.
 *
 * ⚠️ **Se un giorno `buildPersonalBase` leggerà un campo in più, va aggiunto qui.** Un elenco che
 * resta indietro rispetto a quello che la costruzione guarda non dà un errore: dà una base che non
 * si rifà quando dovrebbe, ed è invisibile finché qualcuno non conta a mano.
 */

/**
 * I campi del profilo che, cambiando, cambiano **quali ricette** una cliente può ricevere.
 *
 * ⛔ **`fastingWindow` NON è «per completezza»** — la revisione del 2/9 ha corretto questa riga,
 * che diceva il falso. `clients.service` fa `Object.assign(profileData, orologioAzzerato())` prima
 * di confrontare, quindi il campo passa eccome da questa porta. E in un caso è **l'unico** che
 * salva la ricostruzione: quando il form rimanda `pathType` uguale a com'era mentre l'orologio ha
 * ancora residui scritti, `pathType` non risulta cambiato e `fastingWindow` sì.
 */
export const CAMPI_CHE_CAMBIANO_LA_BASE = [
  'regime',
  'dietStyle',
  'dietFamily',
  'mealsPerDay',
  'pathType',
  'objective',
  'allergies',
  'allergiesOther',
  'fastingWindow',
] as const;

/**
 * La base va rifatta, visti i campi **davvero cambiati** in questo salvataggio?
 *
 * ⛔ **CAMBIATI, non «mandati», e la differenza è già costata cara al progetto.** Il form della
 * scheda rimanda **tutti** i campi a ogni Salva: su «mandati» questa funzione risponderebbe sempre
 * sì, e la base si rifarebbe a ogni click. È la stessa trappola in cui era caduta la regola del
 * senza-glutine — che girava su ogni salvataggio e il 31/8 ha fatto risultare a Patrizia quattro
 * cambi di dieta in un'ora, tutti annullati tre righe dopo dentro la stessa richiesta.
 *
 * ⚠️ Chi chiama passa quindi l'esito di un confronto prima/dopo (`common/diff-campi.ts`), non le
 * chiavi del DTO.
 */
export function laBaseVaRifatta(campiCambiati: Iterable<string> | null | undefined): boolean {
  if (!campiCambiati) return false;
  const quali = new Set<string>(CAMPI_CHE_CAMBIANO_LA_BASE);
  for (const k of campiCambiati) if (quali.has(k)) return true;
  return false;
}
