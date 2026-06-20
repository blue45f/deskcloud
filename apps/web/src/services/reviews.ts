import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  AdminReviewDto,
  AdminReviewListDto,
  ModerateReviewInput,
  ReviewStatus,
} from '@reviewdesk/shared'

/* ──────────────────────────────────────────────────────────────────────────
   어드민 리뷰 — 목록(필터·페이지네이션) · 검수(approve/reject/feature/unfeature/reply) · 삭제.
   모든 요청은 api 클라이언트가 어드민 자격을 자동으로 싣는다.
   ────────────────────────────────────────────────────────────────────────── */

export interface ReviewFilters {
  status?: ReviewStatus
  subjectId?: string
  featured?: boolean
  offset: number
  limit: number
}

export const reviewsKey = (f: ReviewFilters) =>
  ['reviews', f.status ?? 'all', f.subjectId ?? '*', f.featured ?? 'any', f.offset, f.limit] as const

export interface ReviewsPage extends AdminReviewListDto {
  totalCount: number | null
}

/** 어드민 리뷰 목록(필터 + 페이지네이션). X-Total-Count 헤더도 함께 읽는다. */
export function useReviews(filters: ReviewFilters) {
  return useQuery({
    queryKey: reviewsKey(filters),
    queryFn: async (): Promise<ReviewsPage> => {
      // 쿼리스트링 직렬화 — featured(boolean)는 서버 스키마가 'true'|'false' 문자열을 받는다.
      const query: Record<string, string | number | undefined> = {
        status: filters.status,
        subjectId: filters.subjectId,
        featured: filters.featured === undefined ? undefined : String(filters.featured),
        offset: filters.offset,
        limit: filters.limit,
      }
      const { data, totalCount } = await api.getWithHeaders<AdminReviewListDto>(
        'admin/reviews',
        query
      )
      return { ...data, totalCount: totalCount ?? data.total }
    },
    placeholderData: (prev) => prev,
  })
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['reviews'] })
  void qc.invalidateQueries({ queryKey: ['subjects'] })
  void qc.invalidateQueries({ queryKey: ['tenant'] })
}

/** 검수 액션 — approve | reject | feature | unfeature | reply. */
export function useModerate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ModerateReviewInput }) =>
      api.patch<{ ok: true }>(`admin/reviews/${id}`, input),
    onSuccess: () => invalidateAll(qc),
  })
}

/** 리뷰 삭제. */
export function useDeleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`admin/reviews/${id}`),
    onSuccess: () => invalidateAll(qc),
  })
}

/* ── subject 집계 카드 (어드민 목록을 클라이언트에서 집계) ─────────────────────
   서버 공개 집계 엔드포인트는 publishable 키 + 승인본 기준이라, 어드민 대시보드는
   어드민 리뷰 목록(모든 상태)을 한 번에 받아 subject 별로 묶어 보여 준다.
   ──────────────────────────────────────────────────────────────────────── */

/** 모든 리뷰(상태 무관)를 넉넉히 받아 subject 집계 카드를 구성하기 위한 원본. */
export function useAllReviewsForSubjects(limit = 100) {
  return useQuery({
    queryKey: ['subjects', limit] as const,
    queryFn: () =>
      api.get<AdminReviewListDto>('admin/reviews', { offset: 0, limit }).then((d) => d.items),
  })
}

export interface SubjectAggregate {
  subjectId: string
  subjectLabel: string | null
  total: number
  approved: number
  pending: number
  rejected: number
  featured: number
  avgRating: number | null
}

/** subject 별로 어드민 리뷰를 묶어 카운트·평균(승인본 기준)을 집계한다. */
export function groupBySubject(items: AdminReviewDto[]): SubjectAggregate[] {
  const map = new Map<string, SubjectAggregate & { _ratingSum: number; _ratingN: number }>()
  for (const r of items) {
    let agg = map.get(r.subjectId)
    if (!agg) {
      agg = {
        subjectId: r.subjectId,
        subjectLabel: r.subjectLabel,
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        featured: 0,
        avgRating: null,
        _ratingSum: 0,
        _ratingN: 0,
      }
      map.set(r.subjectId, agg)
    }
    agg.total += 1
    if (r.status === 'approved') agg.approved += 1
    else if (r.status === 'pending') agg.pending += 1
    else if (r.status === 'rejected') agg.rejected += 1
    if (r.featured) agg.featured += 1
    if (!agg.subjectLabel && r.subjectLabel) agg.subjectLabel = r.subjectLabel
    // 평균 별점은 승인본 기준(공개 위젯 집계와 일치).
    if (r.status === 'approved') {
      agg._ratingSum += r.rating
      agg._ratingN += 1
    }
  }
  return [...map.values()]
    .map((a) => ({
      subjectId: a.subjectId,
      subjectLabel: a.subjectLabel,
      total: a.total,
      approved: a.approved,
      pending: a.pending,
      rejected: a.rejected,
      featured: a.featured,
      avgRating: a._ratingN > 0 ? Math.round((a._ratingSum / a._ratingN) * 100) / 100 : null,
    }))
    .sort((x, y) => y.total - x.total)
}
