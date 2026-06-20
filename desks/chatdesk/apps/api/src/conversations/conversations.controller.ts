import {
  createConversationSchema,
  messageHistoryQuerySchema,
  myConversationsQuerySchema,
  readReceiptSchema,
  sendMessageSchema,
  type ConversationDto,
  type CreateConversationInput,
  type MessageHistoryDto,
  type MessageHistoryQueryInput,
  type MyConversationsDto,
  type MyConversationsQueryInput,
  type ReadReceiptInput,
  type ReadResultDto,
  type SendMessageInput,
  type SendResultDto,
} from '@chatdesk/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'
import { AnyKeyGuard } from '../tenants/any-key.guard'
import { PublishableKeyGuard } from '../tenants/publishable-key.guard'

import { ConversationsService } from './conversations.service'

import type { AuthedRequest } from '../admin/admin-token.guard'

/**
 * 대화·메시지(브라우저 pk / 서버 sk).
 * - 생성: pk 또는 sk (AnyKeyGuard)
 * - 목록·히스토리·발송·읽음: pk(+Origin) + 멤버 범위 (PublishableKeyGuard, 서비스가 멤버십 강제)
 */
@ApiTags('conversations')
@ApiHeader({ name: 'X-Chat-Key', required: true, description: 'pk_… (브라우저) 또는 sk_… (서버)' })
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(AnyKeyGuard)
  @ApiOperation({ summary: '대화 생성 — DM(멤버쌍 dedupe) 또는 group. pk 또는 sk' })
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createConversationSchema)) body: CreateConversationInput
  ): Promise<ConversationDto> {
    return this.conversations.create(req.tenant!.id, body)
  }

  @Get()
  @UseGuards(PublishableKeyGuard)
  @ApiOperation({ summary: '내 대화 목록 + unread — ?memberId= (pk, 멤버 범위)' })
  myConversations(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(myConversationsQuerySchema)) query: MyConversationsQueryInput
  ): Promise<MyConversationsDto> {
    return this.conversations.myConversations(req.tenant!.id, query.memberId)
  }

  @Get(':id/messages')
  @UseGuards(PublishableKeyGuard)
  @ApiParam({ name: 'id', description: '대화 id(uuid)' })
  @ApiOperation({ summary: '메시지 히스토리 — ?memberId=&before=&limit= (pk, 멤버 범위)' })
  history(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(messageHistoryQuerySchema)) query: MessageHistoryQueryInput
  ): Promise<MessageHistoryDto> {
    return this.conversations.history(req.tenant!.id, id, query)
  }

  @Post(':id/messages')
  @HttpCode(201)
  @UseGuards(PublishableKeyGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiParam({ name: 'id', description: '대화 id(uuid)' })
  @ApiOperation({
    summary: '메시지 발송 — senderMemberId (pk, 멤버 범위). WS 브로드캐스트 + 영속화',
  })
  send(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput
  ): Promise<SendResultDto> {
    return this.conversations.send(req.tenant!.id, id, body)
  }

  @Post(':id/read')
  @HttpCode(200)
  @UseGuards(PublishableKeyGuard)
  @ApiParam({ name: 'id', description: '대화 id(uuid)' })
  @ApiOperation({ summary: '읽음 리시트 — memberId(+lastReadMessageId) (pk). unread 갱신' })
  read(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(readReceiptSchema)) body: ReadReceiptInput
  ): Promise<ReadResultDto> {
    return this.conversations.read(req.tenant!.id, id, body.memberId, body.lastReadMessageId)
  }
}
