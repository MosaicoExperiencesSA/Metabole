/**
 * DA QUANTO IL MENU È FERMO — il dato che c'era e non si vedeva.
 *
 * `GET /me/measurement-gate` risponde da sempre con `since`: il momento in cui la pesata è
 * diventata dovuta. Nessuna schermata lo leggeva. Il riquadro diceva «App in pausa — contatta la
 * tua coach», e basta.
 *
 * ⚠️ La differenza fra le due frasi non è cosmetica. «App in pausa» è uno stato senza storia: chi
 * lo legge non sa se è successo stamattina o se va avanti da una settimana, e non ha modo di
 * capire quanto sta perdendo. «Il menu è fermo da tre giorni» è un fatto, e dai fatti si decide.
 * È l'ultimo pezzo del giro del 16/8 sui dati che agiscono senza farsi vedere (voce 253).
 *
 * ⚠️ E quando `since` non c'è, questa funzione torna `null` invece di dire «da 0 giorni». Non
 * saperlo e «è appena successo» sono due cose diverse: inventare la seconda per non lasciare un
 * buco è esattamente il difetto che il resto del progetto sta togliendo.
 */

const GIORNO_MS = 86_400_000;

/** Mezzanotte locale: i giorni si contano per calendario, non a multipli di 24 ore. Chi si blocca
 *  alle 23 e guarda l'app alle 8 del mattino dopo ha perso **un giorno**, non zero. */
const aMezzanotte = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * «da oggi» · «da ieri» · «da 5 giorni» · «da 2 settimane».
 *
 * `null` quando la data non c'è o non si legge: chi chiama non scrive niente, e la frase resta
 * quella di prima invece di diventare falsa.
 */
export function daQuantoFermo(since?: string | null, adesso: Date = new Date()): string | null {
  if (!since) return null;
  const d = new Date(since);
  if (Number.isNaN(d.getTime())) return null;
  const giorni = Math.floor((aMezzanotte(adesso) - aMezzanotte(d)) / GIORNO_MS);
  // ⚠️ Una data nel futuro non è «da -2 giorni»: è un dato che non torna, e su un dato che non
  // torna si tace. Meglio la frase di prima che una frase sbagliata.
  if (giorni < 0) return null;
  if (giorni === 0) return 'da oggi';
  if (giorni === 1) return 'da ieri';
  if (giorni < 14) return `da ${giorni} giorni`;
  const settimane = Math.floor(giorni / 7);
  return `da ${settimane} settimane`;
}

/**
 * La riga del riquadro «App in pausa», con dentro il da quanto se lo sappiamo.
 *
 * ⚠️ La via d'uscita resta **prima** della coach: «inserisci qui le misure e riparte subito» è
 * quello che la cliente può fare adesso, da sola. Metterlo dopo «contatta la tua coach» la manda
 * ad aspettare una risposta per una cosa che le costa trenta secondi.
 */
export function frasePausaMenu(since?: string | null, adesso: Date = new Date()): string {
  const quanto = daQuantoFermo(since, adesso);
  const inizio = quanto
    ? `Il tuo menu è fermo ${quanto}, in attesa della pesata.`
    : 'Il tuo menu è in attesa della pesata.';
  return `${inizio} Inserisci qui le misure e riparte subito, oppure contatta la tua coach.`;
}
