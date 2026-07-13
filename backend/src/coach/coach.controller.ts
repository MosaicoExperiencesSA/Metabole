import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CoachService } from './coach.service';

/** API dell'app Coach (clienti assegnate, dashboard). RBAC: coach + manager. */
@Controller('coach')
@Roles('coach', 'head_nutritionist', 'sales', 'admin')
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  /** Elenco delle clienti della coach con riepilogo. */
  @Get('clients')
  clients(@CurrentUser() user: AuthUser) {
    return this.coach.clients(user);
  }

  /** Home della coach: clienti, piani in scadenza, guadagni, alert. */
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.coach.dashboard(user);
  }
}
