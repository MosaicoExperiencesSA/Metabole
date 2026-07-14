import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AccountingService, CADENCES, COST_CATEGORIES } from './accounting.service';

class CreateCostDto {
  @IsString() @MinLength(2) @MaxLength(160)
  label!: string;

  @IsIn(COST_CATEGORIES as unknown as string[])
  category!: string;

  @IsInt() @Min(1)
  amountCents!: number;

  @IsOptional() @IsBoolean()
  recurring?: boolean;

  @IsOptional() @IsIn(CADENCES as unknown as string[])
  cadence?: string;

  @IsISO8601()
  date!: string;

  @IsOptional() @IsISO8601()
  endDate?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  vendor?: string | null;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string | null;
}

class UpdateCostDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160)
  label?: string;

  @IsOptional() @IsIn(COST_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional() @IsInt() @Min(1)
  amountCents?: number;

  @IsOptional() @IsBoolean()
  recurring?: boolean;

  @IsOptional() @IsIn(CADENCES as unknown as string[])
  cadence?: string;

  @IsOptional() @IsISO8601()
  date?: string;

  @IsOptional() @IsISO8601()
  endDate?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  vendor?: string | null;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string | null;
}

/** Contabilità (backlog #6): gestione costi + conto economico. Solo admin. */
@Controller('admin/accounting')
@Roles('admin')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get('report')
  report(@Query('from') from: string, @Query('to') to: string) {
    return this.accounting.report(from, to);
  }

  /** Report del periodo in PDF (base64) da scaricare. */
  @Get('report/pdf')
  reportPdf(@Query('from') from: string, @Query('to') to: string) {
    return this.accounting.reportPdf(from, to);
  }

  /** Report del periodo in CSV (base64) da scaricare. */
  @Get('report/csv')
  reportCsv(@Query('from') from: string, @Query('to') to: string) {
    return this.accounting.reportCsv(from, to);
  }

  @Get('costs')
  listCosts() {
    return this.accounting.listCosts();
  }

  @Post('costs')
  createCost(@CurrentUser() user: AuthUser, @Body() dto: CreateCostDto) {
    return this.accounting.registerCost(dto, user.sub);
  }

  @Patch('costs/:id')
  updateCost(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCostDto) {
    return this.accounting.updateCost(id, dto, user.sub);
  }

  @HttpCode(200)
  @Delete('costs/:id')
  deleteCost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accounting.deleteCost(id, user.sub);
  }
}
