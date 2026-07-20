import { Body, Controller, Get, HttpCode, Post, Query, Redirect } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { MarketingService } from './marketing.service';

class SetPrefsDto {
  @IsBoolean() marketingConsent!: boolean;
  @IsOptional() @IsArray() @IsIn(['email', 'whatsapp', 'sms'], { each: true }) channels?: string[];
}

/**
 * Preferenze marketing PUBBLICHE (handoff punto 6, GDPR): il link nel footer di
 * ogni email porta qui con un token firmato — niente login, disiscrizione facile.
 * Serve anche per il RI-OPT-IN dello storico importato (email di re-permission
 * con lo stesso link → la persona sceglie consenso e canali).
 */
@SkipThrottle()
@Controller('public/marketing/prefs')
export class PrefsController {
  constructor(private readonly service: MarketingService) {}

  @Public()
  @Get()
  get(@Query('t') token: string) {
    return this.service.getPrefsByToken(token ?? '');
  }

  @Public()
  @HttpCode(200)
  @Post()
  set(@Query('t') token: string, @Body() dto: SetPrefsDto) {
    return this.service.setPrefsByToken(token ?? '', { marketingConsent: dto.marketingConsent, channels: dto.channels });
  }
}

/**
 * Disiscrizione con-un-click (RFC 8058): l'header List-Unsubscribe-Post fa sì che
 * Gmail/Yahoo/Microsoft mandino una POST diretta qui, senza aprire una pagina. Nessun
 * corpo richiesto → opt-out immediato. Il GET (link seguito a mano da una persona)
 * rimanda invece alla pagina preferenze, così la scelta è consapevole e riattivabile —
 * e i "prefetch" dei filtri antispam non disiscrivono nessuno per errore.
 */
@SkipThrottle()
@Controller('public/marketing/unsubscribe')
export class UnsubscribeController {
  constructor(private readonly service: MarketingService) {}

  @Public()
  @HttpCode(200)
  @Post()
  oneClick(@Query('t') token: string) {
    return this.service.oneClickUnsubscribe(token ?? '');
  }

  @Public()
  @Get()
  @Redirect()
  goToPrefs(@Query('t') token: string) {
    return { url: this.service.prefsPageUrlForToken(token ?? ''), statusCode: 302 };
  }
}
