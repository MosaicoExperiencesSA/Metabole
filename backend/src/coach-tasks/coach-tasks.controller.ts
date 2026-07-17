import { Body, Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CoachTasksService } from './coach-tasks.service';

class SetStatusDto {
  @IsIn(['todo', 'done', 'skipped'])
  status!: 'todo' | 'done' | 'skipped';
}

/** Task coach: la coach vede i SUOI (clienti assegnate); responsabile coach e admin tutti. */
@Controller('staff/coach-tasks')
@RequirePage('coach_tasks')
@Roles('coach', 'sales', 'admin')
export class CoachTasksController {
  constructor(private readonly tasks: CoachTasksService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('limit') limit?: string) {
    return this.tasks.list(u.sub, { status, limit: limit ? Number(limit) || 100 : 100 });
  }

  @Get('summary')
  summary(@CurrentUser() u: AuthUser) {
    return this.tasks.summary(u.sub);
  }

  @HttpCode(200)
  @Patch(':id/status')
  setStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.tasks.setStatus(u.sub, id, dto.status);
  }
}
