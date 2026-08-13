/** Le colazioni dolci e salate — Decisioni 13/8 §12. Il tag scritto è la conferma. */
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, ValidateIf, ValidateNested } from 'class-validator';

export class SetColazioneDto {
  /** `null` toglie la classificazione: è una decisione anche quella, e resta in audit. */
  @ValidateIf((o) => o.tipo !== null)
  @IsIn(['dolce', 'salato'])
  tipo!: 'dolce' | 'salato' | null;
}

export class SceltaColazioneDto {
  @IsString()
  id!: string;

  /** In blocco si conferma solo dolce o salato: togliere è un gesto singolo, non di massa. */
  @IsIn(['dolce', 'salato'])
  tipo!: 'dolce' | 'salato';
}

export class ConfermaColazioniDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SceltaColazioneDto)
  scelte!: SceltaColazioneDto[];
}
