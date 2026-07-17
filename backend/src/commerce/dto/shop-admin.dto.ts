import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

/**
 * Le 4 quote provvigionali in centesimi di €, condivise da piani e prodotti.
 * Importi fissi (non percentuali); 0 = niente provvigione a quel lato.
 */
class CommissionFields {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionCoachCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionManagerCoachCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionNutritionistCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionHeadNutritionistCents?: number;
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
  @IsString() @MinLength(1) @MaxLength(10) period!: string; // es. 3m | 6m | 12m
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mealsPerDay?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}

export class UpdatePlanDto extends CommissionFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10) period?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mealsPerDay?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}
