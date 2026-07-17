import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { UsersService } from './users.service';

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(80)
  menuOrder?: string[];

  // Mostra i KPI "Guadagni" in dashboard (default off: attivabili dall'utente).
  @IsOptional()
  @IsBoolean()
  showEarnings?: boolean;

  // Unità di visualizzazione dell'acqua in dashboard (solo display: il dato resta
  // in bicchieri). glass = bicchieri · bottle05/1/15 = bottiglie da 0,5/1/1,5 L.
  @IsOptional()
  @IsIn(['glass', 'bottle05', 'bottle1', 'bottle15'])
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

class ChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(200) newPassword!: string;
}

class SetInitialPasswordDto {
  @IsString() @MinLength(8) @MaxLength(200) newPassword!: string;
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
    return this.users.updatePreferences(user.sub, { dashboardShortcuts: dto.dashboardShortcuts, dashboardModules: dto.dashboardModules, dashboardCharts: dto.dashboardCharts, menuOrder: dto.menuOrder, showEarnings: dto.showEarnings, waterUnit: dto.waterUnit });
  }
}
