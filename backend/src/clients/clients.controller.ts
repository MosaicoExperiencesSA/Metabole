import { Body, Controller, Get, HttpCode, Ip, Param, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ClientsService } from './clients.service';

class AddNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
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

  /** Aggiunge una nota al log dello staff sul cliente. */
  @HttpCode(201)
  @Post(':id/note')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.clients.addNote(id, user.sub, dto.body);
  }

  /** Invio email di reset password alla cliente: solo admin. */
  @Roles('admin')
  @HttpCode(200)
  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    return this.clients.sendPasswordReset(id, user.sub, ip);
  }
}
