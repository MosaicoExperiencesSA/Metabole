import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AggiornaSostituzioneDto, CreaSostituzioneDto } from './dto/food-swaps.dto';
import { FoodSwapsService } from './food-swaps.service';

/**
 * LE SOSTITUZIONI CONCORDATE CON LE CLIENTI (§16.9).
 *
 * «Se non salviamo la sua risposta lei non impara.» Questa è la tabella dove finisce ogni cambio
 * concordato in chat — trasversale a tutte le clienti e senza finestra temporale, al contrario di
 * quello che si vede nella scheda della singola cliente — più le righe che il nutrizionista scrive
 * a mano, e il pulsante che porta una riga validata nei gruppi di equivalenza.
 *
 * `@RequirePage('food_swaps')` per leggere, `'manage'` per decidere: sono due cose diverse, come
 * per i cambi in chat nella scheda cliente. Una coach può aver bisogno di sapere cosa ha chiesto la
 * sua cliente; toccare quello che il motore userà per tutte è un altro mestiere.
 */
@Controller('food-swaps')
@Roles('admin', 'nutritionist', 'head_nutritionist', 'coach', 'coach_coordinator')
export class FoodSwapsController {
  constructor(private readonly swaps: FoodSwapsService) {}

  @Get()
  @RequirePage('food_swaps')
  list(
    @Query('stato') stato?: string,
    @Query('clientId') clientId?: string,
    @Query('alimento') alimento?: string,
  ) {
    return this.swaps.list({ stato, clientId, alimento });
  }

  @Post()
  @RequirePage('food_swaps', 'manage')
  crea(@Body() dto: CreaSostituzioneDto, @CurrentUser() user: AuthUser) {
    return this.swaps.crea(user.sub, dto);
  }

  @Patch(':id')
  @RequirePage('food_swaps', 'manage')
  aggiorna(@Param('id') id: string, @Body() dto: AggiornaSostituzioneDto, @CurrentUser() user: AuthUser) {
    return this.swaps.aggiorna(user.sub, id, dto);
  }

  /** «Promuovi a regola»: dalla riga di questa cliente ai gruppi di equivalenza, in bozza. */
  @Post(':id/promuovi')
  @RequirePage('food_swaps', 'manage')
  promuovi(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.swaps.promuovi(user.sub, id);
  }

  @Delete(':id')
  @RequirePage('food_swaps', 'manage')
  elimina(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.swaps.elimina(user.sub, id);
  }
}
