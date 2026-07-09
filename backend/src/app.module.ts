import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ConfigParamsModule } from './config-params/config-params.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    MailModule,
    ConfigParamsModule,
    AuthModule,
    UsersModule,
    OnboardingModule,
    ProfileModule,
    HealthModule,
  ],
  providers: [
    // Ordine importante: prima autenticazione, poi RBAC.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
