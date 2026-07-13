import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module';
import { NutritionistController } from './nutritionist.controller';
import { NutritionistService } from './nutritionist.service';

@Module({
  imports: [EngineModule],
  controllers: [NutritionistController],
  providers: [NutritionistService],
  exports: [NutritionistService],
})
export class NutritionistModule {}
