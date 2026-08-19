import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CycleService } from './cycle.service';

/**
 * R10 — Ciclo bigiornaliero attivo.
 * - la cliente vede il proprio ciclo corrente (cosa mangia ora + le 2 cotture);
 * - coach/nutrizionista possono vederlo per una cliente.
 */
@Controller()
export class CycleController {
  constructor(private readonly cycle: CycleService) {}

  /**
   * ⚠️ **Legge e basta**, e manda solo quello che serve a lei (19/8): le cotture di questi giorni e
   * com'è andato il ciclo appena chiuso. `getActiveCycle` — che qui c'era prima — **scrive** a ogni
   * chiamata, e collegarci l'app avrebbe voluto dire una scrittura a ogni apertura della schermata.
   * Vedi `cicloPerLaCliente` e `progetto/DECISIONE_Due_Schermate_App.md`.
   */
  @Get('me/cycle')
  @Roles('client')
  mine(@CurrentUser() user: AuthUser) {
    return this.cycle.cicloPerLaCliente(user.sub);
  }

  /** Lo staff continua a passare da `getActiveCycle`: qui la riga del ciclo deve **esistere**. */
  @Get('clients/:id/cycle')
  @Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'admin')
  forClient(@Param('id') clientId: string) {
    return this.cycle.getActiveCycle(clientId);
  }
}
