/** Mappa gli slot pasto del backend (MealSlot) su etichetta, icona e colori dell'app. */
export interface SlotInfo { label: string; icon: string; bg: string; color: string }

const SLOT: Record<string, SlotInfo> = {
  breakfast: { label: 'Colazione', icon: 'ti-coffee', bg: '#F3E8DC', color: '#B8863B' },
  morning_snack: { label: 'Spuntino', icon: 'ti-apple', bg: '#F3F9E8', color: '#4D7C0F' },
  lunch: { label: 'Pranzo', icon: 'ti-salad', bg: '#DCEBE3', color: '#12A386' },
  afternoon_snack: { label: 'Merenda', icon: 'ti-cup', bg: '#EFEAF9', color: '#6C5AB7' },
  dinner: { label: 'Cena', icon: 'ti-fish', bg: '#DCEBE3', color: '#0E7C66' },
};

export function slotInfo(slot: string): SlotInfo {
  return SLOT[slot] ?? { label: slot, icon: 'ti-tools-kitchen-2', bg: '#F2EFE8', color: '#5F6E6B' };
}

/** Etichette dei metodi di cottura (Recipe.cookingMethods[].type). */
export const METHOD_LABEL: Record<string, string> = {
  veloce: 'Veloce',
  forno: 'Al forno',
  meal_prep: 'Meal prep',
};

export interface ApiMeal { slot: string; recipeId: string; name: string; kcal: number }
export interface ApiMenuDay { id: string; date: string; meals: ApiMeal[] }
export interface ApiRecipe {
  id: string;
  name: string;
  kcal: number;
  tags?: string[];
  ingredients?: { name: string; qty?: number; unit?: string }[];
  cookingMethods?: { type: string; steps: string[] }[];
}
