import { Module } from '@nestjs/common';
import { DietLearningService } from './diet-learning.service';

@Module({
  providers: [DietLearningService],
  exports: [DietLearningService],
})
export class DietLearningModule {}
