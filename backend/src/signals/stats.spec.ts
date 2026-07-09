import {
  movingAverage,
  progressPercent,
  projectTargetDate,
  slopePerDay,
  stallDays,
  weeklyLossRate,
} from './stats';

const day = (n: number) => new Date(Date.UTC(2026, 6, n)); // luglio 2026

describe('movingAverage (finestra da config, spec 7.2)', () => {
  it('finestra 3: media degli ultimi 3 valori', () => {
    expect(movingAverage([70, 69, 68, 67], 3)).toEqual([70, 69.5, 69, 68]);
  });

  it('finestra 1: restituisce i valori originali', () => {
    expect(movingAverage([70, 69], 1)).toEqual([70, 69]);
  });

  it('serie più corta della finestra: media di ciò che c\'è', () => {
    expect(movingAverage([70, 68], 5)).toEqual([70, 69]);
  });
});

describe('slopePerDay + weeklyLossRate', () => {
  it('calo costante di 0.1 kg/giorno → 0.7 kg/settimana', () => {
    const points = [0, 2, 4, 6].map((n, i) => ({ date: day(1 + n), value: 70 - n * 0.1 }));
    const rate = slopePerDay(points);
    expect(rate).toBeCloseTo(-0.1, 5);
    expect(weeklyLossRate(rate)).toBeCloseTo(0.7, 2);
  });

  it('meno di 2 punti → null', () => {
    expect(slopePerDay([{ date: day(1), value: 70 }])).toBeNull();
    expect(weeklyLossRate(null)).toBeNull();
  });
});

describe('projectTargetDate (proiezione data obiettivo)', () => {
  it('68 → 62 kg a 0.1 kg/giorno = ~60 giorni', () => {
    const projected = projectTargetDate(68, 62, -0.1, day(1));
    expect(projected).not.toBeNull();
    const days = (projected!.getTime() - day(1).getTime()) / 86_400_000;
    expect(days).toBe(60);
  });

  it('ritmo nella direzione sbagliata (peso in salita) → null', () => {
    expect(projectTargetDate(68, 62, 0.05, day(1))).toBeNull();
  });

  it('ritmo nullo o proiezione oltre 2 anni → null', () => {
    expect(projectTargetDate(68, 62, 0, day(1))).toBeNull();
    expect(projectTargetDate(68, 62, -0.001, day(1))).toBeNull();
  });
});

describe('stallDays (per l\'alert alla coach)', () => {
  it('media mobile ferma da 8 giorni → 8', () => {
    const series = [
      { date: day(1), value: 68 },
      { date: day(3), value: 67.5 }, // ultimo miglioramento
      { date: day(5), value: 67.5 },
      { date: day(7), value: 67.48 }, // sotto epsilon: non conta
    ];
    expect(stallDays(series, day(11))).toBe(8);
  });

  it('miglioramento recente → pochi giorni', () => {
    const series = [
      { date: day(1), value: 68 },
      { date: day(9), value: 67.2 },
    ];
    expect(stallDays(series, day(10))).toBe(1);
  });
});

describe('progressPercent', () => {
  it('68 → 65 su obiettivo 62: 50%', () => {
    expect(progressPercent(68, 65, 62)).toBe(50);
  });

  it('limitato tra 0 e 100', () => {
    expect(progressPercent(68, 70, 62)).toBe(0);
    expect(progressPercent(68, 60, 62)).toBe(100);
  });

  it('obiettivo non inferiore alla partenza → null', () => {
    expect(progressPercent(68, 67, 68)).toBeNull();
  });
});
