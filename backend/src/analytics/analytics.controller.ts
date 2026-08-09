import { Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AnalyticsService } from './analytics.service';

/** Pagina Grafici: metriche aggregate, con scope per ruolo. */
@Controller('admin/charts')
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  charts(@CurrentUser() user: AuthUser) {
    return this.analytics.charts(user);
  }

  /**
   * Fatturato cumulato e nuove clienti PER GIORNATA, per un mese, col mese precedente affiancato.
   *
   * `?mese=2026-08`; senza parametro, il mese in corso. È una rotta a parte perché la pagina scorre
   * i mesi con le frecce: rifare tutto `charts` (misure comprese) a ogni freccia sarebbe uno spreco
   * che si sente.
   */
  @Get('daily')
  daily(@CurrentUser() user: AuthUser, @Query('mese') mese?: string) {
    return this.analytics.serieGiornaliera(user, mese);
  }

  /** Genera dati demo (6 mesi) per vedere i grafici popolati. Solo admin. */
  @Roles('admin')
  @HttpCode(200)
  @Post('demo')
  seedDemo() {
    return this.analytics.seedDemo();
  }

  /** Rimuove i dati demo. Solo admin. */
  @Roles('admin')
  @HttpCode(200)
  @Delete('demo')
  clearDemo() {
    return this.analytics.clearDemo();
  }
}
