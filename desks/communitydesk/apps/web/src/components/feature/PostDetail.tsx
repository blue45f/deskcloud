import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import type { AdminPostDto, CommentNodeDto } from '@communitydesk/shared'

import { ReactionChips } from '@/components/feature/ReactionChips'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { Tooltip } from '@/components/ui/tooltip'
import { API_BASE } from '@/services/api'
import { deleteComment, getPublicPost, getTenant, moderateComment } from '@/services/community'
import { relativeTime } from '@/utils/format'

function endpoint(): string {
  return API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
}

interface CommentRowProps {
  comment: CommentNodeDto
  onModerate: (id: string, action: 'show' | 'hide' | 'approve') => void
  onDelete: (id: string) => void
  busyId: string | null
}

function CommentRow({ comment, onModerate, onDelete, busyId }: CommentRowProps) {
  const busy = busyId === comment.id
  return (
    <li>
      <div
        className="rounded-md border border-border bg-surface px-3 py-2"
        style={{ marginLeft: `${Math.min(comment.depth, 6) * 1}rem` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-text-subtle">
              <span className="font-medium text-text-muted">{comment.authorName}</span> ·{' '}
              {relativeTime(comment.createdAt)}
            </p>
            <div
              className="cd-richtext mt-1 text-sm"
              // 서버에서 살균된 HTML(화이트리스트 출력)을 그대로 렌더.
              dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
            />
            <div className="mt-1.5">
              <ReactionChips reactions={comment.reactions} />
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Tooltip content="노출">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() => onModerate(comment.id, 'show')}
                aria-label="댓글 노출"
              >
                <Eye className="size-3.5 text-success" />
              </Button>
            </Tooltip>
            <Tooltip content="숨김">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() => onModerate(comment.id, 'hide')}
                aria-label="댓글 숨김"
              >
                <EyeOff className="size-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content="승인">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() => onModerate(comment.id, 'approve')}
                aria-label="댓글 승인"
              >
                <ShieldCheck className="size-3.5 text-success" />
              </Button>
            </Tooltip>
            <Tooltip content="삭제">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() => onDelete(comment.id)}
                aria-label="댓글 삭제"
              >
                <Trash2 className="size-3.5 text-danger" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
      {comment.children.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {comment.children.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              onModerate={onModerate}
              onDelete={onDelete}
              busyId={busyId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * 검수 큐의 한 글을 펼쳤을 때의 상세 — 본문(살균 HTML) + 중첩 댓글 트리(검수 액션 포함).
 *
 * 댓글 트리는 공개 글 상세 엔드포인트(pk + Origin)로 가져온다. 어드민이 ADMIN_TOKEN 으로
 * 로그인했거나 테넌트 corsOrigins 가 대시보드 origin 을 허용하지 않으면 가져오지 못할 수
 * 있어, 그 경우 본문(어드민 글이 이미 들고 있는 bodyHtml)만 보여 주고 안내한다.
 */
export function PostDetail({ post, onChanged }: { post: AdminPostDto; onChanged: () => void }) {
  const qc = useQueryClient()

  const tenantQ = useQuery({ queryKey: ['tenant'], queryFn: getTenant })
  const pk = tenantQ.data?.publishableKey

  const detailQ = useQuery({
    queryKey: ['public-post', post.id, pk],
    queryFn: () => getPublicPost(post.id, pk!, endpoint()),
    enabled: Boolean(pk),
    retry: 0,
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['public-post', post.id] })
    onChanged()
  }

  const moderateMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'show' | 'hide' | 'approve' }) =>
      moderateComment(id, action),
    onSuccess: () => {
      toast.success('댓글에 적용했습니다.')
      refresh()
    },
    onError: () => toast.error('댓글 적용에 실패했습니다.'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => {
      toast.success('댓글을 삭제했습니다.')
      refresh()
    },
    onError: () => toast.error('댓글 삭제에 실패했습니다.'),
  })

  const busyId =
    (moderateMut.isPending && moderateMut.variables?.id) ||
    (deleteMut.isPending && deleteMut.variables) ||
    null

  return (
    <div className="space-y-4">
      {/* 본문 — 어드민 글이 들고 있는 살균 HTML 을 그대로 */}
      <div>
        <p className="mb-1 text-xs font-medium text-text-subtle">본문</p>
        <div
          className="cd-richtext prose-measure rounded-md border border-border bg-surface p-3"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />
      </div>

      {/* 댓글 */}
      <div>
        <p className="mb-2 text-xs font-medium text-text-subtle">댓글 ({post.replyCount})</p>
        {!pk ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-text-subtle">
            테넌트 publishable 키를 확인할 수 없어 댓글 트리를 불러오지 못했습니다(ADMIN_TOKEN
            모드). 댓글 검수는 테넌트 secret 키로 로그인하면 사용할 수 있습니다.
          </p>
        ) : detailQ.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-4/5" />
          </div>
        ) : detailQ.isError ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-text-subtle">
            댓글 트리를 불러오지 못했습니다. 대시보드 origin 이 테넌트 CORS 허용목록에 있는지
            확인하세요(설정 탭).
          </p>
        ) : (detailQ.data?.comments.length ?? 0) === 0 ? (
          <p className="text-xs text-text-subtle">아직 댓글이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {detailQ.data?.comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                busyId={busyId}
                onModerate={(id, action) => moderateMut.mutate({ id, action })}
                onDelete={(id) => deleteMut.mutate(id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
