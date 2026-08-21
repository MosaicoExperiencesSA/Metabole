/**
 * COSA È STATO CHIESTO, COSA VIENE SERVITO — e la differenza detta a voce alta.
 *
 * Nasce dal caso di Cristina (11/8). Nella sua scheda si leggevano due righe che si
 * contraddicevano: «Dieta assegnata: Flessibile **vegan · 3 pasti**» e, tre righe sotto,
 * «Pasti / percorso: **5 pasti**». Lei è onnivora e ne ha chiesti cinque.
 *
 * Le cause erano due, sovrapposte, e nessuna delle due era «il motore le serve la dieta sbagliata»:
 *
 * 1. **la scheda cercava la dieta per NOME e basta.** Una famiglia ha fino a diciotto varianti che
 *    condividono il nome e si distinguono per regime, stile, obiettivo e pasti: quella query pescava
 *    la prima che capitava e ne mostrava gli attributi. Il regime «vegan» che si vedeva era di
 *    un'altra variante, non del suo piano — il motore, che filtra sempre sul regime, non potrebbe
 *    mai servire una dieta vegana a una cliente onnivora;
 * 2. **il ripiego sui pasti non lo diceva nessuno.** `pickDietFor` lascia cadere l'obiettivo, poi lo
 *    stile, poi il numero di pasti, perché una dieta vicina è meglio di nessun menu. È voluto. Ma
 *    finora l'unica traccia era un evento scritto solo per lo scostamento di *stile*: se a cambiare
 *    erano i pasti, non lo sapeva nessuno.
 *
 * Il costo di tacerlo non è teorico: chi legge la scheda va a cercare un errore di assegnazione che
 * non esiste, e nel frattempo il vero problema — una variante mancante a catalogo — resta lì.
 *
 * Modulo **puro**: nessuna dipendenza, così questa regola si verifica per tabella invece che
 * montando mezza applicazione.
 */

/** Quello che la cliente ha chiesto, dal suo profilo. */
export interface DietaChiesta {
  famiglia: string | null;
  regime: string | null;
  style: string | null;
  mealsPerDay: number | null;
  /**
   * ⛔ **I PASTI PROMESSI CHE IL CATALOGO SERVITO NON SA COMPORRE**, già in italiano. Vuoto o assente
   * = non ne manca nessuno.
   *
   * ## ⛔ Perché è un elenco e non un numero (corretto in revisione, 21/8)
   *
   * La prima stesura passava «quanti pasti promette l'orologio» e qui li confrontava con
   * `servito.mealsPerDay`. **Sono due scale diverse**, e il confronto era falso su quattro protocolli
   * su cinque: `strutturaPerFinestra` mappa i pasti promessi su un catalogo da 3 o da 5, quindi la
   * 14:10 (4 pasti promessi) servita **correttamente** dal catalogo a 5 dava «4 ≠ 5» e la scheda
   * scriveva *«le promette 4 pasti … viene servita quella da 5. Riceve meno pasti di quelli che le
   * abbiamo detto»* — cinque è più di quattro, la frase si contraddiceva nella stessa riga. E la 20:4
   * (2 promessi) servita dal catalogo digiuno (3) dava lo stesso allarme, mentre pranzo e cena ci
   * sono entrambi.
   *
   * ⚠️ La domanda giusta non è «quanti», è **quali**: `pastiPromessiCheMancano` in
   * `catalog/struttura-per-digiuno.ts` la risponde già, ed è la stessa funzione che il motore usa per
   * dirlo nei log. Qui arriva il suo risultato, non un conto rifatto.
   *
   * ⚠️ Arriva **già tradotto** perché questo modulo è puro e senza dipendenze: importare il catalogo
   * per una mappa di nomi vorrebbe dire non poterlo più provare per tabella.
   */
  pastiCheMancano?: string[] | null;
}

/** Quello che il catalogo offre, ridotto agli attributi che distinguono una variante. */
export interface DietaServita {
  regime: string | null;
  style: string | null;
  mealsPerDay: number | null;
}

export type MotivoScostamento = 'pasti' | 'stile' | 'stile_e_pasti' | 'regime' | 'obiettivo' | 'finestra';

export interface Scostamento {
  motivo: MotivoScostamento;
  chiesto: DietaChiesta;
  servito: DietaServita;
  /** Frase pronta: la ricompongono in due schermate diverse ⇒ due versioni diverse dello stesso fatto. */
  testo: string;
}

