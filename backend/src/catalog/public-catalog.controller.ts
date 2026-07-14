import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

/** Endpoint pubblici per il sito di presentazione (nessuna autenticazione). */
@Controller('public')
export class PublicCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Percorsi mostrati sul sito (data-paths-endpoint): diete clientVisible, una per stile. */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('paths')
  paths() {
    return this.catalog.publicPaths();
  }

  /** Numeri della home (data-stats-endpoint): config_param con fallback a conteggi reali. */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('stats')
  stats() {
    return this.catalog.publicStats();
  }
}
