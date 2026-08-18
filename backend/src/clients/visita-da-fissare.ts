/**
 * «SERVE UNA VISITA» — DETTO A QUALCUNO CHE PUÒ FISSARLA.
 *
 * ## Il buco
 *
 * La nutrizionista apre la scheda, sceglie **«serve una visita»**, scrive la nota obbligatoria e
 * salva. Da lì in poi: la decisione è scritta sul profilo, la nota è nella lista note, le
 * segnalazioni cliniche si chiudono. E **la visita non la fissa nessuno**. Non c'è un appuntamento,
 * non c'è un compito, non c'è un messaggio: l'unico modo perché succeda qualcosa è che qualcuno si
 * ricordi di guardare quella scheda. ⚠️ Ed è una decisione **clinica**: è il caso in cui «me ne
 * ricorderò» costa di più.
 *
 * ## Perché un'attività della coach, e non un appuntamento creato da solo
 *
 * Un appuntamento si crea con un orario, e l'orario non ce l'abbiamo: dipende dall'agenda della
 * nutrizionista e da quando può la cliente. Scriverne uno a caso vorrebbe dire mettere in calendario
 * una cosa che qualcuno dovrà disdire. ⚠️ E c'è un secondo cancello che rende impossibile
 * l'automatismo: `prenotazioni.service` lascia prenotare **solo chi una visita l'ha comprata**
 * (Simone, 12/8). Se non ce l'ha, la strada non finisce con un orario ma con un acquisto — e questo
 * è esattamente il tipo di cosa che una persona deve dire a un'altra persona.
 *
 * Quindi: l'attività della coach, che è il posto dove in questo progetto una cosa da fare diventa
 * lavoro di qualcuno (stessa scelta di `finestra-mai-chiesta.ts`).
 *
 * ## ⚠️ Il numero che cambia la telefonata
 *
 * Nel testo c'è **quante visite le restano**. Senza, la coach chiama, propongono un orario, la
 * cliente apre l'app e trova «per prenotare una visita serve prima acquistarla dal negozio»: una
 * figura fatta fare a lei, su una cosa che sapevamo già. Con il numero davanti, la coach sa in
 * partenza se la telefonata è «quando ci vediamo?» o «serve prima questo».
 */

/** Il tipo dell'attività: metà della chiave di unicità (`clientId + kind + refId`). */
export const TIPO_VISITA_DA_FISSARE = 'visita_da_fissare';

/**
 * Il testo dell'attività.
 *
 * ⚠️ **Il motivo clinico non si copia qui.** La nota della nutrizionista è già nella lista note, e
 * duplicarla vorrebbe dire avere due copie di un dato sanitario che possono divergere — la seconda
 * senza autore e senza ora. Si dice **dov'è**, che è quello che serve per andarla a leggere.
 *
 * ⚠️ E non si scrive che la cliente «deve» comprare qualcosa: si dice alla coach cosa c'è e cosa
 * manca. Quello che si dice alla cliente lo decide lei, che ha la nota davanti.
 */
export function testoVisitaDaFissare(p: {
  nome?: string | null;
  nutrizionista?: string | null;
  visiteDisponibili?: number | null;
  /** ⚠️ Chi riceve l'attività. Assente = **nessuno la riceve**, e va detto. */
  coach?: string | null;
}): { title: string; description: string } {
  const chi = (p.nome ?? '').trim() || 'la cliente';
  const conChi = (p.nutrizionista ?? '').trim();
  /**
   * ⚠️ SENZA COACH ASSEGNATA L'ATTIVITÀ NON LA RICEVE NESSUNO — trovato rileggendo, la sera stessa.
   * `avvisaAttivitaNuova` non manda la push se la coach non c'è, e l'elenco delle attività è filtrato
   * per cliente assegnata: resta visibile solo a chi vede tutto (responsabile, admin). E capita
   * proprio all'inizio del percorso, che è quando il via libera clinico si decide: finché
   * l'assegnazione è in attesa, `assignedCoachId` è `null` (`commerce/crm.service.ts`).
   * Dirlo è l'unica cosa onesta: l'alternativa era un'attività che sembra partita e non è partita.
   */
  const senzaCoach = !(p.coach ?? '').trim();

  // ⚠️ Tre stati, e il terzo è «non lo so»: se il conto delle visite non si è potuto fare, non si
  // scrive né «ne ha» né «non ne ha». Un numero inventato qui manda la coach a dire la cosa
  // sbagliata a una persona che si fida di lei.
  const credito =
    p.visiteDisponibili === null || p.visiteDisponibili === undefined
      ? 'Non sono riuscito a contare le visite che le restano: controlla in scheda prima di chiamarla.'
      : p.visiteDisponibili > 0
        ? `Ha ${p.visiteDisponibili} visit${p.visiteDisponibili === 1 ? 'a' : 'e'} già disponibil${p.visiteDisponibili === 1 ? 'e' : 'i'}: può prenotare da sola dall'app, o fissatela insieme.`
        : '⚠️ NON ha visite disponibili: dall\'app non riesce a prenotare («serve prima acquistarla dal negozio»). Prima di proporle un orario, vedete insieme come fare.';

  return {
    title: `Fissa la visita per ${chi}`,
    description:
      `La nutrizionista ha deciso che ${chi} deve fare una visita prima di proseguire. ` +
      'Il motivo è nella sua nota, in cima alla lista note della scheda: leggila prima di chiamarla. ' +
      `${credito}` +
      (conChi ? ` La sua nutrizionista è ${conChi}.` : ' ⚠️ Non ha una nutrizionista assegnata: senza, non ci sono orari da scegliere.') +
      (senzaCoach
        ? ' ⚠️ E non ha una COACH assegnata: questa attività non arriva a nessuna coach e nessuna push è partita — assegnale una coach, o resta qui a aspettare.'
        : '') +
      ' Quando la visita è fissata, segna l\'attività fatta.',
  };
}
