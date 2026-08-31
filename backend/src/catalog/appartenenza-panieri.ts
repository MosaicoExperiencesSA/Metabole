/**
 * DA QUALE PANIERE VIENE UNA VARIANTE — la regola della migrazione della Fase 1.
 *
 * ⛔ `Diet` oggi è la **variante** (famiglia × regime × obiettivo × struttura pasti: 318 righe).
 * Il paniere è **famiglia × regime** e basta: 10 × 4 − 2 = 38. Quindi molte varianti confluiscono
 * nello stesso paniere, ed è esattamente quello che il piano vuole (§1.6, strada B) — un pranzo
 * vegano a basso indice glicemico serve anche DASH vegana e Mediterranea vegana, e non si
 * riscrive.
 *
 * ⚠️ **Obiettivo e struttura pasti NON entrano nella chiave.** «Mediterranea onnivora dimagrimento
 * 3 pasti» e «Mediterranea onnivora mantenimento 5 pasti» versano nello stesso paniere: le calorie
 * e la struttura le decide il motore quando compone, non l'appartenenza del piatto.
 *
 * ⛔ **E il digiuno nemmeno**: `Digiuno intermittente (16:8)` non è una famiglia, è una struttura
 * pasti travestita (§2.1 del piano). Qui si mappa sulla famiglia vera che il piano gli assegna, o
 * si dichiara non mappabile — non si inventa un paniere «Digiuno», che sarebbe la settima famiglia
 * fantasma dopo le sei che questo lavoro esiste per chiudere.
 */

/** Le dieci famiglie del piano (§1.1), coi nomi come stanno in `Diet.name`. */
export const FAMIGLIE = [
  'Basso indice glicemico', 'DASH', 'Detossinante (reset depurativo)', 'Flessibile',
  'Iperproteica sportiva / ricomposizione', 'Keto (non terapeutica)', 'Keto-Mediterranea',
  'Low carb', 'Mediterranea', 'Proteica',
] as const;

/** I quattro regimi (§1.2), coi nomi come stanno in `Diet.regime`. */
export const REGIMI = ['omnivore', 'pescetarian', 'vegetarian', 'vegan'] as const;

/**
 * ⛔ Le due combinazioni dichiarate impossibili (§1.3). Si bloccano **a priori**: chi ci finisce
 * sopra legge «combinazione non possibile», non un paniere vuoto — che sembra un problema
 * temporaneo e nessuno lo guarda.
 */
export const IMPOSSIBILI: readonly string[] = ['Keto (non terapeutica)|vegan', 'Keto-Mediterranea|vegan'];

/**
 * Le famiglie di oggi che **non sono famiglie** e dove vanno (§2.1). ⚠️ Vuoto = la variante non si
 * migra e si dichiara: meglio una riga in un elenco da guardare che un paniere inventato.
 */
export const FAMIGLIE_CHE_SPARISCONO: Readonly<Record<string, string>> = {
  // Regimi travestiti da famiglia: la famiglia vera non c'è, il regime sì → non si migra.
  Vegana: '',
  'Vegetariana (latto-ovo)': '',
  // Strutture e obiettivi travestiti da famiglia.
  'Digiuno intermittente (16:8)': '',
  'Mediterranea ipocalorica': 'Mediterranea',
  // Decisione di Simone del 27/8: il paniere resta, la famiglia si chiude → confluisce.
  'Mediterranea senza glutine': 'Mediterranea',
  // Funzioni, non panieri (§6).
  'Ritorno in Equilibrio': '',
  'Vacanze in Serenità': '',
};

export interface VariantePerPaniere {
  id: string;
  name: string;
  regime: string;
}

export type Esito =
  | { tipo: 'paniere'; famiglia: string; regime: string }
  | { tipo: 'impossibile'; famiglia: string; regime: string }
  | { tipo: 'non_mappabile'; perche: string };

const FAMIGLIA = new Set<string>(FAMIGLIE);
const REGIME = new Set<string>(REGIMI);

export function paniereDellaVariante(d: VariantePerPaniere): Esito {
  const regime = (d.regime ?? '').trim();
  if (!REGIME.has(regime)) return { tipo: 'non_mappabile', perche: `regime sconosciuto: «${regime}»` };

  const nome = (d.name ?? '').trim();
  let famiglia = nome;
  if (!FAMIGLIA.has(famiglia)) {
    const dove = FAMIGLIE_CHE_SPARISCONO[famiglia];
    if (dove === undefined) return { tipo: 'non_mappabile', perche: `famiglia sconosciuta: «${nome}»` };
    if (!dove) return { tipo: 'non_mappabile', perche: `«${nome}» non è una famiglia (§2.1 del piano)` };
    famiglia = dove;
  }
  if (IMPOSSIBILI.includes(`${famiglia}|${regime}`)) return { tipo: 'impossibile', famiglia, regime };
  return { tipo: 'paniere', famiglia, regime };
}

/** I 38 panieri da creare, in ordine stabile. */
export function panieriDaCreare(): { famiglia: string; regime: string }[] {
  const out: { famiglia: string; regime: string }[] = [];
  for (const famiglia of FAMIGLIE) {
    for (const regime of REGIMI) {
      if (!IMPOSSIBILI.includes(`${famiglia}|${regime}`)) out.push({ famiglia, regime });
    }
  }
  return out;
}

/** Gli id di ricetta nominati da una giornata, per slot. ⚠️ `meals` è Json: non ci si fida. */
export function ricetteDellaGiornata(meals: unknown): { slot: string; recipeId: string }[] {
  if (!Array.isArray(meals)) return [];
  const out: { slot: string; recipeId: string }[] = [];
  for (const m of meals) {
    if (!m || typeof m !== 'object') continue;
    const slot = String((m as { slot?: unknown }).slot ?? '').trim();
    const recipeId = String((m as { recipeId?: unknown }).recipeId ?? '').trim();
    if (slot && recipeId) out.push({ slot, recipeId });
  }
  return out;
}
