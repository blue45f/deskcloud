import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'

import { ApiKeysModule } from './apikeys/apikeys.module'
import { AuditModule } from './audit/audit.module'
import { AuthModule } from './auth/auth.module'
import { BootstrapService } from './bootstrap.service'
import { BrokerageModule } from './brokerage/brokerage.module'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { ConsentsModule } from './consents/consents.module'
import { CoreModule } from './core/core.module'
import { ExportModule } from './export/export.module'
import { HealthModule } from './health/health.module'
import { InquiriesModule } from './inquiries/inquiries.module'
import { InsightsModule } from './insights/insights.module'
import { MembersModule } from './members/members.module'
import { NotificationsModule } from './notifications/notifications.module'
import { OrgsModule } from './orgs/orgs.module'
import { PoliciesModule } from './policies/policies.module'
import { PublicModule } from './public/public.module'
import { RealtimeModule } from './realtime/realtime.module'
import { SupportModule } from './support/support.module'

import type { IncomingMessage } from 'node:http'

const isProd = process.env.NODE_ENV === 'production'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: isProd ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
        autoLogging: {
          ignore: (req: IncomingMessage) =>
            (req.url ?? '').startsWith('/health') || (req.url ?? '').startsWith('/api/docs'),
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    CoreModule,
    AuthModule,
    PoliciesModule,
    ConsentsModule,
    PublicModule,
    SupportModule,
    RealtimeModule,
    AuditModule,
    ApiKeysModule,
    InsightsModule,
    MembersModule,
    OrgsModule,
    ExportModule,
    InquiriesModule,
    NotificationsModule,
    BrokerageModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    BootstrapService,
  ],
})
export class AppModule {}
