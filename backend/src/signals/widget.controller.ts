import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../common/decorators/public.decorator';
import { SignalsService } from './signals.service';

/**
 * Endpoint PUBBLICO per il widget da home screen (nativo iOS/Android).
 * Autenticazione con il "token widget" (scope 'widget', lunga scadenza), passato
 * come Bearer o come query `?token=`. Il token widget NON vale sulle altre rotte
 * (la guardia globale lo rifiuta). Sola lettura.
 */
@Controller()
export class WidgetController {
  constructor(
    private readonly jwt: JwtService,
    private readonly signals: SignalsService,
  ) {}

  @Public()
  @Get('widget')
  async widget(@Req() req: { headers: Record<string, string | undefined>; query: Record<string, string | undefined> }) {
    const auth = req.headers['authorization'];
    const bearer = auth && auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    const token = bearer ?? req.query['token'];
    if (!token) throw new UnauthorizedException('Token widget mancante');
    let payload: { sub: string; scope?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token widget non valido o scaduto');
    }
    if (payload.scope !== 'widget' || !payload.sub) {
      throw new UnauthorizedException('Token non valido per il widget');
    }
    return this.signals.widget(payload.sub);
  }
}
