import { Module } from '@nestjs/common';
import {
  CatalogController,
  DietsController,
  HeadCatalogController,
  RecipesController,
} from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [
    DietsController,
    HeadCatalogController,
    CatalogController,
    RecipesController,
  ],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
