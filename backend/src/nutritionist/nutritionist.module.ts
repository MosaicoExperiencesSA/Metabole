import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module';
import { PersonalBaseModule } from '../personal-base/personal-base.module';
import { NutritionistController } from './nutritionist.controller';
import { NutritionistService } from './nutritionist.service';

@Module({
  // PersonalBaseModule serve per lo SBLOCCO vero del piano (ricostruzione della base sicura).
  // Non ha import propri, quindi non introduce cicli fra moduli.
  imports: [EngineModule, PersonalBaseModule],
  controllers: [NutritionistController],
  providers: [NutritionistService],
  exports: [NutritionistService],
})
export class NutritionistModule {}
