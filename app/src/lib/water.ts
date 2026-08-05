/**
 * Unità di visualizzazione dell'acqua scelta dal cliente (solo display).
 * Il dato resta SEMPRE salvato in bicchieri (1 bicchiere = 250 ml, obiettivo 8 = 2 L),
 * così in backoffice l'acqua bevuta è corretta e confrontabile a prescindere dall'unità.
 */
export type WaterUnit = 'glass' | 'bottle05' | 'bottle1' | 'bottle15';

export const WATER_UNITS: Record<WaterUnit, { label: string; short: string; icon: string; glasses: number }> = {
  glass: { label: 'Bicchieri', short: 'bicchieri', icon: 'ti-glass-full', glasses: 1 }, // 250 ml
  bottle05: { label: 'Bottiglie da 0,5 L', short: 'bott. 0,5 L', icon: 'ti-bottle', glasses: 2 }, // 500 ml
  bottle1: { label: 'Bottiglie da 1 L', short: 'bott. 1 L', icon: 'ti-bottle', glasses: 4 }, // 1000 ml
  bottle15: { label: 'Bottiglie da 1,5 L', short: 'bott. 1,5 L', icon: 'ti-bottle', glasses: 6 }, // 1500 ml
};

export const WATER_UNIT_KEYS = Object.keys(WATER_UNITS) as WaterUnit[];
export const DEFAULT_WATER_UNIT: WaterUnit = 'glass';

export function isWaterUnit(v: unknown): v is WaterUnit {
  return typeof v === 'string' && (WATER_UNIT_KEYS as string[]).includes(v);
}

/** Icona da mostrare in dashboard per l'unità scelta. */
export function waterIcon(unit: WaterUnit): string {
  return WATER_UNITS[unit].icon;
}

/** Quanti bicchieri aggiunge un tap con l'unità scelta. */
export function waterStep(unit: WaterUnit): number {
  return WATER_UNITS[unit].glasses;
}

/** Converte un numero di bicchieri nel numero di unità scelte, formattato it-IT. */
export function waterValue(glasses: number, unit: WaterUnit): string {
  const per = WATER_UNITS[unit].glasses;
  const v = glasses / per;
  return Number.isInteger(v)
    ? String(v)
    : v.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * L'obiettivo giornaliero ESPRESSO NELL'UNITÀ SCELTA, come numero intero di unità.
 *
 * L'obiettivo arriva dal server in bicchieri ed è calcolato sul peso (circa 33 ml/kg), quindi è
 * quasi sempre un numero che nelle bottiglie non torna tondo: 11 bicchieri = 2,75 L diventano
 * 11/6 = 1,83 e in dashboard si leggevano «1,8» accanto all'etichetta «bottiglie da 1,5 L», cioè
 * un numero che sembrava la misura della bottiglia invece che l'obiettivo. Se la cliente ha scelto
 * di contare in bottiglie, l'obiettivo va detto in bottiglie intere: quante gliene servono.
 *
 * Arrotondiamo all'intero più vicino, mai sotto una unità. Il litraggio esatto non si perde: resta
 * nel suggerimento del riquadro (`waterLiters`). L'obiettivo VERO, quello su cui il backend valuta
 * l'aderenza, resta quello in bicchieri: qui cambia solo come lo si legge.
 */
export function waterGoalValue(goalGlasses: number, unit: WaterUnit): string {
  const per = WATER_UNITS[unit].glasses;
  if (per === 1) return String(Math.max(1, Math.round(goalGlasses)));
  return String(Math.max(1, Math.round(goalGlasses / per)));
}

/** Un numero di bicchieri scritto in litri, per dire l'obiettivo esatto senza ambiguità. */
export function waterLiters(glasses: number): string {
  return `${(glasses * 0.25).toLocaleString('it-IT', { maximumFractionDigits: 2 })} L`;
}
