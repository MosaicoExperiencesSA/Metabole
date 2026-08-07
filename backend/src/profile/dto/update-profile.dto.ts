import { Type } from 'class-transformer';
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

export class UpdateObjectiveDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(30)
  weightToLoseKg?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(52)
  weeks?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(40)
  waistToLoseCm?: number;
}
