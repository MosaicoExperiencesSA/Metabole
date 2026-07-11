import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AnalyticsService } from './analytics.service';

/** Pagina Grafici: metriche aggregate, con scope per ruolo. */
@Controller('admin/charts')
@Roles('coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  charts(@CurrentUser() user: AuthUser) {
    return this.analytics.charts(user);
  }
}
