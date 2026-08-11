import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AuthService } from './auth.service';

class ImpersonateDto {
  @IsUUID()
  userId!: string;
}

/**
 * «Entra come»: apre l'app con gli occhi di una cliente, per l'assistenza.
 *
 * ⚠️ Chi può farlo lo dice la TABELLA DEI PERMESSI (`impersonate`), non più `@Roles('admin')`:
 * era una decisione di prodotto scritta nel codice, e la matrice — dove Simone va a cercarla —
 * non la nominava nemmeno. L'admin resta ammesso comunque, perché `PageGuard` lo tratta da
 * superutente.
 *
 * La sessione che ne esce è di SOLA LETTURA e dura 30 minuti: vedi
 * `SolaLetturaImpersonazioneGuard` e `AuthService.impersonate`.
 */
@Controller('admin/impersonate')
export class AdminImpersonateController {
  constructor(private readonly auth: AuthService) {}

  @HttpCode(200)
  @RequirePage('impersonate', 'manage')
  @Post()
  impersonate(
    @Body() dto: ImpersonateDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.auth.impersonate(actor.sub, dto.userId, ip);
  }
}
