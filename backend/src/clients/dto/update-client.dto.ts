import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Aggiornamento scheda cliente: anagrafica (User) + questionario (ClientProfile). Tutti i campi opzionali. */
export class UpdateClientDto {
  // --- Anagrafica (User) ---
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(160) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(10) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) province?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;

  // --- Questionario (ClientProfile) ---
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsInt() @Min(18) @Max(100) age?: number;
  @IsOptional() @IsIn(['female', 'male']) sex?: string;
  @IsOptional() @IsInt() @Min(120) @Max(230) heightCm?: number;
  @IsOptional() @IsNumber() @Min(35) @Max(250) startWeightKg?: number;
  @IsOptional() @IsNumber() @Min(40) @Max(200) startWaistCm?: number;
  @IsOptional() @IsNumber() @Min(40) @Max(200) startHipsCm?: number;
  @IsOptional() @IsIn(['omnivore', 'vegetarian', 'vegan']) regime?: string;
  @IsOptional() @IsIn(['mediterranean', 'protein', 'low_carb', 'flexible', 'keto']) dietStyle?: string;
  @IsOptional() @IsIn([3, 4, 5]) mealsPerDay?: number;
  @IsOptional() @IsIn(['classic3', 'five', 'supplements', 'intermittent_fasting']) pathType?: string;
  @IsOptional() @IsIn(['daily', 'when_needed', 'on_request']) coachStyle?: string;
  @IsOptional() @IsIn(['follows', 'needs_push', 'perseveres', 'quits']) character?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) intolerances?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) dislikedFoods?: string[];
  @IsOptional() @IsString() @MaxLength(9) themeColor?: string;
}
