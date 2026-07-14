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
class AssignNutritionistDto {
  // stringa vuota = rimuovi; UUID = assegna quel nutrizionista.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nutritionistStaffId!: string;
}
class RejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
class RefCodeDto {
  /** Codice scelto dall'admin (3-12 caratteri, lettere/numeri); assente = casuale. */
  @IsOptional()
  @IsString()
  @MaxLength(12)
  code?: string;
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

  /** Il capo nutrizionisti (o admin) assegna il nutrizionista a una cliente. */
  @Roles('head_nutritionist', 'admin')
  @HttpCode(200)
  @Post('leads/:id/assign-nutritionist')
  assignNutritionist(@Param('id') id: string, @Body() dto: AssignNutritionistDto, @CurrentUser() user: AuthUser) {
    return this.svc.assignNutritionist(id, dto.nutritionistStaffId, user.sub);
  }

  /** Elenco nutrizionisti per il menu di assegnazione. */
  @Roles('head_nutritionist', 'admin')
  @Get('nutritionists')
  nutritionists() {
    return this.svc.listNutritionists();
  }

  /** Lead in attesa di accettazione per la coach corrente (vuoto per chi non è coach). */
  @Roles('coach', 'sales', 'head_nutritionist', 'admin')
  @Get('my-assignments')
  mine(@CurrentUser() user: AuthUser) {
    return this.svc.myPending(user.sub);
  }

  /** Invito della coach: proprio ref code + link di registrazione precompilato (backlog #2). */
  @Roles('coach')
  @Get('my-invite')
  myInvite(@CurrentUser() user: AuthUser) {
    return this.svc.myInvite(user.sub);
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

  /** Genera (o imposta, con body.code) il ref code di una coach (admin). */
  @Roles('admin')
  @HttpCode(200)
  @Post('coaches/:userId/refcode')
  refcode(@Param('userId') userId: string, @Body() dto: RefCodeDto, @CurrentUser() user: AuthUser) {
    return this.svc.generateRefCode(userId, user.sub, dto.code);
  }
}
