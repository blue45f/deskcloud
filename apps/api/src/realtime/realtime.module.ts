import { Module } from "@nestjs/common";

import { TenantsModule } from "../tenants/tenants.module";

import { ChannelsController, PublishController } from "./publish.controller";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";

/**
 * 실시간 도메인 — publish(sk)·history(pk) REST + socket.io 게이트웨이.
 * PresenceService 는 CoreModule(전역)에서 제공된다.
 */
@Module({
  imports: [TenantsModule],
  controllers: [PublishController, ChannelsController],
  providers: [RealtimeService, RealtimeGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}
