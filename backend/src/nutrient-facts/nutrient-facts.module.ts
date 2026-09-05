import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgenteAlimentiService } from './agente-alimenti.service';
import { NutrientFactsController } from './nutrient-facts.controller';
import { ValoriNutrizionaliService } from './valori-nutrizionali.service';

/**
 * La banca dati nutrizionale (11/8). La usano la chat — per far **citare** a Gaia dei valori invece di
 * ricordarli — e la nutrizionista dal backoffice, che è l'unica che può correggerli.
 */
@Module({
  imports: [AiModule],
  controllers: [NutrientFactsController],
  providers: [ValoriNutrizionaliService, AgenteAlimentiService],
  exports: [ValoriNutrizionaliService, AgenteAlimentiService],
})
export class NutrientFactsModule {}
