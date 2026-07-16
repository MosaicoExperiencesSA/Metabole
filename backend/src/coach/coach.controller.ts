import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CoachService } from './coach.service';

class CreateAppointmentDto {
  @IsString()
  clientId!: string;

  @IsIn(['call', 'televisit', 'in_person'])
  type!: string;

  @IsISO8601()
  datetime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UpdateAppointmentDto {
  @IsOptional()
  @IsIn(['scheduled', 'done', 'cancelled'])
  status?: 'scheduled' | 'done' | 'cancelled';

  @IsOptional()
  @IsISO8601()
  datetime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** API dell'app Coach (clienti, dashboard, agenda). RBAC: coach + manager. */
@Controller('coach')
@Roles('coach', 'head_nutritionist', 'sales', 'admin')
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Get('clients')
  clients(@CurrentUser() user: AuthUser, @Query('leads') leads?: string) {
    return this.coach.clients(user, leads === '1' || leads === 'true');
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.coach.dashboard(user);
  }

  /** Agenda della coach: appuntamenti futuri delle sue clienti. */
  @Get('agenda')
  agenda(@CurrentUser() user: AuthUser) {
    return this.coach.coachAgenda(user);
  }
}

/** Creazione/gestione appuntamenti (staff). */
@Controller('appointments')
@Roles('coach', 'nutritionist')
export class AppointmentsController {
  constructor(private readonly coach: CoachService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.coach.createAppointment(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.coach.updateAppointment(user, id, dto);
  }
}

/** Agenda lato cliente: i propri appuntamenti + scadenza piano. */
@Controller('me/agenda')
@Roles('client')
export class MeAgendaController {
  constructor(private readonly coach: CoachService) {}

  @Get()
  agenda(@CurrentUser() user: AuthUser, @Query('next') next?: string) {
    return this.coach.clientAgenda(user.sub, next === '1' || next === 'true');
  }
}
