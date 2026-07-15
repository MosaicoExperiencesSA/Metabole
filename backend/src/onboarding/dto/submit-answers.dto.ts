import { Type } from 'class-transformer';
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
  @IsNumber()
  @Min(1)
  @Max(40)
  weightToLoseKg!: number;

  @IsInt()
  @Min(3)
  @Max(52)
  weeks!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  waistToLoseCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
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

  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(200)
  startWaistCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(200)
  startHipsCm?: number;

  @IsString() @MaxLength(40)
  regime!: string;

  @IsString() @MaxLength(40)
  dietStyle!: string;

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
