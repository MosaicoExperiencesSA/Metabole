import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { MenuAManoService } from './menu-a-mano.service';

/**
 * ⛔ **QUELLO CHE IL CLIENT PUÒ DIRE, e non è molto.**
 *
 * La prima stesura accettava anche `name`, `kcal`, `bloccata` e `motivoBlocco` **dal browser**:
 * bastava mandare `{"bloccata": false}` perché un piatto vietato passasse senza avvisi, senza
 * conferma e senza traccia nel registro. Adesso il client dice **quale ricetta in quale pasto**, e
 * il motivo se la sta forzando; nome, calorie, verdetto e sostituzioni li rilegge il server.
 * *Il client può proporre; non può certificare.*
 */
class PastoDto {
  @IsString() @MinLength(1) @MaxLength(40)
  slot!: string;

  @IsString() @MinLength(1) @MaxLength(64)
  recipeId!: string;

  /**
   * ⛔ **Il minimo è 5, non 1.** Una forzatura motivata con «ok» non è motivata: chi la legge fra
   * sei mesi non saprebbe più di prima. È la stessa scelta di `IdoneitaDto`, che sul via libera
   * clinico chiede dieci caratteri — qui meno, perché una ragione vera può essere corta
   * («concordato con la cliente»), ma non una parola sola.
   */
  @IsOptional() @IsString() @MinLength(5) @MaxLength(500)
  forzatoPerche?: string;
}

class GiornataAManoDto {
  /** `AAAA-MM-GG`. La forma vera la controlla il servizio, che sa anche dirlo in italiano. */
  @IsString() @MinLength(10) @MaxLength(10)
  data!: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PastoDto)
  pasti!: PastoDto[];

  /** ⚠️ Serve solo quando ci sono avvisi: vedi `MenuAManoService.scrivi`. */
  @IsOptional() @IsBoolean()
  conferma?: boolean;
}

/**
 * ⛔ **IL MENU SCRITTO A MANO DALLA SCHEDA CLIENTE.**
 *
 * ⚠️ **La chiave `menu_a_mano` nasce qui insieme alla guardia che la legge**, che è la regola di
 * `CLAUDE.md`: una chiave dichiarata e non letta da nessuno è un interruttore che non accende
 * niente. E dal 3/9 c'è un secondo motivo per non dimenticarla — `chiavi-senza-guardia.spec.ts`
 * congela l'elenco delle chiavi senza `@RequirePage`, e una in più lo fa diventare rosso.
 *
 * ⚠️ `@Roles` resta sotto: il `PageGuard` è permissivo se il database non risponde, e in quel caso
 * dietro deve esserci ancora un cancello.
 */
@Roles('nutritionist', 'head_nutritionist', 'admin')
@RequirePage('menu_a_mano')
@Controller('admin/clients/:id/menu-a-mano')
export class MenuAManoController {
  constructor(private readonly menuAMano: MenuAManoService) {}

  /** Le ricette che si possono mettere in un pasto, con le incompatibili **barrate col motivo**. */
  @Get('ricette')
  ricette(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('slot') slot?: string,
    @Query('q') q?: string,
    /**
     * ⛔ **Cercare in TUTTO il catalogo e non solo nel suo paniere** (Simone, 4/9). È il motivo per
     * cui i menu passavano dalla chat: se il piatto giusto stava fuori dal pool, da qui non si
     * trovava. ⚠️ Fuori dal paniere resta il filtro sul **regime** compatibile, e ogni riga dice
     * che è un'eccezione — vedi `MenuAManoService.ricette`.
     */
    @Query('tuttoIlCatalogo') tuttoIlCatalogo?: string,
  ) {
    return this.menuAMano.ricette(user.sub, id, slot, q, tuttoIlCatalogo === '1' || tuttoIlCatalogo === 'true');
  }

  /** La cornice: che pasti ha la sua giornata, che fabbisogno, e cosa c'è già scritto. */
  @Get('giornata')
  giornata(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('data') data: string) {
    return this.menuAMano.giornata(user.sub, id, data);
  }

  /** ⛔ La scrittura chiede `manage`: vedere la schermata e cambiare cosa mangia una persona sono due cose. */
  @RequirePage('menu_a_mano', 'manage')
  @HttpCode(200)
  @Post()
  scrivi(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: GiornataAManoDto) {
    return this.menuAMano.scrivi(
      id,
      /**
       * ⚠️ **L'email, non un id opaco.** `AuthUser` non porta il nome, e il marchio finisce dentro
       * `meals`: fra sei mesi «scritta da `a3f9…`» non dice niente a nessuno. Il nome vero lo
       * risolve il servizio se serve; qui si scrive quello che c'è, che almeno si riconosce.
       */
      { id: user.sub, nome: user.email || user.sub },
      { data: dto.data, pasti: dto.pasti, conferma: dto.conferma },
    );
  }
}
