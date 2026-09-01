/**
 * «QUALI GIORNATE DI QUESTA CLIENTE HANNO FUNZIONATO MEGLIO?» — una domanda, una porta.
 *
 * ⚠️ Serve a due funzioni diverse, ed è per questo che nasce come modulo suo invece di restare
 * dentro chi la faceva per primo:
 *
 *  · **il kit di rientro** (`generateRientroMenus`): la cliente torna da una pausa col peso
 *    risalito, e le si ripropongono le giornate che su di lei avevano dato il calo migliore;
 *  · **Ritorno in Equilibrio** (§6.1, richiesta di Simone del 27/8): *«per chi ha già fatto un
 *    percorso con noi, un mese coi menu scelti tra quelli che hanno dato migliori risultati **e al
 *    cliente più graditi**»*.
 *
 * ⛔ **E le due domande NON sono la stessa**, che è la ragione per cui questa porta prende dei
 * pesi invece di rispondere in un modo solo. Il kit di rientro guarda il **peso**: chi rientra
 * sopra la sua linea vuole le giornate che l'hanno fatta scendere, che le siano piaciute o no.
 * Ritorno in Equilibrio è un mese intero a percorso finito, e un mese di piatti che non le
 * piacciono non lo finisce nessuno: lì il gusto conta quanto il risultato, e lo dice la richiesta.
 *
 * ⚠️ Il codice di prima aveva il **peso** in tre criteri a cascata e il gradimento **da nessuna
 * parte** — `RecipeRating` esiste dal primo giorno e non entrava in questa scelta.
 */

/** Una giornata già servita, coi segnali che si sono raccolti attorno a lei. */
export interface GiornataCandidata {
  /** Come si chiama questa giornata per chi chiama (di solito la data). Deve essere unica. */
  chiave: string;
  /**
   * Il calo di peso attorno a quella giornata, in kg. **Negativo = ha funzionato.**
   * `null` = non c'erano pesate abbastanza vicine: non lo sappiamo, e non vuol dire zero.
   */
  caloKg: number | null;
  /** La media delle stelle DATE ai piatti di quella giornata (1–5). `null` = nessuno ha votato. */
  gradimento: number | null;
  /** Quanto è recente, come numero crescente (di solito il tempo in ms). Serve solo a parità. */
  recenza: number;
}

/** Quanto contano i due segnali. Si dichiarano fuori: è la differenza fra le due funzioni. */
export interface Pesi {
  calo: number;
  gusto: number;
}

/** Il kit di rientro guarda il peso: chi rientra sopra la sua linea vuole scendere. */
export const PESI_RIENTRO: Pesi = { calo: 1, gusto: 0 };
/** Ritorno in Equilibrio: un mese di piatti che non le piacciono non lo finisce nessuno. */
export const PESI_RITORNO_IN_EQUILIBRIO: Pesi = { calo: 0.5, gusto: 0.5 };

/**
 * Porta un segnale su 0..1 confrontandolo con le ALTRE giornate della stessa cliente.
 *
 * ⚠️ Si confronta **dentro la cliente**, non contro una scala assoluta: mezzo chilo in una
 * settimana è tantissimo per una e poco per un'altra, e una soglia fissa direbbe la stessa cosa a
 * tutte e due. Qui la domanda è «quali delle SUE giornate hanno reso di più», che è relativa per
 * costruzione.
 *
 * ⛔ **Si usa il RANGO, non la distanza fra il minimo e il massimo** — e la prima stesura faceva
 * il contrario. Con `(v − min) / (max − min)`, due giornate che sono scese di 1,0 kg e di 0,9 kg
 * diventano **1 e 0**: una differenza di cento grammi, che nessuna nutrizionista chiamerebbe una
 * differenza, pesa quanto la distanza fra la migliore e la peggiore. E basta un'unica giornata
 * eccezionale — o una pesata sbagliata — perché tutte le altre si schiaccino in fondo alla scala e
 * diventino indistinguibili fra loro.
 *
 * ⚠️ Il rango perde la grandezza, ed è **voluto**: la domanda che gli si fa è «quali delle sue
 * giornate vengono prima», cioè una domanda di ordine. Dire quanto è stata migliore la prima non
 * serve a scegliere, e fingere di saperlo con questi dati sarebbe peggio.
 *
 * ⚠️ A pari valore si dà il **rango medio** invece di romperlo con l'ordine di lettura: due
 * giornate identiche devono avere lo stesso punteggio, e a decidere fra loro sarà la recenza.
 *
 * ⚠️ Se tutte le giornate hanno lo stesso valore, il segnale non distingue niente e vale 0.5 per
 * tutte: un segnale piatto non deve decidere l'ordine, deve farsi da parte.
 */
