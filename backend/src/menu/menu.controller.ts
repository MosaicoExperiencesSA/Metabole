import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsDateString,
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

  /** "Sostituisci un ingrediente": registra il non gradito e aggiorna il menu di oggi. */
  @Post('menu/substitute')
  substitute(@CurrentUser() user: AuthUser, @Body() dto: DislikeIngredientDto) {
    return this.menu.substituteDislikedForToday(user.sub, dto.ingredient);
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
