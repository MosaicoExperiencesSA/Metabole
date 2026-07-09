import { IsEmail, IsString, MinLength } from 'class-validator';

export class PasswordResetRequestDto {
  @IsEmail()
  email!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La password deve avere almeno 8 caratteri' })
  newPassword!: string;
}
