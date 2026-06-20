import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  channelSchema,
  historyQuerySchema,
  publishSchema,
  type HistoryDto,
  type PublishInput,
  type PublishResultDto,
} from "@realtimedesk/shared";

import { ZodValidationPipe } from "../common/zod.pipe";
import { PublishableKeyGuard } from "../tenants/publishable-key.guard";
import { SecretKeyGuard } from "../tenants/secret-key.guard";
import { TenantsService } from "../tenants/tenants.service";

import { RealtimeService } from "./realtime.service";

import type { AuthedRequest } from "../admin/admin-token.guard";

/** 서버 publish(sk) — 채널로 브로드캐스트 + (history 활성 시) 영속화. */
@ApiTags("publish (secret)")
@ApiHeader({
  name: "X-Realtime-Key",
  required: true,
  description: "secret 키(sk_…)",
})
@Controller("publish")
@UseGuards(SecretKeyGuard)
export class PublishController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly tenants: TenantsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "publish — {channel,event,data} 를 구독자에게 전달하고 영속화",
  })
  @HttpCode(200)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async publish(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(publishSchema)) body: PublishInput,
  ): Promise<PublishResultDto> {
    const tenant = req.tenant!;
    // free cap 강제 — 월간 메시지 상한 초과 시 429(Too Many Requests)로 거부.
    const allowed = await this.tenants.tryConsumeMessage(tenant.id, 1);
    if (!allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "메시지 사용량 상한을 초과했습니다",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.realtime.publish(tenant.id, body);
  }
}

/** 채널 history(pk) — 브라우저가 publishable 키 + Origin 으로 최근 N개를 읽는다. */
@ApiTags("channels (publishable)")
@ApiHeader({
  name: "X-Realtime-Key",
  required: true,
  description: "publishable 키(pk_…)",
})
@Controller("channels")
@UseGuards(PublishableKeyGuard)
export class ChannelsController {
  constructor(private readonly realtime: RealtimeService) {}

  @Get(":channel/history")
  @ApiParam({ name: "channel", example: "room:42" })
  @ApiOperation({
    summary: "채널 최근 N개 메시지(오래된→최신). history 비활성이면 빈 배열",
  })
  async history(
    @Req() req: AuthedRequest,
    @Param("channel") channelRaw: string,
    @Query(new ZodValidationPipe(historyQuerySchema)) query: { limit?: number },
  ): Promise<HistoryDto> {
    const tenant = req.tenant!;
    const channel = channelSchema.parse(channelRaw);
    const items = await this.realtime.history(tenant.id, channel, query.limit);
    return { channel, items };
  }
}
