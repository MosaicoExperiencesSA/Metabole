import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { STAFF_ROLES } from '../common/roles';
import { RolesService } from './roles.service';
import { RequirePage } from '../common/decorators/require-page.decorator';

const HEX = /^#[0-9a-fA-F]{6}$/;

class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  @IsIn(STAFF_ROLES as string[])
  baseRole!: string;

  @IsOptional()
  @IsString()
  color?: string;
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

/** Gestione ruoli: elenco (sistema + personalizzati) e CRUD dei personalizzati. */
/**
 * ⛔ **La guardia agganciata il 5/9, primo passo delle 29.** Questa rotta ha il solo elenco dei
 * ruoli, e dentro c'è l'admin e basta: l'admin è superutente e la guardia lo lascia passare senza
 * leggere la matrice, mentre chi admin non è prendeva 403 già ieri. Quindi l'aggancio **non toglie
 * l'accesso a nessuno** — chiude la casella, che finora spegneva la voce di menu e non la porta.
 * ⚠️ L'elenco dei ruoli resta sotto: senza, il fail-open della guardia si rovescia e un singhiozzo
 * del database diventa 403 per tutti (`page.guard.ts`, correzione del 17/8).
 */
@Controller('admin/roles')
@Roles('admin')
@RequirePage('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list() {
    return this.roles.listAll();
  }

  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthUser) {
    return this.roles.create({ label: dto.label, baseRole: dto.baseRole, color: dto.color && HEX.test(dto.color) ? dto.color : undefined }, actor.sub);
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() dto: UpdateRoleDto, @CurrentUser() actor: AuthUser) {
    return this.roles.update(key, { label: dto.label, color: dto.color && HEX.test(dto.color) ? dto.color : undefined }, actor.sub);
  }

  @Delete(':key')
  remove(@Param('key') key: string, @CurrentUser() actor: AuthUser) {
    return this.roles.remove(key, actor.sub);
  }
}
