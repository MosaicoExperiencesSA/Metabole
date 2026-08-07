import { Transform, Type } from 'class-transformer';
import { numeroOpzionale, numeroOpzionaleConZero } from '../../common/validazione';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

class LifestyleDto {
  @IsOptional()
  @IsIn(['sedentary', 'standing', 'shifts', 'travel'])
  work?: string;

  @IsOptional()
  @IsIn(['very_little', 'some', 'love_cooking'])
  cookingTime?: string;

  @IsOptional()
  @IsIn(['home', 'canteen', 'out', 'on_the_go'])
  weekdayLunch?: string;

  // Schermo 6 del prototipo: "Perché vuoi iniziare adesso?" (motivazione).
  @IsOptional()
  @IsIn(['wellbeing', 'clothes', 'health', 'event'])
  motivation?: string;
}

class HealthDto {
  @IsIn(['no', 'yes', 'tell_in_visit'])
  hasConditions!: string;

  @IsIn(['no', 'yes', 'tell_in_visit'])
  takesMedications!: string;
}

class ObjectiveInputDto {
  // Obbligatori: qui lo zero è un errore da segnalare, non una casella lasciata in bianco.
  @IsNumber({}, { message: 'Indica quanti chili vuoi perdere (es. 6).' })
  @Min(1, { message: 'L\'obiettivo minimo è 1 kg.' })
  @Max(40, { message: 'Sopra i 40 kg il percorso va impostato con la nutrizionista: parlane con lei.' })
  weightToLoseKg!: number;

  @IsInt({ message: 'Indica in quante settimane, con un numero intero (es. 18).' })
  @Min(3, { message: 'Servono almeno 3 settimane: sotto non è un percorso, è una dieta lampo.' })
  @Max(52, { message: 'Al massimo 52 settimane. Se serve più tempo lo si allunga strada facendo.' })
  weeks!: number;

  // Facoltativi, e qui lo ZERO è legittimo: vuol dire «quella misura non me la pongo».
  @IsOptional()
  @Transform(numeroOpzionaleConZero)
  @IsNumber({}, { message: 'I centimetri di girovita devono essere un numero (es. 6).' })
  @Min(0, { message: 'I centimetri di girovita non possono essere negativi.' })
  @Max(40, { message: 'Più di 40 cm di girovita è un obiettivo da rivedere insieme alla nutrizionista.' })
  waistToLoseCm?: number;

  @IsOptional()
  @Transform(numeroOpzionaleConZero)
  @IsNumber({}, { message: 'I centimetri di fianchi devono essere un numero (es. 6).' })
  @Min(0, { message: 'I centimetri di fianchi non possono essere negativi.' })
  @Max(40, { message: 'Più di 40 cm di fianchi è un obiettivo da rivedere insieme alla nutrizionista.' })
  hipsToLoseCm?: number;
}

export class SubmitAnswersDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(18)
  @Max(100)
  age!: number;

  @IsIn(['female', 'male', 'unspecified'])
  sex!: 'female' | 'male' | 'unspecified';

  @IsInt()
  @Min(120)
  @Max(230)
  heightCm!: number;

  @IsNumber()
  @Min(35)
  @Max(250)
  startWeightKg!: number;

  // Facoltative: chi non si è mai misurata le lascia in bianco. Senza il Transform la casella
  // vuota arrivava come 0 e bloccava la REGISTRAZIONE con «startWaistCm must not be less than
  // 40» — lo stesso difetto segnalato il 7/8 sulle misure, ma nel punto peggiore possibile.
  @IsOptional()
  @Transform(numeroOpzionale)
  @IsNumber({}, { message: 'Il girovita deve essere un numero in centimetri (es. 82).' })
  @Min(40, { message: 'Il girovita sembra troppo piccolo: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(200, { message: 'Il girovita sembra troppo grande: controlla il valore in cm.' })
  startWaistCm?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsNumber({}, { message: 'I fianchi devono essere un numero in centimetri (es. 98).' })
  @Min(40, { message: 'I fianchi sembrano troppo piccoli: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(200, { message: 'I fianchi sembrano troppo grandi: controlla il valore in cm.' })
  startHipsCm?: number;

  @IsString() @MaxLength(40)
  regime!: string;

  @IsString() @MaxLength(40)
  dietStyle!: string;

  /**
   * FAMIGLIA scelta (`Diet.name`), che insieme a `dietStyle` identifica il PRODOTTO.
   * Opzionale di proposito: le app già installate mandano solo `dietStyle` e devono continuare
   * a funzionare — senza questo campo l'abbinamento resta quello di prima.
   */
  @IsOptional() @IsString() @MaxLength(120)
  dietFamily?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  /** Allergie fuori dai 14 codici UE: testo libero → forza revisione del nutrizionista. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergiesOther?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intolerances?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dislikedFoods?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LifestyleDto)
  lifestyle?: LifestyleDto;

  @IsIn([3, 4, 5])
  mealsPerDay!: number;

  @IsIn(['classic3', 'five', 'supplements', 'intermittent_fasting'])
  pathType!: string;

  @IsOptional()
  @IsIn(['skip_breakfast', 'skip_breakfast_lunch', 'skip_dinner_breakfast'])
  fastingWindow?: string;

  @IsOptional()
  @IsIn(['sedentary', 'light', 'moderate', 'active', 'very_active'])
  activityLevel?: string;

  @ValidateNested()
  @Type(() => HealthDto)
  health!: HealthDto;

  @ValidateNested()
  @Type(() => ObjectiveInputDto)
  objective!: ObjectiveInputDto;

  @IsIn(['daily', 'when_needed', 'on_request'])
  coachStyle!: string;

  @IsIn(['follows', 'needs_push', 'perseveres', 'quits'])
  character!: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  themeColor?: string;

  @IsOptional()
  @IsObject()
  consents?: Record<string, unknown>;

  /** Accettazione esplicita del trattamento dei dati sanitari (GDPR art. 9). */
  @IsBoolean()
  healthDataConsent!: boolean;
}
