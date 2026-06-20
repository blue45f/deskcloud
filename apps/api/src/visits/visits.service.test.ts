import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadConfig, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'

import { VisitsService } from './visits.service'

describe('VisitsService (PGlite)', () => {
  let tmp: string
  let dbs: DatabaseService
  let visits: VisitsService
  let cfg: AppConfig

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'mediadesk-visits-'))
    process.env.DATABASE_URL = ''
    process.env.PGLITE_DIR = join(tmp, 'pg')
    cfg = loadConfig()

    dbs = new DatabaseService(cfg)
    await dbs.onModuleInit()
    visits = new VisitsService(dbs)
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('집계 시작 전에는 모든 합계가 0이고 trafficSince=null', async () => {
    const totals = await visits.totals()
    expect(totals.totalTraffic).toBe(0)
    expect(totals.todayVisitors).toBe(0)
    expect(totals.todayHits).toBe(0)
    expect(totals.trafficSince).toBeNull()
  })

  it('hits 는 매 핑마다 +1, visitors 는 newToday 일 때만 +1', async () => {
    await visits.recordVisit(true) // 첫 방문 — 고유 방문자 +1
    await visits.recordVisit(false) // 같은 방문자 재방문 — hits 만 +1
    await visits.recordVisit(false)

    const totals = await visits.totals()
    expect(totals.totalTraffic).toBe(3) // hits 합계
    expect(totals.todayHits).toBe(3)
    expect(totals.todayVisitors).toBe(1) // 고유 방문자 1
    expect(totals.trafficSince).not.toBeNull()
    // 집계 시작일은 오늘(서버 TZ)의 ISO date.
    expect(totals.trafficSince).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('여러 고유 방문자는 visitors 를 누적한다', async () => {
    await visits.recordVisit(true)
    await visits.recordVisit(true)
    const totals = await visits.totals()
    expect(totals.todayVisitors).toBe(2)
    expect(totals.todayHits).toBe(2)
    expect(totals.totalTraffic).toBe(2)
  })
})
