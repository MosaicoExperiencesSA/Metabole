import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsEmail, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { MarketingService, SegmentFilters } from './marketing.service';

class PreviewDto {
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
}
class SendCampaignDto {
  @IsString() @MaxLength(160) title!: string;
  @IsString() @MaxLength(120) templateKey!: string;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
}
class TestDto {
  @IsString() @MaxLength(120) templateKey!: string;
  @IsEmail() testEmail!: string;
}

@Controller('marketing')
@Roles('marketing', 'head_marketing', 'admin')
export class MarketingController {
  constructor(private readonly service: MarketingService) {}

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
    return this.service.sendCampaign({ title: dto.title, templateKey: dto.templateKey, filters: (dto.filters ?? {}) as SegmentFilters }, u.sub);
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
}
