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
import { SetRecipeAllergensDto } from './dto/allergens.dto';
import {
  CreateDietDto,
  CreateRecipeDto,
  UpdateRecipeDto,
  RejectDietDto,
  SetDayTemplatesDto,
  UpdateDietDto,
  UpdateDietProductDto,
  SetProductRulesDto,
  RuleProposalDto,
} from './dto/catalog.dto';

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

  @HttpCode(200)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteDiet(user.sub, id);
  }

  /** Modifica la sola scheda cliente (schermo 16), anche su diete approvate. */
  @Patch(':id/product')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateDietProductDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateDietProduct(user.sub, id, dto);
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
  @HttpCode(200)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.approveDiet(user.sub, id);
  }

  @Roles('head_nutritionist')
  @HttpCode(200)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDietDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.rejectDiet(user.sub, id, dto.reason);
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

  /** Regimi (configurabili) + stili (dalle diete): opzioni per i form di dieta/ricetta. */
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

/** Ricette: lettura anche per le clienti (dal menu), scrittura per nutrizionisti. */
@Controller('recipes')
@RequirePage('recipes')
export class RecipesController {
  constructor(private readonly catalog: CatalogService) {}

  @Roles('nutritionist', 'head_nutritionist', 'admin')
  @Get()
  list(
    @Query('regime') regime?: string,
    @Query('mealSlot') mealSlot?: string,
    @Query('q') q?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.catalog.listRecipes({ regime, mealSlot, q, includeInactive: includeInactive === 'true' });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.catalog.getRecipe(id);
  }

  @Roles('nutritionist', 'head_nutritionist')
  @Post()
  create(@Body() dto: CreateRecipeDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createRecipe(user.sub, dto);
  }

  @Roles('nutritionist', 'head_nutritionist')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateRecipe(user.sub, id, dto);
  }

  @Roles('nutritionist', 'head_nutritionist')
  @HttpCode(200)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteRecipe(user.sub, id);
  }

  /** Pre-tag allergeni assistito (suggerimenti dagli ingredienti + stato attuale). */
  @Roles('nutritionist', 'head_nutritionist')
  @Get(':id/allergen-suggestions')
  allergenSuggestions(@Param('id') id: string) {
    return this.catalog.recipeAllergenSuggestions(id);
  }

  /** Conferma degli allergeni della ricetta da parte del nutrizionista (reviewed=true). */
  @Roles('nutritionist', 'head_nutritionist')
  @Patch(':id/allergens')
  setAllergens(@Param('id') id: string, @Body() dto: SetRecipeAllergensDto, @CurrentUser() user: AuthUser) {
    return this.catalog.setRecipeAllergens(user.sub, id, dto.allergens);
  }
}
