import { giornoItaliano, giornoLocale } from '../common/date-only';

/**
 * LA RIGA CHE RESTA IN SCHEDA QUANDO QUALCUNO TOCCA LE CALORIE DI UNA PERSONA.
 *
 * Decisione di Simone, 27/8, rispondendo alla domanda «chi autorizza l'aumento delle calorie»:
 * *«Vera lo chiede al nutrizionista che risponde, e la sua risposta si salva nelle note della scheda
 * cliente (aumento calorie autorizzato da… il…)»*.
 *
 * ## Perché una nota, se c'è già lo storico
 *
 * `kcal_override` c'è ed è completo — prima, dopo, motivo, chi, sotto soglia. ⚠️ Ma sta **dentro la
 * card delle calorie**, che è un posto dove va chi sta già pensando alle calorie. Le note della
 * scheda sono l'altro posto: è lì che la coach guarda per capire *cos'è successo a questa cliente*,
 * ed è la domanda che si fa fra tre mesi qualcuno che quella decisione non l'ha presa. Lo stesso
 * ragionamento del via libera clinico (`clients/idoneita.ts`), che scrive la sua nota nella lista
 * che esiste già invece di farsene una sua.
 *
 * ## ⛔ Il verso lo dice il TARGET, non il segno della percentuale
 *
 * La tentazione è scrivere «aumento» quando `correzionePct > 0`. Sbagliato: le leve sono **due** e
 * tirano in direzioni opposte. Togliere 200 kcal di **deficit** alza il piatto senza che nessuna
 * percentuale sia positiva; scrivere +5% mentre si aggiunge un deficit di 400 lo abbassa. ⚠️ E chi
 * rilegge la nota non vuole sapere quale leva è stata mossa: vuole sapere se quella persona ha
 * cominciato a mangiare **di più o di meno**. Per questo il verso si legge da `targetPrima` →
 * `targetDopo`, che è il numero che arriva nel piatto.
 *
 * ⚠️ Quando uno dei due target non si sa (profilo incompleto: manca sesso, età o altezza) non si
 * indovina: la nota dice «Calorie corrette da…», che è vero in tutti i casi. *Una ragione falsa è
 * peggio di un ordine sbagliato.*
 *
 * Modulo **puro**: si collauda con una tabella di valori, ed è il modo in cui questa frase resta una
 * sola anche quando le porte che la scrivono diventano tre.
 */

export interface DatiNotaKcal {
  /** Il target prima della modifica (kcal/giorno), `null` se non si sa. */
  targetPrima: number | null;
  /** Il target dopo la modifica, `null` se non si sa. */
  targetDopo: number | null;
  /** Il deficit imposto dopo la modifica, `null` = nessuno. */
  deficitKcal: number | null;
  /** La correzione percentuale dopo la modifica, `null` = nessuna. */
  correzionePct: number | null;
  /** Fino a quando vale la correzione, `null` = finché non la tolgono. */
  fino: Date | null;
  /** Per quanti giorni, se è stata scritta una durata. */
  perGiorni: number | null;
  /** Chi ha deciso, come lo legge una persona. */
  chi: string;
  /** Quando. */
  quando: Date;
  /** Il motivo, obbligatorio a monte. */
  motivo: string;
}

/** Chi ha deciso, quando non si riesce a risalire al nome: mai una riga senza un soggetto. */
export const CHI_SCONOSCIUTO = 'staff';

const numero = (n: number): string => String(Math.round(n));

/**
 * ⚠️ Il verso, dal target e non dalle leve. `null` quando uno dei due non si sa.
 */
export function versoKcal(prima: number | null, dopo: number | null): 'su' | 'giu' | 'fermo' | null {
  if (prima == null || dopo == null) return null;
  if (dopo > prima) return 'su';
  if (dopo < prima) return 'giu';
  return 'fermo';
}

const INTESTAZIONE: Record<'su' | 'giu' | 'fermo', string> = {
  // ⚠️ Le parole di Simone, alla lettera: «aumento calorie autorizzato da… il…».
  su: 'Aumento calorie autorizzato',
  giu: 'Riduzione calorie decisa',
  fermo: 'Calorie corrette',
};

/**
 * Cosa è stato scritto, in parole: la parte «(+10% per 7 giorni, fino al 04/09/2026)».
 *
 * ⚠️ Dice **anche quando non c'è scadenza**, e lo dice a parole («senza scadenza»): una correzione
 * a termine e una permanente sono due prescrizioni diverse, e il silenzio le fa sembrare uguali.
 * ⚠️ E quando non c'è più niente, lo dice: «tolta ogni correzione» — una nota che elenca zero cose
 * lascia credere che la modifica non sia avvenuta.
 */
export function cosaEStatoScritto(d: DatiNotaKcal): string {
  const pezzi: string[] = [];
  if (d.correzionePct != null && d.correzionePct !== 0) {
    const segno = d.correzionePct > 0 ? '+' : '−';
    const durata =
      d.fino && d.perGiorni
        ? ` per ${d.perGiorni} giorn${d.perGiorni === 1 ? 'o' : 'i'}, fino al ${giornoItaliano(d.fino)}`
        : ' senza scadenza';
    pezzi.push(`${segno}${Math.abs(d.correzionePct)}%${durata}`);
  }
  if (d.deficitKcal != null && d.deficitKcal > 0) {
    pezzi.push(`deficit ${numero(d.deficitKcal)} kcal/giorno scritto a mano`);
  }
  if (!pezzi.length) return 'tolta ogni correzione scritta a mano: si torna al calcolo automatico';
  return pezzi.join(', ');
}

/**
 * La nota, pronta per `ClientNote.body`.
 *
 * ⚠️ **Il «di quanto» sta dentro**, ed è una richiesta esplicita: *«Nella nota va anche DI QUANTO.
 * Una riga che dice chi e quando ma non cosa non serve a nessuno, o fra tre mesi è una firma su
 * niente»*.
 */
export function testoNotaKcal(d: DatiNotaKcal): string {
  const verso = versoKcal(d.targetPrima, d.targetDopo);
  const intestazione = INTESTAZIONE[verso ?? 'fermo'];
  const chi = d.chi.trim() || CHI_SCONOSCIUTO;
  const salto =
    d.targetPrima != null && d.targetDopo != null
      ? `da ${numero(d.targetPrima)} a ${numero(d.targetDopo)} kcal/giorno `
      : '';
  /**
   * ⚠️ **`giornoLocale` e non `giornoItaliano` diretto**: `quando` è un ISTANTE (adesso), non un
   * giorno salvato. `giornoItaliano` legge la data in UTC, quindi una decisione presa alle 00:30 di
   * Roma sarebbe finita in scheda **col giorno prima** — e questa nota esiste per rispondere alla
   * domanda «quando». La scadenza qui sotto invece è già un giorno (colonna DATE, mezzanotte UTC) e
   * va convertita direttamente, senza fuso.
   */
  return (
    `${intestazione} da ${chi} il ${giornoItaliano(giornoLocale(d.quando))}: ` +
    `${salto}(${cosaEStatoScritto(d)}). Motivo: «${d.motivo.trim()}».`
  );
}
