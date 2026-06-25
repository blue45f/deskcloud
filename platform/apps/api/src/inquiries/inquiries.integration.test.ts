import { submitInquirySchema } from '@desk/shared'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { DrizzleInquiryStore } from '../stores/drizzle-inquiry.store'

import { InquiriesService } from './inquiries.service'

import type { Database, DatabaseService } from '../db/database.service'
import type { SubmitInquiryInput } from '@desk/shared'

/** PGlite 인메모리 + 마이그레이션 → DrizzleInquiryStore + InquiriesService 스택. */
async function makeService(): Promise<InquiriesService> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return new InquiriesService(new DrizzleInquiryStore(dbs))
}

const base: SubmitInquiryInput = {
  category: 'partnership',
  title: '제휴 제안드립니다',
  body: '협업을 논의하고 싶습니다.',
  contactEmail: 'partner@example.com',
  authorName: '홍길동',
  originUrl: 'https://rotifolk.example/contact',
}

describe('submitInquirySchema (Zod)', () => {
  it('정상 입력 통과 + email 소문자화', () => {
    const parsed = submitInquirySchema.parse({ ...base, contactEmail: 'Partner@Example.com' })
    expect(parsed.category).toBe('partnership')
    expect(parsed.contactEmail).toBe('partner@example.com')
  })

  it('허니팟 website 가 비어있으면 통과, 채워지면 거부', () => {
    expect(submitInquirySchema.safeParse({ ...base, website: '' }).success).toBe(true)
    expect(submitInquirySchema.safeParse({ ...base, website: 'http://spam' }).success).toBe(false)
  })

  it('title/body 길이·category enum 검증', () => {
    expect(submitInquirySchema.safeParse({ ...base, title: '' }).success).toBe(false)
    expect(submitInquirySchema.safeParse({ ...base, body: 'x'.repeat(4001) }).success).toBe(false)
    expect(submitInquirySchema.safeParse({ ...base, category: 'nope' as never }).success).toBe(
      false
    )
  })

  it('선택 필드 없이도 통과(contactEmail/authorName/originUrl optional)', () => {
    const parsed = submitInquirySchema.parse({ category: 'bug', title: 'T', body: 'B' })
    expect(parsed.contactEmail).toBeUndefined()
  })
})

