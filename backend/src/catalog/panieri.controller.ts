import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { GIORNATA_CINQUE } from '../common/slot-pasto';
import { PanieriService } from './panieri.service';

class RicettaNelPaniereDto {
  @IsString() @MinLength(1) @MaxLength(200) famiglia!: string;
  @IsString() @MinLength(1) @MaxLength(40) regime!: string;
  @IsIn([...GIORNATA_CINQUE]) slot!: string;
  @IsString() @MinLength(1) @MaxLength(80) recipeId!: string;
}

/**
 * I PANIERI — Fase 7 del piano.
 *
 * ⚠️ **Chiave di permesso PROPRIA** (`panieri`), e la guardia nasce insieme alla chiave: una chiave
 * dichiarata e non letta è un interruttore che non accende niente, ed è già successo con
 * `assignments`. `manage` è del capo nutrizionista: chi tocca una riga qui cambia da dove arrivano
 * i piatti di **tutte** le clienti di quella famiglia, non la giornata di una.
 */
@Controller('panieri')
@RequirePage('panieri')
@Roles('nutritionist', 'head_nutritionist', 'admin')
export class PanieriController {
  constructor(private readonly panieri: PanieriService) {}

  /** Le 38 celle, con quante ricette per pasto. */
  @Get()
  celle() {
    return this.panieri.celle();
  }

  /**
   * In quali panieri sta una ricetta, e in quali potrebbe stare.
   *
   * ⚠️ **Prima della rotta con i parametri**, che ha tre segmenti: qui ce ne sono due e non si
   * accavallano, ma l'ordine di dichiarazione è l'unica cosa che lo garantisce ancora fra un anno.
   */
  @Get('ricetta/:recipeId')
  doveSta(@Param('recipeId') recipeId: string) {
    return this.panieri.doveSta(recipeId);
  }

  /** Le ricette di un paniere per un pasto — coi gemelli uniti, com'è per la cliente. */
  @Get(':famiglia/:regime/ricette')
  ricette(
    @Param('famiglia') famiglia: string,
    @Param('regime') regime: string,
    @Query('slot') slot: string,
  ) {
    return this.panieri.ricetteDi(decodeURIComponent(famiglia), regime, slot);
  }

  @RequirePage('panieri', 'manage')
  @Roles('head_nutritionist', 'admin')
  @Post('ricetta')
  aggiungi(@Body() dto: RicettaNelPaniereDto, @CurrentUser() user: AuthUser) {
    return this.panieri.aggiungi(dto.famiglia, dto.regime, dto.slot, dto.recipeId, user.sub);
  }

  @RequirePage('panieri', 'manage')
  @Roles('head_nutritionist', 'admin')
  @Delete('ricetta')
  togli(@Body() dto: RicettaNelPaniereDto, @CurrentUser() user: AuthUser) {
    return this.panieri.togli(dto.famiglia, dto.regime, dto.slot, dto.recipeId, user.sub);
  }
}
