import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { RIGHE_AMMESSE, UsersService } from './users.service';
import { CHIAVI_UNITA_ACQUA } from '../common/unita-acqua';

class UpdatePrefsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  dashboardShortcuts?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  dashboardModules?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  dashboardCharts?: string[];

  /**
   * ⚠️ `@MaxLength` per riga, e sta qui perché nell'editor la casella ha `maxLength={24}` — ma il
   * limite del browser non è un limite: vale per chi usa la schermata, non per chi parla con l'API.
   * Senza, una chiamata diretta poteva salvare un titolo da cinquemila caratteri che la barra
   * laterale poi disegnava (difetto 3 del 18/8). Il taglio a 64 lo fa comunque `puliscoOrdineMenu`;
   * questo rifiuta la richiesta invece di accorciarla in silenzio.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @ArrayMaxSize(80)
  menuOrder?: string[];

  /**
   * I blocchi fissi della home SPENTI (portafoglio, avvisi, tabella clienti…): un elenco di
   * esclusioni, non di inclusioni. Vedi il commento in `getPreferences`.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  dashboardBlocksOff?: string[];

  /** Righe per pagina nelle tabelle della home: 10, 25, 50 o 100. */
  @IsOptional()
  @IsIn(RIGHE_AMMESSE)
  righePerPagina?: number;

  // Mostra i KPI "Guadagni" in dashboard (default off: attivabili dall'utente).
  @IsOptional()
  @IsBoolean()
  showEarnings?: boolean;

  // Unità di visualizzazione dell'acqua in dashboard (solo display: il dato resta
  // in bicchieri). glass = bicchieri · bottle05/1/15 = bottiglie da 0,5/1/1,5 L.
  @IsOptional()
  @IsIn(CHIAVI_UNITA_ACQUA)
  waterUnit?: string;
}

class UpdateAccountDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsIn(['light', 'dark', 'taupe', 'white']) theme?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  // Foto profilo: data URL ridotta lato client (≤ ~300k char ≈ 220KB) o null per rimuoverla.
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300000) photoUrl?: string | null;
}

// Password: sono i messaggi che legge la persona mentre sta cercando di entrare. Quelli di
// default («newPassword must be longer than or equal to 8 characters») dicono la stessa cosa,
// ma in inglese e col nome del campo del database — e chi li legge non sta programmando.
class ChangePasswordDto {
  @IsString({ message: 'Inserisci la password attuale.' })
  @MinLength(1, { message: 'Inserisci la password attuale.' })
  currentPassword!: string;

  @IsString({ message: 'Inserisci la nuova password.' })
  @MinLength(8, { message: 'La nuova password deve avere almeno 8 caratteri.' })
  @MaxLength(200, { message: 'La password è troppo lunga (massimo 200 caratteri).' })
  newPassword!: string;
}

class DeleteMyAccountDto {
  @IsString({ message: 'Inserisci la tua password per confermare.' })
  @MinLength(1, { message: 'Inserisci la tua password per confermare.' })
  @MaxLength(200, { message: 'La password è troppo lunga (massimo 200 caratteri).' })
  password!: string;
}

class SetInitialPasswordDto {
  @IsString({ message: 'Scegli la tua password.' })
  @MinLength(8, { message: 'La password deve avere almeno 8 caratteri.' })
  @MaxLength(200, { message: 'La password è troppo lunga (massimo 200 caratteri).' })
  newPassword!: string;
}

class UpdateMyProfileDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(80) nickname?: string;
  @IsOptional() @IsString() @MaxLength(160) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(60) province?: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  // Data di nascita (ISO yyyy-mm-dd) o null per rimuoverla.
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(10) birthDate?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20) codiceFiscale?: string | null;
}

@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  /** Dati essenziali dell'utente autenticato. */
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.getById(user.sub);
  }

  /** Dati anagrafici modificabili dalla cliente (l'email ha un flusso a parte). */
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.users.getMyProfile(user.sub);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateMyProfileDto) {
    return this.users.updateMyProfile(user.sub, dto);
  }

  /** Impostazioni account (backoffice): dati personali + tema. */
  @Patch('account')
  updateAccount(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto) {
    return this.users.updateAccount(user.sub, dto);
  }

  /** Cambio password (con verifica di quella attuale). */
  @Patch('password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  /**
   * Cancellazione account self-service (requisito Google Play / App Store).
   * Conferma con la password; l'account viene anonimizzato e archiviato.
   */
  @Post('account/delete')
  deleteAccount(@CurrentUser() user: AuthUser, @Body() dto: DeleteMyAccountDto) {
    return this.users.deleteMyAccount(user.sub, dto.password);
  }

  /** Imposta la password al primo accesso (account provvisorio con mustChangePassword). */
  @Patch('password/initial')
  setInitialPassword(@CurrentUser() user: AuthUser, @Body() dto: SetInitialPasswordDto) {
    return this.users.setInitialPassword(user.sub, dto.newPassword);
  }

  /** Preferenze UI (scorciatoie dashboard). */
  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.users.getPreferences(user.sub);
  }

  @Put('preferences')
  setPreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePrefsDto) {
    return this.users.updatePreferences(user.sub, { dashboardShortcuts: dto.dashboardShortcuts, dashboardModules: dto.dashboardModules, dashboardCharts: dto.dashboardCharts, menuOrder: dto.menuOrder, showEarnings: dto.showEarnings, waterUnit: dto.waterUnit, dashboardBlocksOff: dto.dashboardBlocksOff, righePerPagina: dto.righePerPagina });
  }
}
