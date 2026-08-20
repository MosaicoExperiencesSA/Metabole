/**
 * L'IBAN SU CUI FINISCE UN BONIFICO VERO.
 *
 * Il controllo che c'era (`payouts.service.ts`, 12/8) era la lunghezza: fra 15 e 34 caratteri.
 * ⛔ Passa qualunque cosa. Una cifra sbagliata, due cifre invertite, una `O` al posto di uno `0`
 * danno un IBAN lungo giusto — e quello che succede dopo non è un errore a schermo: è un operatore
 * che fa un bonifico. Nel caso migliore la banca lo respinge dopo giorni; nel caso peggiore
 * l'IBAN esiste ed è di qualcun altro.
 *
 * ⚠️ È la stessa specie di problema delle kcal scritte `8OO`: un dato che *sembra* buono costa più
 * di un dato che manca, perché nessuno lo va a ricontrollare.
 *
 * ## Cosa controlla, e cosa no
 *
 * La **cifra di controllo mod-97** (ISO 13616) è pensata esattamente per questo: intercetta ogni
 * errore di una cifra sola e quasi tutte le inversioni di due cifre adiacenti. Non dice che il
 * conto esiste, e non può: dice che quello che è stato digitato non è il risultato di un refuso.
 *
 * ⚠️ **La lunghezza per paese si controlla solo dove la sappiamo.** L'elenco qui sotto copre i
 * paesi SEPA in cui questa azienda paga davvero; per gli altri resta il solo mod-97. Rifiutare un
 * IBAN di un paese che non abbiamo in tabella vorrebbe dire bloccare un pagamento legittimo per
 * ignoranza nostra — *«non lo so» deve costare meno di «ho indovinato»*.
 */

/** Lunghezza ufficiale dell'IBAN, per i paesi in cui paghiamo. Fuori da qui: solo il mod-97. */
const LUNGHEZZE: Record<string, number> = {
  IT: 27, SM: 27, VA: 22, // Italia, San Marino, Città del Vaticano
  AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, ES: 24,
  FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26, LI: 21, LT: 20,
  LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24,
  SI: 19, SK: 24,
};

/** Togli spazi e punteggiatura, tutto maiuscolo. È come le persone lo scrivono davvero. */
export function normalizzaIban(grezzo: string): string {
  return (grezzo ?? '').replace(/[\s.\-_]/g, '').toUpperCase();
}

export type EsitoIban = { valido: true; iban: string } | { valido: false; perche: string };

/**
 * Il resto della divisione per 97 di un numero lungo fino a 70 cifre.
 *
 * A pezzi di **sette**, non di nove: il resto precedente vale al massimo 96, quindi il numero che
 * si costruisce a ogni giro ha al massimo 2 + 7 = 9 cifre — sotto i 2^53 che `Number` regge senza
 * perdere niente. Con pezzi più lunghi il conto comincerebbe ad arrotondare, e un mod-97 che
 * arrotonda dice «valido» a IBAN che non lo sono: cioè il contrario di quello che serve.
 */
function modulo97(cifre: string): number {
  let resto = 0;
  for (let i = 0; i < cifre.length; i += 7) {
    resto = Number(String(resto) + cifre.slice(i, i + 7)) % 97;
  }
  return resto;
}

/**
 * ⚠️ Il messaggio è quello che legge la persona mentre sta chiedendo i suoi soldi: dice **cosa**
 * non va, non «IBAN non valido». Chi vede «non valido» ricontrolla e ridigita lo stesso identico
 * numero, perché a occhio è giusto.
 */
export function controllaIban(grezzo: string): EsitoIban {
  const iban = normalizzaIban(grezzo);
  if (!iban) return { valido: false, perche: 'Manca l\'IBAN.' };
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) {
    return { valido: false, perche: 'L\'IBAN comincia con due lettere del paese e due cifre di controllo (per l\'Italia: IT più due numeri).' };
  }
  if (iban.length < 15 || iban.length > 34) {
    return { valido: false, perche: `Un IBAN ha fra 15 e 34 caratteri, questo ne ha ${iban.length}.` };
  }
  const paese = iban.slice(0, 2);
  const attesa = LUNGHEZZE[paese];
  if (attesa !== undefined && iban.length !== attesa) {
    return {
      valido: false,
      perche: `Un IBAN ${paese} ha ${attesa} caratteri, questo ne ha ${iban.length}: probabilmente ne manca uno o ce n'è uno di troppo.`,
    };
  }
  // ISO 13616: i primi quattro caratteri vanno in fondo, le lettere diventano numeri (A=10 … Z=35),
  // e il numero che ne esce deve dare resto 1 diviso 97.
  const ruotato = iban.slice(4) + iban.slice(0, 4);
  const cifre = ruotato.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  if (modulo97(cifre) !== 1) {
    return {
      valido: false,
      perche: 'Le cifre di controllo non tornano: c\'è un carattere sbagliato o due invertiti. Ricopialo dal documento della banca invece che a memoria.',
    };
  }
  return { valido: true, iban };
}
