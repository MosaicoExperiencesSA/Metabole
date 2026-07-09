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

  /** Nome visibile per lo staff (coach, nutrizioniste…). Se assente, ricavato dall'email. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;
}
