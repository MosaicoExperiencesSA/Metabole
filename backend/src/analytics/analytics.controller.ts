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

  /**
   * FATTURATO COACH e PROVVIGIONI MATURATE, una barra per coach, mese per mese.
   *
   * ⚠️ I ruoli sono **tre**, e non sono quelli della pagina: la classe apre i grafici anche a coach,
   * nutrizioniste e capo nutrizionista, ma questi due dati sono i soldi di una squadra di coach.
   * Una coach non deve vedere quanto fattura e quanto guadagna la collega, e una nutrizionista non
   * ha niente da farci. Chi entra vede la propria rete: la coordinatrice le sue, admin e
   * Responsabile Coach tutte (`reteCoachVisibile`).
   */
  @Roles('admin', 'sales', 'coach_coordinator')
  @Get('coach')
  graficiCoach(@CurrentUser() user: AuthUser) {
    return this.analytics.graficiCoach(user);
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
