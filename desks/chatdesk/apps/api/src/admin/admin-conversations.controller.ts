import {
  adminMessageHistoryQuerySchema,
  systemMessageSchema,
  type AdminMessageHistoryQueryInput,
  type ConversationDto,
  type DeleteMessageResultDto,
  type MessageHistoryDto,
  type SendResultDto,
  type SystemMessageInput,
} from '@chatdesk/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'

import { ZodValidationPipe } from '../common/zod.pipe'
import { ConversationsService } from '../conversations/conversations.service'

import { AdminGuard, type AuthedRequest } from './admin-token.guard'

/**
 * 어드민(테넌트 self-service) — 대화 목록·시스템 발송·모더레이션(삭제).
 * secret 키 또는 전역 X-Admin-Token 으로 통과. 테넌트 식별엔 sk 가 필요(전역 토큰만이면 401).
 */
@ApiTags('admin (conversations)')
@ApiHeader({ name: 'X-Chat-Key', required: false, description: 'secret 키(sk_…) — 테넌트 식별' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '전역 어드민 토큰' })
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  /** AdminGuard 가 sk 로 통과시켰으면 req.tenant 가 있다. 없으면(전역 토큰만) 401. */
  private requireTenantId(req: AuthedRequest): string {
    if (req.tenant) return req.tenant.id
    throw new UnauthorizedException('테넌트 식별을 위해 secret 키(X-Chat-Key: sk_…)가 필요합니다')
  }

  @Get('conversations')
  @ApiOperation({ summary: '테넌트의 모든 대화(최신순)' })
  listConversations(@Req() req: AuthedRequest): Promise<ConversationDto[]> {
    return this.conversations.listAll(this.requireTenantId(req))
  }

  @Get('conversations/:id/messages')
  @ApiParam({ name: 'id', description: '대화 id(uuid)' })
  @ApiOperation({ summary: '대화 메시지 히스토리(모니터) — ?before=&limit= (멤버십 무관)' })
  messages(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(adminMessageHistoryQuerySchema))
    query: AdminMessageHistoryQueryInput
  ): Promise<MessageHistoryDto> {
    return this.conversations.adminHistory(this.requireTenantId(req), id, query)
  }

  @Post('conversations/:id/system-message')
  @HttpCode(201)
  @ApiParam({ name: 'id', description: '대화 id(uuid)' })
  @ApiOperation({ summary: '시스템 발송 — 발신자 없는 공지/자동화 메시지. WS 브로드캐스트' })
  systemSend(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(systemMessageSchema)) body: SystemMessageInput
  ): Promise<SendResultDto> {
    return this.conversations.systemSend(this.requireTenantId(req), id, body)
  }

  @Delete('messages/:id')
  @ApiParam({ name: 'id', description: '메시지 id(uuid)' })
  @ApiOperation({ summary: '모더레이션 — 메시지 soft delete. WS 통지' })
  deleteMessage(
    @Req() req: AuthedRequest,
    @Param('id') id: string
  ): Promise<DeleteMessageResultDto> {
    return this.conversations.deleteMessage(this.requireTenantId(req), id)
  }

  @Post('messages/:id/restore')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: '메시지 id(uuid)' })
  @ApiOperation({ summary: '모더레이션 취소 — soft delete 된 메시지 복원. WS 통지' })
  restoreMessage(
    @Req() req: AuthedRequest,
    @Param('id') id: string
  ): Promise<DeleteMessageResultDto> {
    return this.conversations.restoreMessage(this.requireTenantId(req), id)
  }
}
