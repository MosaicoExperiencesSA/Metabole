import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateSocialPostDto,
  MarkPublishedDto,
  ScheduleDto,
  UpdateSocialPostDto,
} from './dto/social.dto';
import { PublisherService } from './publisher.service';

/** Agente Publisher — gestione post social dal backoffice (marketing/admin). */
@Controller('admin/social-posts')
@Roles('marketing', 'head_marketing', 'admin')
export class SocialController {
  constructor(private readonly publisher: PublisherService) {}

  @Get()
  list(@Query('status') status?: string, @Query('channel') channel?: string) {
    return this.publisher.list({ status, channel });
  }

  @Post()
  create(@Body() dto: CreateSocialPostDto, @CurrentUser() user: AuthUser) {
    return this.publisher.create(user.sub, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSocialPostDto, @CurrentUser() user: AuthUser) {
    return this.publisher.update(user.sub, id, dto);
  }

  @HttpCode(200)
  @Post(':id/judge')
  judge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.publisher.judge(user.sub, id);
  }

  @HttpCode(200)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.publisher.approve(user.sub, id);
  }

  @HttpCode(200)
  @Post(':id/schedule')
  schedule(@Param('id') id: string, @Body() dto: ScheduleDto, @CurrentUser() user: AuthUser) {
    return this.publisher.schedule(user.sub, id, dto.at);
  }

  @HttpCode(200)
  @Post(':id/publish')
  publish(@Param('id') id: string, @Body() dto: MarkPublishedDto, @CurrentUser() user: AuthUser) {
    return this.publisher.markPublished(user.sub, id, dto.externalId);
  }

  @HttpCode(200)
  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.publisher.reject(user.sub, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.publisher.remove(user.sub, id);
  }
}
