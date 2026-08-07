import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { numeroOpzionale, numeroOpzionaleConZero } from './validazione';
import { SubmitAnswersDto } from '../onboarding/dto/submit-answers.dto';
import { UpdateObjectiveDto } from '../profile/dto/update-profile.dto';
import { CreateMeasurementDto } from '../signals/dto/signals.dto';

/**
 * Il 7/8 una cliente non riusciva a correggere le misure perché lasciava vuota una casella:
 * `Number('')` fa **0**, e lo zero passa il controllo «è un numero» per poi schiantarsi sul
 * minimo. Corretto quel punto, un controllo sugli altri DTO che le clienti compilano ha trovato
 * lo stesso difetto **ancora vivo** nel questionario di registrazione e nella modifica
 * dell'obiettivo.
 *
 * Questi test tengono chiusi tutti e tre insieme, perché il difetto non era in un file: era in
 * un modo di scrivere i DTO che si ripete ogni volta che se ne aggiunge uno.
 */

const errori = (cls: new () => object, body: Record<string, unknown>) =>
  validateSync(plainToInstance(cls, body) as object, { whitelist: true });

const inglese = (e: unknown) => /must not be|must be a|must be longer|must be shorter/.test(JSON.stringify(e));

describe('numeroOpzionale — «campo vuoto» non è «zero»', () => {
  it.each(['', '   ', null, undefined, 0, '0', -3])('«%s» → undefined', (v) => {
    expect(numeroOpzionale({ value: v })).toBeUndefined();
  });

  it('un valore vero passa, virgola compresa', () => {
    expect(numeroOpzionale({ value: 98 })).toBe(98);
    expect(numeroOpzionale({ value: '98,5' })).toBe(98.5);
  });

  it('la variante con lo zero lo tiene: «0 cm da perdere» è una scelta, non un campo vuoto', () => {
    expect(numeroOpzionaleConZero({ value: 0 })).toBe(0);
    expect(numeroOpzionaleConZero({ value: '' })).toBeUndefined();
    expect(numeroOpzionaleConZero({ value: -1 })).toBeUndefined();
  });
});

describe('I tre DTO dove il difetto era (o è stato) vivo', () => {
  const questionario = {
    name: 'Giusy', age: 42, sex: 'female', heightCm: 165, startWeightKg: 78,
    regime: 'onnivoro', dietStyle: 'mediterranean', mealsPerDay: 5, pathType: 'five',
    coachStyle: 'when_needed', character: 'follows', healthDataConsent: true,
    health: { hasConditions: 'no', takesMedications: 'no' },
    objective: { weightToLoseKg: 8, weeks: 16 },
  };

  it('il questionario di prova è valido (se questo fallisce, i test sotto non provano niente)', () => {
    expect(errori(SubmitAnswersDto, questionario)).toHaveLength(0);
  });

  it('REGISTRAZIONE: girovita e fianchi lasciati vuoti non bloccano più il questionario', () => {
    // Era il punto peggiore: un errore incomprensibile al primo contatto col prodotto non fa
    // perdere una funzione, fa perdere la persona.
    for (const vuoto of [0, '', null]) {
      const e = errori(SubmitAnswersDto, { ...questionario, startWaistCm: vuoto, startHipsCm: vuoto });
      expect(e).toHaveLength(0);
    }
  });

  it('REGISTRAZIONE: un girovita assurdo viene ancora rifiutato, e in italiano', () => {
    const e = errori(SubmitAnswersDto, { ...questionario, startWaistCm: 5 });
    expect(e.length).toBeGreaterThan(0);
    expect(inglese(e)).toBe(false);
  });

  it('OBIETTIVO: i campi svuotati non bloccano il salvataggio', () => {
    expect(errori(UpdateObjectiveDto, { weightToLoseKg: 0, weeks: 0 })).toHaveLength(0);
    expect(errori(UpdateObjectiveDto, { weightToLoseKg: '', weeks: '' })).toHaveLength(0);
  });

  it('OBIETTIVO: «0 cm di girovita» resta un valore vero, non sparisce', () => {
    const dto = plainToInstance(UpdateObjectiveDto, { waistToLoseCm: 0 });
    expect(dto.waistToLoseCm).toBe(0);
    expect(errori(UpdateObjectiveDto, { waistToLoseCm: 0 })).toHaveLength(0);
  });

  it('MISURE: il caso originale della segnalazione resta chiuso', () => {
    expect(errori(CreateMeasurementDto, { weightKg: 86.3, waistCm: 95, hipsCm: 0 })).toHaveLength(0);
  });

  it('nessuno dei tre restituisce più messaggi in inglese alla cliente', () => {
    const tutti = [
      errori(SubmitAnswersDto, { ...questionario, startWaistCm: 5 }),
      errori(UpdateObjectiveDto, { weightToLoseKg: 99 }),
      errori(CreateMeasurementDto, { weightKg: 10 }),
      errori(CreateMeasurementDto, { weightKg: 70, hipsCm: 5 }),
    ];
    for (const e of tutti) {
      expect(e.length).toBeGreaterThan(0);
      expect(inglese(e)).toBe(false);
    }
  });
});
