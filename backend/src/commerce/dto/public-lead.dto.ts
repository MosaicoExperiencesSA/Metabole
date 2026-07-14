import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** Lead pubblico dai form del sito (contatti + "Lavora con noi"). */
export class PublicLeadDto {
  @IsEmail()
  email!: string;

  @IsOptional() @IsString() @MaxLength(120)
  nome?: string;

  @IsOptional() @IsString() @MaxLength(40)
  fonte?: string; // 'sito_presentazione' | 'lavora_con_noi'

  @IsOptional() @IsString() @MaxLength(8)
  lingua?: string;

  @IsOptional() @IsString() @MaxLength(60)
  ruolo?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  messaggio?: string;

  // Honeypot: deve restare vuoto (i bot lo compilano). Il controller lo scarta con 200.
  @IsOptional() @IsString() @MaxLength(200)
  website?: string;
}
