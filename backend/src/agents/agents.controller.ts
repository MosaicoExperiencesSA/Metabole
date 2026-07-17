import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AGENT_DEPARTMENTS, AGENT_ENGINES, AGENT_TYPES, AgentsService } from './agents.service';

class AgentDto {
  @IsOptional() @IsString() @MaxLength(40) key?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsIn(AGENT_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsIn(AGENT_DEPARTMENTS as unknown as string[]) department?: string;
  @IsOptional() @IsString() @MaxLength(2000) task?: string;
  @IsOptional() @IsString() @MaxLength(2000) rule?: string;
  @IsOptional() @IsIn(AGENT_ENGINES as unknown as string[]) engine?: string;
  @IsOptional() @IsString() @MaxLength(20000) systemPrompt?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() humanInLoop?: boolean;
  @IsOptional() @IsInt() @Min(0) monthlyBudgetCents?: number;
}

/**
 * Registro Agenti AI — sezione "Agenti" del backoffice (reparto marketing + admin).
 * CRUD sul registro; esecuzioni e costi in sola lettura (il runtime arriva dopo).
 */
@Controller('agents')
@RequirePage('agents')
@Roles('marketing', 'head_marketing', 'admin')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@Query('includeArchived') includeArchived?: string) {
    return this.agents.list(includeArchived === 'true');
  }

  @Post()
  create(@Body() dto: AgentDto, @CurrentUser() u: AuthUser) {
    return this.agents.create(dto, u.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AgentDto, @CurrentUser() u: AuthUser) {
    return this.agents.update(id, dto, u.sub);
  }

  @HttpCode(200)
  @Delete(':id')
  archive(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.agents.archive(id, u.sub);
  }

  @Get('costs')
  costs(@Query('from') from?: string, @Query('to') to?: string) {
    return this.agents.costs(from, to);
  }

  @Get(':id/runs')
  runs(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.agents.runs(id, limit ? Number(limit) || 50 : 50);
  }
}
