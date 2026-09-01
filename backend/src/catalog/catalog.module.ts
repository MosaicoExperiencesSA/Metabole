import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  CatalogController,
  DietsController,
  HeadCatalogController,
  RecipesController,
} from './catalog.controller';
import { AgentePastiLeggeriService } from './agente-pasti-leggeri.service';
import { CatalogService } from './catalog.service';
import { PublicCatalogController } from './public-catalog.controller';

@Module({
  controllers: [
    DietsController,
    HeadCatalogController,
    CatalogController,
    RecipesController,
    PublicCatalogController,
  ],
  imports: [NotificationsModule, AiModule],
  providers: [CatalogService, AgentePastiLeggeriService],
  exports: [CatalogService, AgentePastiLeggeriService],
})
export class CatalogModule {}
