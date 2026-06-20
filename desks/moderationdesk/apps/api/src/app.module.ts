import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { BootstrapService } from './bootstrap.service'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { CoreModule } from './core/core.module'
import { HealthModule } from './health/health.module'
import { LogsModule } from './logs/logs.module'
import { ModerationModule } from './moderation/moderation.module'
import { ReportsModule } from './reports/reports.module'
import { RulesModule } from './rules/rules.module'
import { StatsModule } from './stats/stats.module'
import { TenantsModule } from './tenants/tenants.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 240 }]),
    CoreModule,
    TenantsModule,
    ModerationModule,
    RulesModule,
    ReportsModule,
    LogsModule,
    StatsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    BootstrapService,
  ],
})
export class AppModule {}
