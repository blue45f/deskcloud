import { PGlite } from '@electric-sql/pglite'
import { NotFoundException } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { TenantsService, type TenantRow } from '../tenants/tenants.service'

import { ReportsService } from './reports.service'

import type { Database, DatabaseService } from '../db/database.service'

async function setup(): Promise<{
  tenants: TenantsService
  reports: ReportsService
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const tenants = new TenantsService(dbs)
  const reports = new ReportsService(dbs)
  return { tenants, reports }
}

async function makeTenant(tenants: TenantsService): Promise<TenantRow> {
  const res = await tenants.createTenant({ name: 'T', corsOrigins: ['*'] })
  return (await tenants.findById(res.tenant.id))!
}

const base = { subjectType: 'comment', subjectId: 'c_1', reason: '신고 사유' } as const

describe('ReportsService (PGlite)', () => {
  let tenants: TenantsService
  let reports: ReportsService

  beforeEach(async () => {
    ;({ tenants, reports } = await setup())
  })

  it('접수는 항상 open 상태로 시작', async () => {
    const t = await makeTenant(tenants)
    const r = await reports.submitReport(t, { ...base })
    expect(r.status).toBe('open')
    expect(r.id).toBeTruthy()
  })

  it('상태 전이: open → reviewing → resolved', async () => {
    const t = await makeTenant(tenants)
    const r = await reports.submitReport(t, { ...base })

    let updated = await reports.updateReport(t, r.id, { status: 'reviewing' })
    expect(updated.status).toBe('reviewing')

    updated = await reports.updateReport(t, r.id, { status: 'resolved', notes: '처리 완료' })
    expect(updated.status).toBe('resolved')
    expect(updated.notes).toBe('처리 완료')
  })

  it('상태 전이: open → dismissed', async () => {
    const t = await makeTenant(tenants)
    const r = await reports.submitReport(t, { ...base })
    const updated = await reports.updateReport(t, r.id, { status: 'dismissed' })
    expect(updated.status).toBe('dismissed')
  })

  it('notes 만 갱신(상태 유지)', async () => {
    const t = await makeTenant(tenants)
    const r = await reports.submitReport(t, { ...base })
    const updated = await reports.updateReport(t, r.id, { notes: '메모만' })
    expect(updated.status).toBe('open')
    expect(updated.notes).toBe('메모만')
  })

  it('같은 상태로 재설정해도 무해(멱등)', async () => {
    const t = await makeTenant(tenants)
    const r = await reports.submitReport(t, { ...base })
    await reports.updateReport(t, r.id, { status: 'open' })
    const list = await reports.listReports(t, { status: 'open' })
    expect(list.total).toBe(1)
  })

  it('status 필터 목록', async () => {
    const t = await makeTenant(tenants)
    const a = await reports.submitReport(t, { ...base, subjectId: 'c_1' })
    await reports.submitReport(t, { ...base, subjectId: 'c_2' })
    await reports.updateReport(t, a.id, { status: 'resolved' })

    expect((await reports.listReports(t, { status: 'open' })).total).toBe(1)
    expect((await reports.listReports(t, { status: 'resolved' })).total).toBe(1)
    expect((await reports.listReports(t, {})).total).toBe(2)
  })

  it('subjectType 필터 목록', async () => {
    const t = await makeTenant(tenants)
    await reports.submitReport(t, { subjectType: 'comment', subjectId: 'c_1', reason: 'r' })
    await reports.submitReport(t, { subjectType: 'post', subjectId: 'p_1', reason: 'r' })
    expect((await reports.listReports(t, { subjectType: 'post' })).total).toBe(1)
  })

  it('페이지네이션(offset/limit)', async () => {
    const t = await makeTenant(tenants)
    for (let i = 0; i < 5; i += 1) {
      await reports.submitReport(t, { ...base, subjectId: `c_${i}` })
    }
    const page = await reports.listReports(t, { offset: 2, limit: 2 })
    expect(page.total).toBe(5)
    expect(page.items).toHaveLength(2)
    expect(page.offset).toBe(2)
  })

  it('타 테넌트 신고는 갱신 불가(404)', async () => {
    const t1 = await makeTenant(tenants)
    const t2 = await makeTenant(tenants)
    const r = await reports.submitReport(t1, { ...base })
    await expect(reports.updateReport(t2, r.id, { status: 'resolved' })).rejects.toBeInstanceOf(
      NotFoundException
    )
  })

  it('목록은 테넌트 격리 — 자기 신고만', async () => {
    const t1 = await makeTenant(tenants)
    const t2 = await makeTenant(tenants)
    await reports.submitReport(t1, { ...base })
    await reports.submitReport(t2, { ...base })
    expect((await reports.listReports(t1, {})).total).toBe(1)
    expect((await reports.listReports(t2, {})).total).toBe(1)
  })
})
