import { Module } from '@nestjs/common';
import { CoachTasksController } from './coach-tasks.controller';
import { CoachTasksService } from './coach-tasks.service';

/** Task coach generati dal cron sui momenti chiave di prova e piani (handoff lancio). */
@Module({
  controllers: [CoachTasksController],
  providers: [CoachTasksService],
  exports: [CoachTasksService],
})
export class CoachTasksModule {}
