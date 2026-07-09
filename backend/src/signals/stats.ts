/**
 * Statistiche pure sui segnali (specifica sez. 7.2: ragionare sulla TENDENZA,
 * media mobile su N rilevazioni, mai sul singolo dato).
 * Nessuna dipendenza: tutto testabile in isolamento.
 */

export interface DatedValue {
  date: Date;
  value: number;
}

/** Media mobile semplice sugli ultimi `window` valori di ogni punto. */
export function movingAverage(values: number[], window: number): number[] {
  if (window < 1) window = 1;
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * Pendenza (unità/giorno) con regressione lineare sui punti datati.
 * Ritorna null con meno di 2 punti o intervallo nullo.
 */
export function slopePerDay(points: DatedValue[]): number | null {
  if (points.length < 2) return null;
  const t0 = points[0].date.getTime();
  const xs = points.map((p) => (p.date.getTime() - t0) / 86_400_000);
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * Proiezione della data in cui si raggiunge `target` proseguendo al ritmo attuale.
 * Ritorna null se il ritmo non va nella direzione giusta o è trascurabile.
 */
export function projectTargetDate(
  current: number,
  target: number,
  ratePerDay: number | null,
  from: Date,
  maxDaysAhead = 730,
): Date | null {
  if (ratePerDay === null) return null;
  const remaining = target - current; // negativo se bisogna scendere
  if (remaining === 0) return from;
  if (ratePerDay === 0 || Math.sign(remaining) !== Math.sign(ratePerDay)) return null;
  const days = remaining / ratePerDay;
  if (!Number.isFinite(days) || days > maxDaysAhead) return null;
  return new Date(from.getTime() + Math.ceil(days) * 86_400_000);
}

/**
 * Giorni di stallo: da quanti giorni la media mobile non migliora (non scende)
 * di almeno `epsilonKg`. Usato per l'alert alla coach (config: stall_days_before_coach_alert).
 */
export function stallDays(
  maSeries: DatedValue[],
  today: Date,
  epsilonKg = 0.1,
): number {
  if (maSeries.length === 0) return 0;
  let bestSoFar = maSeries[0].value;
  let lastImprovement = maSeries[0].date;
  for (const point of maSeries.slice(1)) {
    if (point.value <= bestSoFar - epsilonKg) {
      bestSoFar = point.value;
      lastImprovement = point.date;
    }
  }
  return Math.max(0, Math.floor((today.getTime() - lastImprovement.getTime()) / 86_400_000));
}

/** Ritmo settimanale (kg/settimana, positivo = calo) dalla pendenza giornaliera. */
export function weeklyLossRate(ratePerDay: number | null): number | null {
  if (ratePerDay === null) return null;
  return Math.round(-ratePerDay * 7 * 100) / 100;
}

/** Percentuale di avanzamento start→target, limitata a [0, 100]. */
export function progressPercent(start: number, current: number, target: number): number | null {
  const total = start - target;
  if (total <= 0) return null;
  const done = ((start - current) / total) * 100;
  return Math.round(Math.min(Math.max(done, 0), 100) * 10) / 10;
}
