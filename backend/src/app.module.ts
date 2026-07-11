import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { CatalogModule } from './catalog/catalog.module';
import { ChatModule } from './chat/chat.module';
import { ClientsModule } from './clients/clients.module';
import { CommerceModule } from './commerce/commerce.module';
import { CronModule } from './cron/cron.module';
import { EngineModule } from './engine/engine.module';
import { EscalationsModule } from './escalations/escalations.module';
import { VisitsModule } from './visits/visits.module';
import { CompensationModule } from './compensation/compensation.module';
import { HealthAreaModule } from './health-area/health-area.module';
import { I18nModule } from './i18n/i18n.module';
import { MenuModule } from './menu/menu.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ConfigParamsModule } from './config-params/config-params.module';
import { HealthModule } from './health/health.module';
import { ReportsModule } from './reports/reports.module';
import { MailModule } from './mail/mail.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { RolesModule } from './roles/roles.module';
import { SignalsModule } from './signals/signals.module';
import { UsersModule } from './users/users.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting globale (hardening OWASP); limiti più stretti sugli endpoint auth.
    // THROTTLE_LIMIT sovrascrivibile via env (default 120 richieste/minuto per IP).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: Number(process.env.THROTTLE_LIMIT ?? 120) }],
    }),
    PrismaModule,
    AuditModule,
    I18nModule,
    MailModule,
    ConfigParamsModule,
    PdfModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    OnboardingModule,
    ProfileModule,
    SignalsModule,
    CatalogModule,
    CalendarModule,
    MenuModule,
    EngineModule,
    NotificationsModule,
    CronModule,
    HealthAreaModule,
    ChatModule,
    ClientsModule,
    CommerceModule,
    ReportsModule,
    HealthModule,
    EscalationsModule,
    VisitsModule,
    CompensationModule,
  ],
  providers: [
    // Ordine importante: prima rate limiting, poi autenticazione, poi RBAC.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
