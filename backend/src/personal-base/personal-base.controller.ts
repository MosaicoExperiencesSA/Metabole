import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PersonalBaseService } from './personal-base.service';

/**
 * Base personalizzata del cliente (R8 — agente esclusioni).
 * - il cliente vede lo stato e può chiedere di "rigenerare la base";
 * - il nutrizionista può rigenerarla per una cliente dopo aver sistemato tag/allergeni.
 */
@Controller()
export class PersonalBaseController {
  constructor(private readonly personalBase: PersonalBaseService) {}

  /** Stato della base della cliente loggata (pronta / in lavorazione). */
  @Get('me/personal-base')
  @Roles('client')
  status(@CurrentUser() user: AuthUser) {
    return this.personalBase.getStatus(user.sub);
  }

  /** "Rigenera base": il cliente richiede una nuova costruzione della base sicura. */
  @Post('me/personal-base/rebuild')
  @Roles('client')
  rebuildMine(@CurrentUser() user: AuthUser) {
    return this.personalBase.buildPersonalBase(user.sub);
  }

  /** Il nutrizionista rigenera la base di una cliente (es. dopo aver confermato gli allergeni). */
  @Post('clients/:id/personal-base/rebuild')
  @Roles('nutritionist', 'head_nutritionist', 'admin')
  rebuildFor(@Param('id') clientId: string) {
    return this.personalBase.buildPersonalBase(clientId);
  }
}
