import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NotificationsService } from './notifications.service';

/** Tipi disattivabili dalla cliente (gli alert allo staff non si toccano da qui). */
const CLIENT_NOTIFICATION_TYPES = [
  'engine_daily',
  'checkin_reminder',
  'measurement_reminder',
  'progress_cheer',
  'rating_request',
  'visit_reminder',
  'pre_event',
  'mini_plan',
  'chat_reply_coach',
  'chat_reply_nutritionist',
] as const;

class UpdatePrefsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(CLIENT_NOTIFICATION_TYPES as unknown as string[], { each: true })
  disabledTypes?: string[];

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;
}

/** Notifiche in-app: clienti e staff leggono le proprie. */
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.listForUser(user.sub, unread === 'true');
  }

  /** Preferenze (spec sez. 9: rispettare preferenze e consensi dell'utente). */
  @Roles('client')
  @Get('prefs')
  getPrefs(@CurrentUser() user: AuthUser) {
    return this.notifications.getPrefs(user.sub);
  }

  @Roles('client')
  @Patch('prefs')
  updatePrefs(@CurrentUser() user: AuthUser, @Body() dto: UpdatePrefsDto) {
    return this.notifications.updatePrefs(user.sub, dto);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, id);
  }
}
