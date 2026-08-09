import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrivacyService } from './privacy.service';

class RevocaDto {
  /** La parola scritta a mano nel popup. La validazione vera sta in `confermaValida`. */
  @IsString({ message: 'Scrivi ELIMINA per confermare.' })
  @MaxLength(40)
  conferma!: string;
}

/** La card «Consenso» nel profilo dell'app, e la revoca. Solo la cliente, sui propri dati. */
@Controller('me/consent')
@Roles('client')
export class MyConsentController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  stato(@CurrentUser() user: AuthUser) {
    return this.privacy.statoConsenso(user.sub);
  }

  /**
   * Revoca del consenso: da qui parte il termine di 30 giorni.
   *
   * `POST` e non `DELETE` perché non cancella niente adesso: crea una richiesta, disdice il rinnovo
   * e manda le mail. La cancellazione la esegue il cron al 31° giorno.
   */
  @HttpCode(200)
  @Post('revoke')
  revoca(@CurrentUser() user: AuthUser, @Body() body: RevocaDto) {
    return this.privacy.revoca(user.sub, body.conferma);
  }
}

/**
 * Le due rotte PUBBLICHE della cancellazione.
 *
 * `sospendi` è pubblica perché il token della mail **è** l'autorizzazione: è così che la decisione
 * «solo la cliente può fermare il termine» diventa vera anche tecnicamente — nessuna sessione dello
 * staff, per quanto privilegiata, può arrivare qui senza quel link. E perché il link deve funzionare
 * anche se ha cancellato l'app dal telefono, che è la situazione più probabile di tutte.
 *
 * `cosa-cancelliamo` è pubblica perché è un'informativa: chi deve decidere se revocare vuole poterla
 * leggere prima, e magari mostrarla a qualcun altro.
 */
@Controller('privacy')
export class PrivacyPublicController {
  constructor(private readonly privacy: PrivacyService) {}

  @Public()
  @Get('cosa-cancelliamo')
  cosaCancelliamo() {
    return this.privacy.cosaCancelliamo();
  }

  @Public()
  @HttpCode(200)
  @Post('sospendi')
  sospendi(@Query('token') token: string) {
    return this.privacy.sospendi(token);
  }
}
