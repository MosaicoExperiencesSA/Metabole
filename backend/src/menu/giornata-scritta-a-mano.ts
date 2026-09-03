/**
 * ⛔ **IL MENU SCRITTO A MANO DALLA SCHEDA CLIENTE — la regola, fuori dal servizio e fuori dalla
 * schermata.**
 *
 * Il 31/8, con una cliente senza menu, sarebbe stata la via d'uscita in cinque minuti. Non
 * esisteva. Disegno concordato con Simone: dalla scheda si scelgono le date, e per ogni pasto si
 * cerca nel catalogo — con tre cose che lo rendono utile invece che pericoloso:
 *
 * · la ricerca è **già filtrata sulle sue esclusioni**, le incompatibili compaiono **barrate col
 *   motivo**, e servirle richiede di forzare e **scrivere perché**;
 * · le **kcal si sommano** mentre scegli, col target davanti;
 * · il giorno scritto a mano è **intoccabile** dalla passata notturna e da «Rigenera menu».
 *
 * ## ⛔ Perché il giudizio sta qui e non nel servizio
 *
 * Perché è la parte che si può sbagliare in silenzio. Una schermata che accetta una giornata a cui
 * manca un pasto, o che serve un allergene senza chiedere il motivo, non dà nessun errore: dà una
 * giornata storta a una persona. Una funzione pura si prova; una `if` dentro un `handler` no.
 *
 * ## ⚠️ Niente colonna nuova: il marchio sta dentro `meals`
 *
 * `MealSnapshot` è nato con campi opzionali retrocompatibili (`porzione`, `substitutions`,
 * `cambioPiatto`), e un pasto scritto a mano ne porta uno in più — `scrittaAMano`, con dentro chi e
 * quando.
 *
 * ⚠️ **Non è `Substitution.origine`**, e la prima stesura di questo commento lo diceva: quel campo
 * è tipizzato `'chat' | 'app'` e sta sulla singola sostituzione, non sul pasto. Sono due cose
 * diverse, e chiamarle con lo stesso nome manda il prossimo a cercare la seconda dove c'è la prima.
 *
 * ⛔ **Il prezzo va detto due volte.** (1) Niente colonna vuol dire **niente `where`**: chi deve
 * saltare i giorni a mano li carica e filtra in memoria — sulla singola cliente non costa niente, e
 * il giorno che servisse un elenco «tutte le giornate scritte a mano di questo mese» su molte
 * clienti insieme, allora la colonna serve. (2) `scrittaAMano` **non è dichiarato in
 * `MealSnapshot`**, quindi ogni punto che ricostruisce un pasto tipizzato lo perde **senza un
 * errore di compilazione** — ed è già successo (`sostituzione-chat.service.ts`, che riscrive
 * `{slot, recipeId, name, kcal, substitutions?, cambioPiatto?}` e basta). Chi dichiara il campo lì
 * chiude anche quel buco.
 */
import { contaGiornata, type ContoGiornata } from '../vera/giornata-dettata';

/** Chi ha scelto il pasto. Assente = il motore, come è sempre stato. */
export const ORIGINE_A_MANO = 'nutrizionista' as const;

export interface ScrittaAMano {
  origine: typeof ORIGINE_A_MANO;
  /** Chi l'ha scritta: il nome che comparirà in scheda, non un id opaco. */
  da: string;
  /** Quando (ISO). */
  il: string;
  /**
   * ⛔ **Il motivo, obbligatorio quando il piatto è stato FORZATO** — cioè servito nonostante
   * un'incompatibilità dichiarata. Non è burocrazia: è la sola cosa che, fra sei mesi, distingue
   * «qualcuno ha deciso e sapeva» da «qualcuno ha cliccato senza leggere». Vedi `controllaGiornata`.
   */
  forzatoPerche?: string;
}

export interface PastoAMano {
  slot: string;
  recipeId: string;
  name: string;
  kcal: number;
  /** Vero se questa ricetta è incompatibile con le sue esclusioni. */
  bloccata?: boolean;
  /** Il motivo leggibile, quello che `valutaRicetta` rende già in italiano. */
  motivoBlocco?: string;
  /** Scritto da chi compone, quando serve la ricetta bloccata lo stesso. */
  forzatoPerche?: string;
}

export interface VerdettoGiornata {
  /** Si può scrivere. */
  pronta: boolean;
  /**
   * ⛔ **Quello che IMPEDISCE di scrivere.** Sono le cose che rendono la giornata sbagliata a
   * prescindere da chi la guarda: un pasto che manca, uno slot che quella dieta non ha, lo stesso
   * piatto due volte, un piatto forzato senza motivo.
   */
  problemi: string[];
  /**
   * ⚠️ **Quello che si MOSTRA e non ferma.** Le kcal fuori banda sono l'esempio: una nutrizionista
   * può avere una ragione clinica per una giornata più leggera, e bloccarla vorrebbe dire farle
   * scegliere fra il suo giudizio e lo strumento. *Un cancello chiuso costa a una cliente tutto il
   * servizio*: qui costerebbe la via d'uscita che questa schermata esiste per dare.
   */
  avvisi: string[];
  conto: ContoGiornata;
}

