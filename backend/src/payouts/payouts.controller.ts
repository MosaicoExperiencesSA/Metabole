import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBase64, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PayoutsService } from './payouts.service';

class WithdrawalReceiptDto {
  @IsString() @MinLength(1) @MaxLength(200) fileName!: string;
  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'image/heic']) mimeType!: string;
  @IsBase64() contentBase64!: string;
}

class RequestWithdrawalDto {
  @IsInt() @Min(1) amountCents!: number;
  @IsString() @MinLength(15) @MaxLength(40) iban!: string;
  @IsOptional() @ValidateNested() @Type(() => WithdrawalReceiptDto) receipt?: WithdrawalReceiptDto;
}

/** Pagamento già fatto, registrato dall'admin senza richiesta della persona (19/10). */
class ManualPaymentDto {
  @IsString() @MinLength(1) @MaxLength(64) staffId!: string;
  @IsInt() @Min(1) amountCents!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) paidOn!: string;
  @IsOptional() @IsString() @MaxLength(80) paidWith?: string;
  @IsOptional() @IsString() @MaxLength(40) iban?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @ValidateNested() @Type(() => WithdrawalReceiptDto) proof?: WithdrawalReceiptDto;
}

class ProofDto {
  @ValidateNested() @Type(() => WithdrawalReceiptDto) proof!: WithdrawalReceiptDto;
}

class RejectWithdrawalDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

/** Portafoglio provvigioni e richiesta prelievo (staff). */
@Controller('me/wallet')
export class WalletController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  wallet(@CurrentUser() user: AuthUser) {
    return this.payouts.myWallet(user.sub);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: AuthUser) {
    return this.payouts.myEarnings(user.sub);
  }

  @HttpCode(201)
  @Post('withdrawals')
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestWithdrawalDto) {
    return this.payouts.requestWithdrawal(user.sub, { amountCents: dto.amountCents, iban: dto.iban, receipt: dto.receipt });
  }
}

/** Gestione richieste di prelievo (admin). */
@Controller('admin/withdrawals')
@Roles('admin')
export class AdminWithdrawalsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.payouts.listWithdrawals(status);
  }

  /** Chi si può pagare, con maturato, già pagato e residuo (finestra «Registra pagamento»). */
  @Get('payees')
  payees() {
    return this.payouts.listPayees();
  }

  /**
   * Le voci «con cosa hai pagato». Hanno una rotta loro e non quella di Contabilità
   * (`accounting_costs`): chi gestisce i prelievi non deve per forza vedere i costi aziendali.
   */
  @Get('payment-methods')
  paymentMethods() {
    return this.payouts.metodiPagamento();
  }

  @HttpCode(201)
  @Post('manual')
  manual(@CurrentUser() user: AuthUser, @Body() dto: ManualPaymentDto) {
    return this.payouts.registerManualPayment(user, dto);
  }

  @Get(':id/receipt')
  receipt(@Param('id') id: string) {
    return this.payouts.downloadReceipt(id);
  }

  @Get(':id/proof')
  proof(@Param('id') id: string) {
    return this.payouts.downloadProof(id);
  }

  @HttpCode(200)
  @Post(':id/proof')
  uploadProof(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProofDto) {
    return this.payouts.uploadProof(user, id, dto.proof);
  }

  @HttpCode(200)
  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payouts.confirmWithdrawal(user, id);
  }

  @HttpCode(200)
  @Post(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectWithdrawalDto) {
    return this.payouts.rejectWithdrawal(user, id, dto.reason);
  }
}
