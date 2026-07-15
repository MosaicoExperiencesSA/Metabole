import { Body, Controller, Delete, Get, HttpCode, Ip, Param, Patch, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';

class AddNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

class TravelDto {
  @IsOptional() @IsString() @MaxLength(20) state?: string;
  @IsOptional() @IsString() @MaxLength(40) start?: string;
  @IsOptional() @IsString() @MaxLength(40) end?: string;
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

  /** Cronologia delle modifiche al profilo (chi e quando). */
  @Get(':id/audit')
  changeLog(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.changeLog(id, user.sub);
  }

  /** Aggiunge una nota al log dello staff sul cliente. */
  @HttpCode(201)
  @Post(':id/note')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.clients.addNote(id, user.sub, dto.body);
  }

  /** Elimina una nota dal log: solo admin. */
  @Roles('admin')
  @HttpCode(200)
  @Delete(':id/note/:noteId')
  deleteNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('noteId') noteId: string) {
    return this.clients.deleteNote(id, noteId, user.sub);
  }

  /** Invio email di reset password alla cliente: solo admin. */
  @Roles('admin')
  @HttpCode(200)
  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    return this.clients.sendPasswordReset(id, user.sub, ip);
  }

  /** Modifica anagrafica e questionario del cliente (chi ha accesso alla scheda). */
  @HttpCode(200)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.updateClient(id, user.sub, dto);
  }

  /** Modalità viaggio/estate: in vacanza il popup misure si sospende; al rientro scatta un evento CRM/marketing. */
  @Patch(':id/travel')
  setTravel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TravelDto) {
    return this.clients.setTravel(id, user.sub, dto);
  }

  /** Eliminazione definitiva del cliente/lead e di tutto il collegato: SOLO admin. */
  @Roles('admin')
  @HttpCode(200)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.hardDelete(id, user.sub);
  }
}
