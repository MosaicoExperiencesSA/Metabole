import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateCheckinDto,
  CreateMeasurementDto,
  CreateStepsDto,
  CreateWaterDto,
} from './dto/signals.dto';
import { ProgressService } from './progress.service';
import { SignalsService } from './signals.service';

@Controller('me')
@Roles('client')
export class SignalsController {
  constructor(
    private readonly signals: SignalsService,
    private readonly progress: ProgressService,
  ) {}

  // Misure
  @Get('measurements')
  listMeasurements(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.signals.listMeasurements(user.sub, from, to);
  }

  @Post('measurements')
  createMeasurement(@CurrentUser() user: AuthUser, @Body() dto: CreateMeasurementDto) {
    return this.signals.upsertMeasurement(user.sub, dto);
  }

  // Correzione della misura di OGGI (una sola volta): la precedente resta "sostituita".
  @Post('measurements/correct')
  correctMeasurement(@CurrentUser() user: AuthUser, @Body() dto: CreateMeasurementDto) {
    return this.signals.correctTodayMeasurement(user.sub, dto);
  }

  // Check-in
  @Get('checkins')
  listCheckins(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.signals.listCheckins(user.sub, from, to);
  }

  @Post('checkins')
  createCheckin(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckinDto) {
    return this.signals.upsertCheckin(user.sub, dto);
  }

  /** Stato del giorno per la dashboard (popup check-in, acqua, passi). */
  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.signals.todayStatus(user.sub);
  }

  /** Dati per il widget da home screen (stato mascotte, frase, prossimo pasto, progresso). */
  @Get('widget')
  widget(@CurrentUser() user: AuthUser) {
    return this.signals.widget(user.sub);
  }

  // Acqua e passi
  @Post('water')
  water(@CurrentUser() user: AuthUser, @Body() dto: CreateWaterDto) {
    return this.signals.upsertWater(user.sub, dto);
  }

  @Post('steps')
  steps(@CurrentUser() user: AuthUser, @Body() dto: CreateStepsDto) {
    return this.signals.upsertSteps(user.sub, dto);
  }

  // Traguardi e progressi
  @Get('milestones')
  milestones(@CurrentUser() user: AuthUser) {
    return this.signals.listMilestones(user.sub);
  }

  @Get('progress')
  getProgress(@CurrentUser() user: AuthUser) {
    return this.progress.getProgress(user.sub);
  }
}
