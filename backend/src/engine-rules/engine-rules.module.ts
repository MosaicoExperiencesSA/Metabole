import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
// ⚠️ Serve `KcalNeedService`: la taglia del catalogo si calcola sul fabbisogno delle clienti
// (voce 273). Nessun ciclo — `MenuModule` non importa questo modulo.
import { MenuModule } from '../menu/menu.module';
import { EngineRulesController } from './engine-rules.controller';
import { EngineRulesService } from './engine-rules.service';

@Module({
  imports: [AiModule, MenuModule],
  controllers: [EngineRulesController],
  providers: [EngineRulesService],
  exports: [EngineRulesService],
})
export class EngineRulesModule {}
