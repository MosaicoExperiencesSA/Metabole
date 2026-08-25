import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * ⛔ **I PESI DEI GRASSI** — Nocanty, 24/8: *«Approvata anche l'integrazione della colonna
 * nell'editor dei gruppi in backoffice per la gestione autonoma futura.»*
 *
 * `pesi` è nome → **grammi equivalenti a 100 g del riferimento**. Sta sul gruppo perché è il
 * nutrizionista a mantenerlo: un numero clinico scritto in un file di codice è un numero che per
 * cambiarlo serve un rilascio.
 *
 * ⚠️ Il campo `members` è già `Json`, quindi **nessuna migrazione**.
 */
export class FattoriDto {
  @IsString()
  @MaxLength(120)
  riferimento!: string;

  /** Nome → grammi. ⚠️ Il valore si valida nel servizio: qui è un oggetto libero per costruzione. */
  @IsObject()
  pesi!: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fonte?: string;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => FattoriDto)
  fattori?: FattoriDto;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => FattoriDto)
  fattori?: FattoriDto | null;
}
