import { Module } from '@nestjs/common';
import { AdminWithdrawalsController, WalletController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  controllers: [WalletController, AdminWithdrawalsController],
  providers: [PayoutsService],
})
export class PayoutsModule {}
