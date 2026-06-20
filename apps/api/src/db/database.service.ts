import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'

import { APP_CONFIG, type AppConfig } from '../config'

import { MIGRATIONS } from './migrations'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>
export type DbKind = 'postgres' | 'pglite'

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Database')
  db!: Database
  kind!: DbKind
  private pgPool: { query: (sql: string) => Promise<unknown>; end: () => Promise<void> } | null = null
  private pglite: { exec: (sql: string) => Promise<unknown>; close?: () => Promise<void> } | null = null

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  async onModuleInit(): Promise<void> {
    if (this.cfg.databaseUrl) {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: this.cfg.databaseUrl })
      this.pgPool = pool as unknown as typeof this.pgPool
      this.db = drizzlePg(pool, { schema })
      this.kind = 'postgres'
    } else {
      const { mkdirSync } = await import('node:fs')
      mkdirSync(this.cfg.pgliteDir, { recursive: true })
      const { PGlite } = await import('@electric-sql/pglite')
      const client = await PGlite.create(this.cfg.pgliteDir)
      this.pglite = client as unknown as typeof this.pglite
      const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite')
      this.db = drizzlePglite(client, { schema }) as unknown as Database
      this.kind = 'pglite'
    }
    await this.migrate()
    this.logger.log(`데이터베이스 준비 완료 (${this.kind})`)
  }

  /** 멀티스테이트먼트 raw SQL 실행 (드라이버별 네이티브 경로). */
  async execRaw(rawSql: string): Promise<void> {
    if (this.kind === 'postgres') {
      await this.pgPool!.query(rawSql)
    } else {
      await this.pglite!.exec(rawSql)
    }
  }

  private async migrate(): Promise<void> {
    await this.execRaw(
      `CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());`
    )
    const res = (await this.db.execute(sql`SELECT name FROM _migrations`)) as unknown as {
      rows?: { name: string }[]
    }
    const rows = res.rows ?? (res as unknown as { name: string }[])
    const applied = new Set((Array.isArray(rows) ? rows : []).map((r) => r.name))
    for (const m of MIGRATIONS) {
      if (applied.has(m.name)) continue
      this.logger.log(`마이그레이션 적용: ${m.name}`)
      await this.execRaw(m.sql)
      await this.db.execute(sql`INSERT INTO _migrations (name) VALUES (${m.name})`)
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pgPool?.end()
    await this.pglite?.close?.()
  }
}
