import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { BootstrapService } from './bootstrap.service'
import { ChatModule } from './chat/chat.module'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { ConversationsModule } from './conversations/conversations.module'
import { CoreModule } from './core/core.module'
import { HealthModule } from './health/health.module'
import { TenantsModule } from './tenants/tenants.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 240 }]),
    CoreModule,
    TenantsModule,
    ConversationsModule,
    ChatModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    BootstrapService,
  ],
})
export class AppModule {}
