import { registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

interface StepCounterPlugin {
  getStepCount(): Promise<{ steps: number; stale?: boolean }>;
}

const StepCounter = registerPlugin<StepCounterPlugin>('StepCounter');
const KEY = 'metabole_steps_baseline';

/**
 * Passi di OGGI dal sensore hardware del telefono (delta rispetto a una baseline
 * di inizio giornata). Il sensore TYPE_STEP_COUNTER è cumulativo dall'ultimo
 * riavvio, quindi salviamo la prima lettura del giorno come punto zero.
 * Ritorna null se il sensore/permesso non è disponibile (es. web, device senza
 * sensore, permesso negato) → in quel caso si usa il valore dal backend.
 */
export async function getTodaySteps(): Promise<number | null> {
  try {
    const { steps } = await StepCounter.getStepCount();
    if (typeof steps !== 'number' || !Number.isFinite(steps)) return null;
    const today = new Date().toISOString().slice(0, 10);
    const { value } = await Preferences.get({ key: KEY });
    let baseline = value ? (JSON.parse(value) as { date: string; value: number }) : null;
    // Nuovo giorno, prima lettura, o riavvio telefono (counter azzerato) → nuova baseline.
    if (!baseline || baseline.date !== today || steps < baseline.value) {
      baseline = { date: today, value: steps };
      await Preferences.set({ key: KEY, value: JSON.stringify(baseline) });
    }
    return Math.max(0, steps - baseline.value);
  } catch {
    return null;
  }
}
