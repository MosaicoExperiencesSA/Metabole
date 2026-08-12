import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrenotaDto, SpostaDto } from './dto/agenda.dto';
import { PrenotazioniService } from './prenotazioni.service';

/**
 * §16.7 — LE VISITE VISTE DALLA CLIENTE: quali orari ci sono, prenota, sposta, disdici.
 *
 * Il prefisso è `me/visite` e non `me/visits`: quest'ultimo esiste già (`health-area`, l'elenco in
 * sola lettura) e due controller sullo stesso percorso sono il modo di scoprire una rotta doppia in
 * produzione. `rotte-uniche.spec.ts` lo sorveglia.
 *
 * Nessun parametro identifica la cliente: è sempre quella loggata. Un id nel percorso sarebbe la
 * porta per prenotare al posto di un'altra persona.
 */
@Controller('me/visite')
@Roles('client')
export class PrenotazioniController {
  constructor(private readonly prenotazioni: PrenotazioniService) {}

  /** I suoi appuntamenti futuri, con scritto se e perché può ancora toccarli. */
  @Get()
  mie(@CurrentUser() user: AuthUser) {
    return this.prenotazioni.mieVisite(user.sub);
  }

  /** Gli orari liberi della SUA nutrizionista, più quante visite le restano. */
  @Get('disponibilita')
  disponibilita(@CurrentUser() user: AuthUser, @Query('dal') dal?: string, @Query('al') al?: string) {
    return this.prenotazioni.disponibilita(user.sub, dal, al);
  }

  @Post('prenota')
  prenota(@CurrentUser() user: AuthUser, @Body() dto: PrenotaDto) {
    return this.prenotazioni.prenota(user.sub, dto);
  }

  /** Spostare = disdire e riprenotare in un colpo solo. Le 24 ore valgono sul VECCHIO orario. */
  @Post(':id/sposta')
  sposta(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SpostaDto) {
    return this.prenotazioni.sposta(user.sub, id, dto);
  }

  @Post(':id/disdici')
  disdici(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prenotazioni.disdici(user.sub, id);
  }
}
