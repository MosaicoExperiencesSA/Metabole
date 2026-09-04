import { Module } from '@nestjs/common';
import { CoachDiRiservaController } from './coach-di-riserva.controller';
import { CoachDiRiservaService } from './coach-di-riserva.service';

@Module({
  controllers: [CoachDiRiservaController],
  providers: [CoachDiRiservaService],
  exports: [CoachDiRiservaService],
})
export class CoachDiRiservaModule {}
