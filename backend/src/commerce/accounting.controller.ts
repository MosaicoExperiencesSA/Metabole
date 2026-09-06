import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AccountingService, CADENCES, COST_CATEGORIES } from './accounting.service';
import { RequirePage } from '../common/decorators/require-page.decorator';

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

  /**
   * Con cosa è stato pagato. Nessun `@IsIn` qui, di proposito: le voci ammesse le decide Simone nei
   * Parametri e cambiano senza rilascio — il controllo sta nel servizio, che le legge, e restituisce
   * un messaggio che dice dove si aggiungono.
   */
  @IsOptional() @IsString() @MaxLength(80)
  paidWith?: string | null;
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

  @IsOptional() @IsString() @MaxLength(80)
  paidWith?: string | null;
}

/**
 * Fattura di un costo. Arriva in base64 come le contabili dei pagamenti: nessun multipart, così il
 * limite del body (12 MB) e la validazione restano quelli di tutto il resto dell'API.
 */
class FatturaDto {
  @IsString() @MinLength(1) @MaxLength(200)
  fileName!: string;

  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'image/heic'])
  mimeType!: string;

  // ~6,8 MB di base64 per 5 MB di file: il limite vero, sui byte decodificati, è nel servizio.
  @IsString() @MinLength(8) @MaxLength(7_000_000)
  contentBase64!: string;
}

/** Contabilità (backlog #6): gestione costi + conto economico. Solo admin. */
@Controller('admin/accounting')
@Roles('admin')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  /**
   * ⛔ **Guardia per METODO e non di classe**: qui dentro convivono due chiavi diverse, e una
   * guardia sulla classe le confonderebbe in una sola — che è il difetto che stiamo chiudendo,
   * rifatto un piano più sopra.
   */
  @RequirePage('accounting')
  @Get('report')
  report(@Query('from') from: string, @Query('to') to: string) {
    return this.accounting.report(from, to);
  }

  /** Report del periodo in PDF (base64) da scaricare. */
  @RequirePage('accounting')
  @Get('report/pdf')
  reportPdf(@Query('from') from: string, @Query('to') to: string) {
    return this.accounting.reportPdf(from, to);
  }

  /** Report del periodo in CSV (base64) da scaricare. */
  @RequirePage('accounting')
  @Get('report/csv')
  reportCsv(@Query('from') from: string, @Query('to') to: string) {
    return this.accounting.reportCsv(from, to);
  }

  /**
   * Le voci della tendina «con cosa hai pagato». Endpoint a sé e non un campo dentro `costs`: la
   * pagina le usa in due punti (il modulo di inserimento e il filtro della colonna) e le vuole anche
   * quando di costi non ce n'è ancora nessuno.
   */
  /**
   * ⚠️ **`accounting_costs` e non `accounting`**: è la tendina del **modulo costi**, e la pagina che
   * la usa (`/contabilita`) sta sotto quella chiave. Metterla sotto l'altra avrebbe fatto fallire
   * il caricamento a chi ha i costi e non il conto economico — il giorno che i due permessi
   * smettono di coincidere, che è tutto il senso di averli separati.
   */
  @RequirePage('accounting_costs')
  @Get('payment-methods')
  metodiPagamento() {
    return this.accounting.metodiPagamento();
  }

  @RequirePage('accounting_costs')
  @Get('costs')
  listCosts() {
    return this.accounting.listCosts();
  }

  @RequirePage('accounting_costs')
  @Post('costs')
  createCost(@CurrentUser() user: AuthUser, @Body() dto: CreateCostDto) {
    return this.accounting.registerCost(dto, user.sub);
  }

  @RequirePage('accounting_costs')
  @Patch('costs/:id')
  updateCost(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCostDto) {
    return this.accounting.updateCost(id, dto, user.sub);
  }

  @HttpCode(200)
  @RequirePage('accounting_costs')
  @Delete('costs/:id')
  deleteCost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accounting.deleteCost(id, user.sub);
  }

  // ---------- Fattura allegata (richiesta di Simone, 8/8: «avere tutto insieme») ----------

  /** Allega o sostituisce la fattura del costo. Un file per costo, max 5 MB, salvato cifrato. */
  @HttpCode(200)
  @RequirePage('accounting_costs')
  @Post('costs/:id/fattura')
  allegaFattura(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FatturaDto) {
    return this.accounting.allegaFattura(id, dto, user.sub);
  }

  /** La fattura in base64: la pagina la apre in una scheda nuova o la scarica. */
  @RequirePage('accounting_costs')
  @Get('costs/:id/fattura')
  scaricaFattura(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accounting.scaricaFattura(id, user.sub);
  }

  @HttpCode(200)
  @RequirePage('accounting_costs')
  @Delete('costs/:id/fattura')
  rimuoviFattura(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accounting.rimuoviFattura(id, user.sub);
  }
}
