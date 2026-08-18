/**
 * UNA GIORNATA COPIATA VA RIPORZIONATA, NON RICOPIATA — ultima coda della voce 255.
 *
 * ## Chi copia le giornate
 *
 * Il **kit di rientro** (`monitoring.generateRientroMenus`): a fine pausa, se il peso è risalito,
 * sceglie i giorni che su quella cliente avevano funzionato meglio e li **ricrea nei giorni
 * successivi**, copiando `meals` così com'è. È l'unico posto del progetto dove una giornata di
 * ieri diventa una giornata di domani senza passare da `deliverIfEligible`.
 *
 * ## Perché copiarla e basta è sbagliato, in due modi diversi
 *
 * 1. **La giornata vecchia non è scalata.** Le porzioni si scalano dal 18/8: un giorno di due mesi
 *    fa non ha nessun `porzione`. Copiato di peso, il kit di rientro **rimette nel futuro una
 *    giornata al 65%** — e nessuno la aggiusterà più, perché `deliverIfEligible` compone solo le
 *    date che non esistono ancora e il suo `upsert` ha `update: {}`. Il rimedio del 18/8 le
 *    passerebbe accanto senza vederla.
 * 2. **Il fattore vecchio non è più il suo.** Una giornata scalata a ×1,8 quando pesava dieci chili
 *    di più è dimensionata su un fabbisogno che oggi non ha. Il numero è giusto per quel giorno, e
 *    per nessun altro.
 *
 * ⚠️ E il modo sbagliato di rimediare è **scalare quello che è già scalato**: 891 kcal × 1,8 fa
 * 1603, cioè ×3,24 sulla ricetta. Si torna sempre alla **porzione di catalogo** prima di
 * riscalare — `kcalBase` esiste per questo.
 */
import type { MealSnapshot } from './pasto-giornata';
import { porzioniScalate, type TettiPorzione } from './porzione-scalata';

/**
 * La giornata riportata alla porzione di CATALOGO: `kcal` torna a `kcalBase`, il fattore sparisce.
 *
 * ⚠️ Un pasto senza `kcalBase` non è mai stato scalato e resta com'è. ⚠️ E `porzione` va **tolto**,
 * non messo a 1: l'app distingue «assente» da «presente», e una giornata con `porzione: 1` addosso
 * direbbe alla cliente che qualcosa è stato deciso sulla sua porzione quando non è vero.
 */
export function aPorzioneDiCatalogo(meals: MealSnapshot[]): MealSnapshot[] {
  return meals.map((m) => {
    if (m?.kcalBase === undefined || m?.kcalBase === null) {
      if (m?.porzione === undefined) return m;
      const { porzione: _via, ...senzaFattore } = m;
      return senzaFattore as MealSnapshot;
    }
    const { porzione: _f, kcalBase: _b, ...resto } = m;
    return { ...resto, kcal: m.kcalBase } as MealSnapshot;
  });
}

/**
 * Riporziona una giornata copiata sul fabbisogno di **adesso**.
 *
 * ⚠️ **Senza un target non si tocca niente**, e la giornata resta esattamente com'era. È la scelta
 * prudente e non la comoda: riportarla alla porzione di catalogo «perché non sappiamo» le
 * **rimpicciolirebbe** il piatto in silenzio, e «non si rimpicciolisce mai» è la regola con cui la
 * strada C è stata decisa (voce 255).
 *
 * ⚠️ La scalatura passa da `porzioniScalate`, la stessa funzione che usa l'erogazione: se domani i
 * tetti cambiano, il kit di rientro cambia con lei. Due funzioni per la stessa domanda si
 * contraddicono in un pomeriggio — è già successo il 17/8 fra il motore e `diag:digiuni`.
 */
export function riporzionaSulFabbisogno(
  meals: unknown,
  targetKcal: number | null | undefined,
  tetti: TettiPorzione,
): { meals: MealSnapshot[]; cambiata: boolean } {
  if (!Array.isArray(meals)) return { meals: [], cambiata: false };
  const originali = meals as MealSnapshot[];
  if (!targetKcal || !Number.isFinite(targetKcal) || targetKcal <= 0) {
    return { meals: originali, cambiata: false };
  }
  const base = aPorzioneDiCatalogo(originali);
  const esito = porzioniScalate(base, targetKcal, tetti);
  const nuovi = base.map((m, i) => {
    const f = esito.fattori[i];
    if (!(f > 1.0001)) return m;
    return { ...m, kcal: Math.round(m.kcal * f), kcalBase: m.kcal, porzione: Math.round(f * 100) / 100 };
  });
  const cambiata = nuovi.some((m, i) => m.kcal !== originali[i]?.kcal || m.porzione !== originali[i]?.porzione);
  return { meals: nuovi, cambiata };
}
