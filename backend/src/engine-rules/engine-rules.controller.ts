import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsDefined, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EngineRulesService } from './engine-rules.service';

class SetGlobalDto {
  // number | boolean | string: il servizio valida/coerce contro il catalogo.
  // @IsDefined per superare il whitelist globale (forbidNonWhitelisted).
  @IsDefined()
  value!: number | boolean | string;
}
class PresetDto {
  @IsOptional() @IsString() @MaxLength(60) style?: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsOptional() @IsString() @MaxLength(40) regime?: string | null;
  @IsOptional() @IsString() @MaxLength(40) objective?: string | null;
  @IsOptional() @IsObject() rules?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(1000) clinicalNotes?: string;
  @IsOptional() @IsString() @MaxLength(400) source?: string;
  @IsOptional() @IsBoolean() suggested?: boolean;
}
class GenerateCatalogDto {
  @IsOptional() @IsInt() @Min(1) @Max(60) days?: number;
}
class ProposalDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsString() @MinLength(3) @MaxLength(4000) text!: string;
  @IsOptional() @IsString() dietId?: string | null;
}
class ProposalStatusDto {
  @IsIn(['pending', 'approved', 'rejected']) status!: 'pending' | 'approved' | 'rejected';
}

/**
 * Regole del motore — di norma riservate al CAPO NUTRIZIONISTA (head_nutritionist),
 * con l'admin per l'accesso tecnico. Il ruolo `nutritionist` è ammesso a livello di
 * guardia così che il capo/admin possa ABILITARLO dalla tabella permessi (di default
 * resta spento per il nutrizionista: vedi DEFAULT_PERMISSIONS in permissions/pages.ts).
 */
@Controller('engine-rules')
@Roles('head_nutritionist', 'nutritionist', 'admin')
export class EngineRulesController {
  constructor(private readonly service: EngineRulesService) {}

  @Get('catalog')
  catalog() {
    return this.service.catalog();
  }

  @Patch('global/:code')
  setGlobal(@Param('code') code: string, @Body() dto: SetGlobalDto, @CurrentUser() u: AuthUser) {
    return this.service.setGlobal(code, dto.value, u.sub);
  }

  @Get('presets')
  presets() {
    return this.service.listPresets();
  }

  @Post('presets')
  createPreset(@Body() dto: PresetDto, @CurrentUser() u: AuthUser) {
    return this.service.createPreset(dto as never, u.sub);
  }

  @Patch('presets/:id')
  updatePreset(@Param('id') id: string, @Body() dto: PresetDto, @CurrentUser() u: AuthUser) {
    return this.service.updatePreset(id, dto, u.sub);
  }

  @Delete('presets/:id')
  deletePreset(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.service.deletePreset(id, u.sub);
  }

  @Post('presets/:id/apply/:dietId')
  apply(@Param('id') id: string, @Param('dietId') dietId: string, @CurrentUser() u: AuthUser) {
    return this.service.applyPresetToDiet(id, dietId, u.sub);
  }

  /** Genera con l'AI una BOZZA di catalogo (ricette, giornate, alternative, allergeni)
   *  dal preset: tutto in bozza, il nutrizionista rivede e approva. */
  @Post('presets/:id/generate-catalog')
  generateCatalog(@Param('id') id: string, @Body() dto: GenerateCatalogDto, @CurrentUser() u: AuthUser) {
    return this.service.generateCatalogFromPreset(id, u.sub, dto.days);
  }

  @Get('diets/:id/preview')
  preview(@Param('id') id: string) {
    return this.service.dietPreview(id);
  }

  @Get('diets/:id/review-status')
  reviewStatus(@Param('id') id: string) {
    return this.service.dietReviewStatus(id);
  }

  @Post('diets/:id/activate-recipes')
  activateRecipes(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.service.activateDietRecipes(id, u.sub);
  }

  @Post('diets/:id/review-allergens')
  reviewAllergens(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.service.reviewDietAllergens(id, u.sub);
  }

  @Post('diets/:id/approve-groups')
  approveGroups(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.service.approveDietGroups(id, u.sub);
  }

  @Get('proposals')
  proposals() {
    return this.service.listProposals();
  }

  @Post('proposals')
  createProposal(@Body() dto: ProposalDto, @CurrentUser() u: AuthUser) {
    return this.service.createProposal(dto, u.sub);
  }

  @Patch('proposals/:id/status')
  setProposalStatus(@Param('id') id: string, @Body() dto: ProposalStatusDto, @CurrentUser() u: AuthUser) {
    return this.service.setProposalStatus(id, dto.status, u.sub);
  }
}
