import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateDietDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString() @MaxLength(40)
  regime!: string;

  @IsString() @MaxLength(40)
  style!: string;

  @IsIn([3, 5])
  mealsPerDay!: number;

  // Digiuno intermittente 16:8 (pasti nella finestra 12-20, niente colazione).
  @IsOptional()
  @IsBoolean()
  fasting?: boolean;

  @IsOptional()
  @IsArray()
  levels?: unknown[];

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  // Campi "prodotto" mostrati al cliente (schermo 16).
  @IsOptional() @IsString() @MaxLength(60) clientName?: string;
  @IsOptional() @IsString() @MaxLength(400) clientDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsString() @MaxLength(40) seasonalTag?: string;
  @IsOptional() @IsIn(['dimagrimento', 'mantenimento']) objective?: string;
  @IsOptional() @IsBoolean() clientVisible?: boolean;
  @IsOptional() @IsBoolean() siteVisible?: boolean;
  @IsOptional() @IsBoolean() recommended?: boolean;
}

export class RenameDietDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
}

export class UpdateDietDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString() @MaxLength(40)
  regime?: string;

  @IsOptional()
  @IsString() @MaxLength(40)
  style?: string;

  @IsOptional()
  @IsIn([3, 5])
  mealsPerDay?: number;

  // Digiuno intermittente 16:8.
  @IsOptional()
  @IsBoolean()
  fasting?: boolean;

  @IsOptional()
  @IsArray()
  levels?: unknown[];

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  // Campi "prodotto" mostrati al cliente (schermo 16).
  @IsOptional() @IsString() @MaxLength(60) clientName?: string;
  @IsOptional() @IsString() @MaxLength(400) clientDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsString() @MaxLength(40) seasonalTag?: string;
  @IsOptional() @IsIn(['dimagrimento', 'mantenimento']) objective?: string;
  @IsOptional() @IsBoolean() clientVisible?: boolean;
  @IsOptional() @IsBoolean() recommended?: boolean;
}

/** Modifica della sola "scheda cliente" (schermo 16), consentita anche su diete approvate. */
export class UpdateDietProductDto {
  @IsOptional() @IsString() @MaxLength(60) clientName?: string;
  @IsOptional() @IsString() @MaxLength(400) clientDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsString() @MaxLength(40) seasonalTag?: string;
  @IsOptional() @IsIn(['dimagrimento', 'mantenimento']) objective?: string;
  @IsOptional() @IsBoolean() clientVisible?: boolean;
  @IsOptional() @IsBoolean() recommended?: boolean;
}

/** Una regola del motore attivata/parametrizzata per un prodotto (Fase F). */
export class ProductRuleItemDto {
  @IsString() @MaxLength(20) ruleCode!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() params?: Record<string, unknown>;
}

export class SetProductRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductRuleItemDto)
  rules!: ProductRuleItemDto[];
}

export class RuleProposalDto {
  @IsString() @MinLength(4) @MaxLength(500) text!: string;
}

class TemplateMealDto {
  @IsIn(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'])
  slot!: string;

  @IsString()
  recipeId!: string;
}

export class DayTemplateDto {
  @IsInt()
  @Min(1)
  @Max(10)
  level!: number;

  @IsInt()
  @Min(1)
  @Max(28)
  dayIndex!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateMealDto)
  meals!: TemplateMealDto[];
}

export class SetDayTemplatesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayTemplateDto)
  days!: DayTemplateDto[];
}

class IngredientDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  qty?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateRecipeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString() @MaxLength(40)
  regime!: string;

  @IsIn(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'])
  mealSlot!: string;

  @IsInt()
  @Min(30)
  @Max(2000)
  kcal!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients!: IngredientDto[];

  @IsOptional()
  @IsArray()
  cookingMethods?: unknown[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  macros?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Modifica ricetta: tutti i campi opzionali (si aggiornano solo quelli inviati). */
export class UpdateRecipeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) regime?: string;
  @IsOptional() @IsIn(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']) mealSlot?: string;
  @IsOptional() @IsInt() @Min(30) @Max(2000) kcal?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => IngredientDto) ingredients?: IngredientDto[];
  @IsOptional() @IsArray() cookingMethods?: unknown[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsObject() macros?: Record<string, number>;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class RejectDietDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
