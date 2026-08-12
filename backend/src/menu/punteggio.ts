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
  const stelle = r.stelle ?? STELLE_SE_MAI_VOTATA;
  return (
    p.wEff * (r.efficacia ?? 0) +
    p.wGrad * (stelle / 5) +
    (p.usePreEvent ? p.proteinBonus * (r.proteina ?? 0) : 0) -
    // R11: scoraggia la ripetizione (varietà).
    p.penaltyRepeat * (r.volteDiRecente ?? 0) -
    // Fuori stagione si PENALIZZA, non si esclude: un piatto fuori stagione è meno grave di una
    // cena mancante (decisione di Simone).
    (r.fuoriStagione ? p.penaltyStagione : 0)
  );
}
