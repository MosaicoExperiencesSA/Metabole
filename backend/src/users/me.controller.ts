import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { UsersService } from './users.service';

class UpdatePrefsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  dashboardShortcuts!: string[];
}

class UpdateMyProfileDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(80) nickname?: string;
  @IsOptional() @IsString() @MaxLength(160) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(60) province?: string;
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

  /** Preferenze UI (scorciatoie dashboard). */
  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.users.getPreferences(user.sub);
  }

  @Put('preferences')
  setPreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePrefsDto) {
    return this.users.setDashboardShortcuts(user.sub, dto.dashboardShortcuts ?? []);
  }
}
