import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBase64,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Headers, HttpCode as HttpCodeDecorator, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CommerceService } from './commerce.service';
import { CreatePlanDto, CreateProductDto, UpdatePlanDto, UpdateProductDto } from './dto/shop-admin.dto';
import { CrmService } from './crm.service';
import { FinanceService } from './finance.service';
import { StripeService } from './stripe.service';

class SubscribeDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsIn(['bank_transfer', 'card'])
  method?: 'bank_transfer' | 'card';
}

class OrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

class CheckoutDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  @IsIn(['card', 'bank_transfer'])
  method!: 'card' | 'bank_transfer';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  discountCode?: string;
}

class UploadReceiptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'image/heic'])
  mimeType!: string;

  @IsBase64()
  contentBase64!: string;
}

class RejectPaymentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class CreateLeadDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

class AdvanceLeadDto {
  @IsString()
  stage!: string;

  @IsOptional()
  @IsString()
  ownerStaffId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;
}

class UpdateLeadInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;

  // Storico importato dalle liste pre-Metabole (informativo).
  @IsOptional()
  @IsString()
  @MaxLength(80)
  previousStatus?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  historicalPaidCents?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codiceFiscale?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  tags?: string[];
}

class SetLeadListsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  listIds!: string[];
}

class AddLeadNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

// Nessun limite di lunghezza qui: i dati storici possono avere campi sporchi
// (nomi concatenati, ecc.). Il servizio tronca i campi troppo lunghi invece di
// far fallire l'intero lotto per una singola riga anomala.
class ImportRowDto {
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() lists?: string; // separate da '|'
  @IsOptional() @IsString() previousStatus?: string;
  @IsOptional() @IsInt() historicalPaidCents?: number;
  @IsOptional() @IsString() coachRefCode?: string;
  @IsOptional() @IsString() codiceFiscale?: string;
  @IsOptional() @IsString() address?: string;
}

class ImportLeadsDto {
  @IsBoolean() dryRun!: boolean;
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

class CreateCrmListDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @MaxLength(9) color?: string;
}

class UpdateCrmListDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @MaxLength(9) color?: string;
}

/** Piani e prodotti pubblici (per landing e app). */
@Controller()
export class CatalogCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Public()
  @Get('plans')
  plans() {
    return this.commerce.listPlans();
  }

  @Public()
  @Get('products')
  products() {
    return this.commerce.listProducts();
  }

  /** Metodi di pagamento abilitati dal backoffice (per il checkout dell'app). */
  @Public()
  @Get('payment-methods')
  paymentMethods() {
    return this.commerce.enabledPaymentMethods();
  }
}

/** Lato cliente. */
@Controller('me')
@Roles('client')
export class MyCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  /** Piani visibili a QUESTO cliente: nasconde i piani non riacquistabili già presi. */
  @Get('plans')
  myPlans(@CurrentUser() user: AuthUser) {
    return this.commerce.listPlansForClient(user.sub);
  }

  /** Prodotti visibili a QUESTO cliente: nasconde i prodotti non riacquistabili già presi. */
  @Get('products')
  myProducts(@CurrentUser() user: AuthUser) {
    return this.commerce.listProductsForClient(user.sub);
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.commerce.subscribe(user.sub, dto.planId, user.email, dto.method ?? 'bank_transfer');
  }

  /** Checkout unificato del carrello (piano + prodotti + sconto, carta o bonifico). */
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.commerce.checkout(user.sub, user.email, {
      planId: dto.planId,
      items: dto.items,
      method: dto.method,
      discountCode: dto.discountCode,
    });
  }

  @Get('subscription')
  subscription(@CurrentUser() user: AuthUser) {
    return this.commerce.mySubscription(user.sub);
  }

  @Post('orders')
  order(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.commerce.createOrder(user.sub, user.email, dto.items);
  }

  @Get('payments')
  payments(@CurrentUser() user: AuthUser) {
    return this.commerce.myPayments(user.sub);
  }

  /** Ricevuta PDF di un proprio pagamento confermato. */
  @Get('payments/:id/receipt-pdf')
  receiptPdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.myReceiptPdf(user.sub, id);
  }

  /** Upload della contabile del bonifico. */
  @HttpCode(200)
  @Post('payments/:id/receipt')
  receipt(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadReceiptDto,
  ) {
    return this.commerce.uploadReceipt(user.sub, id, dto);
  }

  /** La cliente annulla un proprio ordine ancora in attesa (non ancora approvato). */
  @HttpCode(200)
  @Post('payments/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.cancelPayment(user.sub, id, { byClient: true });
  }
}

class CreateManualPurchaseDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  planId!: string;

  @IsBoolean()
  generateCommissions!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  discountCode?: string | null;
}

class RefundPurchaseDto {
  /** Importo del rimborso in centesimi (l'operatore lo decide: anche parziale). */
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}

/** Acquisti: elenco completo, ricevuta PDF, inserimento manuale (operatore). */
@Controller('admin/purchases')
@Roles('admin', 'sales')
export class AdminPurchasesController {
  constructor(private readonly commerce: CommerceService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.commerce.listPayments(status);
  }

  @Get(':id/receipt-pdf')
  receiptPdf(@Param('id') id: string) {
    return this.commerce.generateReceiptPdf(id);
  }

  @Roles('admin')
  @HttpCode(201)
  @Post()
  createManual(@CurrentUser() user: AuthUser, @Body() dto: CreateManualPurchaseDto) {
    return this.commerce.createManualPurchase(user, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.commerce.deletePurchase(id, user.sub);
  }

  /** Storno: registra il rimborso, blocca i menu e storna le provvigioni in proporzione. */
  @Roles('admin')
  @HttpCode(200)
  @Post(':id/refund')
  refund(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: RefundPurchaseDto) {
    return this.commerce.refundPurchase(id, user.sub, dto);
  }

  @Get(':id/refund-receipt-pdf')
  refundReceiptPdf(@Param('id') id: string) {
    return this.commerce.generateRefundReceiptPdf(id);
  }
}

/** Operatore: verifica contabili e approva (admin + commerciale). */
@Controller('admin/payments')
@Roles('admin', 'sales')
export class AdminPaymentsController {
  constructor(private readonly commerce: CommerceService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.commerce.listPayments(status);
  }

  @Get(':id/receipt')
  receipt(@Param('id') id: string) {
    return this.commerce.downloadReceipt(id);
  }

  @HttpCode(200)
  @Post(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.approvePayment(user, id);
  }

  @HttpCode(200)
  @Post(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.commerce.rejectPayment(user, id, dto.reason);
  }

  /** "Elimina" con conferma dal backoffice: annulla il pagamento (resta nello storico). */
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.cancelPayment(user.sub, id, { byClient: false });
  }
}

/** Webhook Stripe (spec: POST /payments/webhook). Firma verificata, idempotente. */
@SkipThrottle() // la firma Stripe è la protezione; niente rate limit sui webhook
@Controller('payments')
export class StripeWebhookController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly stripe: StripeService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const event = this.stripe.verifyWebhook(req.rawBody ?? Buffer.alloc(0), signature ?? '');
    return this.commerce.handleStripeEvent(event as never);
  }
}