function normalizza(valori: readonly (number | null)[], meglioSeBasso: boolean): (number | null)[] {
  const noti = valori.filter((v): v is number => v !== null);
  if (noti.length === 0) return valori.map(() => null);
  const ordinati = [...noti].sort((a, b) => (meglioSeBasso ? a - b : b - a));
  if (Math.abs(ordinati[0] - ordinati[ordinati.length - 1]) < 1e-9) {
    return valori.map((v) => (v === null ? null : 0.5));
  }
  /** Il rango medio del valore: la media delle posizioni occupate dai suoi pari. */
  const rangoDi = new Map<number, number>();
  for (let i = 0; i < ordinati.length; i++) {
    const v = ordinati[i];
    if (rangoDi.has(v)) continue;
    let j = i;
    while (j + 1 < ordinati.length && Math.abs(ordinati[j + 1] - v) < 1e-9) j++;
    rangoDi.set(v, (i + j) / 2);
  }
  const ultimo = ordinati.length - 1;
  return valori.map((v) => (v === null ? null : 1 - (rangoDi.get(v) ?? 0) / ultimo));
}

/**
 * Il punteggio di ogni giornata, e l'ordine.
 *
 * ⛔ **UN SEGNALE ASSENTE NON È UNO ZERO.** Una giornata che nessuno ha votato non è una giornata
 * che è piaciuta poco: è una giornata di cui non sappiamo niente. Contarla zero vorrebbe dire
 * mettere in fondo proprio le giornate delle clienti che le stelle non le danno mai — cioè quasi
 * tutte. Vale la **media delle giornate che quel segnale ce l'hanno**: non premia e non punisce.
 *
 * ⛔ E se un segnale manca su TUTTE le giornate, il suo peso si **ridistribuisce** sugli altri
 * invece di aggiungere una costante a ognuna. Sommare 0.5 × peso a tutte non cambierebbe l'ordine,
 * ma renderebbe i punteggi non confrontabili fra una cliente che vota e una che non vota — e il
 * primo che li guardasse insieme concluderebbe che la seconda ha giornate peggiori.
 */
export function ordinaLeGiornate(
  candidate: readonly GiornataCandidata[],
  pesi: Pesi = PESI_RIENTRO,
): { giornata: GiornataCandidata; punteggio: number }[] {
  if (!candidate.length) return [];

  const cali = normalizza(candidate.map((c) => c.caloKg), true);
  const gusti = normalizza(candidate.map((c) => c.gradimento), false);

  const media = (v: readonly (number | null)[]): number | null => {
    const noti = v.filter((x): x is number => x !== null);
    return noti.length ? noti.reduce((s, x) => s + x, 0) / noti.length : null;
  };
  const mediaCalo = media(cali);
  const mediaGusto = media(gusti);

  // Il peso di un segnale che non esiste per nessuna giornata si ridistribuisce.
  const pesoCalo = mediaCalo === null ? 0 : Math.max(0, pesi.calo);
  const pesoGusto = mediaGusto === null ? 0 : Math.max(0, pesi.gusto);
  const totale = pesoCalo + pesoGusto;

  const punteggi = candidate.map((c, i) => {
    if (totale <= 0) return { giornata: c, punteggio: 0 };
    const calo = cali[i] ?? mediaCalo ?? 0;
    const gusto = gusti[i] ?? mediaGusto ?? 0;
    return { giornata: c, punteggio: (calo * pesoCalo + gusto * pesoGusto) / totale };
  });

  /**
   * ⚠️ A parità di punteggio vince la **più recente**, e non è un dettaglio: senza un criterio
   * dichiarato l'ordine sarebbe quello di lettura del database, cioè stabile finché non cambia
   * un indice. E una cliente che riceve due volte lo stesso mese di menu si accorge dell'ordine
   * prima che di qualunque punteggio.
   */
  return punteggi.sort((a, b) => b.punteggio - a.punteggio || b.giornata.recenza - a.giornata.recenza);
}

/**
 * Le prime `quante` giornate, senza doppioni di chiave.
 *
 * ⚠️ **Non riempie a forza.** Se le giornate buone sono meno di quante ne servono, se ne
 * restituiscono meno: chi chiama decide cosa fare del buco — il kit di rientro completa coi giorni
 * più recenti, e quella è una scelta sua, non di questa porta.
 */
export function leMigliori(
  candidate: readonly GiornataCandidata[],
  quante: number,
  pesi: Pesi = PESI_RIENTRO,
): GiornataCandidata[] {
  if (quante <= 0) return [];
  const viste = new Set<string>();
  const out: GiornataCandidata[] = [];
  for (const { giornata } of ordinaLeGiornate(candidate, pesi)) {
    if (viste.has(giornata.chiave)) continue;
    viste.add(giornata.chiave);
    out.push(giornata);
    if (out.length >= quante) break;
  }
  return out;
}
