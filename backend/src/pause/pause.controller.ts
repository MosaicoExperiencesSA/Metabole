import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PauseService } from './pause.service';

class RequestPauseDto {
  @IsDateString({}, { message: 'Scegli il giorno da cui vuoi sospendere.' })
  startDate!: string;

  @IsDateString({}, { message: 'Scegli il giorno in cui vuoi riprendere.' })
  endDate!: string;
}

class DecideDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Congelamento abbonamento lato cliente (app). */
@Controller('me/pause-requests')
@Roles('client')
export class MePauseController {
  constructor(private readonly pause: PauseService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.pause.myRequests(user.sub);
  }

  @Post()
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestPauseDto) {
    return this.pause.requestPause(user.sub, dto);
  }
}

/** Approvazione richieste di pausa lato staff (backoffice). */
@Controller('staff/pause-requests')
/**
 * ⚠️ **QUESTA PORTA NON PASSA DA `travel_mode`, ed è una scelta dichiarata (24/8).**
 *
 * Il permesso `travel_mode` regola la card «Sospensioni» in scheda cliente: quella con cui la coach
 * *mette* una vacanza. Le RICHIESTE di pausa sono l'altra porta — le apre la cliente dall'app, e una
 * collega le approva — e restano sui ruoli qui sotto, `sales` compreso.
 *
 * Perché non si è agganciata anche questa: `travel_mode` di default ce l'ha **solo l'admin**, quindi
 * metterci la stessa chiave chiuderebbe da domani le approvazioni a tutte le coach che le fanno
 * oggi. *Un cancello chiuso costa a una cliente tutto il servizio*: si dichiara e si decide, non si
 * chiude di nascosto dentro un'altra consegna. ⛔ Da chiedere a Simone: chi deve poter approvare una
 * pausa richiesta dall'app — le stesse persone che possono metterla dalla scheda, o anche altre?
 */
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class StaffPauseController {
  constructor(private readonly pause: PauseService) {}

  @Get()
  pending(@CurrentUser() user: AuthUser) {
    return this.pause.pendingForStaff(user.sub);
  }

  @Post(':id/decide')
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecideDto) {
    return this.pause.decide(user.sub, id, dto.approve, dto.note);
  }
}
