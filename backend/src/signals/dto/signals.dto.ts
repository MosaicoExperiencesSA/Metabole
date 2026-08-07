import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * Circonferenza «non compilata» → `undefined`, cioè «non lo mando».
 *
 * Serve perché la casella vuota di un form non arriva sempre vuota: `Number('')` fa **0**, e uno
 * zero è un numero valido a tutti gli effetti — quindi passava la validazione «è un numero» e si
 * schiantava su «minimo 40». È esattamente quello che è successo a una cliente il 7/8: fianchi
 * mai misurati, casella vuota, e la correzione delle misure che non si salvava con un messaggio
 * in inglese sotto il pulsante.
 *
 * L'app è stata corretta perché non mandi più zeri, ma la correzione lato app arriva solo con una
 * pubblicazione sugli store: finché le clienti hanno la versione installata, deve reggere il
 * backend. E deve reggerlo comunque, perché **nessun client va creduto sulla parola**.
 *
 * Zero e negativi si possono trattare come «assente» senza ambiguità: non esiste una vita di
 * 0 cm. Il PESO invece resta fuori da qui — è obbligatorio, e uno zero lì è un errore da
 * segnalare, non un campo lasciato in bianco.
 */
const circonferenzaOpzionale = ({ value }: { value: unknown }): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
};

/**
 * Misure inserite dalla CLIENTE: i messaggi qui sotto li legge lei, non noi.
 *
 * Erano quelli di default di class-validator, in inglese e col nome del campo del database:
 * una cliente che lasciava vuota la casella «Fianchi» si è vista rispondere
 * «hipsCm must not be less than 40» sotto un pulsante che sembrava semplicemente non
 * funzionare (segnalato il 7/8). La causa vera era nell'app — un campo vuoto partiva come 0 —
 * ed è corretta lì; ma un messaggio del genere non deve poter arrivare a nessuno comunque,
 * perché non dice cosa fare e sembra un guasto.
 */
export class CreateMeasurementDto {
  /** Default: oggi. Formato YYYY-MM-DD. */
  @IsOptional()
  @IsDateString()
  date?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Il peso deve essere un numero (es. 72,4).' })
  @Min(35, { message: 'Il peso sembra troppo basso: controlla il valore in kg.' })
  @Max(250, { message: 'Il peso sembra troppo alto: controlla il valore in kg.' })
  weightKg!: number;

  @IsOptional()
  @Transform(circonferenzaOpzionale)
  @IsNumber({}, { message: 'La vita deve essere un numero in centimetri (es. 82).' })
  @Min(40, { message: 'La vita sembra troppo piccola: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(200, { message: 'La vita sembra troppo grande: controlla il valore in cm.' })
  waistCm?: number;

  @IsOptional()
  @Transform(circonferenzaOpzionale)
  @IsNumber({}, { message: 'I fianchi devono essere un numero in centimetri (es. 98).' })
  @Min(40, { message: 'I fianchi sembrano troppo piccoli: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(200, { message: 'I fianchi sembrano troppo grandi: controlla il valore in cm.' })
  hipsCm?: number;

  @IsOptional()
  @Transform(circonferenzaOpzionale)
  @IsNumber({}, { message: 'Le cosce devono essere un numero in centimetri (es. 58).' })
  @Min(20, { message: 'Le cosce sembrano troppo piccole: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(120, { message: 'Le cosce sembrano troppo grandi: controlla il valore in cm.' })
  thighsCm?: number;
}

export class CreateCheckinDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsIn(['great', 'good', 'ok', 'hard', 'stressed'])
  mood!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  energy?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  hunger?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  stress?: number;
}

export class CreateWaterDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsInt()
  @Min(0)
  @Max(30)
  glasses!: number;
}

export class CreateStepsDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsInt()
  @Min(0)
  @Max(150000)
  steps!: number;

  @IsOptional()
  @IsIn(['manual', 'healthkit', 'google_fit'])
  source?: string;
}
