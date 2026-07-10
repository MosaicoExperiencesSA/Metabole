import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBase64,
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
}

/** Lato cliente. */
@Controller('me')
@Roles('client')
export class MyCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.commerce.subscribe(user.sub, dto.planId, user.email, dto.method ?? 'bank_transfer');
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
  list(@Query('stage') stage?: string) {
    return this.crm.list({ stage });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.crm.create(user.sub, dto);
  }

  @Patch(':id')
  advance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdvanceLeadDto) {
    return this.crm.advance(user.sub, id, dto);
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
