import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { MenuService } from './menu.service';

class RateRecipeDto {
  @IsString()
  @MinLength(1)
  recipeId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsDateString()
  date?: string;
}

class CheckItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  itemName!: string;

  @IsBoolean()
  checked!: boolean;
}

class DislikeIngredientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  ingredient!: string;

  /**
   * Per quanto vale la sostituzione. La distinzione l'hanno chiesta le clienti e non è un
   * dettaglio: «oggi non ce l'ho in casa» non è «questo cibo non mi piace», e solo la
   * seconda deve restringere per sempre il pool dei menu.
   *  - `today`   solo il menu di oggi
   *  - `days`    oggi e i due giorni successivi (comportamento storico, resta il default)
   *  - `forever` come `days`, e in più il cibo entra fra i non graditi del profilo
   */
  @IsOptional()
  @IsIn(['today', 'days', 'forever'])
  scope?: 'today' | 'days' | 'forever';

  /** @deprecated Sostituito da `scope`. Resta accettato per le app già installate. */
  @IsOptional()
  @IsBoolean()
  forever?: boolean;
}

@Controller('me')
@Roles('client')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  /** Menu visibile (eroga automaticamente i giorni successivi se spetta). */
  @Get('menu')
  getMenu(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.menu.getMenu(user.sub, from, to);
  }

  /**
   * Stato del gate misure: se `blocking` è true, l'app mostra il popup bloccante
   * (misure obbligatorie al 2° giorno del ciclo) finché non arriva la misura.
   */
  @Get('measurement-gate')
  measurementGate(@CurrentUser() user: AuthUser) {
    return this.menu.measurementGate(user.sub);
  }

  @Post('ratings')
  rate(@CurrentUser() user: AuthUser, @Body() dto: RateRecipeDto) {
    return this.menu.rateRecipe(user.sub, dto);
  }

  /** "Sostituisci un ingrediente": la portata la sceglie la cliente (solo oggi / 3 giorni / per sempre). */
  @Post('menu/substitute')
  substitute(@CurrentUser() user: AuthUser, @Body() dto: DislikeIngredientDto) {
    // `forever` è la vecchia forma booleana: la traduco qui, così il servizio conosce
    // un solo concetto e le app non aggiornate continuano a funzionare.
    const scope = dto.scope ?? (dto.forever === true ? 'forever' : 'days');
    return this.menu.substituteDisliked(user.sub, dto.ingredient, scope);
  }

  /** Pasti consumati non ancora valutati (da riproporre all'apertura). */
  @Get('ratings/pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.menu.pendingRatings(user.sub);
  }

  @Get('shopping-list')
  shoppingList(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.menu.shoppingList(user.sub, from, to);
  }

  @Patch('shopping-list/:id/items')
  checkItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CheckItemDto,
  ) {
    return this.menu.checkItem(user.sub, id, dto.itemName, dto.checked);
  }
}

/**
 * Sblocco dell'app quando le misure mancano (voce #6e del 5/8).
 * Lo usa la coach DALLA CHAT, dopo aver sentito la cliente e capito il motivo: è il pezzo che
 * rende accettabile un blocco: c'è sempre una persona che può riaprire.
 */
@Controller('staff/clients')
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'admin')
export class StaffMeasuresController {
  constructor(private readonly menu: MenuService) {}

  @Post(':clientId/measures-unlock')
  unlock(@Param('clientId') clientId: string, @CurrentUser() user: AuthUser) {
    return this.menu.unlockMeasures(clientId, user.sub);
  }
}
