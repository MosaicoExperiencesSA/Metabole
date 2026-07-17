import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email non valida' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La password deve avere almeno 8 caratteri' })
  password!: string;

  // Telefono (prefisso internazionale + numero), obbligatorio insieme all'email.
  // Arriva già combinato dal frontend (es. "+39 3331234567").
  @IsString()
  @MinLength(6, { message: 'Il numero di telefono è obbligatorio' })
  @MaxLength(32)
  phone!: string;

  // Anagrafica (schermata "Crea il tuo account").
  @IsString()
  @MinLength(1, { message: 'Il nome è obbligatorio' })
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1, { message: 'Il cognome è obbligatorio' })
  @MaxLength(80)
  lastName!: string;

  // Indirizzo di spedizione (facoltativo in fase di registrazione).
  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsIn(['it', 'en', 'fr', 'de', 'es'])
  locale?: string;

  // Codice invito della coach (facoltativo): auto-assegna la cliente.
  @IsOptional()
  @IsString()
  refCode?: string;
}
