import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CommerceModule } from '../commerce/commerce.module';
import { ReferralModule } from '../referral/referral.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminImpersonateController } from './admin-impersonate.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    CommerceModule,
    ReferralModule,
    NotificationsModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_ACCESS_SECRET mancante: configurarla nelle variabili d\'ambiente');
        }
        const ttl = config.get<string>('JWT_ACCESS_TTL') ?? '3h'; // sessione backoffice: min 3 ore
        return {
          secret: secret ?? 'dev-only-insecure-secret',
          // Il tipo di expiresIn è il template-literal del pacchetto "ms" ("15m", "1h", ...):
          // arriva da env come string, il cast è sicuro.
          signOptions: { expiresIn: ttl as unknown as number },
        };
      },
    }),
  ],
  controllers: [AuthController, AdminImpersonateController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
