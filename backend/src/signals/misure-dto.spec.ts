import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateMeasurementDto } from './dto/signals.dto';

/**
 * Segnalazione di una cliente (7/8): correggeva le misure di oggi, lasciava vuoti i **fianchi**
 * perché non li aveva mai misurati, e il salvataggio falliva con «hipsCm must not be less
 * than 40» — in inglese, sotto un pulsante che sembrava rotto.
 *
 * `Number('')` fa **0**, e zero passa il controllo «è un numero» per poi schiantarsi sul minimo.
 * L'app è stata corretta perché non mandi più zeri, ma quella correzione arriva solo con una
 * pubblicazione sugli store: **il backend deve reggere le versioni già installate**. E deve
 * reggerle comunque, perché nessun client va creduto sulla parola.
 *
 * Questi test girano sul DTO, che è il punto dove la richiesta entra davvero.
 */

const errori = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateMeasurementDto, body) as object, { whitelist: true });

const valori = (body: Record<string, unknown>) =>
  plainToInstance(CreateMeasurementDto, body) as CreateMeasurementDto;

describe('CreateMeasurementDto — le circonferenze non compilate', () => {
  const base = { weightKg: 86.3, waistCm: 95 };

  it.each([0, '0', '', null])('«%s» nei fianchi non blocca più il salvataggio', (vuoto) => {
    // È il caso esatto della segnalazione.
    expect(errori({ ...base, hipsCm: vuoto })).toHaveLength(0);
    expect(valori({ ...base, hipsCm: vuoto }).hipsCm).toBeUndefined();
  });

  it('undefined significa «non lo mando»: il valore a database resta quello di prima', () => {
    const dto = valori({ ...base, hipsCm: 0 });
    expect(dto.hipsCm).toBeUndefined();
    expect(dto.weightKg).toBe(86.3);
    expect(dto.waistCm).toBe(95);
  });

  it('una circonferenza VERA passa e resta un numero', () => {
    expect(errori({ ...base, hipsCm: 98 })).toHaveLength(0);
    expect(valori({ ...base, hipsCm: 98 }).hipsCm).toBe(98);
    expect(valori({ ...base, hipsCm: '98,5' }).hipsCm).toBe(98.5);
  });

  it('un valore ASSURDO viene ancora rifiutato, e in italiano', () => {
    // Tollerare lo zero non vuol dire tollerare tutto: 5 cm resta un errore di battitura.
    const e = errori({ ...base, hipsCm: 5 });
    expect(e.length).toBeGreaterThan(0);
    expect(JSON.stringify(e)).toContain('fianchi');
    expect(JSON.stringify(e)).not.toContain('must not be less than');
  });

  it('il PESO resta obbligatorio: uno zero lì è un errore, non un campo in bianco', () => {
    expect(errori({ weightKg: 0 }).length).toBeGreaterThan(0);
    expect(errori({}).length).toBeGreaterThan(0);
  });

  it('vita e cosce seguono la stessa regola dei fianchi', () => {
    expect(errori({ weightKg: 70, waistCm: 0, thighsCm: 0 })).toHaveLength(0);
    const dto = valori({ weightKg: 70, waistCm: 0, thighsCm: 0 });
    expect(dto.waistCm).toBeUndefined();
    expect(dto.thighsCm).toBeUndefined();
  });

  it('nessun messaggio di validazione arriva più alla cliente in inglese', () => {
    const tutti = JSON.stringify([
      errori({ weightKg: 10 }),
      errori({ weightKg: 300 }),
      errori({ weightKg: 70, waistCm: 5 }),
      errori({ weightKg: 70, thighsCm: 500 }),
    ]);
    expect(tutti).not.toMatch(/must not be|must be a number/);
  });
});
