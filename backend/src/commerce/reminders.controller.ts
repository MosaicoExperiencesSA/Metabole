import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { RemindersService } from './reminders.service';

class CreateReminderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  crmRecordId?: string;
}

class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

/** Calendario CRM (coach, commerciale, capo, admin). */
@Controller('crm/reminders')
@Roles('coach', 'sales', 'nutritionist', 'head_nutritionist', 'admin')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string, @Query('includeDone') includeDone?: string) {
    return this.reminders.list({ from, to, includeDone: includeDone === 'true' });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReminderDto) {
    return this.reminders.create(dto, user.sub);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateReminderDto) {
    return this.reminders.update(id, dto, user.sub);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reminders.remove(id, user.sub);
  }
}
