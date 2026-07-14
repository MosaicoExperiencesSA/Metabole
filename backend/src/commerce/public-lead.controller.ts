import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CrmService } from './crm.service';
import { PublicLeadDto } from './dto/public-lead.dto';

/** Endpoint pubblico per i form del sito (contatti + "Lavora con noi"). */
@Controller('public/leads')
export class PublicLeadController {
  constructor(private readonly crm: CrmService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // max 5 invii/min per IP
  @HttpCode(200)
  @Post()
  async create(@Body() dto: PublicLeadDto) {
    if (dto.website && dto.website.length > 0) return { ok: true }; // honeypot: bot → drop silenzioso
    return this.crm.createPublic({
      email: dto.email,
      nome: dto.nome,
      fonte: dto.fonte,
      lingua: dto.lingua,
      ruolo: dto.ruolo,
      messaggio: dto.messaggio,
    });
  }
}
