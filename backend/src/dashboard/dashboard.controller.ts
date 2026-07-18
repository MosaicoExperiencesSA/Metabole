import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { DashboardService } from './dashboard.service';

/** Anteprime dei moduli della dashboard (ultimi dati per pagina). */
@Controller('admin/dashboard')
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'sales', 'marketing', 'head_marketing', 'admin')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('previews')
  previews(@CurrentUser() user: AuthUser) {
    return this.dashboard.previews(user);
  }
}
