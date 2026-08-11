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
}

/** Quello che il catalogo offre, ridotto agli attributi che distinguono una variante. */
export interface DietaServita {
  regime: string | null;
  style: string | null;
  mealsPerDay: number | null;
}

export type MotivoScostamento = 'pasti' | 'stile' | 'stile_e_pasti' | 'regime' | 'obiettivo';

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
