/**
 * «QUANTO MANCA ALL'OBIETTIVO?» — una domanda, una risposta.
 *
 * Il 18/8, rileggendo, sono saltati fuori **quattro** punti che rispondevano a questa domanda, e
 * ognuno con un conto suo (`progetto/DECISIONE_Due_Schermate_App.md` §2):
 *
 * | dove | come | chi lo legge |
 * |---|---|---|
 * | `progress.service` | **media mobile** | il motore, l'allarme di stallo della coach |
 * | `signals.widget` | ultima misura | la cliente, dalla home |
 * | `coach.service` (elenco clienti) | ultima misura | la coach |
 * | `app/Obiettivo.tsx` | ultima misura | la cliente, in «I tuoi obiettivi» |
 *
 * ⚠️ Non è una schermata mancante: sono **risposte diverse alla stessa domanda** sulla stessa
 * persona. La cliente vedeva una percentuale che balla con l'acqua — due etti di ritenzione e la
 * barra torna indietro in una giornata in cui non è successo niente — mentre il motore ne vedeva
 * un'altra, più stabile, e nessuno dei due sapeva dell'altro.
 *
 * ⚠️ **La risposta è la media mobile** (decisione di Simone, 19/8), perché è la regola scritta del
 * progetto: *si ragiona sempre sulla tendenza, mai sul singolo dato* (spec 7.2). Il prezzo, detto
 * ad alta voce: per qualche cliente il numero **cambia** il giorno del rilascio, e in qualche caso
 * all'indietro.
 *
 * ⚠️ La finestra è `moving_average_window` dai Parametri, e chi chiama la passa: qui non c'è nessun
 * default nascosto, perché un default nascosto è la quinta risposta.
 */
import { movingAverage, progressPercent } from './stats';

/**
 * ⚠️ IL TETTO DELLA FINESTRA, e il perché sta qui e non nei Parametri.
 *
 * `moving_average_window` è una chiave dei Parametri **senza minimo né massimo**: qualcuno può
 * scriverci 150 senza che niente lo fermi. Una media mobile su centocinquanta pesate non è una media
 * mobile — è la media di tutto — ma soprattutto **riaprirebbe le due risposte**: `progress.service`
 * legge al massimo le ultime 120 pesate, gli altri due chiamanti le prendono tutte, e con una
 * finestra più larga di 120 la stessa cliente tornerebbe ad avere due percentuali diverse.
 *
 * Il tetto è basso di proposito: trenta pesate sono un mese e mezzo di misure quotidiane, e nessuno
 * ha mai chiesto una tendenza più lunga di così.
 */
export const FINESTRA_MASSIMA = 30;

const finestraSensata = (f: number): number =>
  Math.min(FINESTRA_MASSIMA, Math.max(1, Math.floor(Number.isFinite(f) ? f : 1)));

export interface AvanzamentoPeso {
  /** La percentuale [0,100] verso il traguardo, o `null` se non si può dire. */
  percento: number | null;
  /** I chili persi rispetto alla partenza, **sulla media mobile**. Positivo = calo. */
  persiKg: number | null;
  /** Il peso «di adesso» come lo intende il progetto: la media mobile, non l'ultima pesata. */
  pesoDiAdesso: number | null;
}

/**
 * @param pesi   le pesate in ordine di data, dalla più vecchia alla più recente
 * @param start  il peso di partenza (`ClientProfile.startWeightKg`, o la prima pesata)
 * @param target il traguardo dall'obiettivo, o `null` se non l'ha impostato
 * @param finestra `moving_average_window` (Parametri)
 */
export function avanzamentoPeso(
  pesi: readonly number[],
  start: number | null | undefined,
  target: number | null | undefined,
  finestra: number,
): AvanzamentoPeso {
  const buoni = (pesi ?? []).filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  if (!buoni.length) return { percento: null, persiKg: null, pesoDiAdesso: null };

  /**
   * ⚠️ **Si guardano le ultime `finestra` pesate, e basta.** La media mobile di oggi dipende solo da
   * quelle: tagliarle qui vuol dire che **quanta storia pesca il chiamante non cambia il numero** —
   * e i tre chiamanti ne pescano quantità diverse (`progress.service` si ferma a 120 pesate, il
   * widget e la lista della coach le prendono tutte). Senza questo taglio, con una finestra grande
   * la stessa cliente tornerebbe ad avere due percentuali: il difetto che questo file esiste per
   * chiudere, rientrato dalla porta di servizio.
   */
  const larghezza = finestraSensata(finestra);
  const ultime = buoni.slice(-larghezza);
  const ma = movingAverage(ultime, larghezza);
  const adesso = Math.round(ma[ma.length - 1] * 100) / 100;

  // ⚠️ Il punto di partenza è quello del PROFILO quando c'è: è il peso con cui è cominciato il
  // percorso, e non cambia se la prima pesata viene corretta. La prima pesata è il ripiego per chi
  // il campo non ce l'ha (le clienti di prima) — e qui è `buoni[0]`, cioè la più vecchia che il
  // chiamante ha passato, non `ultime[0]`.
  const partenza = typeof start === 'number' && Number.isFinite(start) ? start : buoni[0];

  return {
    percento: typeof target === 'number' ? progressPercent(partenza, adesso, target) : null,
    persiKg: Math.round((partenza - adesso) * 10) / 10,
    pesoDiAdesso: adesso,
  };
}
