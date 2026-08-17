/**
 * QUALE CATALOGO SI GENERA ADESSO — una settimana per volta, in ordine di utilità.
 *
 * Richiesta della nutrizionista, girata da Simone il 17/8: «invece di fare lei una alla volta col
 * pulsante *genera*, possiamo farli tutti noi fino alla settimana 12, poi lei piano piano le
 * controlla». Questo modulo decide **cosa tocca adesso**; a generarlo è lo stesso
 * `generateCatalogFromPreset` del pulsante, con le stesse bozze e la stessa validazione.
 *
 * ⚠️ Modulo **puro**: nessun accesso al database. La regola di priorità è una decisione, e una
 * decisione si prova per tabella — non guardando i log di un giro da cinquecento chiamate all'AI.
 *
 * ## Le tre regole, in quest'ordine
 *
 * 1. **Prima le famiglie che hanno clienti sopra.** Il 17/8 la diagnostica ha detto che su 306
 *    diete in catalogo quelle con qualcuno sopra sono 16, per 25 clienti. Generare a caso vuol dire
 *    pagare ricette nuove per diete su cui non mangia nessuno mentre chi c'è continua a vedere la
 *    stessa colazione cinque volte al mese.
 *
 * 2. **Dentro un gruppo, prima la variante a 5 pasti.** Le tre strutture (5, 3, digiuno)
 *    CONDIVIDONO le ricette — lo dichiara il generatore stesso — e chi arriva dopo le trova già in
 *    casa. Generare prima la 3 pasti vuol dire pagare all'AI dei piatti che la 5 pasti avrebbe
 *    regalato: **lo stesso lavoro, al triplo del prezzo**.
 *
 * 3. **Le settimane in ordine, dalla più bassa.** Non è un gusto: il generatore rifiuta un buco
 *    (la 1 e la 3 senza la 2), perché un ciclo con giornate mancanti in mezzo il motore non lo sa
 *    colmare.
 *
 * ## ⚠️ Perché si RIFANNO anche le settimane che risultano già fatte
 *
 * Le varianti con clienti hanno 28 giornate ma **19 ricette diverse per pasto** invece di 28: sono
 * nate col metodo vecchio, che ricombinava pochi piatti su tante giornate. In modalità «completa»
 * il generatore non cancella niente e chiede all'AI **solo la differenza** per arrivare a sette
 * piatti nuovi per pasto in quella settimana. Quindi una settimana «già fatta» ma magra va
 * ripassata, e ripassarla non perde il lavoro fatto a mano.
 *
 * Il conto delle settimane da solo non basta a dirlo: serve sapere quanti piatti diversi ha il
 * pasto messo peggio, ed è `pastiMagri`.
 */

/** Le tre strutture pasti, nel nome che usano il backoffice e i preset. */
export type StrutturaPasti = '3' | '5' | 'fasting';

export interface VarianteDaRiempire {
  /** Il `RulePreset` da passare al generatore. */
  presetId: string;
  /** Solo per il registro e per il messaggio di risposta. */
  etichetta: string;
  /** Il gruppo di ricette: nome + stile + regime + obiettivo. Le sorelle lo condividono. */
  gruppo: string;
  struttura: StrutturaPasti;
  /** Settimane già in catalogo su QUESTA variante (giorno più alto ÷ 7). */
  settimaneFatte: number;
  /**
   * La settimana più bassa che ESISTE ma è **magra** — un pasto con meno di sette piatti diversi —
   * oppure `null` se sono tutte piene. `null` anche quando non lo sappiamo: nel dubbio si va
   * avanti, non si rifà.
   *
   * ⚠️ Serve perché il conto delle settimane da solo mente. Le varianti con clienti hanno 28
   * giornate — «quattro settimane fatte» — ma **19 piatti diversi per pasto invece di 28**: sono
   * nate col metodo vecchio, che ricombinava pochi piatti su tante giornate. Chi guarda il numero
   * delle settimane le vede a posto; chi mangia vede la stessa colazione cinque volte al mese.
   */
  primaSettimanaMagra: number | null;
  /** Clienti sull'intero gruppo di ricette (non sulla singola variante). */
  clientiGruppo: number;
}

