import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EventsService } from './events.service';

class CreateEventDto {
  @IsIn(['wedding', 'baptism', 'dinner', 'monthly_cheat', 'vacation', 'other'])
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsIn(['single_event', 'pause_period'])
  mode!: 'single_event' | 'pause_period';
}

@Controller('me/events')
@Roles('client')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.events.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.events.create(user.sub, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.remove(user.sub, id);
  }

  @Get(':id/plan')
  plan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.plan(user.sub, id);
  }
}
