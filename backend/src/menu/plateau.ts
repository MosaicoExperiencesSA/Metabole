/**
 * «IL PESO NON SCENDE» — quando comanda l'efficacia, e quando comandano le stelle.
 *
 * Risposta di Simone (13/8, dalla pagina Lavori): «se abbiamo un problema di umore vincono le 5
 * stelle, se il problema è il peso che non scende o che è aumentato vince l'efficacia».
 *
 * Qui non c'è database: entrano le pesate, esce un sì o un no. È la riga che decide se domani nel
 * piatto di una persona arriva quello che le fa bene o quello che le piace, e una riga così si prova
 * con un elenco di casi, non a occhio dentro un servizio.
 */

/** Quante pesate consecutive senza calo servono. Decisione di Simone: tre. */
export const PESATE_PER_PLATEAU = 3;

/**
 * Vero se le ultime pesate dicono che il peso **non scende**.
 *
 * @param pesi i pesi in kg, dal **più recente al più vecchio** (come li restituisce una query
 *   ordinata per data discendente).
 *
 * ⚠️ **Soglia secca: conta solo «fermo o salito».** Scelta di Simone fra tre alternative. Un calo di
 * cinquanta grammi azzera il contatore, quindi chi cala pochissimo ma di continuo non fa mai
 * scattare l'efficacia — è il caso «sto dimagrendo pianissimo», ed è voluto che resti così.
 *
 * ⚠️ Servono **tre pesate**, cioè almeno tre misure: con due sole non si risponde, e nel dubbio si
 * risponde «no». Un plateau dichiarato su due numeri toglierebbe i piatti amati a chi si è appena
 * iscritta.
 */
export function pesoNonScende(pesi: readonly number[], minimo = PESATE_PER_PLATEAU): boolean {
  const validi = pesi.filter((p) => typeof p === 'number' && Number.isFinite(p) && p > 0);
  if (validi.length < minimo) return false;
  // Si guardano le prime `minimo` pesate (le più recenti) a due a due: la più recente non deve
  // essere più bassa di quella che la precede.
  for (let i = 0; i < minimo - 1; i++) {
    if (validi[i] < validi[i + 1]) return false;
  }
  return true;
}

/**
 * IL GIORNO DI CONFORTO DENTRO IL PLATEAU — la domenica.
 *
 * Decisione di Simone (13/8): quando ci sono **insieme** umore basso e peso fermo, comanda
 * l'efficacia, ma un giorno a settimana vincono le stelle.
 *
 * ⚠️ Un giorno **fisso e uguale per tutte**, non a rotazione e non calcolato dalla data di inizio:
 * così lo si può dire a voce alla cliente («la domenica vincono i piatti che ami») e la coach se lo
 * ricorda. Un giorno che si sposta da persona a persona sarebbe invisibile a tutte e due, e
 * nessuno può accorgersi che una regola sta funzionando se non sa quando aspettarsela.
 *
 * ⚠️ Vale **solo** quando il conforto sarebbe scattato da solo: non è un premio settimanale per
 * tutte. Chi ha il peso fermo e sta bene di morale non ha nessun giorno di stelle — non gli serve.
 */
export const GIORNO_CONFORTO = 0; // domenica, come `Date.getUTCDay()`

/**
 * ⚠️ **`getUTCDay`, non `getDay`** (25/8, allargando il censimento delle date). `giorno` è un
 * **valore-giorno**: mezzanotte UTC del giorno di Roma, come lo scrive `menu.service` sommando
 * millisecondi a `firstNewDate`. `getDay()` lo rileggerebbe nel fuso del **processo**: a UTC e a Roma
 * risponde domenica, con `APP_TIMEZONE` a ovest di Greenwich risponde **sabato** — cioè il giorno di
 * conforto cadrebbe il giorno prima di quello che si è detto a voce alla cliente.
 */
export function eGiornoDiConforto(giorno: Date): boolean {
  return giorno.getUTCDay() === GIORNO_CONFORTO;
}
