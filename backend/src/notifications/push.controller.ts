import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PushService } from './push.service';

class PushTokenDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsOptional()
  @IsIn(['android', 'ios', 'web'])
  platform?: string;
}

/** Registrazione/rimozione dei token push del dispositivo (clienti e staff). */
@Controller('me/push-tokens')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(200)
  register(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.push.saveToken(user.sub, dto.token, dto.platform ?? 'android');
  }

  @Delete()
  @HttpCode(200)
  unregister(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.push.removeToken(user.sub, dto.token);
  }

  /** Push di prova ai MIEI dispositivi (chiunque sia loggato, solo su se stesso). */
  @Post('test')
  @HttpCode(200)
  test(@CurrentUser() user: AuthUser) {
    return this.push.sendTest(user.sub);
  }
}

/**
 * Strumento di collaudo delle push per l'admin: manda un ping a un utente qualsiasi
 * e restituisce la diagnostica (Firebase configurato? quanti dispositivi? quale
 * errore per ciascuno?). Serve perché finora l'unico modo di provare le push era
 * fingere una conversazione in chat — che però è limitata a una notifica al giorno
 * per tipo, quindi faceva sembrare rotto quello che funzionava.
 * Non crea notifiche in app: è solo un ping al telefono.
 */
@Controller('admin/push-test')
@Roles('admin')
export class AdminPushTestController {
  constructor(private readonly push: PushService) {}

  @Post(':userId')
  @HttpCode(200)
  send(@Param('userId') userId: string) {
    return this.push.sendTest(userId);
  }
}
