import { Transform, Type } from 'class-transformer';
import { numeroOpzionale, numeroOpzionaleConZero } from '../../common/validazione';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

class LifestylePatchDto {
  @IsOptional()
  @IsIn(['sedentary', 'standing', 'shifts', 'travel'])
  work?: string;

  @IsOptional()
  @IsIn(['very_little', 'some', 'love_cooking'])
  cookingTime?: string;

  @IsOptional()
  @IsIn(['home', 'canteen', 'out', 'on_the_go'])
  weekdayLunch?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  /** Lingua dell'utente (i18n): notifiche ed email arrivano in questa lingua. */
  @IsOptional()
  @IsIn(['it', 'en'])
  locale?: string;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsInt()
  @Min(120)
  @Max(230)
  heightCm?: number;

  @IsOptional()
  @IsString() @MaxLength(40)
  regime?: string;

  @IsOptional()
  @IsString() @MaxLength(40)
  dietStyle?: string;

  /** Famiglia (`Diet.name`): con lo stile identifica il prodotto scelto. */
  @IsOptional() @IsString() @MaxLength(120)
  dietFamily?: string;

  @IsOptional()
  @IsIn([3, 4, 5])
  mealsPerDay?: number;

  @IsOptional()
  @IsIn(['classic3', 'five', 'supplements', 'intermittent_fasting'])
  pathType?: string;

  @IsOptional()
  @IsIn(['skip_breakfast', 'skip_breakfast_lunch', 'skip_dinner_breakfast'])
  fastingWindow?: string;

  @IsOptional()
  @IsIn(['daily', 'when_needed', 'on_request'])
  coachStyle?: string;

  @IsOptional()
  @IsIn(['follows', 'needs_push', 'perseveres', 'quits'])
  character?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intolerances?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dislikedFoods?: string[];

  /** La cliente preferisce ricette semplici (cucina italiana) quando disponibili. */
  @IsOptional()
  @IsBoolean()
  prefersSimpleRecipes?: boolean;

  /** Livello di attività fisica (domanda dedicata): guida il calcolo del fabbisogno calorico. */
  @IsOptional()
  @IsIn(['sedentary', 'light', 'moderate', 'active', 'very_active'])
  activityLevel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LifestylePatchDto)
  lifestyle?: LifestylePatchDto;

  @IsOptional()
  @IsDateString()
  planStartDate?: string;

  @IsOptional()
  @IsObject()
  consents?: Record<string, unknown>;
}

export class UpdateThemeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(9)
  color!: string;
}

/**
 * Modifica dell'obiettivo dall'app: sono tutti campi che la cliente **digita**, e tutti
 * facoltativi — cambia quello che vuole e lascia in bianco il resto.
 *
 * Il `@Transform` c'è per la stessa ragione del DTO delle misure: una casella svuotata arriva
 * come `0` e senza di lui il salvataggio falliva con «weightToLoseKg must not be less than 1».
 */
export class UpdateObjectiveDto {
  @IsOptional()
  @Transform(numeroOpzionale)
  @Min(1, { message: 'L\'obiettivo minimo è 1 kg.' })
  @Max(30, { message: 'Sopra i 30 kg l\'obiettivo va rivisto insieme alla nutrizionista.' })
  weightToLoseKg?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsInt({ message: 'Le settimane vanno indicate con un numero intero (es. 18).' })
  @Min(3, { message: 'Servono almeno 3 settimane.' })
  @Max(52, { message: 'Al massimo 52 settimane. Se serve più tempo lo si allunga strada facendo.' })
  weeks?: number;

  // Qui lo ZERO è legittimo: vuol dire «il girovita non me lo pongo come obiettivo».
  @IsOptional()
  @Transform(numeroOpzionaleConZero)
  @Min(0, { message: 'I centimetri di girovita non possono essere negativi.' })
  @Max(40, { message: 'Più di 40 cm di girovita è un obiettivo da rivedere insieme alla nutrizionista.' })
  waistToLoseCm?: number;
}
