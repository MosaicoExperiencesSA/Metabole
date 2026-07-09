import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Role, ROLES } from '../common/roles';
import { PermissionsService } from './permissions.service';

class UpdatePermissionDto {
  @IsIn(ROLES as readonly string[])
  role!: Role;

  @IsString()
  pageKey!: string;

  @IsOptional()
  @IsBoolean()
  canView?: boolean;

  @IsOptional()
  @IsBoolean()
  canManage?: boolean;
}

@Controller('admin/permissions')
@Roles('admin')
export class AdminPermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  matrix() {
    return this.permissions.getMatrix();
  }

  @Patch()
  update(@Body() dto: UpdatePermissionDto, @CurrentUser() actor: AuthUser) {
    return this.permissions.update(dto, actor.sub);
  }
}

@Controller('me/permissions')
export class MePermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  /** Il frontend costruisce menu e viste del backoffice da questa risposta. */
  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.permissions.getForRole(user.role);
  }
}
