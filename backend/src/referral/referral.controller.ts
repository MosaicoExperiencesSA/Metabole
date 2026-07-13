import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ReferralService } from './referral.service';

/** Invito "porta un'amica" lato cliente: codice + statistiche inviti/ricompense. */
@Controller('me/referral')
@Roles('client')
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  @Get()
  my(@CurrentUser() user: AuthUser) {
    return this.referral.myReferral(user.sub);
  }
}
