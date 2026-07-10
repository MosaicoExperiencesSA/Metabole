import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class AssignmentDto {
  @IsUUID()
  clientId!: string; // user id della cliente

  // string = assegna quello staff; null/"" = rimuovi; assente = lascia com'è.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  coachId?: string | null; // staff id

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  nutritionistId?: string | null; // staff id
}
