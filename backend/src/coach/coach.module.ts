import { Module } from '@nestjs/common';
import { AppointmentsController, CoachController, MeAgendaController } from './coach.controller';
import { CoachService } from './coach.service';

@Module({
  controllers: [CoachController, AppointmentsController, MeAgendaController],
  providers: [CoachService],
  exports: [CoachService],
})
export class CoachModule {}
