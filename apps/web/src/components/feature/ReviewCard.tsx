import { Check, MessageSquare, Sparkles, Star, Trash2, X } from 'lucide-react'

import { Stars } from './Stars'

import type { AdminReviewDto, ModerationAction } from '@reviewdesk/shared'

import { FeaturedBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { formatRelative } from '@/utils/format'

export interface ReviewCardProps {
  review: AdminReviewDto
  onModerate: (action: ModerationAction) => void
  onReply: () => void
  onDelete: () => void
  /** 현재 진행 중인 액션(버튼 로딩 표시). */
  pendingAction?: ModerationAction | 'delete' | null
}

/** 검수 큐의 리뷰 1건 카드 — 메타 + 본문 + 답글 + 액션 바. */
export function ReviewCard({
  review,
  onModerate,
  onReply,
  onDelete,
  pendingAction,
}: ReviewCardProps) {
  const busy = pendingAction != null
  const isApproved = review.status === 'approved'
  const isRejected = review.status === 'rejected'

  return (
    <article className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text">{review.authorName}</span>
            <Stars value={review.rating} size="sm" />
            <StatusBadge status={review.status} />
            {review.featured ? <FeaturedBadge /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-subtle">
            <span className="font-mono">{review.subjectId}</span>
            {review.subjectLabel ? <span>· {review.subjectLabel}</span> : null}
            <span>· {formatRelative(review.createdAt)}</span>
            {review.source ? <span>· {review.source}</span> : null}
            {review.authorEmail ? <span className="font-mono">· {review.authorEmail}</span> : null}
          </div>
        </div>
      </div>

      {review.title ? (
        <h3 className="mt-3 text-sm font-semibold text-text">{review.title}</h3>
      ) : null}
      <p className="mt-1.5 text-sm whitespace-pre-wrap text-pretty text-text-muted">
        {review.body}
      </p>

      {review.reply ? (
        <div className="mt-3 rounded-md border-l-2 border-accent bg-surface-2 px-3 py-2">
          <p className="text-xs font-semibold text-accent-fg">운영자 답글</p>
          <p className="mt-0.5 text-[0.8125rem] whitespace-pre-wrap text-text-muted">
            {review.reply}
          </p>
        </div>
      ) : null}

      {/* 액션 바 */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
        {!isApproved ? (
          <Button
            variant="accent"
            size="sm"
            onClick={() => onModerate('approve')}
            loading={pendingAction === 'approve'}
            disabled={busy && pendingAction !== 'approve'}
          >
            <Check className="size-4" /> 승인
          </Button>
        ) : null}
        {!isRejected ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onModerate('reject')}
            loading={pendingAction === 'reject'}
            disabled={busy && pendingAction !== 'reject'}
          >
            <X className="size-4" /> 거절
          </Button>
        ) : null}

        <Tooltip content={isApproved ? '' : '승인된 리뷰만 추천할 수 있습니다'}>
          <span>
            <Button
              variant={review.featured ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => onModerate(review.featured ? 'unfeature' : 'feature')}
              loading={pendingAction === 'feature' || pendingAction === 'unfeature'}
              disabled={(busy && !pendingAction?.startsWith('feature')) || !isApproved}
            >
              {review.featured ? (
                <>
                  <Star className="size-4 fill-current" /> 추천 해제
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> 추천
                </>
              )}
            </Button>
          </span>
        </Tooltip>

        <Button variant="ghost" size="sm" onClick={onReply} disabled={busy}>
          <MessageSquare className="size-4" /> {review.reply ? '답글 수정' : '답글'}
        </Button>

        <Tooltip content="리뷰를 영구 삭제합니다">
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-text-subtle hover:text-danger"
            onClick={onDelete}
            loading={pendingAction === 'delete'}
            disabled={busy && pendingAction !== 'delete'}
            aria-label="리뷰 삭제"
          >
            <Trash2 className="size-4" />
          </Button>
        </Tooltip>
      </div>
    </article>
  )
}
