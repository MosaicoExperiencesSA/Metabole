import { Module } from '@nestjs/common';
import { PushModule } from '../notifications/push.module';
import { CoachTasksController } from './coach-tasks.controller';
import { CoachTasksService } from './coach-tasks.service';

/** Task coach generati dal cron sui momenti chiave di prova e piani (handoff lancio). */
@Module({
  // PushModule è autonomo (Prisma + Config): serve alla push delle attività (Simone, 14/8).
  imports: [PushModule],
  controllers: [CoachTasksController],
  providers: [CoachTasksService],
  exports: [CoachTasksService],
})
export class CoachTasksModule {}
