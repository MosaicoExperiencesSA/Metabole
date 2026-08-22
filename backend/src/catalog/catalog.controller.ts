import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ArrayMaxSize, IsArray } from 'class-validator';
import { CatalogService } from './catalog.service';
import { ConfermaAllergeniInBloccoDto, SetRecipeAllergensDto } from './dto/allergens.dto';
import { ConfermaColazioniDto, SetColazioneDto } from './dto/colazioni.dto';
import { CreateDietDto, CreateRecipeDto, UpdateRecipeDto, RejectDietDto, SetDayTemplatesDto, UpdateDietDto, UpdateDietProductDto, UpdateFamilyProductDto, SetProductRulesDto, RuleProposalDto, RenameDietDto, CollegaRicettaDto } from './dto/catalog.dto';

/** Diete: il nutrizionista propone, il capo approva. */
@Controller('diets')
@RequirePage('diets_catalog')
@Roles('nutritionist', 'head_nutritionist')
export class DietsController {
  constructor(private readonly catalog: CatalogService) {}

  @Roles('nutritionist', 'head_nutritionist', 'admin') // admin: sola lettura
  @Get()
  list(@Query('status') status?: string) {
    return this.catalog.listDiets({ status });
  }

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.catalog.getDiet(id);
  }

  @Post()
  create(@Body() dto: CreateDietDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createDiet(user.sub, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDietDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateDiet(user.sub, id, dto);
  }

  /** Rinomina rapida (anche su diete approvate): non azzera lo stato. */
  @Patch(':id/name')
  rename(@Param('id') id: string, @Body() dto: RenameDietDto, @CurrentUser() user: AuthUser) {
    return this.catalog.renameDiet(user.sub, id, dto.name);
  }

  @HttpCode(200)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteDiet(user.sub, id);
  }

  /**
   * ⛔ **LA FAMIGLIA INTERA — e sta PRIMA di `:id/product`, non è uno stile: è necessità.**
   *
   * Nest cerca le rotte nell'ordine in cui sono dichiarate, e `:id/product` combacia anche con
   * `famiglia/product` (leggendo `famiglia` come un id). Dichiarata dopo, questa rotta non verrebbe
   * mai raggiunta: risponderebbe l'altra, con un 404 su una dieta che si chiama «famiglia».
   */
  @Patch('famiglia/product')
  updateFamilyProduct(@Body() dto: UpdateFamilyProductDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateFamilyProduct(user.sub, dto);
  }

  /**
   * ⛔ **APERTA ANCHE ALLA NUTRIZIONISTA** (deciso da Simone il 22/8: «la nutrizionista scrive il
   * testo, il capo la visibilità»).
   *
   * Era `@Roles('head_nutritionist')` intera, mentre il pulsante «Scheda cliente» in pagina Diete si
   * mostrava anche alla nutrizionista semplice: apriva, scriveva, salvava e prendeva **403**. La
   * guardia adesso è **per campo** e sta nel service (`soloIlCapoAccendeLaVetrina`), perché la stessa
   * rotta accetta il testo da tutte e due e la vetrina solo dal capo.
   */
  @Patch(':id/product')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateDietProductDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateDietProduct(user.sub, id, dto, user.role);
  }

  /** Regole del motore attivate per il prodotto (Fase F). */
  @Get(':id/rules')
  rules(@Param('id') id: string) {
    return this.catalog.getRules(id);
  }

  @Patch(':id/rules')
  setRules(@Param('id') id: string, @Body() dto: SetProductRulesDto, @CurrentUser() user: AuthUser) {
    return this.catalog.setRules(user.sub, id, dto.rules);
  }

  @Post(':id/rule-proposals')
  proposeRule(@Param('id') id: string, @Body() dto: RuleProposalDto, @CurrentUser() user: AuthUser) {
    return this.catalog.proposeRule(user.sub, id, dto.text);
  }

  @Put(':id/days')
  setDays(
    @Param('id') id: string,
    @Body() dto: SetDayTemplatesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.setDayTemplates(user.sub, id, dto);
  }

  @HttpCode(200)
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.submitForReview(user.sub, id);
  }

  /** Approvazione riservata al capo (mai la propria dieta). */
  @Roles('head_nutritionist')
  @RequirePage('diets_catalog', 'view')
  @HttpCode(200)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.approveDiet(user.sub, id);
  }

  /** Pubblicazione diretta del capo su una PROPRIA dieta (nessuna revisione). */
  // Livello 'view' sulla pagina: l'azione è già ristretta al capo da @Roles;
  // il requisito 'manage' del controller bloccherebbe chi ha il catalogo in sola
  // lettura pur essendo il responsabile.
  @Roles('head_nutritionist')
  @RequirePage('diets_catalog', 'view')
  @HttpCode(200)
  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.publishDiet(user.sub, id);
  }

  @Roles('head_nutritionist')
  @RequirePage('diets_catalog', 'view')
  @HttpCode(200)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDietDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.rejectDiet(user.sub, id, dto.reason);
  }

  /** Archivia una dieta generata (anche approvata): esce da menu, schermo 16 e sito.
   *  Serve ad allineare il catalogo quando si toglie un'opzione dal generatore. */
  @RequirePage('diets_catalog', 'view')
  @HttpCode(200)
  @Post(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.archiveDiet(user.sub, id);
  }
}

