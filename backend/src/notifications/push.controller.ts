import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
}
