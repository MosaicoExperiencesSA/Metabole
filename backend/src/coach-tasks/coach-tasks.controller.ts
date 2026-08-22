import { Body, Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CoachTasksService } from './coach-tasks.service';
// ⚠️ La stessa costante che usa il filtro nel servizio: chi entra e cosa vede è una domanda sola.
import { RUOLI_NUTRIZIONISTA } from '../common/ruoli-nutrizionista';

class SetStatusDto {
  @IsIn(['todo', 'done', 'skipped'])
  status!: 'todo' | 'done' | 'skipped';
}

/**
 * Task coach: la coach vede i SUOI (clienti assegnate); responsabile coach e admin tutti.
 *
 * ## ⛔ E LA NUTRIZIONISTA — che dal 21/8 riceveva la push e trovava un 403 (corretto il 22/8)
 *
 * Quattro tipi di attività nascono addosso a lei (`TIPI_DELLA_NUTRIZIONISTA` in
 * `avvisi-attivita.ts`): digiuno estremo, finestra non traducibile, pasti non serviti, calorie che
 * restano corte. I loro testi chiedono cose che solo lei può fare, e dal 21/8 la push le arriva
 * davvero. Ma questa porta era `@Roles('coach',
 * 'coach_coordinator', 'sales', 'admin')` e il permesso `coach_tasks` per il suo ruolo era spento:
 * cliccava e prendeva «Non hai il permesso per questa sezione».
 *
 * ⚠️ **Avvisare qualcuno di una cosa che non può guardare è peggio che non avvisarlo**: sa che c'è
 * qualcosa su una sua cliente e non ha modo di vedere cosa. E il difetto non si accendeva da
 * nessuna parte — la push partiva, l'attività c'era, il log era pulito.
 *
 * ⚠️ Quello che vede è **solo la sua roba**: `list` e `setStatus` filtrano i suoi quattro tipi (vedi
 * `filtroNutrizionista` in `coach-tasks.service.ts`). Aprirle l'elenco intero vorrebbe dire
 * metterle davanti le chiamate della prova e i rinnovi, che non sono suoi — e una colonna piena di
 * lavoro altrui si smette di leggere.
 *
 * ⛔ Il permesso di pagina è **due cose**: il default in `permissions/pages.ts` (vale per gli
 * ambienti nuovi) e la **riga già scritta in banca dati**, che vince sul default. Per quella c'è
 * `npm run apri:attivita-nutrizionista`, da lanciare una volta sola su Render.
 */
@Controller('staff/coach-tasks')
@RequirePage('coach_tasks')
@Roles('coach', 'coach_coordinator', 'sales', 'admin', ...RUOLI_NUTRIZIONISTA)
export class CoachTasksController {
  constructor(private readonly tasks: CoachTasksService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('limit') limit?: string) {
    return this.tasks.list(u.sub, u.role, { status, limit: limit ? Number(limit) || 100 : 100 });
  }

  @Get('summary')
  summary(@CurrentUser() u: AuthUser) {
    return this.tasks.summary(u.sub, u.role);
  }

  @HttpCode(200)
  @Patch(':id/status')
  setStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.tasks.setStatus(u.sub, id, dto.status, u.role);
  }
}
