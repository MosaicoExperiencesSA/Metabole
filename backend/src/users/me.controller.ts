import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}

class UpdateAccountDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsIn(['light', 'dark', 'taupe', 'white']) theme?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
}

class ChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
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

  /** Preferenze UI (scorciatoie dashboard). */
  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.users.getPreferences(user.sub);
  }

  @Put('preferences')
  setPreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePrefsDto) {
    return this.users.updatePreferences(user.sub, { dashboardShortcuts: dto.dashboardShortcuts, dashboardModules: dto.dashboardModules });
  }
}
