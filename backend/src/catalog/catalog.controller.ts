import {
  Body,
  Controller,
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
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CatalogService } from './catalog.service';
import {
  CreateDietDto,
  CreateRecipeDto,
  UpdateRecipeDto,
  RejectDietDto,
  SetDayTemplatesDto,
  UpdateDietDto,
} from './dto/catalog.dto';

/** Diete: il nutrizionista propone, il capo approva. */
@Controller('diets')
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
@Controller('catalog')
@Roles('nutritionist', 'head_nutritionist', 'admin')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.catalog();
  }
}

/** Ricette: lettura anche per le clienti (dal menu), scrittura per nutrizionisti. */
@Controller('recipes')
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
}
