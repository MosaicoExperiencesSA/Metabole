import { Body, Controller, Get, HttpCode, Ip, Patch, Post, Query, Res } from '@nestjs/common';
import { IsBoolean, IsEmail, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePage } from '../../common/decorators/require-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { InvitoGaiaService } from './invito-gaia.service';

class ImpostazioniInvitoDto {
  @IsOptional() @IsBoolean() attivo?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) alGiorno?: number;
  @IsOptional() @IsInt() @Min(1) @Max(90) promemoriaGiorni?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) oraDa?: number;
  @IsOptional() @IsInt() @Min(1) @Max(24) oraA?: number;
}

class ProvaInvitoDto {
  @IsEmail() email!: string;
}

/** Pannello «Invito a Gaia» nella pagina Marketing: stesse guardie della pagina. */
@Controller('marketing/invito-gaia')
@RequirePage('marketing')
@Roles('marketing', 'head_marketing', 'admin')
export class InvitoGaiaController {
  constructor(private readonly invito: InvitoGaiaService) {}

  @Get()
  panoramica() {
    return this.invito.panoramica();
  }

  @Patch()
  aggiorna(@Body() dto: ImpostazioniInvitoDto, @CurrentUser() u: AuthUser) {
    return this.invito.aggiorna(dto, u.sub);
  }

  @HttpCode(200)
  @Post('prova')
  prova(@Body() dto: ProvaInvitoDto, @CurrentUser() u: AuthUser) {
    return this.invito.prova(dto.email, u.sub);
  }

  /** Un giro subito (rispetta interruttore e finestra oraria): per non aspettare il quarto d'ora. */
  @HttpCode(200)
  @Post('giro')
  giro() {
    return this.invito.giro();
  }
}

function html(res: Response, corpo: string): void {
  res
    .status(200)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      // Il token sta nell'indirizzo: non deve finire nel Referer di nessuno.
      'Referrer-Policy': 'no-referrer',
    })
    .send(corpo);
}

/**
 * I link delle email dell'invito (pubblici, senza login). Il GET mostra una pagina, il POST agisce:
 * vedi `pagine.ts` per il perché.
 */
@Controller('public/gaia')
export class InvitoGaiaPubblicoController {
  constructor(private readonly invito: InvitoGaiaService) {}

  @Public()
  @Get('inizia')
  async paginaInizio(@Query('t') t: string, @Res() res: Response) {
    html(res, await this.invito.paginaInizio(t ?? ''));
  }

  @Public()
  @Post('inizia')
  async inizia(@Query('t') t: string, @Ip() ip: string, @Res() res: Response) {
    const esito = await this.invito.inizia(t ?? '', ip);
    if ('vai' in esito) {
      res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).redirect(303, esito.vai);
      return;
    }
    html(res, esito.pagina);
  }

  @Public()
  @Get('cancellami')
  async paginaCancellami(@Query('t') t: string, @Res() res: Response) {
    html(res, await this.invito.paginaCancellami(t ?? ''));
  }

  @Public()
  @Post('cancellami')
  async cancellami(@Query('t') t: string, @Res() res: Response) {
    html(res, await this.invito.cancellami(t ?? ''));
  }
}
