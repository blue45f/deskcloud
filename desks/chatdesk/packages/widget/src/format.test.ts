import { describe, expect, it } from 'vitest'

import { conversationName, dayLabel, previewText, sameDate, shortTime } from './format'

import type { ConversationListItemDto, MessageDto } from '@chatdesk/shared'

function conv(over: Partial<ConversationListItemDto>): ConversationListItemDto {
  return {
    id: 'c1',
    tenantId: 't1',
    kind: 'dm',
    title: null,
    memberIds: ['alice', 'bob'],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastMessage: null,
    unreadCount: 0,
    ...over,
  }
}

function msg(over: Partial<MessageDto>): MessageDto {
  return {
    id: 'm1',
    tenantId: 't1',
    conversationId: 'c1',
    senderMemberId: 'bob',
    body: 'hi',
    attachments: [],
    system: false,
    deleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('conversationName', () => {
  it('DM 은 상대 멤버(나 제외)를 보여준다', () => {
    expect(conversationName(conv({ memberIds: ['alice', 'bob'] }), 'alice')).toBe('bob')
  })

  it('group 은 title 우선, 없으면 멤버 요약', () => {
    expect(conversationName(conv({ kind: 'group', title: '팀 채널' }), 'alice')).toBe('팀 채널')
    expect(
      conversationName(conv({ kind: 'group', title: null, memberIds: ['alice', 'bob', 'carol'] }), 'alice')
    ).toBe('bob, carol')
  })

  it('group 멤버가 많으면 외 N명', () => {
    const name = conversationName(
      conv({ kind: 'group', title: null, memberIds: ['me', 'a', 'b', 'c', 'd', 'e'] }),
      'me'
    )
    expect(name).toBe('a, b, c 외 2명')
  })
})

describe('previewText', () => {
  it('메시지 없음 / 삭제 / 첨부 / 본문', () => {
    expect(previewText(conv({ lastMessage: null }))).toBe('아직 메시지가 없습니다')
    expect(previewText(conv({ lastMessage: msg({ deleted: true, body: '' }) }))).toBe('삭제된 메시지')
    expect(previewText(conv({ lastMessage: msg({ body: '안녕' }) }))).toBe('안녕')
    expect(
      previewText(
        conv({ lastMessage: msg({ body: '', attachments: [{ name: 'a.png', url: 'http://x/a' }] }) })
      )
    ).toBe('첨부 1개')
  })
})

describe('time helpers', () => {
  it('shortTime 은 오늘은 시각, 어제는 어제(로컬 기준)', () => {
    const now = new Date(2026, 5, 15, 12, 0, 0)
    expect(shortTime(new Date(2026, 5, 14, 9, 0, 0).toISOString(), now)).toBe('어제')
    expect(shortTime(new Date(2026, 5, 10, 9, 0, 0).toISOString(), now)).toBe('6/10')
  })

  it('dayLabel 은 오늘/어제 라벨(로컬 기준)', () => {
    const now = new Date(2026, 5, 15, 12, 0, 0)
    expect(dayLabel(new Date(2026, 5, 15, 1, 0, 0).toISOString(), now)).toBe('오늘')
    expect(dayLabel(new Date(2026, 5, 14, 1, 0, 0).toISOString(), now)).toBe('어제')
  })

  it('sameDate 는 같은 날 판정(로컬 타임존 기준)', () => {
    // 타임존 의존을 피하려고 로컬 날짜/시각 문자열을 쓴다(Date 가 로컬로 해석).
    const a = new Date(2026, 5, 15, 1, 0, 0).toISOString()
    const b = new Date(2026, 5, 15, 23, 0, 0).toISOString()
    const c = new Date(2026, 5, 16, 1, 0, 0).toISOString()
    expect(sameDate(a, b)).toBe(true)
    expect(sameDate(a, c)).toBe(false)
  })
})
