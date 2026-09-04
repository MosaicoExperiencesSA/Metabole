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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  AccorpaDto,
  AccorpabiliDto,
  CreateEquivalenceGroupDto,
  UpdateEquivalenceGroupDto,
} from './dto/equivalence.dto';
import { EquivalenceService } from './equivalence.service';

/** Gestione gruppi di equivalenza dal backoffice (nutrizionista/capo/admin). */
@Controller('equivalence-groups')
@Roles('nutritionist', 'head_nutritionist', 'admin')
export class EquivalenceController {
  constructor(private readonly service: EquivalenceService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.service.list({ status });
  }

  @Post()
  create(@Body() dto: CreateEquivalenceGroupDto, @CurrentUser() user: AuthUser) {
    return this.service.create(user.sub, dto);
  }

  /**
   * ⚠️ **Sola lettura, ed è un `POST` apposta**: l'elenco degli alimenti sta nel corpo perché in
   * una query string quindici nomi con gli spazi diventano illeggibili — e questa risposta la
   * chiedono sia la schermata sia Vera, prima di scrivere.
   *
   * ⛔ Sta **prima** di `:id` nel file: `accorpabili` è un segmento solo, e con l'ordine invertito
   * Nest lo prenderebbe per un id.
   */
  @HttpCode(200)
  @Post('accorpabili')
  accorpabili(@Body() dto: AccorpabiliDto) {
    return this.service.accorpabili(dto);
  }

  @HttpCode(200)
  @Post(':id/accorpa')
  accorpa(@Param('id') id: string, @Body() dto: AccorpaDto, @CurrentUser() user: AuthUser) {
    return this.service.accorpa(user.sub, id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEquivalenceGroupDto, @CurrentUser() user: AuthUser) {
    return this.service.update(user.sub, id, dto);
  }

  @HttpCode(200)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(user.sub, id);
  }

  @HttpCode(200)
  @Post(':id/unapprove')
  unapprove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.unapprove(user.sub, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(user.sub, id);
  }
}
