import { REVIEW_REPLY_MAX, type AdminReviewDto } from '@reviewdesk/shared'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Textarea } from '@/components/ui/field'

/**
 * 운영자 답글 다이얼로그 — reply 액션. 빈 문자열로 제출하면 답글 삭제.
 * 제출 시 onSubmit(reply) 호출(상위가 moderate 뮤테이션을 실행).
 */
export function ReplyDialog({
  review,
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  review: AdminReviewDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (reply: string) => void
  pending: boolean
}) {
  // 다이얼로그가 열릴 때(닫힘→열림 전이) 기존 답글로 입력값을 초기화한다.
  // 이펙트 대신 렌더 중 이전 open 상태와 비교해 조정하는 React 공식 패턴을 쓴다.
  const [value, setValue] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setValue(review?.reply ?? '')
  }

  if (!review) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>운영자 답글</DialogTitle>
          <DialogDescription>
            {review.authorName} 님의 리뷰에 답글을 답니다. 승인본이면 위젯에 함께 노출됩니다.
          </DialogDescription>
        </DialogHeader>

        <blockquote className="mb-4 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[0.8125rem] text-text-muted">
          {review.title ? (
            <strong className="block font-semibold text-text">{review.title}</strong>
          ) : null}
          <span className="line-clamp-3">{review.body}</span>
        </blockquote>

        <Field
          label="답글"
          htmlFor="reply-body"
          hint={`비우고 저장하면 기존 답글이 삭제됩니다. 최대 ${REVIEW_REPLY_MAX.toLocaleString()}자.`}
        >
          <Textarea
            id="reply-body"
            value={value}
            maxLength={REVIEW_REPLY_MAX}
            placeholder="감사 인사나 후속 안내를 남겨 주세요."
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </Field>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            취소
          </Button>
          <Button onClick={() => onSubmit(value.trim())} loading={pending}>
            {value.trim() ? '답글 저장' : '답글 삭제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