/** Vista del capo: coda di revisione e catalogo pubblicato. */
@Controller('head')
@Roles('head_nutritionist')
export class HeadCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('diets')
  diets(@Query('status') status = 'in_review') {
    return this.catalog.listDiets({ status });
  }
}

/** Catalogo pubblicato (staff + admin). */
class SetRegimesDto {
  @IsArray()
  @ArrayMaxSize(30)
  regimes!: { code: string; label: string }[];
}

@Controller('catalog')
@Roles('nutritionist', 'head_nutritionist', 'admin')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.catalog();
  }

  /**
   * Regimi (configurabili) + stili (dalle diete): opzioni per i form. Sono solo
   * ETICHETTE (nessun dato sensibile): leggibili da tutto lo staff, perché servono
   * anche fuori dal catalogo (es. tendine Regime/Stile nella scheda cliente per chi
   * ha il permesso "Cambia tipo di dieta").
   */
  @Roles('coach', 'coach_coordinator', 'sales', 'nutritionist', 'head_nutritionist', 'marketing', 'head_marketing', 'admin')
  @Get('taxonomy')
  taxonomy() {
    return this.catalog.taxonomy();
  }

  /** Aggiorna la lista dei regimi (solo admin). */
  @Roles('admin')
  @Patch('regimes')
  setRegimes(@Body() dto: SetRegimesDto, @CurrentUser() u: AuthUser) {
    return this.catalog.setRegimes(dto.regimes, u.sub);
  }
}

/**
 * Ricette: il dettaglio (`GET :id`) è leggibile da QUALSIASI utente autenticato —
 * serve alle clienti che aprono una ricetta dal proprio menu. Le rotte di gestione
 * (elenco/creazione/modifica) restano riservate ai nutrizionisti con il permesso di
 * pagina `recipes` (perciò `@RequirePage` è sui singoli metodi staff, NON sulla classe:
 * sulla classe bloccherebbe anche la lettura delle clienti → ricetta vuota in app).
 */
@Controller('recipes')
export class RecipesController {
  constructor(private readonly catalog: CatalogService) {}

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Get()
  list(
    @Query('regime') regime?: string,
    @Query('mealSlot') mealSlot?: string,
    @Query('q') q?: string,
    @Query('includeInactive') includeInactive?: string,
    // Solo le ricette effettivamente usate nelle giornate di QUESTA dieta. Serve alla pagina
    // Gestione dieta: senza, mostrava tutte le ricette del regime — comprese quelle di altre
    // famiglie — dando l'impressione che appartenessero alla dieta aperta.
    @Query('dietId') dietId?: string,
    // Filtri di colonna: girano sul DATABASE. Prima la pagina filtrava le prime 1000 righe
    // caricate, cioè cercava dentro una fetta del catalogo senza dirlo.
    @Query('difficulty') difficulty?: string,
    @Query('season') season?: string,
    @Query('stato') stato?: string,
    @Query('kcalMin') kcalMin?: string,
    @Query('kcalMax') kcalMax?: string,
    /** ⚠️ Il filtro «aspetta gli allergeni» gira sul database: vedi `listRecipes`. */
    @Query('daRivedere') daRivedere?: string,
  ) {
    const num = (v?: string) => (v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined);
    return this.catalog.listRecipes({
      regime, mealSlot, q, includeInactive: includeInactive === 'true', dietId,
      daRivedere: daRivedere === 'true',
      difficulty, season, stato, kcalMin: num(kcalMin), kcalMax: num(kcalMax),
    });
  }

  /** Le colazioni con proposta dolce/salato e stato di conferma (Decisioni 13/8 §12). */
  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Get('colazioni')
  colazioni() {
    return this.catalog.elencoColazioni();
  }

