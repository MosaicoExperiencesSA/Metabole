import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
import { DataInizioChatService } from './data-inizio-chat.service';
import { MenuService } from './menu.service';

/**
 * ⚠️ **La data è obbligatoria e si valida.** «Segna aperto il giorno che stai guardando» senza dire
 * quale sarebbe di nuovo la domanda sbagliata — quella a cui `viewedAt` rispondeva.
 */
class GiornoApertoDto {
  @IsDateString({}, { message: 'Giorno non valido.' })
  giorno!: string;
}

class RateRecipeDto {
  @IsString({ message: 'Ricetta non riconosciuta: riprova dal menu.' })
  @MinLength(1, { message: 'Ricetta non riconosciuta: riprova dal menu.' })
  recipeId!: string;

  @IsInt({ message: 'Il voto va da 1 a 5 stelle.' })
  @Min(1, { message: 'Il voto va da 1 a 5 stelle.' })
  @Max(5, { message: 'Il voto va da 1 a 5 stelle.' })
  stars!: number;

  @IsOptional()
  @IsArray({ message: 'Etichette non valide.' })
  @IsString({ each: true, message: 'Etichette non valide.' })
  tags?: string[];

  @IsOptional()
  @IsDateString({}, { message: 'Data non valida.' })
  date?: string;
}

/** Nuova data di inizio scelta dal profilo dell'app. */
class SpostaInizioDto {
  @IsString({ message: 'Data non valida.' })
  @MinLength(10, { message: 'Data non valida.' })
  @MaxLength(10, { message: 'Data non valida.' })
  data!: string; // AAAA-MM-GG
}

class CheckItemDto {
  @IsString({ message: 'Indica quale voce della lista.' })
  @MinLength(1, { message: 'Indica quale voce della lista.' })
  @MaxLength(120, { message: 'Nome della voce troppo lungo (massimo 120 caratteri).' })
  itemName!: string;

  @IsBoolean({ message: 'Valore non valido per la spunta.' })
  checked!: boolean;
}

class DislikeIngredientDto {
  // Testo libero digitato dalla cliente mentre guarda il menu: è il campo più esposto di tutti.
  @IsString({ message: 'Scrivi l\'ingrediente che vuoi sostituire.' })
  @MinLength(2, { message: 'Scrivi il nome dell\'ingrediente per esteso (almeno 2 lettere).' })
  @MaxLength(60, { message: 'Nome troppo lungo: scrivi solo l\'ingrediente, senza la ricetta.' })
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
  @IsIn(['today', 'days', 'forever'], { message: 'Scelta non valida per la durata della sostituzione.' })
  scope?: 'today' | 'days' | 'forever';

  /** @deprecated Sostituito da `scope`. Resta accettato per le app già installate. */
  @IsOptional()
  @IsBoolean({ message: 'Valore non valido.' })
  forever?: boolean;
}

@Controller('me')
@Roles('client')
export class MenuController {
  constructor(
    private readonly menu: MenuService,
    private readonly dataInizio: DataInizioChatService,
  ) {}

  /**
   * DATA DI INIZIO DEL PIANO, dal profilo dell'app (richiesta di Simone dell'11/8: «dal profilo,
   * cliccando sul piano, mi fa modificare la data di inizio fino a 24 ore prima»).
   *
   * Sono due endpoint e non uno con un `PATCH` che si arrangia, perché la schermata ha bisogno di
   * sapere PRIMA se il pulsante va mostrato e con che limiti: un pulsante che c'è e poi risponde
   * «non si può» è peggio di un pulsante che non c'è, e la spiegazione arriva dopo il tocco invece
   * che al posto suo.
   *
   * La regola è quella di Gaia, letta dallo stesso parametro: vedi `DataInizioChatService`.
   */
  @Get('plan-start')
  statoInizio(@CurrentUser() user: AuthUser) {
    return this.dataInizio.statoPerApp(user.sub);
  }

  @Patch('plan-start')
  spostaInizio(@CurrentUser() user: AuthUser, @Body() dto: SpostaInizioDto) {
    return this.dataInizio.spostaDaApp(user.sub, dto.data.trim());
  }

  /**
   * ⛔ **«HO APERTO QUESTO GIORNO»** — il segnale vero, dal 26/8 (voce `visto-non-vuol-dire-aperto`,
   * strada 2 scelta da Simone il 25/8).
   *
   * ## Perché serviva
   *
   * `viewedAt` si chiama «visto» e in tutto il progetto veniva letto come «l'ha aperto». Non è
   * quello che ci scrive dentro: `getMenu` rende all'app gli **ultimi trenta giorni visibili**,
   * futuri compresi, e subito dopo li segna tutti. Bastava che una cliente aprisse l'app una volta
   * perché tutto il suo futuro risultasse letto — e il rifacimento dei giorni già preparati, che su
   * quel campo si regge, non trovava più niente. La nutrizionista dettava «niente pesce» e leggeva
   * «non ho toccato niente» mentre il branzino era nel menu di domani.
   *
   * ⚠️ **Questa rotta la chiama l'app quando la cliente sta GUARDANDO quel giorno**, non quando lo
   * riceve nella lista. È la differenza fra «gliel'abbiamo mostrato» e «l'ha aperto», e sono due
   * domande che meritavano due campi.
   *
   * ⚠️ **È idempotente e non fallisce mai in faccia a nessuno**: si scrive solo la prima volta, e un
   * errore qui non deve impedire a una cliente di leggere il menu. Il menu è il lavoro, questa è la
   * cronaca.
   */
  @Post('menu/aperto')
  @HttpCode(204)
  segnaAperto(@CurrentUser() user: AuthUser, @Body() dto: GiornoApertoDto) {
    return this.menu.segnaGiornoAperto(user.sub, dto.giorno);
  }

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
