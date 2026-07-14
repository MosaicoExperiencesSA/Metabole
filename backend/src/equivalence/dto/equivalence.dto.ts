import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEquivalenceGroupDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  items!: string[]; // alimenti/ingredienti intercambiabili

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsString()
  productId?: string; // Diet.id; assente/null = gruppo globale

  @IsOptional()
  @IsIn(['draft', 'approved'])
  status?: string;
}

export class UpdateEquivalenceGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  items?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsOptional()
  @IsIn(['draft', 'approved'])
  status?: string;
}
