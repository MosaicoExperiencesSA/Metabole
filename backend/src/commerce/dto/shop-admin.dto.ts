import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Type(() => Number) @IsInt() @Min(0) priceCents!: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreatePlanDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Type(() => Number) @IsInt() @Min(0) priceCents!: number;
  @IsString() @MinLength(1) @MaxLength(10) period!: string; // es. 3m | 6m | 12m
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mealsPerDay?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10) period?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mealsPerDay?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
