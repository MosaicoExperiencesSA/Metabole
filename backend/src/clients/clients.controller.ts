import { Body, Controller, Get, HttpCode, Ip, Param, Post, Put } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ClientsService } from './clients.service';

class SaveNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}

/** Scheda cliente (staff che gestisce i clienti). */
@Controller('admin/clients')
@Roles('coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.getDetail(id, user.sub);
  }

  /** Salva la nota libera dello staff sul cliente. */
  @HttpCode(200)
  @Put(':id/note')
  saveNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SaveNoteDto) {
    return this.clients.saveNote(id, user.sub, dto.body ?? '');
  }

  /** Invio email di reset password alla cliente: solo admin. */
  @Roles('admin')
  @HttpCode(200)
  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    return this.clients.sendPasswordReset(id, user.sub, ip);
  }
}
