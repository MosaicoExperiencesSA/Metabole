import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
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

  // Email di login (correzione da parte dell'admin; deve essere unica).
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;

  // Anagrafica (modificabile dall'admin nella scheda utente).
  @IsOptional() @IsString() @MaxLength(80) firstName?: string | null;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string | null;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string; // nome mostrato (scheda Staff)
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(80) title?: string | null;
  @IsOptional() @IsString() @MaxLength(200) addressLine?: string | null;
  @IsOptional() @IsString() @MaxLength(80) country?: string | null;

  /**
   * Tetto di guadagno MENSILE, in centesimi (§16.8). `null` lo toglie.
   *
   * `@Min(0)` e non `@Min(1)`: un campo svuotato arriva come `0` e deve poter essere salvato —
   * viene poi letto come «nessun tetto» (`common/tetto-compensi.ts`), non come «tetto a zero».
   * Rifiutarlo qui significherebbe un errore di validazione a chi sta semplicemente togliendo il
   * tetto. Il massimo è un milione di euro: serve solo a intercettare l'euro scritto al posto del
   * centesimo tre ordini di grandezza più in là.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  earningsCapCents?: number | null;
}
