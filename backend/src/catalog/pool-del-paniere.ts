/**
 * DA DOVE VIENE IL POOL DI UNA CLIENTE — la porta unica della Fase 2 del piano panieri.
 *
 * ⛔ Fino a oggi il pool si costruiva leggendo `DietDayTemplate.meals`, cioè **l'appartenenza
 * viveva dentro il JSON delle giornate**. Da questa consegna la domanda «quali ricette può ricevere
 * questa cliente, per ogni pasto» si fa **in un posto solo**, e la sorgente è un interruttore:
 *
 *  · `giornate` — come sempre: si legge dalle giornate pre-costruite. **È il default.**
 *  · `paniere`  — si legge da `PaniereRicetta`, la tabella con le chiavi esterne.
 *
 * ⚠️ **Con l'interruttore su `giornate` non cambia niente per nessuna cliente**, ed è voluto: la
 * tabella dei panieri si riempie con un passo suo (`npm run panieri:riempi`), e finché non è piena
 * e verificata leggere di là vorrebbe dire comporre menu da un pool vuoto. Si sposta quando il
 * confronto prima/dopo torna, non prima.
 *
 * ⛔ **E non è un ripiego automatico.** La tentazione era «se il paniere è vuoto leggi le
 * giornate»: sarebbe una porta che risponde da due posti a seconda dello stato del database, cioè
 * esattamente il genere di cosa che funziona per mesi e poi un giorno serve il menu sbagliato senza
 * che nessuno sappia perché. La sorgente la decide un parametro che si legge, non il caso.
 */

export interface Appartenenza {
  slot: string;
  recipeId: string;
}

export type Sorgente = 'giornate' | 'paniere';

/** L'unica sorgente che vale se il parametro dice una parola che non conosciamo. */
export const SORGENTE_PREDEFINITA: Sorgente = 'giornate';

/**
 * ⚠️ Una parola sconosciuta nel parametro **non** apre il paniere: si torna al comportamento di
 * sempre. Un refuso in `config_param` non deve poter spostare da cosa mangiano le clienti.
 */
export function leggiSorgente(valore: string | null | undefined): Sorgente {
  return valore === 'paniere' ? 'paniere' : SORGENTE_PREDEFINITA;
}

/** Le righe di appartenenza contenute nelle giornate pre-costruite. */
export function righeDalleGiornate(
  giornate: readonly { meals: unknown }[] | null | undefined,
): Appartenenza[] {
  const out: Appartenenza[] = [];
  for (const g of giornate ?? []) {
    if (!Array.isArray(g?.meals)) continue;
    for (const m of g.meals as { slot?: unknown; recipeId?: unknown }[]) {
      if (!m || typeof m !== 'object') continue;
      const slot = String(m.slot ?? '').trim();
      const recipeId = String(m.recipeId ?? '').trim();
      if (slot && recipeId) out.push({ slot, recipeId });
    }
  }
  return out;
}

/**
 * Il pool per pasto: slot → insieme di ricette.
 *
 * ⚠️ La forma delle due sorgenti è la stessa (`{slot, recipeId}`), ed è per questo che la porta può
 * essere una sola: cambia da dove arrivano le righe, non cosa se ne fa.
 */
export function poolPerSlot(righe: readonly Appartenenza[]): Map<string, Set<string>> {
  const pool = new Map<string, Set<string>>();
  for (const r of righe ?? []) {
    if (!r?.slot || !r?.recipeId) continue;
    if (!pool.has(r.slot)) pool.set(r.slot, new Set());
    pool.get(r.slot)!.add(r.recipeId);
  }
  return pool;
}

/** Tutte le ricette del pool, senza distinzione di pasto. */
export const ricetteDelPool = (pool: ReadonlyMap<string, Set<string>>): Set<string> => {
  const tutte = new Set<string>();
  for (const s of pool.values()) for (const id of s) tutte.add(id);
  return tutte;
};

export interface PrismaPerPaniere {
  paniereRicetta: {
    findMany(args: unknown): Promise<{ recipeId: string; slot: string }[]>;
  };
}

/**
 * Le righe di appartenenza dal PANIERE di una variante.
 *
 * ⚠️ Si passa famiglia e regime e non l'id della dieta: il paniere è famiglia × regime, e molte
 * varianti versano nello stesso (strada B, §1.6 del piano). Chiedere «il paniere di questa dieta»
 * suggerirebbe un legame uno-a-uno che non esiste.
 */
export async function righeDalPaniere(
  prisma: PrismaPerPaniere,
  famiglia: string,
  regime: string,
): Promise<Appartenenza[]> {
  if (!famiglia || !regime) return [];
  const righe = await prisma.paniereRicetta.findMany({
    where: { paniere: { famiglia, regime } },
    select: { recipeId: true, slot: true },
  });
  return (righe ?? []).map((r) => ({ slot: r.slot, recipeId: r.recipeId }));
}
