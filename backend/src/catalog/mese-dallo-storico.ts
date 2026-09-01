import { ordinaLeGiornate, type GiornataCandidata, type Pesi } from '../monitoring/giornate-che-hanno-funzionato';

/**
 * UN MESE COMPOSTO DAL PASSATO — «Ritorno in Equilibrio», §6.1 del piano.
 *
 * Richiesta di Simone del 27/8: *«per chi ha già fatto un percorso con noi, un mese coi menu scelti
 * tra quelli che hanno dato migliori risultati e al cliente più graditi»*.
 *
 * ⚠️ **Non è un paniere ed è per questo che sta qui e non lì**: il paniere è famiglia × regime e lo
 * condividono molte clienti; questo è **il passato di una persona sola**, e due clienti della stessa
 * famiglia hanno due mesi diversi.
 *
 * ⛔ **IL PROBLEMA VERO NON È SCEGLIERE LE MIGLIORI: È COSA FARE QUANDO FINISCONO.** Trenta giornate
 * chieste a chi ne ha dodici alle spalle non sono «un mese dei suoi piatti migliori» — sono dodici
 * giornate ripetute due volte e mezza. Quello che decide se il prodotto mantiene la promessa non è
 * l'ordinamento, è **come si ripete**: se le copie si ammucchiano, la cliente si accorge di mangiare
 * la stessa settimana tre volte di fila e la funzione ha fallito anche avendo scelto benissimo.
 */

export interface MeseComposto {
  /** Le giornate scelte, in ordine, una per giorno del mese. */
  giornate: GiornataCandidata[];
  /** Quante giornate DIVERSE ci sono dentro: il numero onesto sulla varietà. */
  distinte: number;
  /**
   * ⚠️ Quante volte è tornata la giornata più ripetuta. `1` = nessuna ripetizione. Chi compone lo
   * scrive: un mese fatto di quattro giornate girate sette volte è un mese che va detto a una
   * persona, non consegnato in silenzio.
   */
  ripetizioneMassima: number;
}

/**
 * ⚠️ **Quanti giorni devono passare prima che una giornata possa tornare.** Non è una preferenza:
 * è la differenza fra «un mese vario» e «la stessa settimana quattro volte». Con meno giornate di
 * così la distanza si accorcia da sé — meglio una ripetizione ravvicinata che un buco.
 */
export const DISTANZA_MINIMA_GIORNI = 7;

/**
 * Sceglie le giornate del mese.
 *
 * ⛔ **Si riparte sempre dalla migliore quando si ricomincia il giro**, invece di continuare a
 * scendere nella classifica: dopo aver esaurito le giornate buone, il secondo giro deve riproporre
 * di nuovo le **migliori**, non le peggiori. La cliente che ha chiesto «i menu che hanno funzionato
 * meglio» non vuole che la seconda metà del mese sia la coda della lista.
 *
 * ⚠️ E la distanza minima **cede** quando non c'è altro: se le giornate distinte sono meno della
 * distanza, si ripete più spesso invece di lasciare il giorno vuoto. È la stessa rete che regge
 * `dayComboPools` e la finestra del digiuno — un buco è sempre peggio di una ripetizione.
 */
export function componiIlMese(
  candidate: readonly GiornataCandidata[],
  quante: number,
  pesi: Pesi,
  distanzaMinima: number = DISTANZA_MINIMA_GIORNI,
): MeseComposto {
  if (quante <= 0 || !candidate.length) return { giornate: [], distinte: 0, ripetizioneMassima: 0 };

  const inOrdine = ordinaLeGiornate(candidate, pesi).map((x) => x.giornata);
  const posto = new Map(inOrdine.map((g, i) => [g.chiave, i]));
  const scelte: GiornataCandidata[] = [];
  /** L'ultima posizione in cui ogni giornata è stata usata: serve a tenere la distanza. */
  const ultimaVolta = new Map<string, number>();
  /** Quante volte è già stata usata: è il criterio che distribuisce le ripetizioni. */
  const quanteVolte = new Map<string, number>();

  /**
   * ⛔ **CHI HA GIRATO MENO VA PER PRIMO — e ci sono volute due prove per arrivarci.**
   *
   * 1ª stesura: «la prima della classifica che rispetta la distanza». Con distanza 7, la migliore
   *    tornava libera al settimo giorno e il giro si chiudeva sulle prime sette: **con 16 giornate
   *    di storico ne usava 7**, buttando via metà del passato di una cliente.
   * 2ª stesura: «prima quelle mai usate». Meglio — le usava tutte e 16 — ma allo **giro
   *    successivo** ripartiva lo stesso ciclo corto: le prime sette tornavano **tre** volte mentre
   *    altre nove una sola.
   *
   * ⚠️ Il criterio giusto non è la distanza né la novità: è **quante volte una giornata è già
   * stata usata**. A parità comanda la classifica, così fra due giornate girate uguale vince la
   * migliore. Con questo le ripetizioni si distribuiscono da sé, a ogni giro.
   *
   * ⛔ Ed è un difetto che da fuori non si vede: il mese esce pieno, le giornate sono davvero le
   * migliori, e nessuno sa che ce n'erano altre altrettanto buone rimaste fuori. La cliente lo
   * scopre mangiando.
   */
  while (scelte.length < quante) {
    const posizione = scelte.length;
    const usi = (g: GiornataCandidata) => quanteVolte.get(g.chiave) ?? 0;
    const abbastanzaLontana = (g: GiornataCandidata) => {
      const q = ultimaVolta.get(g.chiave);
      return q === undefined || posizione - q >= distanzaMinima;
    };

    const ordinatePerUso = [...inOrdine].sort(
      (a, b) => usi(a) - usi(b) || (posto.get(a.chiave) ?? 0) - (posto.get(b.chiave) ?? 0),
    );

    /**
     * ⛔ La distanza **cede** quando nessuna la rispetta: si prende comunque quella che ha girato
     * meno. Non si lascia un giorno vuoto — un mese con un buco dentro non è un mese, ed è la
     * stessa rete che regge `dayComboPools` e la finestra del digiuno.
     */
    const presa = ordinatePerUso.find(abbastanzaLontana) ?? ordinatePerUso[0];
    if (!presa) break;

    scelte.push(presa);
    ultimaVolta.set(presa.chiave, posizione);
    quanteVolte.set(presa.chiave, usi(presa) + 1);
  }

  return {
    giornate: scelte,
    distinte: quanteVolte.size,
    ripetizioneMassima: Math.max(0, ...quanteVolte.values()),
  };
}

/**
 * ⚠️ **La frase da dire a una persona quando il mese è povero.** Non è decorazione: la funzione
 * promette «un mese dei tuoi piatti migliori», e se le giornate distinte sono dieci su trenta
 * qualcuno deve saperlo **prima** che se ne accorga la cliente.
 *
 * ⛔ Torna `null` quando non c'è niente da dire: un avviso che compare sempre non è un avviso.
 */
export function quantoEPovero(mese: MeseComposto, quante: number): string | null {
  if (!mese.giornate.length) return 'Non ha abbastanza storico: non si può comporre niente.';
  if (mese.distinte >= quante) return null;
  const volte = mese.ripetizioneMassima;
  if (volte <= 2 && mese.distinte >= quante / 2) return null;
  return `Solo ${mese.distinte} giornate diverse su ${quante}: qualcuna torna fino a ${volte} volte.`;
}
