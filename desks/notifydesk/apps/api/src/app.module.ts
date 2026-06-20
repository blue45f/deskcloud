import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { BootstrapService } from './bootstrap.service'
import { ChannelsModule } from './channels/channels.module'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { CoreModule } from './core/core.module'
import { HealthModule } from './health/health.module'
import { InboxModule } from './inbox/inbox.module'
import { NotificationsModule } from './notifications/notifications.module'
import { PreferencesModule } from './preferences/preferences.module'
import { TenantsModule } from './tenants/tenants.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 240 }]),
    CoreModule,
    TenantsModule,
    ChannelsModule,
    InboxModule,
    PreferencesModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    BootstrapService,
  ],
})
export class AppModule {}
