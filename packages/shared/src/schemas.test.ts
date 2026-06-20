import { describe, expect, it } from 'vitest'

import {
  createConversationSchema,
  issueMemberTokenSchema,
  memberIdSchema,
  messageHistoryQuerySchema,
  readReceiptSchema,
  sendMessageSchema,
} from './schemas'

describe('memberIdSchema', () => {
  it('영숫자·:·_·-·.·@ 허용, 공백/한글 거부', () => {
    expect(memberIdSchema.safeParse('user_42').success).toBe(true)
    expect(memberIdSchema.safeParse('alice@host.app').success).toBe(true)
    expect(memberIdSchema.safeParse('has space').success).toBe(false)
    expect(memberIdSchema.safeParse('').success).toBe(false)
  })
})

describe('createConversationSchema', () => {
  it('DM 은 멤버 최대 2명', () => {
    expect(createConversationSchema.safeParse({ kind: 'dm', memberIds: ['a', 'b'] }).success).toBe(
      true
    )
    expect(
      createConversationSchema.safeParse({ kind: 'dm', memberIds: ['a', 'b', 'c'] }).success
    ).toBe(false)
  })

  it('group 은 멤버 1명 이상 + 제목 선택', () => {
    const r = createConversationSchema.safeParse({
      kind: 'group',
      title: '팀 채널',
      memberIds: ['a', 'b', 'c'],
    })
    expect(r.success).toBe(true)
  })

  it('멤버가 없으면 거부', () => {
    expect(createConversationSchema.safeParse({ kind: 'group', memberIds: [] }).success).toBe(false)
  })
})

describe('sendMessageSchema', () => {
  it('본문이 있으면 통과', () => {
    expect(sendMessageSchema.safeParse({ senderMemberId: 'a', body: '안녕' }).success).toBe(true)
  })

  it('본문이 비고 첨부도 없으면 거부', () => {
    expect(sendMessageSchema.safeParse({ senderMemberId: 'a', body: '   ' }).success).toBe(false)
  })

  it('본문이 비어도 첨부가 있으면 통과', () => {
    const r = sendMessageSchema.safeParse({
      senderMemberId: 'a',
      body: '',
      attachments: [{ name: 'file.png', url: 'https://cdn.example/file.png' }],
    })
    expect(r.success).toBe(true)
  })
})

describe('readReceiptSchema', () => {
  it('lastReadMessageId 는 선택(생략 시 최신까지)', () => {
    expect(readReceiptSchema.safeParse({ memberId: 'a' }).success).toBe(true)
  })
})

describe('messageHistoryQuerySchema', () => {
  it('limit 은 문자열에서 강제 변환', () => {
    const r = messageHistoryQuerySchema.safeParse({ memberId: 'a', limit: '20' })
    expect(r.success).toBe(true)
    expect(r.success && r.data.limit).toBe(20)
  })
})

describe('issueMemberTokenSchema', () => {
  it('ttlSec 기본값 적용', () => {
    const r = issueMemberTokenSchema.safeParse({ memberId: 'a' })
    expect(r.success && r.data.ttlSec).toBe(3600)
  })
})
