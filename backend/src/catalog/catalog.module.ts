import { Module } from '@nestjs/common';
import {
  CatalogController,
  DietsController,
  HeadCatalogController,
  RecipesController,
} from './catalog.controller';
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
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
