import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Role } from '../common/roles';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

class SetManagerDto {
  @IsOptional()
  @IsString()
  managerId?: string | null;
}

@Controller('admin/users')
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(
    @Query('role') role?: Role,
    @Query('scope') scope?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.users.list({
      role,
      staffOnly: scope === 'staff', // la tabella Utenti mostra solo lo staff, non i clienti
      includeArchived: includeArchived === 'true',
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, dto, actor.sub);
  }

  /** Archivia (soft-delete) un account: reversibile con /restore. */
  @HttpCode(200)
  @Delete(':id')
  archive(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.users.archive(id, actor.sub);
  }

  /** Ripristina un account archiviato. */
  @HttpCode(200)
  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.users.restore(id, actor.sub);
  }

  /** Imposta il responsabile diretto (manager coach / capo nutrizionista). */
  @Patch(':id/manager')
  setManager(
    @Param('id') id: string,
    @Body() dto: SetManagerDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setManager(id, dto.managerId ?? null, actor.sub);
  }
}
