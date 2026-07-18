import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min, MaxLength, MinLength, ValidateIf } from 'class-validator';

/**
 * Le 4 quote provvigionali in centesimi di €, condivise da piani e prodotti.
 * Importi fissi (non percentuali); 0 = niente provvigione a quel lato.
 */
class CommissionFields {
  // LEGACY (importi fissi in centesimi): usati solo se le percentuali sono tutte 0.
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionCoachCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionManagerCoachCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionNutritionistCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionHeadNutritionistCents?: number;

  // RETE A DIFFERENZA: percentuali per LIVELLO (0-100) sull'importo pagato.
  // Coach 25 / Coordinatrice 35 / Manager 45 → 25+10+10 a rete completa.
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionCoachPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionCoordinatorPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionManagerPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionNutritionistPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionHeadNutritionistPct?: number;
}

export class CreateProductDto extends CommissionFields {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Type(() => Number) @IsInt() @Min(0) priceCents!: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}

export class UpdateProductDto extends CommissionFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}

export class CreatePlanDto extends CommissionFields {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Type(() => Number) @IsInt() @Min(0) priceCents!: number;
  // Prezzo pieno di listino (barrato) + fine promo: null = nessun barrato / promo senza scadenza.
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(0) listPriceCents?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() promoEndsAt?: string | null;
  @IsString() @MinLength(1) @MaxLength(10) period!: string; // es. 3m | 6m | 12m
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mealsPerDay?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}

export class UpdatePlanDto extends CommissionFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(0) listPriceCents?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() promoEndsAt?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10) period?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mealsPerDay?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}
