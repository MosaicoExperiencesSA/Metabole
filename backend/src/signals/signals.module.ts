import { Module } from '@nestjs/common';
import { DietLearningModule } from '../diet-learning/diet-learning.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { MenuModule } from '../menu/menu.module';
import { ProgressService } from './progress.service';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { WidgetController } from './widget.controller';

@Module({
  // MenuModule: all'invio di una misura proviamo a erogare il menu (la misura può
  // sbloccare la prova gratuita / il ciclo successivo). Nessun ciclo di dipendenze:
  // MenuModule non importa SignalsModule.
  imports: [DietLearningModule, EscalationsModule, MenuModule],
  controllers: [SignalsController, WidgetController],
  providers: [SignalsService, ProgressService],
  exports: [SignalsService, ProgressService],
})
export class SignalsModule {}
