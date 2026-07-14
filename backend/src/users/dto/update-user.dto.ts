import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ROLES, Role } from '../../common/roles';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(ROLES as readonly string[])
  role?: Role;

  /** Ruolo personalizzato: chiave, oppure null per rimuoverlo. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  customRoleKey?: string | null;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsIn(['it', 'en', 'fr', 'de', 'es'])
  locale?: string;

  // Anagrafica (modificabile dall'admin nella scheda utente).
  @IsOptional() @IsString() @MaxLength(80) firstName?: string | null;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string | null;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string; // nome mostrato (scheda Staff)
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(80) title?: string | null;
  @IsOptional() @IsString() @MaxLength(200) addressLine?: string | null;
  @IsOptional() @IsString() @MaxLength(80) country?: string | null;
}
