import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
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
}