const pulita = (t?: string | null): string => (t ?? '').trim();

/**
 * ⛔ **La giornata si può scrivere?**
 *
 * `slotAttesi` viene da `slotDaComporre`, cioè dalla **dieta** della cliente: è quella a dire
 * quanti pasti ha la sua giornata, non il paniere e non chi compone. Passarli da fuori tiene questa
 * funzione pura e impedisce la seconda copia della regola.
 */
export function controllaGiornata(
  scelte: readonly PastoAMano[],
  slotAttesi: readonly string[],
  targetKcal: number | null,
  tolleranzaPct?: number,
): VerdettoGiornata {
  const problemi: string[] = [];
  const avvisi: string[] = [];
  const righe = (scelte ?? []).filter((s) => s && pulita(s.slot) && pulita(s.recipeId));

  const perSlot = new Map<string, PastoAMano[]>();
  for (const r of righe) {
    const g = perSlot.get(r.slot);
    if (g) g.push(r);
    else perSlot.set(r.slot, [r]);
  }

  for (const slot of slotAttesi ?? []) {
    const n = perSlot.get(slot)?.length ?? 0;
    if (n === 0) problemi.push(`Manca ${slot}: la giornata di questa cliente ha ${(slotAttesi ?? []).length} pasti.`);
    if (n > 1) problemi.push(`${slot} ha ${n} piatti: uno per pasto.`);
  }
  /** ⚠️ Uno slot che quella dieta non ha: darebbe alla cliente un pasto in più, cioè kcal in più. */
  for (const slot of perSlot.keys()) {
    if (!(slotAttesi ?? []).includes(slot)) problemi.push(`«${slot}» non è un pasto della sua giornata.`);
  }

  /**
   * ⛔ **Lo stesso piatto due volte nella stessa giornata.** È il difetto che
   * `stesso-piatto-spuntino-e-merenda` racconta per il motore, dove costa un vincolo dentro un
   * prodotto cartesiano; qui costa un `Set`, e chi compone lo vede subito. Non c'è motivo di
   * lasciarlo passare a mano solo perché a macchina è caro.
   */
  const visti = new Set<string>();
  for (const r of righe) {
    if (visti.has(r.recipeId)) problemi.push(`«${r.name}» compare due volte nella stessa giornata.`);
    visti.add(r.recipeId);
  }

  /**
   * ⛔ **Un piatto incompatibile si può servire, ma scrivendo perché.** Il permesso senza il motivo
   * sarebbe un pulsante «ignora»: la schermata direbbe di aver avvisato e nessuno saprebbe mai chi
   * ha deciso, né sulla base di cosa.
   */
  for (const r of righe) {
    if (!r.bloccata) continue;
    if (!pulita(r.forzatoPerche)) {
      problemi.push(`«${r.name}» è incompatibile (${pulita(r.motivoBlocco) || 'motivo non disponibile'}): per servirla scrivi perché.`);
    } else {
      avvisi.push(`«${r.name}» servita nonostante: ${pulita(r.motivoBlocco) || 'incompatibilità dichiarata'}.`);
    }
  }

  const conto = contaGiornata(righe.map((r) => ({ slot: r.slot, recipeId: r.recipeId, nome: r.name, kcal: r.kcal })), targetKcal, tolleranzaPct);
  if (conto.dentroTolleranza === false) {
    avvisi.push(`La giornata è ${conto.scostamentoPct! > 0 ? 'sopra' : 'sotto'} il suo fabbisogno del ${Math.abs(conto.scostamentoPct!)}%.`);
  }
  if (conto.dentroTolleranza === null && righe.length) {
    /** ⚠️ «Non lo so» non è «va bene», e chi compone deve saperlo mentre sceglie. */
    avvisi.push('Il fabbisogno di questa cliente non è calcolabile: le kcal non si possono giudicare.');
  }

  return { pronta: problemi.length === 0 && righe.length > 0, problemi, avvisi, conto };
}

/**
 * I pasti pronti da scrivere in `MenuDay.meals`, col marchio di chi li ha scelti.
 *
 * ⚠️ La forma è quella che scrivono già il motore e Vera — `{slot, recipeId, name, kcal}` — più il
 * marchio: un campo in più che i trenta punti che leggono `meals` ignorano senza accorgersene, che
 * è esattamente il motivo per cui `MealSnapshot` è fatto di campi opzionali.
 */
export function pastiDaScrivere(
  scelte: readonly PastoAMano[],
  da: string,
  il: Date = new Date(),
): Record<string, unknown>[] {
  return (scelte ?? []).map((r) => ({
    slot: r.slot,
    recipeId: r.recipeId,
    name: r.name,
    kcal: Number.isFinite(r.kcal) ? r.kcal : 0,
    scrittaAMano: {
      origine: ORIGINE_A_MANO,
      da,
      il: il.toISOString(),
      ...(pulita(r.forzatoPerche) ? { forzatoPerche: pulita(r.forzatoPerche) } : {}),
    } satisfies ScrittaAMano,
  }));
}
