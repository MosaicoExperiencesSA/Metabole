/**
 * Modalità viaggio/estate: **quando** lo stato scritto sul profilo vale ancora davvero.
 *
 * `travelState` lo imposta un'operatrice dalla scheda cliente e resta lì finché qualcuno non lo
 * cambia. Nessuno lo azzera al rientro — non c'è un lavoro notturno che lo faccia, e non c'è
 * motivo per cui una coach debba ricordarsene. Leggere il campo grezzo significa quindi
 * accettare che un «in vacanza» di luglio valga ancora a novembre.
 *
 * Non è teoria: `menuStatus` sospende il popup misure quando lo stato è `in_vacanza`, e il gate
 * misure è la regola più severa che abbiamo (senza pesata il giorno dopo l'app si blocca). Un
 * `in_vacanza` dimenticato la spegneva **per sempre**, in silenzio, su quella cliente.
 *
 * Qui lo stato ha una scadenza, e le date che l'operatrice inserisce servono a qualcosa:
 *  - c'è `travelEnd` → lo stato vale fino a quel giorno compreso;
 *  - c'è solo `travelStart` → vale per `maxGiorni` giorni da lì (rete di sicurezza, non una
 *    regola di prodotto: serve solo a chiudere i casi dimenticati);
 *  - nessuna data → vale, come prima. Senza un riferimento non c'è niente da far scadere, e
 *    inventarne uno sarebbe peggio del problema.
 */

export type StatoViaggio = 'in_partenza' | 'in_vacanza' | 'rientrato';

export interface ProfiloViaggio {
  travelState?: string | null;
  travelStart?: Date | string | null;
  travelEnd?: Date | string | null;
}

const GIORNO = 86_400_000;

function soloData(d: Date | string): number {
  const v = typeof d === 'string' ? new Date(d) : d;
  return new Date(v.toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime();
}

/**
 * Lo stato di viaggio ancora VALIDO oggi, o `null` se scaduto (o mai impostato).
 *
 * `rientrato` non compare mai qui: è un istante, non un periodo, e la sua durata si misura
 * dall'evento `travel_return` — vedi `DietAgentService`.
 */
export function statoViaggioAttivo(
  profilo: ProfiloViaggio | null | undefined,
  oggi: Date = new Date(),
  maxGiorni = 30,
): StatoViaggio | null {
  const stato = profilo?.travelState ?? null;
  if (stato !== 'in_partenza' && stato !== 'in_vacanza') return null;

  const adesso = soloData(oggi);
  if (profilo?.travelEnd) return adesso <= soloData(profilo.travelEnd) ? stato : null;
  if (profilo?.travelStart) {
    return adesso <= soloData(profilo.travelStart) + Math.max(1, maxGiorni) * GIORNO ? stato : null;
  }
  return stato;
}