describe('InquiriesService (PGlite, Drizzle store)', () => {
  let service: InquiriesService

  beforeEach(async () => {
    service = await makeService()
  })

  it('submit → 공개 DTO 반환(회신 이메일 redact, 상태 new)', async () => {
    const res = await service.submit('rotifolk', base)
    expect(res.dropped).toBe(false)
    expect(res.inquiry).toBeDefined()
    expect(res.inquiry!.appId).toBe('rotifolk')
    expect(res.inquiry!.status).toBe('new')
    expect(res.inquiry!.authorName).toBe('홍길동')
    // 공개 DTO 에는 contactEmail/originUrl 키가 없어야 한다(redact).
    expect('contactEmail' in res.inquiry!).toBe(false)
    expect('originUrl' in res.inquiry!).toBe(false)
  })

  it('허니팟 채워지면 저장하지 않고 dropped=true', async () => {
    const res = await service.submit('rotifolk', { ...base, website: 'bot-filled' })
    expect(res.dropped).toBe(true)
    expect(res.inquiry).toBeUndefined()
    const list = await service.listPublic('rotifolk', {})
    expect(list.items).toHaveLength(0)
  })

  it('appId 정규화·검증 — 대문자 소문자화, 잘못된 형식 거부', async () => {
    const res = await service.submit('RotiFolk', base)
    expect(res.inquiry!.appId).toBe('rotifolk')
    await expect(service.submit('bad app!', base)).rejects.toThrow()
  })

  it('listPublic — 앱별 격리 + 최신순 + redact', async () => {
    await service.submit('rotifolk', { ...base, title: 'A' })
    await service.submit('rotifolk', { ...base, title: 'B' })
    await service.submit('offhours', { ...base, title: 'C' })

    const roti = await service.listPublic('rotifolk', {})
    expect(roti.appId).toBe('rotifolk')
    expect(roti.items).toHaveLength(2)
    expect(roti.total).toBe(2) // 앱별 전체 수(격리 반영)
    // 최신순(B 가 A 보다 뒤에 들어왔으므로 먼저).
    expect(roti.items[0]!.title).toBe('B')
    expect(roti.items.every((i) => !('contactEmail' in i))).toBe(true)

    const off = await service.listPublic('offhours', {})
    expect(off.items).toHaveLength(1)
    expect(off.total).toBe(1)
    expect(off.items[0]!.title).toBe('C')
  })

  it('listPublic — limit/offset 페이지네이션 + 50 캡', async () => {
    for (let i = 0; i < 5; i++) await service.submit('rotifolk', { ...base, title: `t${i}` })
    const page = await service.listPublic('rotifolk', { limit: 2, offset: 0 })
    expect(page.items).toHaveLength(2)
    expect(page.limit).toBe(2)
    expect(page.total).toBe(5) // 페이지(items)는 잘려도 total 은 전체 수
    const capped = await service.listPublic('rotifolk', { limit: 999 })
    expect(capped.limit).toBe(50)
  })

  it('listAdmin — 회신 이메일·출처 URL 포함 + status 필터', async () => {
    const created = await service.submit('rotifolk', base)
    await service.submit('rotifolk', { ...base, category: 'bug', title: 'bug report' })

    const all = await service.listAdmin('rotifolk', {})
    expect(all.items).toHaveLength(2)
    expect(all.items.some((i) => i.contactEmail === 'partner@example.com')).toBe(true)
    expect(all.items.some((i) => i.originUrl === 'https://rotifolk.example/contact')).toBe(true)
    expect(all.items.some((i) => i.originHost === 'rotifolk.example')).toBe(true)

    await service.setStatus('rotifolk', created.inquiry!.id, 'resolved')
    const resolved = await service.listAdmin('rotifolk', { status: 'resolved' })
    expect(resolved.items).toHaveLength(1)
    expect(resolved.items[0]!.status).toBe('resolved')
  })

  it('listAdmin — 서비스 도메인 originHost 로 문의 큐를 격리 조회', async () => {
    const first = await service.submit('rotifolk', {
      ...base,
      title: '프로덕션 도메인',
      originUrl: 'https://app.example.com/contact',
    })
    await service.submit('rotifolk', {
      ...base,
      title: '어드민 도메인',
      originUrl: 'https://admin.example.com/support',
    })
    await service.submit('rotifolk', {
      ...base,
      title: '포트 포함 도메인',
      originUrl: 'https://app.example.com:8443/contact',
    })

    await service.setStatus('rotifolk', first.inquiry!.id, 'resolved')

    const appDomain = await service.listAdmin('rotifolk', { originHost: 'app.example.com' })
    expect(appDomain.items.map((item) => item.title)).toEqual(['프로덕션 도메인'])
    expect(appDomain.items[0]!.originHost).toBe('app.example.com')

    const adminDomain = await service.listAdmin('rotifolk', {
      originHost: 'admin.example.com',
    })
    expect(adminDomain.items.map((item) => item.title)).toEqual(['어드민 도메인'])

    const appPort = await service.listAdmin('rotifolk', {
      originHost: 'app.example.com:8443',
    })
    expect(appPort.items.map((item) => item.title)).toEqual(['포트 포함 도메인'])

    const resolvedInAdmin = await service.listAdmin('rotifolk', {
      originHost: 'admin.example.com',
      status: 'resolved',
    })
    expect(resolvedInAdmin.items).toHaveLength(0)
  })

  it('setStatus — 상태 변경 반영, 다른 appId 의 문의는 갱신 안 됨(null)', async () => {
    const created = await service.submit('rotifolk', base)
    const ok = await service.setStatus('rotifolk', created.inquiry!.id, 'in_progress')
    expect(ok?.status).toBe('in_progress')

    // 같은 id 라도 appId 가 다르면 404(null).
    const wrongApp = await service.setStatus('offhours', created.inquiry!.id, 'closed')
    expect(wrongApp).toBeNull()
    // 존재하지 않는 id.
    const missing = await service.setStatus(
      'rotifolk',
      '00000000-0000-0000-0000-000000000000',
      'closed'
    )
    expect(missing).toBeNull()
  })
})
