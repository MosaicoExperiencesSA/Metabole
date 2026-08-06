import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConfigParamsService } from './config-params.service';

class UpdateConfigDto {
  @IsString()
  @MinLength(1)
  value!: string;
}

class CreateConfigDto {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(1)
  value!: string;

  @IsOptional()
  @IsIn(['number', 'string', 'boolean', 'json'])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

@Controller('admin/config')
@Roles('admin')
export class AdminConfigController {
  constructor(private readonly configParams: ConfigParamsService) {}

  @Get()
  list() {
    return this.configParams.list();
  }

  /** Crea un parametro che non esiste ancora (prima si poteva solo aggiornare). */
  @Post()
  create(@Body() dto: CreateConfigDto, @CurrentUser() actor: AuthUser) {
    return this.configParams.create(dto, actor.sub);
  }

  @Patch(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.configParams.update(key, dto.value, actor.sub);
  }
}
