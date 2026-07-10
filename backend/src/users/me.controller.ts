import { Body, Controller, Get, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { UsersService } from './users.service';

class UpdatePrefsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  dashboardShortcuts!: string[];
}

@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  /** Dati essenziali dell'utente autenticato. */
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.getById(user.sub);
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
