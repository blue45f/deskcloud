import { BadRequestException, Injectable } from '@nestjs/common'
import {
  createSupportPostSchema,
  slugSchema,
  supportCategories,
  type CreateSupportPostInput,
  type SupportCategory,
  type SupportPostDto,
  type SupportPostListDto,
} from '@termsdesk/shared'
import { and, desc, eq } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { supportPosts } from '../db/schema'

type SupportPostRow = typeof supportPosts.$inferSelect

function badRequestFromIssues(issues: { path: PropertyKey[]; message: string }[]) {
  return new BadRequestException(
    issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
  )
}

function normalizeProjectSlug(value: string): string {
  const parsed = slugSchema.safeParse(value.trim().toLowerCase())
  if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
  return parsed.data
}

function normalizeCategory(value: unknown): SupportCategory | undefined {
  if (value == null || value === '' || value === 'all') return undefined
  if (typeof value === 'string' && supportCategories.includes(value as SupportCategory)) {
    return value as SupportCategory
  }
  throw new BadRequestException('지원 게시판 category 값이 올바르지 않습니다')
}

function normalizeLimit(value: unknown): number {
  const raw = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 20
  if (!Number.isFinite(raw)) return 20
  return Math.min(Math.max(Math.trunc(raw), 1), 50)
}

@Injectable()
export class SupportService {
  constructor(private readonly dbs: DatabaseService) {}

  private toDto(row: SupportPostRow): SupportPostDto {
    return {
      id: row.id,
      projectSlug: row.projectSlug,
      category: row.category as SupportCategory,
      status: row.status as SupportPostDto['status'],
      title: row.title,
      body: row.body,
      authorName: row.authorName,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }
  }

  async list(
    projectSlug: string,
    filters: { category?: unknown; limit?: unknown } = {}
  ): Promise<SupportPostListDto> {
    const normalizedProjectSlug = normalizeProjectSlug(projectSlug)
    const category = normalizeCategory(filters.category)
    const limit = normalizeLimit(filters.limit)

    const conds = [eq(supportPosts.projectSlug, normalizedProjectSlug)]
    if (category) conds.push(eq(supportPosts.category, category))

    const rows = await this.dbs.db
      .select()
      .from(supportPosts)
      .where(and(...conds))
      .orderBy(desc(supportPosts.createdAt))
      .limit(limit)

    return { items: rows.map((row) => this.toDto(row)) }
  }

  async create(input: CreateSupportPostInput): Promise<SupportPostDto> {
    const parsed = createSupportPostSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)

    const [row] = await this.dbs.db
      .insert(supportPosts)
      .values({
        projectSlug: parsed.data.projectSlug,
        category: parsed.data.category,
        authorName: parsed.data.name,
        contact: parsed.data.contact,
        title: parsed.data.title,
        body: parsed.data.body,
      })
      .returning()

    return this.toDto(row!)
  }
}
