import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PauseService } from './pause.service';

class RequestPauseDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

class DecideDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Congelamento abbonamento lato cliente (app). */
@Controller('me/pause-requests')
@Roles('client')
export class MePauseController {
  constructor(private readonly pause: PauseService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.pause.myRequests(user.sub);
  }

  @Post()
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestPauseDto) {
    return this.pause.requestPause(user.sub, dto);
  }
}

/** Approvazione richieste di pausa lato staff (backoffice). */
@Controller('staff/pause-requests')
@Roles('coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class StaffPauseController {
  constructor(private readonly pause: PauseService) {}

  @Get()
  pending(@CurrentUser() user: AuthUser) {
    return this.pause.pendingForStaff(user.sub);
  }

  @Post(':id/decide')
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecideDto) {
    return this.pause.decide(user.sub, id, dto.approve, dto.note);
  }
}
