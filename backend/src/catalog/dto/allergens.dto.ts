import { ArrayUnique, IsArray, IsIn, IsString } from 'class-validator';
import { EU_ALLERGEN_CODES } from '../allergens';

export class SetRecipeAllergensDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(EU_ALLERGEN_CODES, { each: true })
  allergens!: string[];
}
