import { grammiDi } from '../catalog/agente-pasti-leggeri';
import { ingredientePrincipale } from '../catalog/piatto-di-cosa';
import { paroleAlimento, radice } from '../common/nomi-alimento';

/**
 * LA FAMIGLIA DI UN PIATTO — «due frittate di fila è un errore» (Simone, 19/9).
 *
 * Il 21 e il 22 settembre una cliente ha ricevuto «Frittata con funghi e prezzemolo» e «Frittata con
 * zucchine e formaggio». Per il motore erano due piatti diversi — due `recipeId` diversi — e tutte le
 * regole di varietà erano rispettate: guardano l'identità della ricetta, non che cosa c'è dentro.
 *
 * ⛔ **La famiglia è l'INGREDIENTE PRINCIPALE** (decisione di Simone, 19/9): quello che pesa di più,
 * la stessa porta che decide se un piatto è «di carne» o «di pesce» (`catalog/piatto-di-cosa.ts`).
 * Così due frittate sono la stessa famiglia (uova) anche se una ha i funghi e l'altra le zucchine — e
 * lo sono anche le uova strapazzate, che è proprio quello che Simone ha chiesto.
 *
 * ⚠️ **Senza grammature non c'è famiglia**: `ingredientePrincipale` torna `null` e questa funzione
 * pure. `null` vuol dire «non lo so», e chi la usa non deve scartare niente per un «non lo so» — la
 * regola vale solo dove il catalogo è scritto per intero.
 */

/**
 * Parole che nel nome di un ingrediente descrivono lo STATO o la QUALITÀ, non l'alimento.
 * ⛔ Senza questo elenco «sgombro affumicato» e «salmone affumicato» risulterebbero la stessa
 * famiglia perché condividono «affumicato» — due pesci diversi bloccati a vicenda per un aggettivo.
 */
const PAROLE_DI_CONTORNO = new Set([
  'affumicato', 'affumicata', 'affumicati', 'affumicate',
  'fresco', 'fresca', 'freschi', 'fresche', 'secco', 'secca', 'secchi', 'secche',
  'grigliato', 'grigliata', 'grigliati', 'grigliate', 'lessato', 'lessata', 'lesso', 'lessa',
  'cotto', 'cotta', 'cotti', 'cotte', 'crudo', 'cruda', 'crudi', 'crude',
  'surgelato', 'surgelata', 'surgelati', 'surgelate', 'integrale', 'integrali',
  'magro', 'magra', 'magri', 'magre', 'light', 'bio', 'biologico', 'biologica',
  'naturale', 'naturali', 'misto', 'mista', 'misti', 'miste',
  'filetto', 'filetti', 'petto', 'petti', 'fesa', 'polpa', 'fetta', 'fette', 'trancio', 'tranci',
  'olio', 'sale', 'acqua',
].map(radice));

/**
 * Nomi diversi dello stesso alimento. Elenco corto per scelta: ci sta quello che davvero si vede due
 * giorni di fila nello stesso pasto. Si allunga quando serve, non «per sicurezza».
 *
 * ⚠️ Le chiavi si scrivono per esteso e si riducono a RADICE qui sotto, perché è su quella che si
 * confronta: scritte a mano, «albumi» (radice «album») non avrebbe mai combaciato con «albume».
 * ⛔ Pollo e tacchino NON sono sinonimi: sono due carni, e chi le mangia le distingue.
 */
const SINONIMI: Record<string, string> = Object.fromEntries(
  ([
    ['uovo', 'uova'], ['uova', 'uova'], ['albume', 'uova'], ['albumi', 'uova'],
    ['tuorlo', 'uova'], ['frittata', 'uova'], ['omelette', 'uova'],
    ['yogurt', 'yogurt'], ['skyr', 'yogurt'],
    ['fiocchi', 'avena'], ['avena', 'avena'],
  ] as [string, string][]).map(([da, a]) => [radice(da), a]),
);

/** Le parole «vere» del nome di un alimento: senza stato, qualità e tagli. */
function paroleVere(nome: string): string[] {
  return paroleAlimento(nome)
    .map(radice)
    .filter((p) => !PAROLE_DI_CONTORNO.has(p))
    .map((p) => SINONIMI[p] ?? p);
}

/**
 * La famiglia del piatto: il nome del suo ingrediente principale, oppure `null` se le grammature
 * non ci sono. Il nome resta com'è scritto: a confrontarlo pensa `stessaFamiglia`.
 */
export function famigliaDelPiatto(ingredienti: unknown): string | null {
  if (!Array.isArray(ingredienti)) return null;
  const pesati = (ingredienti as unknown[]).map((i) => ({
    name: String((i as { name?: unknown })?.name ?? ''),
    grammi: grammiDi(i),
  }));
  const principale = ingredientePrincipale(pesati);
  if (!principale) return null;
  return paroleVere(principale).length ? principale : null;
}

/**
 * Due famiglie sono la stessa cosa se i due nomi hanno una parola vera in comune: «petto di pollo» e
 * «pollo» sì, «riso venere» e «riso basmati» sì, «uova» e «frittata di uova» sì. Il confronto è per
 * PAROLA e non per sottostringa, come in `common/nomi-alimento.ts`: «pepe» non è «peperoni».
 *
 * ⚠️ Un `null` non combacia con niente, nemmeno con un altro `null`: «non so cosa sia» non è una
 * ragione per togliere un piatto dalla tavola di qualcuno.
 */
export function stessaFamiglia(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const pa = paroleVere(a);
  const pb = new Set(paroleVere(b));
  return pa.some((p) => pb.has(p));
}

/** Vero se questa famiglia è già comparsa fra quelle recenti dello stesso pasto. */
export function famigliaGiaVista(famiglia: string | null | undefined, recenti: readonly (string | null | undefined)[]): boolean {
  return recenti.some((r) => stessaFamiglia(famiglia, r));
}
