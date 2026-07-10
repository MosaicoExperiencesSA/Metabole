import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { LeadAssignmentService } from './lead-assignment.service';

class AssignCoachDto {
  @IsUUID()
  coachStaffId!: string;
}
class RejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

@Controller('crm')
export class LeadAssignmentController {
  constructor(private readonly svc: LeadAssignmentService) {}

  /** La responsabile assegna un lead a una coach. */
  @Roles('coach', 'sales', 'head_nutritionist', 'admin')
  @HttpCode(200)
  @Post('leads/:id/assign-coach')
  assign(@Param('id') id: string, @Body() dto: AssignCoachDto, @CurrentUser() user: AuthUser) {
    return this.svc.assignCoach(id, dto.coachStaffId, user.sub);
  }

  /** Elenco coach per il menu di assegnazione. */
  @Roles('coach', 'sales', 'head_nutritionist', 'admin')
  @Get('coaches')
  coaches() {
    return this.svc.listCoaches();
  }

  /** Lead in attesa di accettazione per la coach corrente. */
  @Roles('coach')
  @Get('my-assignments')
  mine(@CurrentUser() user: AuthUser) {
    return this.svc.myPending(user.sub);
  }

  @Roles('coach')
  @HttpCode(200)
  @Post('leads/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.accept(id, user.sub);
  }

  @Roles('coach')
  @HttpCode(200)
  @Post('leads/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectDto, @CurrentUser() user: AuthUser) {
    return this.svc.reject(id, user.sub, dto.reason);
  }

  /** Genera il ref code di una coach (admin). */
  @Roles('admin')
  @HttpCode(200)
  @Post('coaches/:userId/refcode')
  refcode(@Param('userId') userId: string, @CurrentUser() user: AuthUser) {
    return this.svc.generateRefCode(userId, user.sub);
  }
}
