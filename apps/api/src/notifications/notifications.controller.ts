import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { type NotificationListDto, type UnreadCountDto } from '@termsdesk/shared'

import { CurrentUser } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'

import { NotificationsService } from './notifications.service'

import type { AuthUser } from '../common/request-context'
import type { Response } from 'express'

/** 인앱 알림 — 본인 수신 알림만 열람·읽음 처리. */
@ApiTags('notifications')
@ApiBearerAuth('session')
@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: '내 알림 목록(unread=true 면 안 읽음만)' })
  async list(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string
  ): Promise<NotificationListDto> {
    const result = await this.notifications.list(user, {
      unread: unread === 'true' || unread === '1',
      limit: limit ? Number(limit) : undefined,
    })
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }

  @Get('unread-count')
  @ApiOperation({ summary: '안 읽음 알림 수' })
  async unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountDto> {
    return { count: await this.notifications.unreadCount(user) }
  }

  @Post('read-all')
  @ApiOperation({ summary: '모두 읽음 처리' })
  markAllRead(@CurrentUser() user: AuthUser): Promise<{ ok: true; updated: number }> {
    return this.notifications.markAllRead(user)
  }

  @Post(':id/read')
  @ApiOperation({ summary: '알림 1건 읽음 처리' })
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ ok: true }> {
    return this.notifications.markRead(user, id)
  }
}
