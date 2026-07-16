import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** Email (principale o secondaria) OPPURE numero di telefono del cliente. */
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
