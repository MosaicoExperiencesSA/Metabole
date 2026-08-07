import { Transform, Type } from 'class-transformer';
import { numeroOpzionale } from '../../common/validazione';
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
  @IsDateString({}, { message: 'Data non valida.' })
  date?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Il peso deve essere un numero (es. 72,4).' })
  @Min(35, { message: 'Il peso sembra troppo basso: controlla il valore in kg.' })
  @Max(250, { message: 'Il peso sembra troppo alto: controlla il valore in kg.' })
  weightKg!: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsNumber({}, { message: 'La vita deve essere un numero in centimetri (es. 82).' })
  @Min(40, { message: 'La vita sembra troppo piccola: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(200, { message: 'La vita sembra troppo grande: controlla il valore in cm.' })
  waistCm?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsNumber({}, { message: 'I fianchi devono essere un numero in centimetri (es. 98).' })
  @Min(40, { message: 'I fianchi sembrano troppo piccoli: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(200, { message: 'I fianchi sembrano troppo grandi: controlla il valore in cm.' })
  hipsCm?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsNumber({}, { message: 'Le cosce devono essere un numero in centimetri (es. 58).' })
  @Min(20, { message: 'Le cosce sembrano troppo piccole: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(120, { message: 'Le cosce sembrano troppo grandi: controlla il valore in cm.' })
  thighsCm?: number;
}

/** Check-in giornaliero: lo compila la cliente tutti i giorni, quindi i messaggi li legge lei. */
export class CreateCheckinDto {
  @IsOptional()
  @IsDateString({}, { message: 'Data non valida.' })
  date?: string;

  @IsIn(['great', 'good', 'ok', 'hard', 'stressed'], { message: 'Scegli come è andata la giornata.' })
  mood!: string;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsInt({ message: 'L\'energia va indicata da 1 a 5.' })
  @Min(1, { message: 'L\'energia va da 1 a 5.' })
  @Max(5, { message: 'L\'energia va da 1 a 5.' })
  energy?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsInt({ message: 'La fame va indicata da 1 a 5.' })
  @Min(1, { message: 'La fame va da 1 a 5.' })
  @Max(5, { message: 'La fame va da 1 a 5.' })
  hunger?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsInt({ message: 'Lo stress va indicato da 1 a 5.' })
  @Min(1, { message: 'Lo stress va da 1 a 5.' })
  @Max(5, { message: 'Lo stress va da 1 a 5.' })
  stress?: number;
}

export class CreateWaterDto {
  @IsOptional()
  @IsDateString({}, { message: 'Data non valida.' })
  date?: string;

  // Qui lo ZERO è legittimo: «oggi non ho bevuto niente» è un dato, non un campo vuoto.
  @IsInt({ message: 'I bicchieri vanno indicati con un numero intero (es. 6).' })
  @Min(0, { message: 'I bicchieri non possono essere un numero negativo.' })
  @Max(30, { message: 'Più di 30 bicchieri in un giorno: controlla il numero.' })
  glasses!: number;
}

export class CreateStepsDto {
  @IsOptional()
  @IsDateString({}, { message: 'Data non valida.' })
  date?: string;

  // Zero legittimo (giornata ferma). Il messaggio dell'intero serve a chi scrive «10.000».
  @IsInt({ message: 'I passi vanno indicati con un numero intero, senza punti (es. 10000).' })
  @Min(0, { message: 'I passi non possono essere un numero negativo.' })
  @Max(150000, { message: 'Più di 150.000 passi in un giorno: controlla il numero.' })
  steps!: number;

  @IsOptional()
  @IsIn(['manual', 'healthkit', 'google_fit'], { message: 'Origine dei passi non riconosciuta.' })
  source?: string;
}
