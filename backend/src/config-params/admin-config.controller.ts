import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConfigParamsService } from './config-params.service';
import { RequirePage } from '../common/decorators/require-page.decorator';

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

/**
 * ⛔ **La guardia agganciata il 5/9, primo passo delle 29.** Questa rotta ha il solo elenco dei
 * ruoli, e dentro c'è l'admin e basta: l'admin è superutente e la guardia lo lascia passare senza
 * leggere la matrice, mentre chi admin non è prendeva 403 già ieri. Quindi l'aggancio **non toglie
 * l'accesso a nessuno** — chiude la casella, che finora spegneva la voce di menu e non la porta.
 * ⚠️ L'elenco dei ruoli resta sotto: senza, il fail-open della guardia si rovescia e un singhiozzo
 * del database diventa 403 per tutti (`page.guard.ts`, correzione del 17/8).
 */
@Controller('admin/config')
@Roles('admin')
@RequirePage('engine_config')
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
