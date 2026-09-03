/**
 * ⛔ **AL RIENTRO, IL RIFERIMENTO È IL PESO DI PRIMA DI QUEL MOMENTO — NON I PIANI PRECEDENTI.**
 *
 * Regola di Simone, 3/9, in risposta a due voci dei lavori che chiedevano la stessa cosa da due
 * parti diverse: *«Quando uno rientra noi consideriamo sempre il peso del giorno prima dell'inizio
 * di quel momento e non dei piani precedenti»*. E, sulla seconda: *«Sì esatto»* — cioè anche le
 * porzioni del kit di rientro partono da lì, non dalla tendenza.
 *
 * ## Cosa risolve, e perché una regola sola per due difetti
 *
 * · **Il fabbisogno.** La media mobile guarda novanta giorni. Chi sospende un mese e torna si porta
 *   dentro la media le pesate del piano di prima — cioè il corpo di due mesi fa — e le calorie nel
 *   piatto escono da una miscela di due periodi che non si somigliano.
 * · **Il kit di rientro.** Parte perché l'**ultima** pesata è un salto, e poi riporziona sulla
 *   **media**, che quel salto lo diluisce: riferimento 68, pesate 68,2 / 68,0 / 71,0 → il kit parte
 *   perché è salita di 3 chili e le porzioni sono tarate come se ne avesse ripresi 1,07.
 *
 * ⚠️ Sono lo stesso difetto visto da due porte: al rientro **la tendenza è vecchia per
 * definizione**, perché nel mezzo non c'è stato niente da cui fare tendenza.
 *
 * ## ⛔ La pesata di riferimento si TIENE, non si scarta
 *
 * «Non dei piani precedenti» non vuol dire «solo da qui in poi». Se si buttasse tutto, chi rientra e
 * digita un numero sbagliato resterebbe con **una pesata sola**: nessuna coppia, nessun confronto,
 * e il fabbisogno calcolato su quel numero. Il riferimento — *«il peso del giorno prima dell'inizio
 * di quel momento»* — è la sola cosa che si porta dietro, ed è quello che rende possibile accorgersi
 * dell'errore.
 *
 * ## ⚠️ Quello che questo modulo NON decide
 *
 * Non sceglie **quando** l'inizio è: lo passa chi chiama, che sa se il momento è la fine di una
 * sospensione, l'inizio di un piano o l'apertura di un monitoraggio. Tenerlo qui vorrebbe dire
 * scrivere una seconda volta una regola che vive nel dominio di qualcun altro.
 *
 * Modulo **puro**: nessuna dipendenza, si collauda con una tabella di date e numeri.
 */
import type { PesataPerCoerenza } from './peso-incoerente';

export interface PesateDelPeriodo {
  /**
   * ⛔ **Il riferimento: l'ultima pesata PRIMA dell'inizio.** `null` quando non ce n'è — una cliente
   * nuova, o una che non si era mai pesata. `null` non è «zero»: chi lo legge deve dire «non lo so».
   */
  riferimento: PesataPerCoerenza | null;
  /** Le pesate dal rientro in poi, dalla più vecchia alla più recente. */
  delPeriodo: PesataPerCoerenza[];
  /**
   * ⚠️ Quante pesate sono state lasciate fuori perché di periodi precedenti. Si **dice**, non si
   * nasconde: *niente tagli silenziosi*. Chi legge un fabbisogno calcolato su due pesate invece che
   * su otto deve poter sapere perché.
   */
  scartate: number;
}

const perData = (a: PesataPerCoerenza, b: PesataPerCoerenza) => a.date.getTime() - b.date.getTime();

const valida = (p: PesataPerCoerenza): boolean =>
  !!p && p.date instanceof Date && Number.isFinite(p.date.getTime()) && Number.isFinite(p.weightKg);

