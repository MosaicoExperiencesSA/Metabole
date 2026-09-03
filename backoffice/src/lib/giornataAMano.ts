/**
 * ⛔ **LA GIORNATA SCRITTA A MANO — quello che la schermata calcola mentre si sceglie.**
 *
 * Sta in `lib/` per la stessa ragione di `famiglieDiete.ts`: è la parte che si può sbagliare in
 * silenzio. Una somma kcal sbagliata non dà nessun errore — dà una nutrizionista che decide su un
 * numero falso, con il fabbisogno della cliente scritto accanto.
 *
 * ## ⛔ QUI NON C'È IL VERDETTO, E NON DEVE ESSERCI
 *
 * Se la giornata si può scrivere lo decide il **server** (`menu/giornata-scritta-a-mano.ts`), che
 * conosce gli slot della sua dieta, il fabbisogno e le esclusioni. Qui c'è solo quello che serve a
 * **far vedere** com'è messa mentre si compone: il totale, lo scostamento, e le due cose che
 * l'interfaccia deve poter segnalare subito perché dipendono da quello che l'utente sta scrivendo
 * in quel momento (un pasto vuoto, una forzatura senza motivo).
 *
 * ⚠️ Ricopiare qui `controllaGiornata` vorrebbe dire due copie della stessa regola. Le due copie
 * divergono — è successo con l'ereditarietà dei permessi, che girava in tre posti e ne era stato
 * corretto uno — e qui la divergenza si chiamerebbe «il pulsante era acceso e il salvataggio ha
 * risposto di no», cioè uno strumento che sembra rotto proprio nel momento in cui serve.
 */

export interface Scelta {
  slot: string;
  recipeId: string;
  nome: string;
  kcal: number;
  bloccata?: boolean;
  motivoBlocco?: string | null;
  forzatoPerche?: string;
}

export interface Conto {
  kcal: number;
  /** `null` senza fabbisogno: «non lo so» non è «va bene». */
  scostamentoPct: number | null;
  dentroBanda: boolean | null;
  /** Gli slot ancora vuoti, nell'ordine in cui li ha chiesti il server. */
  mancanti: string[];
  /** Le forzature senza motivo: finché ce n'è una, il salvataggio non parte. */
  senzaMotivo: string[];
  /** Vero quando il pulsante «Salva» si può accendere. */
  siPuoProvare: boolean;
}

const pulita = (t?: string | null): string => (t ?? '').trim();

/**
 * ⚠️ **Il minimo del motivo è lo stesso del DTO (5).** Se qui fosse più permissivo, il pulsante si
 * accenderebbe e il server risponderebbe 400: chi scrive vedrebbe uno strumento che si contraddice.
 * Se fosse più severo, si vieterebbe qualcosa che il server accetta. Il numero è uno solo, e sta
 * scritto in tutti e due i posti col perché.
 */
export const MOTIVO_MINIMO = 5;

export function conta(
  scelte: readonly Scelta[],
  slotAttesi: readonly string[],
  targetKcal: number | null,
  tolleranzaPct: number,
): Conto {
  const per = new Map<string, Scelta>();
  for (const s of scelte ?? []) if (s && pulita(s.slot) && pulita(s.recipeId)) per.set(s.slot, s);

  const kcal = [...per.values()].reduce((n, s) => n + (Number.isFinite(s.kcal) ? s.kcal : 0), 0);
  const mancanti = (slotAttesi ?? []).filter((s) => !per.has(s));
  const senzaMotivo = [...per.values()]
    .filter((s) => s.bloccata && pulita(s.forzatoPerche).length < MOTIVO_MINIMO)
    .map((s) => s.nome);

  const scostamentoPct = targetKcal && targetKcal > 0
    ? Math.round(((kcal - targetKcal) / targetKcal) * 1000) / 10
    : null;
  const banda = Number.isFinite(tolleranzaPct) && tolleranzaPct > 0 ? tolleranzaPct : 15;

  return {
    kcal,
    scostamentoPct,
    dentroBanda: scostamentoPct === null ? null : Math.abs(scostamentoPct) <= banda,
    mancanti,
    senzaMotivo,
    /**
     * ⚠️ **«Si può provare», non «è giusta».** Il nome del campo è scelto: il pulsante si accende
     * quando non c'è più niente che *questa schermata* sappia essere sbagliato — il verdicto resta
     * del server, e il messaggio che rende è quello che si mostra.
     */
    siPuoProvare: per.size > 0 && mancanti.length === 0 && senzaMotivo.length === 0,
  };
}

/** Le etichette dei pasti, quelle che legge chi compone. */
export const NOME_PASTO: Record<string, string> = {
  breakfast: 'Colazione',
  morning_snack: 'Spuntino',
  lunch: 'Pranzo',
  afternoon_snack: 'Merenda',
  dinner: 'Cena',
};
export const nomePasto = (s: string): string => NOME_PASTO[s] ?? s;
