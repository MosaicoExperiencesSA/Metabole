import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** Email (principale o secondaria) OPPURE numero di telefono del cliente. */
  @IsString({ message: 'Inserisci la tua email o il tuo numero di telefono.' })
  @MinLength(3, { message: 'Inserisci la tua email o il tuo numero di telefono.' })
  @MaxLength(160, { message: 'Email troppo lunga: controlla di averla scritta bene.' })
  email!: string;

  @IsString({ message: 'Inserisci la password.' })
  @MinLength(1, { message: 'Inserisci la password.' })
  password!: string;
}
