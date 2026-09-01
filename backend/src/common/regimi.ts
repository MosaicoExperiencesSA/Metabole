/**
 * I REGIMI ALIMENTARI E CHI PUÒ MANGIARE COSA — in un posto solo.
 *
 * Il nesting è quello standard, e va letto da dentro a fuori:
 *
 *     vegano ⊂ vegetariano ⊂ pescetariano ⊂ onnivoro
 *
 * Una cliente vegetariana può ricevere anche i piatti vegani; una pescetariana anche quelli
 * vegetariani e vegani; un'onnivora tutto. Il verso opposto no, mai.
 *
 * ⛔ **IL RIPIEGO ERA ROVESCIATO, e questa è la ragione per cui il file esiste.** La tabella viveva
 * dentro `personal-base.service.ts` e non conosceva `pescetarian`; il ripiego per un regime
 * sconosciuto era `['omnivore']`. Cioè: il giorno che `pescetarian` entra fra i regimi attivi —
 * che è la Fase 5 del piano panieri — a una cliente pescetariana la base personale avrebbe
 * dichiarato sicuri **i piatti di carne**, perché il suo regime non stava nella tabella.
 *
 * ⚠️ Un ripiego su un elenco di cosa si può mangiare deve andare verso il **più stretto**, non
 * verso il più largo: se non so cosa mangia questa persona, il vegano è sbagliato al massimo per
 * difetto — le arriva meno scelta e qualcuno se ne accorge. L'onnivoro è sbagliato **nel piatto**.
 */

export const REGIMI_IN_ORDINE = ['vegan', 'vegetarian', 'pescetarian', 'omnivore'] as const;

export type Regime = (typeof REGIMI_IN_ORDINE)[number];

/**
 * ⚠️ **Il più stretto**, ed è il ripiego per un regime che non conosciamo. Vedi sopra il perché.
 */
export const REGIME_PIU_STRETTO: Regime = 'vegan';

/** Vero se questa parola è uno dei regimi che il progetto conosce. */
export const regimeConosciuto = (regime: string | null | undefined): boolean =>
  (REGIMI_IN_ORDINE as readonly string[]).includes(String(regime ?? '').trim());

/**
 * I regimi delle ricette che una cliente di questo regime può ricevere — **il suo compreso**.
 *
 * ⚠️ Si calcola dall'ordine invece di essere una tabella scritta a mano: una tabella con quattro
 * righe uguali a meno di una voce è una tabella in cui, il giorno che si aggiunge un regime, se ne
 * aggiorna una e si dimenticano le altre. Qui il regime nuovo si aggiunge in `REGIMI_IN_ORDINE`, al
 * suo posto, e tutte le risposte cambiano insieme.
 */
export function regimiCompatibili(regime: string | null | undefined): Regime[] {
  const cercato = String(regime ?? '').trim();
  const i = (REGIMI_IN_ORDINE as readonly string[]).indexOf(cercato);
  if (i < 0) return [REGIME_PIU_STRETTO];
  return REGIMI_IN_ORDINE.slice(0, i + 1) as unknown as Regime[];
}

/** Vero se una ricetta di `regimeRicetta` può andare a una cliente di `regimeCliente`. */
export const ricettaVaBene = (regimeRicetta: string | null | undefined, regimeCliente: string | null | undefined): boolean =>
  (regimiCompatibili(regimeCliente) as readonly string[]).includes(String(regimeRicetta ?? '').trim());
