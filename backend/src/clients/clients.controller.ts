import { Body, Controller, Delete, Get, HttpCode, Ip, Param, Patch, Post } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
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

class PlanStartDto {
  @IsString() @MaxLength(10) @MinLength(10) date!: string; // AAAA-MM-GG
}

class SetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
}

/** Correzione misura: le circonferenze accettano anche null (= svuota il dato). */
class FixMeasurementDto {
  @IsOptional() @IsNumber() @Min(25) @Max(400) weightKg?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(20) @Max(300) waistCm?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(20) @Max(300) hipsCm?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(20) @Max(300) thighsCm?: number | null;
}

/** Scheda cliente (staff che gestisce i clienti). */
@Controller('admin/clients')
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  /** Elenco clienti: coach/nutrizionista vedono SOLO i propri assegnati; manager coach, capo nutrizionista e admin tutti. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.clients.listClients(user.sub);
  }

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

  /** Imposta una password scelta per la cliente (da comunicarle): permesso "set_client_password". */
  @RequirePage('set_client_password', 'manage')
  @HttpCode(200)
  @Post(':id/set-password')
  setPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.clients.setClientPassword(id, user.sub, dto.password);
  }

  /** Modifica anagrafica e questionario del cliente (chi ha accesso alla scheda). */
  @HttpCode(200)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.updateClient(id, user.sub, dto);
  }

  /** Menu del cliente (giorni + piatti + stelline del cliente) per la revisione del nutrizionista. */
  @Get(':id/menus')
  menus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.getMenus(id, user.sub);
  }

  /** Correzione di una misura inserita male dal cliente: permesso dedicato "fix_measures". */
  @RequirePage('fix_measures', 'manage')
  @HttpCode(200)
  @Patch(':id/measurements/:measurementId')
  fixMeasurement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('measurementId') measurementId: string,
    @Body() dto: FixMeasurementDto,
  ) {
    return this.clients.updateMeasurement(id, user.sub, measurementId, dto);
  }

  /** Cambio della data di inizio del piano: permesso dedicato "change_plan_start". */
  @RequirePage('change_plan_start', 'manage')
  @HttpCode(200)
  @Patch(':id/plan-start')
  planStart(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PlanStartDto) {
    return this.clients.updatePlanStart(id, user.sub, dto.date);
  }

  /** Rigenera i menu da oggi in poi (corregge menu vecchi sbagliati). Stesso permesso del cambio data inizio. */
  @RequirePage('change_plan_start', 'manage')
  @HttpCode(200)
  @Post(':id/regenerate-menu')
  regenerateMenu(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.regenerateMenu(id, user.sub);
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
