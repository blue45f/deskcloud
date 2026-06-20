import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { HttpException } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AuditService } from '../common/audit.service'
import { randomUUID } from '../common/crypto'
import { DatabaseService } from '../db/database.service'
import { inquiries, organizations } from '../db/schema'

import { InquiriesService } from './inquiries.service'

import type { AuthUser } from '../common/request-context'
import type { AppConfig } from '../config'
import type { CreateInquiryInput } from '@termsdesk/shared'

const baseConfig = (dir: string): AppConfig => ({
  mode: 'saas',
  port: 0,
  webOrigin: 'http://localhost',
  databaseUrl: null,
  pgliteDir: dir,
  jwtSecret: 'test',
  seedAdminEmail: 'admin@example.com',
  seedAdminPassword: 'password',
  publicCacheTtl: 60,
  allowSignup: true,
  googleClientId: null,
  allowDemo: false,
  inquiryAllowedOrigins: [],
})

const validInput = (over: Partial<CreateInquiryInput> = {}): CreateInquiryInput => ({
  category: 'contact',
  title: '입점 문의드립니다',
  body: '병원 정보 등록 절차가 궁금합니다. 안내 부탁드립니다.',
  ...over,
})

const userOf = (orgId: string): AuthUser => ({
  userId: randomUUID(),
  orgId,
  role: 'owner',
  name: '운영자',
  email: 'op@example.com',
})

