/**
 * LE ALLERGIE DICHIARATE — come si scrivono, una volta sola.
 *
 * Punti B e C dell'handoff (`progetto/HANDOFF_Allergie_Intolleranze.md`). Sta qui e non dentro
 * `onboarding.service` perché lo stesso calcolo servirà al dialogo con Gaia che ri-chiede le
 * allergie alle clienti già iscritte: due copie di una regola su un dato sanitario è esattamente
 * quello che questo progetto passa le giornate a disfare.
 *
 * ## Le tre cose che questa funzione mette a posto
 *
 * 1. **«altro» non è un alimento.** È un flag d'interfaccia — fa comparire il campo libero — e
 *    veniva tolto *soltanto dal client React*. Una chiamata diretta all'endpoint, o un'app vecchia,
 *    salvava «altro» come allergene, ed `expandExclusion('altro')` andava a cercare quella parola
 *    nei nomi dei piatti. Una regola sui dati non si tiene nel client: il client può essere vecchio,
 *    e su un dato sanitario «vecchio» vuol dire «per sempre», perché il questionario non si rifà.
 *
 * 2. **Il testo libero si sa che è testo libero.** Prima veniva concatenato dentro `allergies` e la
 *    sua natura si perdeva; `personal-base` la ricostruiva per differenza col catalogo UE. Funziona
 *    finché un codice UE non cambia nome, e allora un'allergia codificata diventa «da codificare»
 *    (o viceversa) senza che nessuno se ne accorga.
 *
 * 3. **«Non ne ho» diventa distinguibile da «non ho risposto».**
 *
 * ## ⚠️ Perché il testo libero resta ANCHE dentro `allergies`
 *
 * Verrebbe da spostarlo: `allergies` i codici, `allergiesOther` il testo. Ma **sette punti del
 * codice** leggono `allergies` per escludere davvero gli alimenti — il generatore dei menu, i
 * sostituti proposti da Gaia (due punti), la base personale, il report, il CRM, la scheda cliente.
 * Spostare il testo libero altrove li disarmerebbe tutti insieme, e in silenzio: sarebbe rifare in
 * grande il difetto che questo lavoro chiude — `frutta_a_guscio`, un'allergia dichiarata che non
 * escludeva niente.
 *
 * Quindi `allergiesOther` è un **marcatore**, non uno spostamento. È una ridondanza, sì — ma scritta
 * da un punto solo, verificata da un test, e costa meno di sette letture da ricordarsi di
 * aggiornare, con una che se dimenticata non dà nessun errore.
 */

/**
 * Le voci che NON sono alimenti: flag d'interfaccia e risposte «nessuna». Si tolgono da quello che
 * finisce in banca dati come allergene.
 *
 * ⚠️ `'other'` è qui perché fra le ALLERGIE è il gemello inglese di «altro». Fra le INTOLLERANZE
 * invece non si tocca: là non esiste un campo libero associato, quindi quella stringa è l'unica
 * traccia del fatto che la cliente ha un'intolleranza che noi non sappiamo — ed è la popolazione
 * più urgente da ricontattare. Toglierla cancellerebbe la sola cosa che permette di trovarla.
 */
export const NON_ALIMENTI = new Set(['altro', 'other', 'nessuna', 'nessuno', 'none', 'no']);

const pulita = (v: string | null | undefined): string => (v ?? '').trim();
const eNonAlimento = (v: string): boolean => NON_ALIMENTI.has(v.toLowerCase());

export interface AllergieDichiarate {
  /** Tutto quello che va evitato: codici UE **e** testo libero. È l'array che escludono i menu. */
  allergies: string[];
  /** Solo il testo libero, per sapere che va codificato a mano. Sottoinsieme di `allergies`. */
  allergiesOther: string[];
  /** Quando la domanda ha avuto una risposta. `null` = non risulta che sia stata fatta. */
  allergieDichiarateIl: Date | null;
}

/**
 * @param scelte      Le caselle spuntate nel questionario (codici UE, più il flag «altro»).
 * @param testoLibero Quello che ha scritto nel campo libero.
 * @param quando      L'istante della risposta.
 *
 * ⚠️ La domanda si considera **fatta** solo se è arrivata almeno una voce — un allergene o un
 * esplicito «nessuna». Un array vuoto resta «non risposto»: nessun campo di quella pagina è
 * obbligatorio, quindi ci si passa sopra senza rispondere, e non si può distinguere chi ha detto
 * «non ne ho» da chi ha premuto Avanti. Finché il questionario non ha l'opzione «nessuna»
 * esplicita, il caso ambiguo va contato con i dubbi, non con i sicuri: è il senso della colonna.
 */
export function allergieDichiarate(
  scelte: string[] | null | undefined,
  testoLibero: string[] | null | undefined,
  quando: Date,
): AllergieDichiarate {
  const spuntate = (scelte ?? []).map(pulita).filter(Boolean);
  const libere = (testoLibero ?? []).map(pulita).filter(Boolean).filter((a) => !eNonAlimento(a));
  const codificate = spuntate.filter((a) => !eNonAlimento(a));

  // Doppioni via: se scrive «fragole» nel campo libero e per qualche motivo arriva anche fra le
  // scelte, in banca dati ci va una volta sola.
  const allergies = [...new Set([...codificate, ...libere])];

  return {
    allergies,
    allergiesOther: libere.filter((a) => !codificate.some((c) => c.toLowerCase() === a.toLowerCase())),
    allergieDichiarateIl: spuntate.length > 0 || libere.length > 0 ? quando : null,
  };
}

/**
 * Le allergie che **nessuno ha ancora codificato**: sono quelle che bloccano la base personale
 * sicura e quelle che il nutrizionista deve tradurre in codici UE.
 *
 * Prende `allergiesOther` se c'è, e altrimenti ricade sulla vecchia deduzione per differenza col
 * catalogo — che serve alle clienti iscritte prima di questa colonna, dove `allergiesOther` è vuota
 * per costruzione e non per assenza di testo libero. ⚠️ Le due risposte non coincidono, ed è
 * voluto: la deduzione è un'ipotesi, la colonna è un fatto. Quando c'è il fatto, si usa quello.
 */
export function allergieDaCodificare(
  allergies: string[] | null | undefined,
  allergiesOther: string[] | null | undefined,
  codiciNoti: readonly string[],
): string[] {
  const marcate = (allergiesOther ?? []).filter(Boolean);
  if (marcate.length) return marcate;
  const noti = new Set(codiciNoti.map((c) => c.toLowerCase()));
  return (allergies ?? []).filter((a) => a && !noti.has(a.toLowerCase()));
}