/**
 * Divide le pesate in «prima» e «dopo» l'inizio del periodo.
 *
 * ⚠️ **Le pesate si riordinano qui dentro** invece di pretenderle ordinate, come fa
 * `saltiImpossibili`: chi chiama le legge da query diverse (`desc` per il fabbisogno, `asc` per gli
 * alert) e un ordinamento sbagliato non darebbe un errore, darebbe il riferimento sbagliato.
 *
 * ⚠️ **Il confine è incluso nel periodo nuovo**: una pesata fatta *il giorno stesso* del rientro è
 * del periodo nuovo, non del precedente. È il verso giusto: quella pesata la persona l'ha fatta
 * tornando, e descrive il corpo di adesso.
 *
 * ⛔ `inizio` nullo (nessun rientro noto) vuol dire **non dividere niente**: tutte le pesate sono
 * del periodo, e il riferimento è `null`. Un modulo che «per prudenza» tagliasse anche senza sapere
 * dove tagliare toglierebbe dati a chi non ha mai sospeso.
 */
export function pesateDaContare(
  pesate: readonly PesataPerCoerenza[],
  inizio: Date | null | undefined,
): PesateDelPeriodo {
  const buone = (pesate ?? []).filter(valida).slice().sort(perData);
  if (!inizio || !(inizio instanceof Date) || !Number.isFinite(inizio.getTime())) {
    return { riferimento: null, delPeriodo: buone, scartate: 0 };
  }
  const soglia = inizio.getTime();
  const prima = buone.filter((p) => p.date.getTime() < soglia);
  const dopo = buone.filter((p) => p.date.getTime() >= soglia);
  return {
    riferimento: prima.length ? prima[prima.length - 1] : null,
    delPeriodo: dopo,
    // ⚠️ Il riferimento NON è scartato: è tenuto, e non va contato fra le escluse.
    scartate: Math.max(0, prima.length - 1),
  };
}

/**
 * ⛔ **IL PESO CHE VALE ADESSO, al rientro.**
 *
 * Dal periodo nuovo, se c'è qualcosa; altrimenti il riferimento — che è *«il peso del giorno prima
 * dell'inizio di quel momento»*, cioè esattamente quello che la regola dice di usare finché la
 * persona non si ripesa.
 *
 * ⚠️ **È l'ULTIMA pesata del periodo, non la media.** Serve al kit di rientro, che parte *perché*
 * l'ultima pesata è un salto: il trigger e le porzioni guardavano **due numeri diversi nella stessa
 * esecuzione**, ed è quella l'incoerenza — non la direzione dello scarto.
 *
 * ⛔ **E la direzione va detta giusta, perché avevo scritto il contrario.** Il target non cresce col
 * peso in tutti i regimi: `kcal-need.service.ts` scrive che la derivata è `10·PAL − 1100/settimane`,
 * cioè **negativa** nel regime dominante (dimagrimento con obiettivo e data, tetto che non morde).
 * Lì vedere la cliente più pesante vuol dire darle **meno** calorie, non più. Nei regimi a derivata
 * positiva (mantenimento, deficit di default) lo scarto vale una ventina di kcal al giorno. In
 * nessuno dei due casi «arrivano porzioni più basse a chi è risalita» era una frase vera.
 */
export function pesoCheValeAlRientro(p: PesateDelPeriodo): number | null {
  if (p.delPeriodo.length) return p.delPeriodo[p.delPeriodo.length - 1].weightKg;
  return p.riferimento ? p.riferimento.weightKg : null;
}

/**
 * ⚠️ **QUI C'ERA `saltoAttraversoIlRientro`, ED È STATA TOLTA — 3/9, in revisione.**
 *
 * Giudicava il salto attraverso un rientro sul **solo** salto in chili, togliendo la condizione sul
 * ritmo, e si presentava come «nessuna soglia nuova: riuso quella dei Parametri». ⛔ Non era vero:
 * togliere quella condizione **è** cambiare la regola, e `peso-incoerente.ts` scrive per esteso che
 * la versione senza era già stata provata e buttata — «dieci chili in due mesi suonerebbero, ed è un
 * percorso riuscito, non un errore».
 *
 * ⚠️ La voce `pesate-lontane-buco-del-ritmo` dice *«la soglia è clinica e non la scegliamo noi»*, e
 * la risposta di Simone del 3/9 dà il **riferimento** al rientro, non una soglia d'allarme. Il buco
 * resta aperto e la domanda è più stretta di prima: *sopra quanti chili, attraverso una
 * sospensione, si smette di fidarsi del numero?*
 *
 * ⛔ Non si riscrive «tanto il modulo c'era»: una funzione esportata che non chiama nessuno è
 * l'interruttore che non accende niente — il difetto di `assignments`, che questo progetto ha già
 * pagato una volta.
 */
