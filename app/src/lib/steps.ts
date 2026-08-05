import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

interface StepCounterPlugin {
  getStepCount(): Promise<{ steps: number; stale?: boolean }>;
}

const StepCounter = registerPlugin<StepCounterPlugin>('StepCounter');
const KEY = 'metabole_steps_baseline';

/**
 * Passi di OGGI dal sensore del telefono.
 * - iOS (CMPedometer): il nativo restituisce GIÀ i passi di oggi (da inizio
 *   giornata) → si usa il valore così com'è, senza baseline.
 * - Android (TYPE_STEP_COUNTER): il sensore è cumulativo dall'ultimo riavvio,
 *   quindi calcoliamo il delta rispetto a una baseline di inizio giornata.
 * Ritorna null se il sensore/permesso non è disponibile (es. web, device senza
 * sensore, permesso negato) → in quel caso si usa il valore dal backend.
 */
export async function getTodaySteps(): Promise<number | null> {
  try {
    const { steps } = await StepCounter.getStepCount();
    if (typeof steps !== 'number' || !Number.isFinite(steps)) return null;
    // iOS: passi di oggi già pronti, nessuna baseline da applicare.
    if (Capacitor.getPlatform() === 'ios') return Math.max(0, Math.round(steps));
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
