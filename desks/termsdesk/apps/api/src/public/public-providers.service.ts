import { Injectable, NotFoundException } from '@nestjs/common'
import {
  type ProviderProfileDto,
  type ProviderProfileListDto,
  type ProviderReviewDto,
} from '@termsdesk/shared'
import { desc, eq, inArray, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { organizations, providerProfiles, providerReviews, serviceRequests } from '../db/schema'

import { TERMSDESK_PUBLIC_BASE_URL, type SitemapEntry } from './portfolio-legal'

type ProviderRow = typeof providerProfiles.$inferSelect
type ReviewRow = typeof providerReviews.$inferSelect

interface RatingAgg {
  avgRating: number | null
  reviewCount: number
}

const EMPTY_RATING: RatingAgg = { avgRating: null, reviewCount: 0 }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

@Injectable()
export class PublicProvidersService {
  constructor(private readonly dbs: DatabaseService) {}

  async list(filters: { specialty?: unknown } = {}): Promise<ProviderProfileListDto> {
    const specialty =
      typeof filters.specialty === 'string' && filters.specialty.trim()
        ? filters.specialty.trim()
        : undefined

    const rows = await this.dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.active, true))
      .orderBy(desc(providerProfiles.verified), desc(providerProfiles.completedCount))

    const filtered = specialty
      ? rows.filter((row) => splitCsv(row.specialties).includes(specialty))
      : rows

    const [orgNames, ratings] = await Promise.all([
      this.orgNameMap(filtered.map((row) => row.orgId)),
      this.ratingMap(filtered.map((row) => row.userId)),
    ])

    return {
      total: filtered.length,
      items: filtered.map((row) =>
        this.toProviderDto(row, orgNames.get(row.orgId) ?? '', {
          rating: ratings.get(row.userId) ?? EMPTY_RATING,
        })
      ),
    }
  }

  async get(id: string): Promise<ProviderProfileDto> {
    if (!UUID_RE.test(id)) throw new NotFoundException('전문가를 찾을 수 없습니다')
    const rows = await this.dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, id))
      .limit(1)
    const row = rows[0]
    if (!row || !row.active) throw new NotFoundException('전문가를 찾을 수 없습니다')

    const [orgName, rating, reviews] = await Promise.all([
      this.orgName(row.orgId),
      this.ratingFor(row.userId),
      this.reviewsForProvider(row.userId),
    ])
    return this.toProviderDto(row, orgName, { rating, reviews })
  }

  async sitemapEntries(): Promise<SitemapEntry[]> {
    const rows = await this.dbs.db
      .select({ id: providerProfiles.id, updatedAt: providerProfiles.updatedAt })
      .from(providerProfiles)
      .where(eq(providerProfiles.active, true))
      .orderBy(desc(providerProfiles.updatedAt))

    return [
      { loc: `${TERMSDESK_PUBLIC_BASE_URL}/experts`, lastmod: new Date().toISOString() },
      ...rows.map((row) => ({
        loc: `${TERMSDESK_PUBLIC_BASE_URL}/experts/${row.id}`,
        lastmod: new Date(row.updatedAt).toISOString(),
      })),
    ]
  }

  private async ratingMap(userIds: string[]): Promise<Map<string, RatingAgg>> {
    const map = new Map<string, RatingAgg>()
    const unique = [...new Set(userIds)]
    if (unique.length === 0) return map
    const rows = await this.dbs.db
      .select({
        userId: providerReviews.providerUserId,
        avg: sql<number>`avg(${providerReviews.rating})`,
        c: sql<number>`count(*)::int`,
      })
      .from(providerReviews)
      .where(inArray(providerReviews.providerUserId, unique))
      .groupBy(providerReviews.providerUserId)
    for (const row of rows) {
      const count = Number(row.c)
      map.set(row.userId, {
        avgRating: count > 0 ? Math.round(Number(row.avg) * 10) / 10 : null,
        reviewCount: count,
      })
    }
    return map
  }

  private async ratingFor(userId: string): Promise<RatingAgg> {
    return (await this.ratingMap([userId])).get(userId) ?? EMPTY_RATING
  }

  private async reviewsForProvider(userId: string, limit = 20): Promise<ProviderReviewDto[]> {
    const rows = await this.dbs.db
      .select({
        review: providerReviews,
        requestTitle: serviceRequests.title,
      })
      .from(providerReviews)
      .leftJoin(serviceRequests, eq(providerReviews.requestId, serviceRequests.id))
      .where(eq(providerReviews.providerUserId, userId))
      .orderBy(desc(providerReviews.createdAt))
      .limit(limit)
    return rows.map((row) => this.toReviewDto(row.review, row.requestTitle ?? ''))
  }

  private async orgName(orgId: string): Promise<string> {
    const rows = await this.dbs.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
    return rows[0]?.name ?? ''
  }

  private async orgNameMap(orgIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const unique = [...new Set(orgIds)]
    if (unique.length === 0) return map
    const rows = await this.dbs.db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, unique))
    for (const row of rows) map.set(row.id, row.name)
    return map
  }

  private toProviderDto(
    row: ProviderRow,
    orgName: string,
    opts: { rating: RatingAgg; reviews?: ProviderReviewDto[] }
  ): ProviderProfileDto {
    return {
      id: row.id,
      userId: row.userId,
      orgId: row.orgId,
      orgName,
      displayName: row.displayName,
      headline: row.headline,
      bio: row.bio,
      specialties: splitCsv(row.specialties),
      jurisdictions: row.jurisdictions,
      hourlyRate: row.hourlyRate,
      contact: null,
      verified: row.verified,
      active: row.active,
      completedCount: row.completedCount,
      avgRating: opts.rating.avgRating,
      reviewCount: opts.rating.reviewCount,
      reviews: opts.reviews,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }
  }

  private toReviewDto(row: ReviewRow, requestTitle: string): ProviderReviewDto {
    return {
      id: row.id,
      providerUserId: row.providerUserId,
      requestId: row.requestId,
      requestTitle,
      reviewerName: row.reviewerName,
      rating: row.rating,
      comment: row.comment,
      createdAt: new Date(row.createdAt).toISOString(),
    }
  }
}
