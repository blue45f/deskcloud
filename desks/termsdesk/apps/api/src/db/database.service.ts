import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'

import { APP_CONFIG, type AppConfig } from '../config'

import { MIGRATIONS } from './migrations'
import * as schema from './schema'

import type { Pool, PoolConfig } from 'pg'

export type Database = NodePgDatabase<typeof schema>
export type DbKind = 'postgres' | 'pglite'

type RetryablePool = Omit<Pool, 'query'> & { query: (...args: unknown[]) => unknown }
type ErrorWithCause = {
  cause?: unknown
  code?: unknown
  errors?: unknown
  message?: unknown
}

const POSTGRES_POOL_CONFIG: Pick<
  PoolConfig,
  'connectionTimeoutMillis' | 'idleTimeoutMillis' | 'keepAlive' | 'max'
> = {
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
  max: 5,
}
const POSTGRES_QUERY_RETRIES = 1
const POSTGRES_RETRY_DELAY_MS = 200
const TRANSIENT_POSTGRES_CODES = [
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
] as const
const TRANSIENT_POSTGRES_CODE_SET = new Set<string>(TRANSIENT_POSTGRES_CODES)

export function isTransientPostgresError(error: unknown): boolean {
  const seen = new Set<unknown>()
  const pending: unknown[] = [error]
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || seen.has(current)) continue
    seen.add(current)
    if (typeof current !== 'object') continue
    const err = current as ErrorWithCause
    if (typeof err.code === 'string' && TRANSIENT_POSTGRES_CODE_SET.has(err.code)) return true
    const message = err.message
    if (
      typeof message === 'string' &&
      TRANSIENT_POSTGRES_CODES.some((code) => message.includes(code))
    ) {
      return true
    }
    if (err.cause) pending.push(err.cause)
    if (Array.isArray(err.errors)) pending.push(...err.errors)
  }
  return false
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Database')
  db!: Database
  kind!: DbKind
  private pgPool: Pool | null = null
  private pglite: { exec: (sql: string) => Promise<unknown>; close?: () => Promise<void> } | null =
    null

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  async onModuleInit(): Promise<void> {
    if (this.cfg.databaseUrl) {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: this.cfg.databaseUrl, ...POSTGRES_POOL_CONFIG })
      this.installPostgresRetry(pool)
      pool.on('error', (error: unknown) => {
        this.logger.warn(`Postgres idle client error: ${this.errorMessage(error)}`)
      })
      this.pgPool = pool
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

  private installPostgresRetry(pool: Pool): void {
    const retryablePool = pool as unknown as RetryablePool
    const query = retryablePool.query.bind(pool)
    retryablePool.query = (...args: unknown[]) => {
      if (typeof args.at(-1) === 'function') return query(...args)
      return this.queryPostgresWithRetry(query, args)
    }
  }

  private async queryPostgresWithRetry(
    query: (...args: unknown[]) => unknown,
    args: unknown[]
  ): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await query(...args)
      } catch (error) {
        if (attempt >= POSTGRES_QUERY_RETRIES || !isTransientPostgresError(error)) throw error
        this.logger.warn(
          `Postgres transient query error; retrying once: ${this.errorMessage(error)}`
        )
        await wait(POSTGRES_RETRY_DELAY_MS)
      }
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
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
