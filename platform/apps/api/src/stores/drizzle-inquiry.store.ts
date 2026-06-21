import { type InquiryAdminDto, type InquiryStatus } from '@desk/shared'
import { and, desc, eq } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { inquiries } from '../db/schema'
import {
  type CreateInquiryRecord,
  type InquiryStorePort,
  type ListInquiriesOptions,
} from '../inquiries/tokens'

type Row = typeof inquiries.$inferSelect

/** 행 → 어드민 DTO(contactEmail·originUrl 포함). 공개 redact 는 서비스가 담당. */
function toAdminDto(row: Row): InquiryAdminDto {
  return {
    id: row.id,
    appId: row.appId,
    category: row.category,
    status: row.status,
    title: row.title,
    body: row.body,
    authorName: row.authorName,
    contactEmail: row.contactEmail,
    originUrl: row.originUrl,
    originHost: row.originHost,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** core/billing 스토어와 동일한 port/adapter 패턴 — 문의 영속화(Drizzle). */
export class DrizzleInquiryStore implements InquiryStorePort {
  constructor(private readonly dbs: DatabaseService) {}

  async create(rec: CreateInquiryRecord): Promise<InquiryAdminDto> {
    const inserted = await this.dbs.db
      .insert(inquiries)
      .values({
        appId: rec.appId,
        category: rec.category,
        title: rec.title,
        body: rec.body,
        contactEmail: rec.contactEmail,
        originUrl: rec.originUrl,
        originHost: rec.originHost,
        authorName: rec.authorName,
      })
      .returning()
    return toAdminDto(inserted[0]!)
  }

  /** 앱별 최신순(createdAt desc) + 페이지네이션. status/originHost 지정 시 해당 큐만(어드민). */
  async listByApp(appId: string, opts: ListInquiriesOptions): Promise<InquiryAdminDto[]> {
    const filters = [eq(inquiries.appId, appId)]
    if (opts.status) filters.push(eq(inquiries.status, opts.status))
    if (opts.originHost) filters.push(eq(inquiries.originHost, opts.originHost))

    const rows = await this.dbs.db
      .select()
      .from(inquiries)
      .where(and(...filters))
      .orderBy(desc(inquiries.createdAt))
      .limit(opts.limit)
      .offset(opts.offset)
    return rows.map(toAdminDto)
  }

  async getById(id: string): Promise<InquiryAdminDto | null> {
    const rows = await this.dbs.db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1)
    return rows[0] ? toAdminDto(rows[0]) : null
  }

  async updateStatus(id: string, status: InquiryStatus): Promise<InquiryAdminDto | null> {
    const updated = await this.dbs.db
      .update(inquiries)
      .set({ status, updatedAt: new Date() })
      .where(eq(inquiries.id, id))
      .returning()
    return updated[0] ? toAdminDto(updated[0]) : null
  }
}
