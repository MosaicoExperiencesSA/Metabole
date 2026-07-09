import { IsIn, IsOptional } from 'class-validator';
import { ROLES, Role } from '../../common/roles';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(ROLES as readonly string[])
  role?: Role;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsIn(['it', 'en', 'fr', 'de', 'es'])
  locale?: string;
}
