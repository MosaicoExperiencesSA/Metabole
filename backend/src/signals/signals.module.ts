import { Module } from '@nestjs/common';
import { DietLearningModule } from '../diet-learning/diet-learning.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { ProgressService } from './progress.service';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { WidgetController } from './widget.controller';

@Module({
  imports: [DietLearningModule, EscalationsModule],
  controllers: [SignalsController, WidgetController],
  providers: [SignalsService, ProgressService],
  exports: [SignalsService, ProgressService],
})
export class SignalsModule {}
