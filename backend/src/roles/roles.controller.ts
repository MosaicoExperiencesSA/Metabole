import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { STAFF_ROLES } from '../common/roles';
import { RolesService } from './roles.service';

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
@Controller('admin/roles')
@Roles('admin')
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