/**
 * Null quando non c'è niente da segnalare: la variante esatta esiste, oppure mancano i dati per
 * dire qualcosa di sensato (una cliente senza regime o senza numero di pasti non ha «chiesto»
 * niente, e inventarle uno scostamento sarebbe rumore).
 */
export function scostamentoDieta(
  chiesto: DietaChiesta,
  servito: DietaServita | null,
  varianteEsattaEsiste: boolean,
): Scostamento | null {
  if (!servito || varianteEsattaEsiste) return null;
  if (!chiesto.regime || !chiesto.mealsPerDay) return null;

  /**
   * ⛔ **IL DIGIUNO SI MISURA SUI PASTI CHE MANCANO, NON SU UN CONTEGGIO** (21/8, caso di Antonella).
   *
   * Per una cliente in digiuno quanti pasti fa lo dice la **durata della finestra** — la Regola d'Oro
   * del manuale — e il profilo dice sempre `3`. Ma il confronto giusto non è nemmeno fra quel numero
   * e la struttura servita: è **quali** pasti promessi il catalogo servito non sa comporre. Vedi la
   * nota su `pastiCheMancano`, che racconta i falsi allarmi della prima stesura.
   *
   * ⚠️ Questo ramo esce **prima** degli altri perché è più specifico: quando alla cliente mancano
   * pasti che le sono stati promessi, quello è il fatto — non «la variante ha un altro numero».
   */
  const mancano = (chiesto.pastiCheMancano ?? []).filter((s) => !!s && s.trim());
  if (mancano.length) {
    const elenco = mancano.join(', ');
    return {
      motivo: 'finestra',
      chiesto,
      servito,
      testo:
        `⚠️ La sua finestra le promette ${elenco}, ma la dieta che le viene servita non ${mancano.length === 1 ? 'ce l\'ha' : 'li ha'} `
        + `in catalogo: riceve meno pasti di quelli che le abbiamo scritto in app, e non se ne accorge `
        + `nessuno finché non lo racconta lei. `
        + `⛔ Non si chiude cambiandole la finestra — la sposta lei, dall'app — e nemmeno cambiandole il `
        + `profilo: si chiude generando la variante mancante di «${chiesto.famiglia ?? '—'}».`,
    };
  }

  const pastiDiversi = servito.mealsPerDay !== chiesto.mealsPerDay;
  const stileDiverso = !!chiesto.style && servito.style !== chiesto.style;
  /**
   * Il regime che cambia **non dovrebbe accadere**: è l'unico filtro che `pickDietFor` non lascia
   * mai cadere. Se compare, non è un ripiego — è un dato incoerente da qualche parte, e va detto
   * con parole diverse, perché è l'unico caso in cui la cliente potrebbe avere nel piatto qualcosa
   * che non mangia.
   */
  const regimeDiverso = servito.regime !== chiesto.regime;

  const motivo: MotivoScostamento = regimeDiverso
    ? 'regime'
    : pastiDiversi && stileDiverso
      ? 'stile_e_pasti'
      : pastiDiversi
        ? 'pasti'
        : stileDiverso
          ? 'stile'
          : 'obiettivo';

  const fam = chiesto.famiglia ?? '—';
  const testo =
    motivo === 'regime'
      ? `⚠️ La dieta servita ha regime «${servito.regime ?? '—'}» mentre il profilo dice «${chiesto.regime}». ` +
        `Non è un ripiego: il motore non lascia mai cadere il regime, quindi uno dei due dati è sbagliato. Da guardare subito.`
      : motivo === 'obiettivo'
        ? `In catalogo non c'è la variante «${fam}» per l'obiettivo di questa cliente: viene servita quella dell'altro obiettivo, stessa dieta e stessi pasti.`
        : `In catalogo non c'è la variante «${fam}» ${chiesto.regime} · ${chiesto.mealsPerDay} pasti` +
          `${chiesto.style ? ` · ${chiesto.style}` : ''}: viene servita ${servito.regime ?? '—'} · ${servito.mealsPerDay ?? '—'} pasti` +
          `${servito.style ? ` · ${servito.style}` : ''}. Si chiude generando quella variante, non cambiando il profilo della cliente.`;

  return { motivo, chiesto, servito, testo };
}
