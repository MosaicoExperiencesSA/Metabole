import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EngineService } from './engine.service';

class RunEngineDto {
  /** Se assente: esegue per tutte le clienti attive (batch, per il cron). */
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

class ReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CreateProtocolDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  type!: string;

  @IsObject()
  definition!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  thresholds?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  appliesTo?: string;
}

class UpdateProtocolDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(2) type?: string;
  @IsOptional() @IsObject() definition?: Record<string, unknown>;
  @IsOptional() @IsObject() thresholds?: Record<string, unknown>;
  @IsOptional() @IsString() appliesTo?: string;
}

class ValidateProtocolDto {
  @IsBoolean()
  approve!: boolean;
}

@Controller('engine')
export class EngineController {
  constructor(private readonly engine: EngineService) {}

  /** Esecuzione del motore: cron (batch) o admin/nutrizionista (singola cliente). */
  @Roles('admin', 'nutritionist', 'head_nutritionist')
  @HttpCode(200)
  @Post('run')
  run(@Body() dto: RunEngineDto) {
    return dto.clientId ? this.engine.runForClient(dto.clientId) : this.engine.runBatch();
  }

  /** Verifiche a campione: decisioni marcate per revisione. */
  @Roles('nutritionist', 'head_nutritionist')
  @Get('decisions')
  decisions(
    @Query('flagged') flagged?: string,
    @Query('clientId') clientId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.engine.listDecisions({
      flagged: flagged === undefined ? undefined : flagged === 'true',
      clientId,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
  }

  @Roles('nutritionist', 'head_nutritionist')
  @HttpCode(200)
  @Post('decisions/:id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ReviewDto, @CurrentUser() user: AuthUser) {
    return this.engine.reviewDecision(user.sub, id, 'confirmed', dto.note);
  }

  @Roles('nutritionist', 'head_nutritionist')
  @HttpCode(200)
  @Post('decisions/:id/correct')
  correct(@Param('id') id: string, @Body() dto: ReviewDto, @CurrentUser() user: AuthUser) {
    return this.engine.reviewDecision(user.sub, id, 'corrected', dto.note);
  }
}

/** Protocolli: il nutrizionista propone, un collega/il capo valida (mai il proprio). */
@Controller('protocols')
@Roles('nutritionist', 'head_nutritionist')
export class ProtocolsController {
  constructor(private readonly engine: EngineService) {}

  @Roles('nutritionist', 'head_nutritionist', 'admin') // admin: sola lettura
  @Get()
  list(@Query('status') status?: string) {
    return this.engine.listProtocols(status);
  }

  @Post()
  create(@Body() dto: CreateProtocolDto, @CurrentUser() user: AuthUser) {
    return this.engine.createProtocol(user.sub, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProtocolDto, @CurrentUser() user: AuthUser) {
    return this.engine.updateProtocol(user.sub, id, dto);
  }

  @HttpCode(200)
  @Post(':id/validate')
  validate(
    @Param('id') id: string,
    @Body() dto: ValidateProtocolDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.engine.validateProtocol(user.sub, id, dto.approve);
  }
}
