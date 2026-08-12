import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * La riga scritta a mano dal nutrizionista (§16.9): «a Giulia il pomodoro crudo lo sostituiamo
 * sempre con i pomodorini cotti». Nessuna conversazione l'ha prodotta, ed è esattamente il caso per
 * cui l'inserimento manuale era nella richiesta.
 */
export class CreaSostituzioneDto {
  @IsString() @MinLength(1) clientId!: string;

  /** L'alimento (o il piatto) di partenza, col nome che ha nella ricetta. */
  @IsString() @MinLength(2) @MaxLength(120) from!: string;
  @IsString() @MinLength(2) @MaxLength(120) to!: string;

  @IsOptional() @IsIn(['ingrediente', 'piatto']) tipo?: 'ingrediente' | 'piatto';
  @IsOptional() @IsString() recipeId?: string | null;
  @IsOptional() @IsString() @MaxLength(160) dishName?: string | null;
  @IsOptional() @IsString() @MaxLength(40) mealSlot?: string | null;
  @IsOptional() @IsString() @MaxLength(40) motivo?: string | null;
  @IsOptional() @IsString() dietId?: string | null;
  @IsOptional() @IsString() @MaxLength(300) nota?: string | null;

  // Gli stessi limiti dei grammi in chat, e per lo stesso motivo scritto lì: un 700 battuto per 70
  // non deve poter diventare una porzione.
  @IsOptional() @IsNumber() @Min(1) @Max(2000) fromQty?: number | null;
  @IsOptional() @IsNumber() @Min(1) @Max(2000) toQty?: number | null;
  @IsOptional() @IsString() @MaxLength(12) unit?: string | null;
}

/** Validare, correggere il sostituto, annullare, o solo annotare. */
export class AggiornaSostituzioneDto {
  @IsOptional() @IsIn(['da_verificare', 'verificata', 'corretta', 'annullata']) stato?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) to?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(2000) toQty?: number | null;
  @IsOptional() @IsString() @MaxLength(12) unit?: string | null;
  @IsOptional() @IsString() @MaxLength(300) nota?: string | null;
}
