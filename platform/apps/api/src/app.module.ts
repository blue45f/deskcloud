import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { BillingModule } from './billing/billing.module'
import { BootstrapService } from './bootstrap.service'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { CoreModule } from './core/core.module'
import { FavoritesModule } from './favorites/favorites.module'
import { HealthModule } from './health/health.module'
import { InquiriesModule } from './inquiries/inquiries.module'
import { TenantsModule } from './tenants/tenants.module'
import { VisitsModule } from './visits/visits.module'
import { WorkspaceDesksModule } from './workspace-desks/workspace-desks.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    CoreModule,
    TenantsModule,
    BillingModule,
    InquiriesModule,
    FavoritesModule,
    VisitsModule,
    WorkspaceDesksModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    BootstrapService,
  ],
})
export class AppModule {}
