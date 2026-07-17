import { Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
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