describe('InquiriesService', () => {
  let dir: string
  let dbs: DatabaseService
  let audit: AuditService
  let service: InquiriesService

  const insertOrg = async (name: string, slug: string, createdAt: Date) => {
    const [row] = await dbs.db.insert(organizations).values({ name, slug, createdAt }).returning()
    return row!
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-inquiries-'))
    dbs = new DatabaseService(baseConfig(dir))
    await dbs.onModuleInit()
    audit = new AuditService(dbs)
    service = new InquiriesService(dbs, audit, baseConfig(dir))
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('카탈로그 사이트는 org 없이 접수되고, DB 조직 slug 는 org_id 가 연결된다', async () => {
    const org = await insertOrg('Acme', 'acme', new Date('2026-01-01T00:00:00Z'))

    const catalogReceipt = await service.submit('Pettography', validInput(), { ip: '1.1.1.1' })
    expect(catalogReceipt.siteSlug).toBe('pettography')
    expect(catalogReceipt.status).toBe('new')

    const orgReceipt = await service.submit('acme', validInput({ title: '조직 문의입니다' }), {
      ip: '1.1.1.2',
    })
    const rows = await dbs.db.select().from(inquiries)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.id === catalogReceipt.id)?.orgId).toBeNull()
    expect(rows.find((r) => r.id === orgReceipt.id)?.orgId).toBe(org.id)
  })

  it('미지 slug·예약어는 404 로 거부한다', async () => {
    await expect(service.submit('unknown-site', validInput(), { ip: '1.1.1.1' })).rejects.toThrow(
      '접수할 수 없는 사이트'
    )
    await expect(service.submit('support', validInput(), { ip: '1.1.1.1' })).rejects.toThrow(
      '접수할 수 없는 사이트'
    )
  })

  it('허니팟(website)이 채워지면 저장 없이 가짜 영수증만 돌려준다', async () => {
    const receipt = await service.submit(
      'pettography',
      validInput({ website: 'http://spam.example' }),
      { ip: '2.2.2.2' }
    )
    expect(receipt.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(receipt.siteSlug).toBe('pettography')
    const rows = await dbs.db.select().from(inquiries)
    expect(rows).toHaveLength(0)
  })

  it('Origin 허용 목록이 있으면 목록 밖 Origin 은 403, 헤더 없음은 통과한다', async () => {
    const strict = new InquiriesService(dbs, audit, {
      ...baseConfig(dir),
      inquiryAllowedOrigins: ['https://pettography.vercel.app'],
    })
    await expect(
      strict.submit('pettography', validInput(), { ip: '3.3.3.3', origin: 'https://evil.example' })
    ).rejects.toThrow('허용되지 않은 출처')
    await expect(
      strict.submit('pettography', validInput({ title: '허용 출처 문의' }), {
        ip: '3.3.3.4',
        origin: 'https://pettography.vercel.app/',
      })
    ).resolves.toMatchObject({ siteSlug: 'pettography' })
    await expect(
      strict.submit('pettography', validInput({ title: '헤더 없는 문의' }), { ip: '3.3.3.5' })
    ).resolves.toMatchObject({ siteSlug: 'pettography' })
  })

  it('같은 ip 가 1분에 5건을 넘기면 429', async () => {
    for (let i = 0; i < 5; i += 1) {
      await service.submit('pettography', validInput({ title: `서로 다른 문의 ${i}` }), {
        ip: '4.4.4.4',
      })
    }
    await expect(
      service.submit('pettography', validInput({ title: '여섯 번째 문의' }), { ip: '4.4.4.4' })
    ).rejects.toSatisfy((e) => e instanceof HttpException && e.getStatus() === 429)
  })

  it('10분 내 같은 site+ip+제목+본문은 429(중복)로 거부한다', async () => {
    await service.submit('pettography', validInput(), { ip: '5.5.5.5' })
    await expect(service.submit('pettography', validInput(), { ip: '5.5.5.5' })).rejects.toSatisfy(
      (e) => e instanceof HttpException && e.getStatus() === 429
    )
  })

  it('상태 변경은 부분 갱신 + 감사 로그를 남긴다', async () => {
    const org = await insertOrg('Acme', 'acme', new Date('2026-01-01T00:00:00Z'))
    const user = userOf(org.id)
    const receipt = await service.submit('pettography', validInput(), { ip: '6.6.6.6' })

    const updated = await service.update(user, receipt.id, {
      status: 'in_progress',
      adminNote: '담당 배정 완료',
    })
    expect(updated.status).toBe('in_progress')
    expect(updated.adminNote).toBe('담당 배정 완료')
    expect(updated.title).toBe('입점 문의드립니다')

    const events = await audit.list(org.id)
    const event = events.find((e) => e.action === 'inquiry.updated')
    expect(event?.targetId).toBe(receipt.id)
    expect(event?.summary).toContain('상태 new → in_progress')
  })

  it('가시성: 기본(첫) 조직은 전체, 그 외 조직은 자기 slug 의 문의만 본다', async () => {
    const first = await insertOrg('Acme', 'acme', new Date('2026-01-01T00:00:00Z'))
    const second = await insertOrg('Pilot Co', 'pilot-co', new Date('2026-01-02T00:00:00Z'))

    const catalogReceipt = await service.submit('pettography', validInput(), { ip: '7.7.7.1' })
    await service.submit('pilot-co', validInput({ title: '파일럿 조직 문의' }), { ip: '7.7.7.2' })

    const operatorView = await service.list(userOf(first.id))
    expect(operatorView.total).toBe(2)
    expect(operatorView.items.map((i) => i.siteSlug).sort()).toEqual(['pettography', 'pilot-co'])

    const tenantView = await service.list(userOf(second.id))
    expect(tenantView.total).toBe(1)
    expect(tenantView.items[0]?.siteSlug).toBe('pilot-co')

    // 스코프 밖 단건은 존재를 드러내지 않는 404.
    await expect(service.getOne(userOf(second.id), catalogReceipt.id)).rejects.toThrow(
      '문의를 찾을 수 없습니다'
    )
    await expect(service.getOne(userOf(first.id), catalogReceipt.id)).resolves.toMatchObject({
      id: catalogReceipt.id,
    })
  })

  it('목록 필터(status·category)와 limit 캡이 동작한다', async () => {
    const org = await insertOrg('Acme', 'acme', new Date('2026-01-01T00:00:00Z'))
    const user = userOf(org.id)
    await service.submit('pettography', validInput({ category: 'bug', title: '버그 신고합니다' }), {
      ip: '8.8.8.1',
    })
    const target = await service.submit('pettography', validInput(), { ip: '8.8.8.2' })
    await service.update(user, target.id, { status: 'closed' })

    const closed = await service.list(user, { status: 'closed' })
    expect(closed.total).toBe(1)
    expect(closed.items[0]?.id).toBe(target.id)

    const bugs = await service.list(user, { category: 'bug' })
    expect(bugs.total).toBe(1)
    expect(bugs.items[0]?.category).toBe('bug')

    const capped = await service.list(user, { limit: '999' })
    expect(capped.items.length).toBeLessThanOrEqual(100)
    await expect(service.list(user, { status: 'nope' })).rejects.toThrow('status 값')
  })
})
