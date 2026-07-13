import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { TrackingService } from './tracking.service';

/**
 * Ingestione degli eventi di tracciamento (analitici, append-only).
 * Rotta PUBBLICA: gli eventi arrivano anche prima del login (funnel di onboarding).
 * Se è presente un Bearer token valido, l'evento viene legato all'utente.
 */
@Controller('events')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Public()
  @Post()
  @HttpCode(202)
  track(@Body() dto: CreateEventDto, @Headers('authorization') auth?: string) {
    return this.tracking.ingest(dto, auth);
  }
}