  /** La conferma in blocco delle proposte. Massimo 500 per volta. */
  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes', 'manage')
  @Post('colazioni/conferma')
  confermaColazioni(@Body() dto: ConfermaColazioniDto, @CurrentUser() user: AuthUser) {
    return this.catalog.confermaColazioni(user.sub, dto.scelte);
  }

  /**
   * Dettaglio ricetta: aperto a ogni utente autenticato (cliente inclusa) — NIENTE
   * `@RequirePage` qui, altrimenti la cliente riceve 403 e la ricetta si apre vuota.
   *
   * ⚠️ `giorno` e `slot` sono **facoltativi e servono a una cosa sola**: dire *cosa sto guardando*,
   * così la scheda può mostrare le grammature della porzione che quella cliente ha ricevuto quel
   * giorno invece di quelle di catalogo (voce 255). Il **fattore non si passa**: si rilegge dallo
   * snapshot suo. Chi non li manda — l'app pubblicata, il backoffice — riceve esattamente quello
   * che riceveva prima, ed è la ragione per cui sono facoltativi e non automatici.
   */
  @Get(':id')
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('giorno') giorno?: string,
    @Query('slot') slot?: string,
  ) {
    return this.catalog.getRecipe(id, { clientId: user?.sub, giorno, slot });
  }

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Post()
  create(@Body() dto: CreateRecipeDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createRecipe(user.sub, dto);
  }

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateRecipe(user.sub, id, dto);
  }

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @HttpCode(200)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteRecipe(user.sub, id);
  }

  // ---------- Dove è usata la ricetta (scheda ricetta, 11/8) ----------

  /** Le giornate in cui questa ricetta è usata: dieta, settimana, giorno. */
  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Get(':id/uso')
  usi(@Param('id') id: string) {
    return this.catalog.usiDellaRicetta(id);
  }

  /**
   * Le giornate di una dieta viste da uno slot solo: chi c'è adesso in quella cena, giorno per
   * giorno. Serve a scegliere DOVE mettere il piatto sapendo cosa si sostituisce.
   */
  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Get('diete/:dietId/giornate')
  giornateDiDieta(@Param('dietId') dietId: string, @Query('slot') slot: string) {
    return this.catalog.giornateDiDietaPerSlot(dietId, slot);
  }

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @HttpCode(200)
  @Post(':id/uso')
  collega(@Param('id') id: string, @Body() dto: CollegaRicettaDto, @CurrentUser() user: AuthUser) {
    return this.catalog.collegaRicetta(user.sub, id, dto.dietId, dto.dayIndex);
  }

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @HttpCode(200)
  @Delete(':id/uso')
  scollega(@Param('id') id: string, @Body() dto: CollegaRicettaDto, @CurrentUser() user: AuthUser) {
    return this.catalog.scollegaRicetta(user.sub, id, dto.dietId, dto.dayIndex);
  }

  /** Pre-tag allergeni assistito (suggerimenti dagli ingredienti + stato attuale). */
  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Get(':id/allergen-suggestions')
  allergenSuggestions(@Param('id') id: string) {
    return this.catalog.recipeAllergenSuggestions(id);
  }

  /** Conferma degli allergeni della ricetta da parte del nutrizionista (reviewed=true). */
  /** La decisione su una colazione sola: dolce, salato, o `null` per togliere. */
  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes', 'manage')
  @Patch(':id/colazione')
  setColazione(@Param('id') id: string, @Body() dto: SetColazioneDto, @CurrentUser() user: AuthUser) {
    return this.catalog.setColazione(user.sub, id, dto.tipo);
  }

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Patch(':id/allergens')
  setAllergens(@Param('id') id: string, @Body() dto: SetRecipeAllergensDto, @CurrentUser() user: AuthUser) {
    return this.catalog.setRecipeAllergens(user.sub, id, dto.allergens);
  }

  /**
   * Conferma in blocco (19/8): gli allergeni sono quelli **suggeriti dagli ingredienti**, calcolati
   * al momento. Il corpo porta solo gli id — vedi `confermaAllergeniInBlocco` per il perché.
   */
  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @RequirePage('recipes')
  @Post('allergens/bulk')
  confermaAllergeniInBlocco(@Body() dto: ConfermaAllergeniInBloccoDto, @CurrentUser() user: AuthUser) {
    return this.catalog.confermaAllergeniInBlocco(user.sub, dto.ids);
  }
}
