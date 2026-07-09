import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ROLES, Role } from '../../common/roles';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La password deve avere almeno 8 caratteri' })
  password!: string;

  @IsIn(ROLES as readonly string[])
  role!: Role;

  @IsOptional()
  @IsIn(['it', 'en', 'fr', 'de', 'es'])
  locale?: string;
}
