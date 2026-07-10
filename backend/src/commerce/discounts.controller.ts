import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { DiscountsService } from './discounts.service';

class CreateDiscountDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  code!: string;

  @IsIn(['percent', 'fixed'])
  type!: 'percent' | 'fixed';

  @IsInt()
  @Min(1)
  value!: number; // percent 1-100 oppure importo in centesimi

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTotalUses?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  maxPerClient?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}

class SetActiveDto {
  @IsBoolean()
  active!: boolean;
}

class ValidateDiscountDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsInt()
  @Min(0)
  amountCents!: number;
}

/** Gestione buoni sconto (admin). */
@Controller('admin/discounts')
@Roles('admin')
export class AdminDiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get()
  list() {
    return this.discounts.list();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDiscountDto) {
    return this.discounts.create(dto, user.sub);
  }

  @Patch(':id')
  setActive(@Param('id') id: string, @Body() dto: SetActiveDto, @CurrentUser() user: AuthUser) {
    return this.discounts.setActive(id, dto.active, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.discounts.remove(id, user.sub);
  }
}

/** Verifica di un codice lato cliente (per il carrello). */
@Controller('me/discounts')
@Roles('client')
export class MyDiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @HttpCode(200)
  @Post('validate')
  validate(@CurrentUser() user: AuthUser, @Body() dto: ValidateDiscountDto) {
    return this.discounts.validate(dto.code, user.sub, dto.amountCents);
  }
}
