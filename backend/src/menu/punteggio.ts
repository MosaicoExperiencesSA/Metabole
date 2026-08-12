/**
 * QUANTO VALE UN PIATTO PER QUESTA CLIENTE, OGGI — la formula, fuori dal servizio.
 *
 * È la riga che decide cosa una persona si trova nel piatto domani mattina, e fino al 12/8 viveva
 * dentro una closure di duecento righe: nessun test la guardava, e infatti ci è rimasto per mesi un
 * difetto che invertiva proprio il caso a cui serviva di più (vedi `STELLE_SE_MAI_VOTATA`).
 *
 * Qui non c'è database e non c'è stato: entrano i numeri di un piatto, esce un punteggio. Chi
 * sceglie i pesi resta `menu.service`, che è dove vivono gli stati dell'agente e gli override per
 * dieta.
 */

/**
 * ⚠️ UN PIATTO MAI VOTATO VALE ZERO STELLE. Decisione di Simone (12/8).
 *
 * Prima il default era **cinque**: un piatto che la cliente non aveva mai giudicato entrava col
 * gradimento al massimo. Due conseguenze, e la seconda è quella che ha fatto cambiare la riga.
 *
 * **Uno.** Per una cliente senza nessun voto — la maggioranza — ogni piatto valeva 1.0. Il
 * gradimento era una costante, e una costante non cambia l'ordine di niente: lo stato **conforto**
 * («umore basso → menu più amati») moltiplicava per 1.8 un numero uguale per tutti, quindi non
 * faceva assolutamente nulla. Una regola che esisteva solo nel nome.
 *
 * **Due.** Per una cliente con qualche voto faceva il **contrario** di quello che dice. Un piatto
 * mai votato (1.0) batteva uno valutato quattro stelle (0.8), e nel conforto il boost allargava
 * quel vantaggio: nel giorno in cui sta peggio le venivano proposti i piatti su cui non si è mai
 * espressa, scartando quelli che aveva detto di gradire.
 *
 * ⚠️ Per chi non ha votato niente il comportamento **non cambia**: prima tutti 1.0, adesso tutti
 * 0.0 — in entrambi i casi una costante, e l'ordine lo decidono efficacia, ripetizione e stagione.
 * Il cambiamento morde solo dove ci sono voti, che è esattamente dove deve mordere.
 */
export const STELLE_SE_MAI_VOTATA = 0;

/**
 * ⚠️ LA SCALA PARTE DA ZERO: `(stelle − 1) / 4`, non `stelle / 5`. Decisione di Simone (12/8).
 *
 * Conseguenza non voluta del passaggio a «mai votato = 0»: un piatto votato **una stella** valeva
 * 0,2 e si trovava **sopra** uno mai provato (0). Nel conforto il boost allargava anche quel
 * divario — cioè nel giorno peggiore poteva tornarle nel piatto proprio una cosa che aveva bocciato.
 *
 * Con questa scala una stella vale **zero, esattamente come un piatto sconosciuto**: chi ha detto
 * «non mi piace» non guadagna niente, ma non viene nemmeno spinto sotto zero — una penalità vera,
 * con un catalogo ancora poco votato, avrebbe ristretto parecchio le scelte disponibili.
 *
 * ⚠️ Cambia il valore di **tutte** le stelle, non solo di una: un tre stelle passa da 0,6 a 0,5. È
 * voluto — «tre su cinque» su una scala che comincia a uno è esattamente metà.
 */
export const STELLE_MIN = 1;
export const STELLE_MAX = 5;

/** Da stelle (1..5) a gradimento (0..1). Fuori scala si taglia, invece di produrre numeri assurdi. */
export function gradimentoDaStelle(stelle: number): number {
  const dentro = Math.min(STELLE_MAX, Math.max(STELLE_MIN, stelle));
  return (dentro - STELLE_MIN) / (STELLE_MAX - STELLE_MIN);
}

/** Quello che si sa di un piatto per questa cliente. */
export interface DatiRicetta {
  /** Efficacia appresa (`MenuWeight.score / samples`), 0 se non c'è ancora storia. */
  efficacia?: number | null;
  /** Stelle date dalla cliente, `null`/assente se non l'ha mai votato. */
  stelle?: number | null;
  /** Quota proteica 0..1, per lo stato pre-evento. */
  proteina?: number | null;
  /** Quante volte è stata servita nella finestra recente. */
  volteDiRecente?: number | null;
  fuoriStagione?: boolean;
}

/** I pesi, già modulati dallo stato dell'agente e dagli override per dieta. */
export interface PesiPunteggio {
  wEff: number;
  wGrad: number;
  proteinBonus: number;
  penaltyRepeat: number;
  penaltyStagione: number;
  /** Solo nello stato pre-evento la quota proteica entra nel conto. */
  usePreEvent?: boolean;
}

export function punteggioRicetta(r: DatiRicetta, p: PesiPunteggio): number {
  // ⚠️ `null`/assente = mai votato, ed è diverso da «votato una stella»: il primo non ha detto
  // niente, il secondo ha detto di no. Sulla scala valgono uguale — zero — ma per due ragioni
  // diverse, e il giorno che si volesse penalizzare il secondo la distinzione è già qui.
  const gradimento = r.stelle == null ? STELLE_SE_MAI_VOTATA : gradimentoDaStelle(r.stelle);
  return (
    p.wEff * (r.efficacia ?? 0) +
    p.wGrad * gradimento +
    (p.usePreEvent ? p.proteinBonus * (r.proteina ?? 0) : 0) -
    // R11: scoraggia la ripetizione (varietà).
    p.penaltyRepeat * (r.volteDiRecente ?? 0) -
    // Fuori stagione si PENALIZZA, non si esclude: un piatto fuori stagione è meno grave di una
    // cena mancante (decisione di Simone).
    (r.fuoriStagione ? p.penaltyStagione : 0)
  );
}