/** CRM (commerciale, coach, capo, admin). */
@Controller('crm/leads')
@Roles('coach', 'sales', 'head_nutritionist', 'admin')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('stage') stage?: string,
    @Query('listId') listId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('coachId') coachId?: string,
    @Query('nutriId') nutriId?: string,
    @Query('tipo') tipo?: string,
    @Query('valueMin') valueMin?: string,
    @Query('valueMax') valueMax?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortKey') sortKey?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const num = (v?: string) => (v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined);
    // La coach vede SOLO i suoi lead (scope applicato nel service); manager coach/capo/admin tutti.
    return this.crm.list({
      stage, listId, search: q,
      page: num(page), pageSize: num(pageSize),
      coachId, nutriId, tipo,
      valueMin: num(valueMin), valueMax: num(valueMax),
      dateFrom, dateTo, sortKey, sortDir,
    }, user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.crm.create(user.sub, dto);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crm.detail(id, user.sub);
  }

  @Patch(':id')
  advance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdvanceLeadDto) {
    return this.crm.advance(user.sub, id, dto);
  }

  @Patch(':id/info')
  updateInfo(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLeadInfoDto) {
    return this.crm.updateInfo(user.sub, id, dto);
  }

  /** Imposta le liste di un lead (rimpiazza le appartenenze). */
  @Post(':id/lists')
  @HttpCode(200)
  setLists(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetLeadListsDto) {
    return this.crm.setLeadLists(user.sub, id, dto.listIds);
  }

  /** Nota dello staff sulla scheda lead (come le note della scheda cliente). */
  @HttpCode(201)
  @Post(':id/notes')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddLeadNoteDto) {
    return this.crm.addLeadNote(user.sub, id, dto.body);
  }

  /** Elimina una nota della scheda lead: solo admin (come nella scheda cliente). */
  @Roles('admin')
  @HttpCode(200)
  @Delete(':id/notes/:noteId')
  deleteNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('noteId') noteId: string) {
    return this.crm.deleteLeadNote(user.sub, id, noteId);
  }

  /** Import liste storiche (solo admin): un lotto per volta, con dry-run per l'anteprima. */
  @Roles('admin')
  @Post('import')
  @HttpCode(200)
  import(@CurrentUser() user: AuthUser, @Body() dto: ImportLeadsDto) {
    return this.crm.importRows(user.sub, dto.rows, dto.dryRun);
  }
}

/** Liste CRM: raggruppamenti manuali di lead/clienti. */
@Controller('crm/lists')
@Roles('coach', 'sales', 'head_nutritionist', 'admin')
export class CrmListsController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    // La coach vede i conteggi dei SOLI suoi lead (scope nel service).
    return this.crm.listLists(user.sub);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmListDto) {
    return this.crm.createList(user.sub, dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCrmListDto) {
    return this.crm.updateList(user.sub, id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crm.deleteList(user.sub, id);
  }
}

/** Contabilità e dashboard. */
@Controller()
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly crm: CrmService,
  ) {}

  @Roles('admin')
  @Get('admin/commissions')
  commissions() {
    return this.finance.listCommissions();
  }

  @Roles('admin')
  @Delete('admin/commissions/:id')
  deleteCommission(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.finance.deleteCommission(id, actor.sub);
  }

  @Roles('admin')
  @Get('ledger')
  ledger(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    return this.finance.ledger({ from, to, type, category });
  }

  @Roles('sales', 'admin')
  @Get('dashboards/sales')
  sales() {
    return this.crm.salesDashboard();
  }

  @Roles('admin')
  @Get('dashboards/accounting')
  accounting() {
    return this.finance.accountingDashboard();
  }

  @Roles('admin', 'head_nutritionist')
  @Get('dashboards/compensation')
  compensation(@Query('period') period?: string) {
    return this.finance.compensationDashboard(period);
  }
}

/** Gestione negozio (admin): piani e prodotti/integratori. */
@Controller('admin/shop')
@Roles('admin')
export class AdminShopController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('plans')
  plans() {
    return this.commerce.listAllPlans();
  }
  @Post('plans')
  createPlan(@CurrentUser() u: AuthUser, @Body() dto: CreatePlanDto) {
    return this.commerce.createPlan(u.sub, dto);
  }
  @Patch('plans/:id')
  updatePlan(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.commerce.updatePlan(u.sub, id, { ...dto } as Record<string, unknown>);
  }
  @HttpCode(200)
  @Delete('plans/:id')
  deletePlan(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.commerce.deletePlan(u.sub, id);
  }

  @Get('products')
  products() {
    return this.commerce.listAllProducts();
  }
  @Post('products')
  createProduct(@CurrentUser() u: AuthUser, @Body() dto: CreateProductDto) {
    return this.commerce.createProduct(u.sub, dto);
  }
  @Patch('products/:id')
  updateProduct(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.commerce.updateProduct(u.sub, id, { ...dto } as Record<string, unknown>);
  }
  @HttpCode(200)
  @Delete('products/:id')
  deleteProduct(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.commerce.deleteProduct(u.sub, id);
  }
}