export interface ProssimoLavoro {
  variante: VarianteDaRiempire;
  settimana: number;
  /** `completa` ripassa senza cancellare ricette; è l'unica modalità che questo giro usa. */
  modalita: 'completa';
  /** Perché tocca a questa: finisce nel registro e nella risposta dell'endpoint. */
  motivo: string;
}

export const SETTIMANE_OBIETTIVO = 12;

/** 5 pasti per prima: le altre due riusano le sue ricette e non costano una seconda generazione. */
const PESO_STRUTTURA: Record<StrutturaPasti, number> = { '5': 0, '3': 1, fasting: 2 };

/**
 * La prima settimana da generare per questa variante, o `null` se è a posto.
 *
 * ⚠️ Una settimana **magra** viene prima di una settimana **nuova**: la prima la sta mangiando
 * qualcuno adesso, la seconda non la vede ancora nessuno. In modalità «completa» ripassarla non
 * cancella niente — chiede all'AI solo i piatti che mancano per arrivare a sette per pasto.
 */
export function settimanaDaFare(v: VarianteDaRiempire, obiettivo = SETTIMANE_OBIETTIVO): number | null {
  // ⚠️ Prima si rattoppa quello che è già in tavola, poi si allunga. Una settimana magra la sta
  // vedendo qualcuno adesso; la settimana 9 non la vede ancora nessuno.
  if (v.primaSettimanaMagra && v.primaSettimanaMagra <= obiettivo) return v.primaSettimanaMagra;
  if (v.settimaneFatte < obiettivo) return Math.max(1, v.settimaneFatte + 1);
  return null;
}

/**
 * Il prossimo pezzo di lavoro, o `null` se non c'è più niente da fare.
 *
 * ⚠️ L'ordine è deterministico fino in fondo — a parità di tutto vince l'etichetta in ordine
 * alfabetico — perché due chiamate consecutive del cron devono avanzare, non ballare fra due
 * varianti equivalenti rifacendo ogni volta la stessa settimana.
 */
export function prossimaDaGenerare(
  varianti: VarianteDaRiempire[],
  obiettivo = SETTIMANE_OBIETTIVO,
): ProssimoLavoro | null {
  const candidate = (varianti ?? [])
    .map((v) => ({ v, settimana: settimanaDaFare(v, obiettivo) }))
    .filter((c): c is { v: VarianteDaRiempire; settimana: number } => c.settimana !== null);
  if (!candidate.length) return null;

  candidate.sort(
    (a, b) =>
      b.v.clientiGruppo - a.v.clientiGruppo ||
      PESO_STRUTTURA[a.v.struttura] - PESO_STRUTTURA[b.v.struttura] ||
      a.settimana - b.settimana ||
      a.v.etichetta.localeCompare(b.v.etichetta),
  );

  const scelta = candidate[0];
  const perche = scelta.v.clientiGruppo > 0
    ? `${scelta.v.clientiGruppo} client${scelta.v.clientiGruppo === 1 ? 'e' : 'i'} su questa famiglia`
    : 'nessun cliente sopra: si lavora al catalogo di riserva';
  const struttura = scelta.v.struttura === '5' ? '5 pasti (le sorelle riuseranno queste ricette)' : `${scelta.v.struttura} pasti`;
  return {
    variante: scelta.v,
    settimana: scelta.settimana,
    modalita: 'completa',
    motivo: `${perche}; ${struttura}; settimana ${scelta.settimana} di ${obiettivo}`,
  };
}

/** Quanti pezzi di lavoro restano in tutto: è il numero da mostrare per capire quanto manca. */
export function quantoManca(varianti: VarianteDaRiempire[], obiettivo = SETTIMANE_OBIETTIVO): number {
  let n = 0;
  for (const v of varianti ?? []) {
    if (v.settimaneFatte < obiettivo) n += obiettivo - v.settimaneFatte;
    if (v.primaSettimanaMagra && v.primaSettimanaMagra <= Math.min(v.settimaneFatte, obiettivo)) n += 1;
  }
  return n;
}
