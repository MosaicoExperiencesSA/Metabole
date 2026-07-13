import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NutritionistService } from './nutritionist.service';

class ReviewDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** API dell'app Nutrizionista (pazienti, dashboard, coda di validazione). RBAC: nutrizionista + capo + admin. */
@Controller('nutritionist')
@Roles('nutritionist', 'head_nutritionist', 'admin')
export class NutritionistController {
  constructor(private readonly nutritionist: NutritionistService) {}

  @Get('patients')
  patients(@CurrentUser() user: AuthUser) {
    return this.nutritionist.patients(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.nutritionist.dashboard(user);
  }

  /** Coda di validazione: decisioni motore (per-paziente), diete in revisione, protocolli in attesa. */
  @Get('validation-queue')
  validationQueue(@CurrentUser() user: AuthUser) {
    return this.nutritionist.validationQueue(user);
  }

  /** Conferma una decisione del motore (solo pazienti assegnati; capo/admin qualsiasi). */
  @HttpCode(200)
  @Post('decisions/:id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.reviewDecision(user, id, 'confirmed', dto.note);
  }

  /** Corregge una decisione del motore (solo pazienti assegnati; capo/admin qualsiasi). */
  @HttpCode(200)
  @Post('decisions/:id/correct')
  correct(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.reviewDecision(user, id, 'corrected', dto.note);
  }
}
