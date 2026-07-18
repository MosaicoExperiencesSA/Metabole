import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEmail, IsInt, IsISO8601, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { MarketingService, SegmentFilters } from './marketing.service';
import { LifecycleService } from './lifecycle.service';

class PreviewDto {
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
}
class SendCampaignDto {
  @IsString() @MaxLength(160) title!: string;
  @IsString() @MaxLength(120) templateKey!: string;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
  // Invio programmato: data/ora ISO (assente = invia ora).
  @IsOptional() @IsISO8601() scheduledFor?: string;
  // Throttle a lotti: invia N e-mail, poi pausa di M minuti (0 = tutte insieme).
  @IsOptional() @IsInt() @Min(0) @Max(5000) batchSize?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1440) pauseMinutes?: number;
  // Azione post-invio (facoltativa): etichetta da aggiungere e/o stato pipeline da impostare.
  @IsOptional() @IsString() @MaxLength(40) postTag?: string;
  @IsOptional() @IsString() @MaxLength(60) postStage?: string;
}
class TestDto {
  @IsString() @MaxLength(120) templateKey!: string;
  @IsEmail() testEmail!: string;
}
class LifecycleSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() triggers?: Record<string, boolean>;
}

@Controller('marketing')
@RequirePage('marketing')
@Roles('marketing', 'head_marketing', 'admin')
export class MarketingController {

  /** Funnel del lancio (handoff punto 6): conteggi per evento × segmento × canale. */
  @Get('funnel')
  funnel(@Query('days') days?: string) {
    const n = Number(days);
    return this.service.funnelOverview(Number.isFinite(n) && n > 0 ? n : 30);
  }
  constructor(
    private readonly service: MarketingService,
    private readonly lifecycle: LifecycleService,
  ) {}

  @Get('options')
  options() {
    return this.service.options();
  }

  @Post('segments/preview')
  preview(@Body() dto: PreviewDto) {
    return this.service.previewSegment((dto.filters ?? {}) as SegmentFilters);
  }

  @Post('campaigns/test')
  test(@Body() dto: TestDto) {
    return this.service.sendTest(dto.templateKey, dto.testEmail);
  }

  @Post('campaigns')
  send(@Body() dto: SendCampaignDto, @CurrentUser() u: AuthUser) {
    return this.service.sendCampaign(
      {
        title: dto.title,
        templateKey: dto.templateKey,
        filters: (dto.filters ?? {}) as SegmentFilters,
        scheduledFor: dto.scheduledFor ?? null,
        batchSize: dto.batchSize,
        pauseMinutes: dto.pauseMinutes,
        postTag: dto.postTag,
        postStage: dto.postStage,
      },
      u.sub,
    );
  }

  @Post('campaigns/:id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.service.cancelCampaign(id, u.sub);
  }

  @Get('campaigns')
  list() {
    return this.service.listCampaigns();
  }

  @Get('campaigns/:id')
  get(@Param('id') id: string) {
    return this.service.getCampaign(id);
  }

  @Get('campaigns/:id/stats')
  stats(@Param('id') id: string) {
    return this.service.campaignStats(id);
  }

  // ---------- Automazione ciclo di vita ----------

  @Get('lifecycle')
  lifecycleOverview() {
    return this.lifecycle.overview();
  }

  @Patch('lifecycle')
  lifecycleUpdate(@Body() dto: LifecycleSettingsDto, @CurrentUser() u: AuthUser) {
    return this.lifecycle.updateSettings({ enabled: dto.enabled, triggers: dto.triggers }, u.sub);
  }

  @Post('lifecycle/run')
  lifecycleRun(@CurrentUser() u: AuthUser) {
    return this.lifecycle.tick('manual', u.sub);
  }
}
