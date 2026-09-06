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
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Role } from '../common/roles';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { RequirePage } from '../common/decorators/require-page.decorator';

class SetManagerDto {
  @IsOptional()
  @IsString()
  managerId?: string | null;
}

class LinkAccountDto {
  // Email dell'utenza da collegare (null/assente = scollega).
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string | null;
}

class ResetPasswordDto {
  // Facoltativa: se assente, il server ne genera una provvisoria e la restituisce.
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

/**
 * ⛔ **La guardia agganciata il 5/9, primo passo delle 29.** Questa rotta ha il solo elenco dei
 * ruoli, e dentro c'è l'admin e basta: l'admin è superutente e la guardia lo lascia passare senza
 * leggere la matrice, mentre chi admin non è prendeva 403 già ieri. Quindi l'aggancio **non toglie
 * l'accesso a nessuno** — chiude la casella, che finora spegneva la voce di menu e non la porta.
 * ⚠️ L'elenco dei ruoli resta sotto: senza, il fail-open della guardia si rovescia e un singhiozzo
 * del database diventa 403 per tutti (`page.guard.ts`, correzione del 17/8).
 */
@Controller('admin/users')
@Roles('admin')
@RequirePage('users')
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

  /** Collega/scollega l'utenza alla sua gemella (cliente <-> staff, stessa persona). */
  @Patch(':id/link')
  link(
    @Param('id') id: string,
    @Body() dto: LinkAccountDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.linkAccounts(id, dto.email ?? null, actor.sub);
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

  /** Reset password: imposta una provvisoria (fornita o generata), obbliga il cambio
   *  al primo accesso e revoca le sessioni. Ritorna la password in chiaro una volta. */
  @Post(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.resetPassword(id, actor.sub, dto.password);
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
