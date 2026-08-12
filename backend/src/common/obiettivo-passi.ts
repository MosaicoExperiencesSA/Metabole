/**
 * QUANTI PASSI AL GIORNO — su misura, e in un posto solo.
 *
 * Domanda di Simone (12/8): «il numero di passi potrebbe essere una variabile bilanciata per
 * cliente?». Sì: `StepLog.goal` è già scritto riga per riga, quindi un obiettivo diverso per persona
 * non richiede nessuna migrazione. E i dati servono ce li ha già il questionario — in particolare
 * `activityLevel`, le cinque fasce che usiamo pure per il fabbisogno calorico.
 *
 * ## ⚠️ A chi si muove meno si chiede MENO, e non è un errore
 *
 * Sembra il contrario di quello che serve: proprio chi è sedentaria dovrebbe camminare di più. Ma un
 * obiettivo si misura da quante volte viene raggiunto, non da quanto è ambizioso: 10.000 passi al
 * primo giorno a chi ne fa 3.000 non la fa camminare, le fa chiudere la schermata. È la stessa
 * lezione dello stato «conforto» — un numero che non si può prendere smette di essere un obiettivo e
 * diventa una cosa da ignorare.
 *
 * Quindi si parte da dove è, e si sale.
 *
 * ## ⚠️ Il passo successivo è la SUA storia, e oggi non si può fare
 *
 * Il modo che funziona davvero è la mediana dei suoi ultimi 14-28 giorni più un 10-20%: taratura su
 * di lei, che cresce con lei. Ma `StepLog.source` prevede `healthkit` e `google_fit` col commento
 * «(futuro)»: oggi si scrive **solo `manual`**, cioè i passi li digita a mano. Una mediana calcolata
 * su tre giorni inseriti a caso non è la sua abitudine — è rumore con l'aria di un dato. Si passa
 * alla storia quando i passi arrivano dal telefono, e questo file è il punto in cui aggiungerlo.
 *
 * ⚠️ La scala dei numeri va confermata da Nocanty: per chi ha problemi cardiaci, articolari o è in
 * gravidanza prescrivere passi è materia clinica, non di prodotto.
 */

/** Il punto di partenza per ciascuna fascia di attività del questionario. */
export const PASSI_PER_ATTIVITA: Record<string, number> = {
  sedentary: 6000,
  light: 7000,
  moderate: 8000,
  active: 10000,
  very_active: 12000,
};

/**
 * Di quanto si sale, e ogni quanto.
 *
 * Un incremento del 5% ogni due settimane è abbastanza piccolo da non farsi notare come una
 * richiesta in più, e abbastanza continuo da portare una sedentaria da 6.000 a 8.000 in un paio di
 * mesi. ⚠️ Il tetto c'è perché una progressione senza fine finisce sempre nello stesso posto: un
 * numero che non si raggiunge mai.
 */
export const INCREMENTO = 0.05;
export const GIORNI_PER_INCREMENTO = 14;
export const TETTO_INCREMENTI = 8; // +40% sul punto di partenza

/** Arrotonda a 250 passi: un obiettivo di 7.437 sembra il risultato di un calcolo, non una meta. */
const arrotonda = (n: number): number => Math.round(n / 250) * 250;

export interface DatiObiettivoPassi {
  /** La fascia dichiarata nel questionario. */
  activityLevel?: string | null;
  /** Da quanti giorni è iniziato il percorso. Serve a sapere quanti scatti sono maturati. */
  giorniDiPercorso?: number | null;
}

/**
 * L'obiettivo di oggi.
 *
 * @param base Il valore globale (`steps_goal` dai Parametri): è il ripiego quando la fascia non c'è,
 *   e resta il numero che decide tutto se un domani si volesse tornare a un obiettivo unico.
 */
export function obiettivoPassi(dati: DatiObiettivoPassi, base: number): number {
  const partenza = (dati.activityLevel && PASSI_PER_ATTIVITA[dati.activityLevel]) || base;
  const giorni = Math.max(0, dati.giorniDiPercorso ?? 0);
  const scatti = Math.min(TETTO_INCREMENTI, Math.floor(giorni / GIORNI_PER_INCREMENTO));
  return arrotonda(partenza * (1 + INCREMENTO * scatti));
}

/**
 * Vero se l'obiettivo di oggi è più alto di quello di partenza: serve a dire alla cliente **perché**
 * il numero è cambiato. Un obiettivo che sale da solo, senza una riga che lo spieghi, si legge come
 * un guasto — «ieri erano 8.000, oggi 8.400».
 */
export function eCresciuto(dati: DatiObiettivoPassi, base: number): boolean {
  const partenza = (dati.activityLevel && PASSI_PER_ATTIVITA[dati.activityLevel]) || base;
  return obiettivoPassi(dati, base) > arrotonda(partenza);
}
