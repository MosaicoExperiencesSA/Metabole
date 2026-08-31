/**
 * ⛔ **PRIMA DI BLOCCARE, CERCA UN'ALTERNATIVA** — la regola che mancava, 31/8.
 *
 * ## Il fatto
 *
 * Patrizia, sette allergie e trentanove cibi esclusi, menu del rientro fermo. Il log dell'erogazione
 * dice due cose insieme: *«262 ricette tolte dal pool prima della composizione»* e **nessun** avviso
 * «per lo slot X nessuna ricetta del pool è sicura». Cioè: per **ogni pasto** un'alternativa sicura
 * c'era, e il motore si è fermato lo stesso.
 *
 * Perché la giornata la sceglie il **catalogo** (le `dietDayTemplate`), non il pool: se dentro quella
 * giornata c'è un piatto che la cliente non può mangiare, la guardia lo vede e `deliverIfEligible`
 * fa `return []`. Niente menu, per un piatto su cinque, con quattro alternative buone in mano.
 *
 * ## La regola, dettata da Simone il 31/8
 *
 * *«Il sistema deve cercare un'alternativa e erogare il menu… altrimenti non è un sistema pensante»*
 * — e, sull'avviso al nutrizionista: *«non deve avvisare, deve trovare un'alternativa»*.
 *
 * Quindi il blocco diventa **l'ultima risorsa**: si sostituisce il piatto, e ci si ferma solo quando
 * per quel pasto non esiste **niente** di sicuro. L'avviso resta, ma dice un'altra cosa — che il
 * catalogo ha un buco — invece di essere la risposta al posto del menu.
 *
 * ## ⚠️ Perché questo non può fare danni a chi oggi sta bene
 *
 * Entra **solo** dove oggi l'erogazione restituisce `[]`. Il confronto non è «piatto vecchio contro
 * piatto nuovo»: è **un piatto contro nessun menu**. Per tutte le clienti la cui giornata è già
 * sicura questo modulo non viene nemmeno chiamato.
 *
 * ⛔ È la differenza con la prima stesura di stamattina, che invece toccava la **scelta** per tutti e
 * cambiava i menu anche a chi non aveva nessun problema. Quella l'ha bocciata la revisione, e aveva
 * ragione.
 *
 * ## Le kcal: si tiene la banda finché si può, ma la sicurezza viene prima
 *
 * Il candidato si preferisce dentro la banda calorica del piatto che sostituisce, per non sfasciare
 * il bilanciamento della giornata. Se nella banda non c'è niente di sicuro, si prende il **più
 * vicino di calorie** — non il più votato: fra una giornata un po' sbilanciata e nessuna giornata,
 * si sceglie la prima, e si sceglie il modo che la sbilancia di meno. ⚠️ E si dichiara: chi legge il
 * log deve sapere che quel giorno è un ripiego.
 */

export interface ContestoScelta {
  slotPool: Map<string, Set<string>>;
  kcalOf: Map<string, number>;
  score: (id: string) => number;
}

export interface PastoDaSalvare {
  slot: string;
  recipeId: string;
}

export interface Sostituzione {
  slot: string;
  da: string;
  a: string;
  /** Vero se si è dovuti uscire dalla banda calorica per trovarne uno sicuro. */
  fuoriBanda: boolean;
}

export interface EsitoRicerca {
  sostituzioni: Sostituzione[];
  /** I pasti per cui non esiste NIENTE di sicuro: sono questi, e solo questi, a fermare la giornata. */
  senzaAlternativa: { slot: string; recipeId: string }[];
}

/**
 * Sostituisce **sul posto** i pasti non sicuri con il miglior candidato sicuro del pool.
 *
 * ⚠️ `nonSicure` sono gli id che la **guardia** ha giudicato non servibili — la stessa
 * `valutaRicetta` che filtra il pool. Non un secondo elenco: *se due punti rispondono alla stessa
 * domanda, uno deve chiamare l'altro*.
 */
export function cercaUnAlternativa(
  giorni: { meals: PastoDaSalvare[] }[],
  nonSicure: ReadonlySet<string>,
  ctx: ContestoScelta,
  tol: number,
): EsitoRicerca {
  const sostituzioni: Sostituzione[] = [];
  const senzaAlternativa: { slot: string; recipeId: string }[] = [];
  if (!nonSicure.size) return { sostituzioni, senzaAlternativa };

  for (const giorno of giorni) {
    /**
     * ⚠️ **Niente doppioni dentro la stessa giornata**: sostituire la colazione col piatto che è già
     * il pranzo darebbe una giornata con lo stesso piatto due volte — che a chi la riceve sembra un
     * guasto, non una scelta. Si guarda quello che c'è **adesso** nella giornata, aggiornato man
     * mano che si sostituisce.
     */
    const usati = new Set(giorno.meals.map((m) => m.recipeId));
    for (const m of giorno.meals) {
      if (!nonSicure.has(m.recipeId)) continue;
      const pool = ctx.slotPool.get(m.slot);
      if (!pool || pool.size === 0) {
        senzaAlternativa.push({ slot: m.slot, recipeId: m.recipeId });
        continue;
      }
      const base = ctx.kcalOf.get(m.recipeId);
      const lo = base != null ? base * (1 - tol) : Number.NEGATIVE_INFINITY;
      const hi = base != null ? base * (1 + tol) : Number.POSITIVE_INFINITY;

      let inBanda: string | null = null;
      let inBandaScore = Number.NEGATIVE_INFINITY;
      let vicino: string | null = null;
      let vicinoScarto = Number.POSITIVE_INFINITY;
      let vicinoScore = Number.NEGATIVE_INFINITY;

      for (const cand of pool) {
        if (cand === m.recipeId || usati.has(cand)) continue;
        /**
         * ⛔ Il pool è già stato ripulito dalle ricette non sicure, ma si ricontrolla lo stesso: se
         * un domani i due filtri divergessero, qui si sceglierebbe **proprio** il piatto che la
         * guardia sta per vietare, e la cliente resterebbe ferma con una sostituzione in più.
         */
        if (nonSicure.has(cand)) continue;
        const s = ctx.score(cand);
        const k = ctx.kcalOf.get(cand);
        if (k != null && k >= lo && k <= hi) {
          if (inBanda === null || s > inBandaScore + 1e-9 || (Math.abs(s - inBandaScore) <= 1e-9 && cand < inBanda)) {
            inBanda = cand;
            inBandaScore = s;
          }
        }
        // Il ripiego: il più vicino di calorie. A parità di scarto comanda il punteggio, poi l'id —
        // senza il terzo criterio due candidati gemelli si alternerebbero secondo l'ordine del
        // database, che non è garantito.
        const scarto = k != null && base != null ? Math.abs(k - base) : Number.POSITIVE_INFINITY;
        if (
          vicino === null
          || scarto < vicinoScarto - 1e-9
          || (Math.abs(scarto - vicinoScarto) <= 1e-9
            && (s > vicinoScore + 1e-9 || (Math.abs(s - vicinoScore) <= 1e-9 && cand < vicino)))
        ) {
          vicino = cand;
          vicinoScarto = scarto;
          vicinoScore = s;
        }
      }

      const scelto = inBanda ?? vicino;
      if (scelto === null) {
        senzaAlternativa.push({ slot: m.slot, recipeId: m.recipeId });
        continue;
      }
      sostituzioni.push({ slot: m.slot, da: m.recipeId, a: scelto, fuoriBanda: inBanda === null });
      usati.delete(m.recipeId);
      usati.add(scelto);
      m.recipeId = scelto;
    }
  }
  return { sostituzioni, senzaAlternativa };
}
