import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module';
import { MenuModule } from '../menu/menu.module';
import { PersonalBaseModule } from '../personal-base/personal-base.module';
import { NutritionistController } from './nutritionist.controller';
import { NutritionistService } from './nutritionist.service';

@Module({
  // PersonalBaseModule serve per lo SBLOCCO vero del piano (ricostruzione della base sicura).
  // Non ha import propri, quindi non introduce cicli fra moduli.
  //
  // MenuModule serve al §15.5 (le calorie scritte a mano): `KcalNeedService` per il fabbisogno e
  // `MenuService` per rigenerare i giorni futuri. Non chiude nessun anello — `MenuModule` importa
  // Calendar, DietAgent e Push, e nessuno dei tre torna qui.
  imports: [EngineModule, MenuModule, PersonalBaseModule],
  controllers: [NutritionistController],
  providers: [NutritionistService],
  exports: [NutritionistService],
})
export class NutritionistModule {}
