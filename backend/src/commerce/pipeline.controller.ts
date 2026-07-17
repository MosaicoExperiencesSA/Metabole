import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CrmService } from './crm.service';
import { PipelineService } from './pipeline.service';

class MoveDto {
  @IsString()
  stage!: string;
}

class StageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  @IsOptional()
  @IsString()
  color?: string;
}

class UpdateStageDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

class ReorderDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  keys!: string[];
}

/**
 * Pipeline clienti/lead. Board e spostamento schede: coach, commerciale, capo,
 * admin. Gestione degli STATI (crea/rinomina/riordina/elimina): solo admin.
 */
@Controller('crm')
@Roles('coach', 'coach_coordinator', 'sales', 'head_nutritionist', 'admin')
export class PipelineController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly crm: CrmService,
  ) {}

  @Get('pipeline')
  board(@CurrentUser() user: AuthUser) {
    // La coach vede SOLO i suoi lead (scope nel service); manager coach/capo/admin tutti.
    return this.pipeline.board(user.sub);
  }

  @Get('stages')
  stages() {
    return this.pipeline.listStages();
  }

  /** Sposta una scheda in un altro stato (data + responsabile tracciati). */
  @Post('leads/:id/stage')
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveDto) {
    return this.crm.advance(user.sub, id, { stage: dto.stage });
  }

  // ---------- Gestione stati (solo admin) ----------

  @Roles('admin')
  @Post('stages')
  createStage(@CurrentUser() user: AuthUser, @Body() dto: StageDto) {
    return this.pipeline.createStage(dto, user.sub);
  }

  @Roles('admin')
  @Patch('stages/reorder')
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderDto) {
    return this.pipeline.reorder(dto.keys, user.sub);
  }

  @Roles('admin')
  @Patch('stages/:key')
  updateStage(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: UpdateStageDto) {
    return this.pipeline.updateStage(key, dto, user.sub);
  }

  @Roles('admin')
  @Delete('stages/:key')
  deleteStage(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    return this.pipeline.deleteStage(key, user.sub);
  }
}
