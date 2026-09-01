import { GIORNATA_CINQUE, slotDaCuiPescare } from '../common/slot-pasto';
import { ricettaVaBene } from '../common/regimi';

/**
 * CHI ESCE DAL PANIERE, E COSA RESTA DOPO — il giudizio, separato dallo script che cancella.
 *
 * ⛔ **Sta qui perché `panieri:pulisci` CANCELLA righe in produzione**, ed è la cosa più rischiosa
 * consegnata l'1/9. Un mese fa `rifai:troppi-pasti` avrebbe aperto buchi permanenti nei menu di due
 * clienti, e a fermarlo non è stata una rilettura: è stata una sentinella. La differenza fra i due
 * casi è che il giudizio di quello stava dentro lo script, dove nessuna prova arriva.
 *
 * ⚠️ Lo script resta padrone di **quando** scrivere e di come dirlo; qui c'è solo il *cosa*, che è
 * la parte che si può sbagliare in silenzio.
 */

export interface RigaDelPaniere {
  id: string;
  slot: string;
  recipeId: string;
  famiglia: string;
  /** Il regime del PANIERE, non della ricetta. */
  regime: string;
}

export interface RicettaPerPulizia {
  id: string;
  name: string;
  /** Il regime dichiarato della RICETTA. */
  regime: string;
  active: boolean;
}

export interface DaTogliere {
  id: string;
  chiave: string;
  slot: string;
  nome: string;
  regime: string;
}

export interface CasellaSottoSoglia {
  chiave: string;
  slot: string;
  prima: number;
  dopo: number;
}

export interface Verdetto {
  daTogliere: DaTogliere[];
  /** Le caselle (cella × pasto) che dopo la pulizia scendono sotto soglia. È il freno. */
  caselleSotto: CasellaSottoSoglia[];
}

export const chiaveCella = (famiglia: string, regime: string): string => `${famiglia} × ${regime}`;

/**
 * Cosa si toglie, e cosa resterebbe.
 *
 * ⚠️ **Tre regole che non si vedono dal nome della funzione, e che sono il motivo delle prove:**
 *
 * 1. **Le ricette spente non contano nel pool.** Il motore non le vede più (§2.4, chiuso l'1/9),
 *    quindi contarle qui direbbe che una casella è piena mentre alla cliente arriva vuota. ⛔ Ma si
 *    tolgono lo stesso se il regime non va: una riga sbagliata resta sbagliata anche da spenta, e
 *    il giorno che qualcuno riattiva quella ricetta tornerebbe in un paniere che non può mangiarla.
 * 2. **I gemelli si contano uniti** (Fase 2): spuntino e merenda sono un paniere solo, ed è così
 *    che la cliente li vede. Separati direbbero due caselle povere dove ce n'è una piena.
 * 3. **Una casella che era già a zero non si segnala.** Non è la pulizia a svuotarla, e metterla
 *    nell'elenco farebbe sembrare che togliere le righe sbagliate rompa qualcosa che era già rotto
 *    — che è il modo più veloce per far rinunciare chi legge.
 */
export function cosaTogliere(
  righe: readonly RigaDelPaniere[],
  ricette: readonly RicettaPerPulizia[],
  soglia: number,
): Verdetto {
  const perId = new Map(ricette.map((r) => [r.id, r]));
  const daTogliere: DaTogliere[] = [];
  /** cella → slot → ricette ATTIVE, prima e dopo. */
  const prima = new Map<string, Map<string, Set<string>>>();
  const dopo = new Map<string, Map<string, Set<string>>>();

  const aggiungi = (m: Map<string, Map<string, Set<string>>>, chiave: string, slot: string, id: string) => {
    const perSlot = m.get(chiave) ?? new Map<string, Set<string>>();
    const set = perSlot.get(slot) ?? new Set<string>();
    set.add(id);
    perSlot.set(slot, set);
    m.set(chiave, perSlot);
  };

  for (const r of righe) {
    const ric = perId.get(r.recipeId);
    /** ⚠️ Una riga che punta a una ricetta che non esiste non si giudica: non si sa cosa fosse. */
    if (!ric) continue;
    const chiave = chiaveCella(r.famiglia, r.regime);
    const vaBene = ricettaVaBene(ric.regime, r.regime);
    if (!vaBene) daTogliere.push({ id: r.id, chiave, slot: r.slot, nome: ric.name, regime: ric.regime });
    if (!ric.active) continue;
    aggiungi(prima, chiave, r.slot, r.recipeId);
    if (vaBene) aggiungi(dopo, chiave, r.slot, r.recipeId);
  }

  const uniti = (perSlot: Map<string, Set<string>> | undefined, slot: string): number => {
    const s = new Set<string>();
    for (const g of slotDaCuiPescare(slot)) for (const id of perSlot?.get(g) ?? []) s.add(id);
    return s.size;
  };

  const caselleSotto: CasellaSottoSoglia[] = [];
  for (const [chiave, perSlot] of prima) {
    for (const slot of GIORNATA_CINQUE) {
      const a = uniti(perSlot, slot);
      if (a === 0) continue;
      const b = uniti(dopo.get(chiave), slot);
      if (b < soglia && b < a) caselleSotto.push({ chiave, slot, prima: a, dopo: b });
    }
  }
  caselleSotto.sort((x, y) => x.dopo - y.dopo);
  return { daTogliere, caselleSotto };
}
