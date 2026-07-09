import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConfigParamsService } from './config-params.service';

class UpdateConfigDto {
  @IsString()
  @MinLength(1)
  value!: string;
}

@Controller('admin/config')
@Roles('admin')
export class AdminConfigController {
  constructor(private readonly configParams: ConfigParamsService) {}

  @Get()
  list() {
    return this.configParams.list();
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
