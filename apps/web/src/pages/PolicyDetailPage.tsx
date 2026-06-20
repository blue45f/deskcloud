import { can, type PolicyDto } from '@termsdesk/shared'
import { Download, ExternalLink, EyeOff, FilePlus2, History, Lock } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AddToCalendarButton } from '@/components/feature/AddToCalendarButton'
import { VersionTimeline } from '@/components/feature/VersionTimeline'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, PolicyTypeBadge, StatusPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, HashTag, Skeleton } from '@/components/ui/feedback'
import { Switch } from '@/components/ui/switch'
import { Tooltip } from '@/components/ui/tooltip'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSession } from '@/services/auth'
import { usePolicy, useUpdatePolicy, useVersion, useVersions } from '@/services/policies'
import { formatDate } from '@/utils/format'

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{children}</dd>
    </div>
  )
}

/**
 * 공개/비공개 토글 — 노출 제어 전용(게시·해시 비접촉).
 * private 이면 무인증 공개 페이지(/p/...)·공개 API 렌더가 404, API 키 경로는 그대로 동작.
 */
function VisibilityToggle({ policy }: { policy: PolicyDto }) {
  const session = useSession()
  const update = useUpdatePolicy(policy.slug)
  const editable = session.data ? can(session.data.user.role, 'policy.write') : false
  const isPublic = policy.visibility === 'public'

  const onToggle = (checked: boolean) => {
    update.mutate(
      { visibility: checked ? 'public' : 'private' },
      {
        onSuccess: (next) =>
          toast.success(
            next.visibility === 'public'
              ? '공개로 전환했습니다 — 공개 페이지·임베드에 노출됩니다'
              : '비공개로 전환했습니다 — 공개 페이지에서 숨겨집니다(API 키 연동은 유지)'
          ),
        onError: (e) => toast.error(e instanceof Error ? e.message : '변경에 실패했습니다'),
      }
    )
  }

  return (
    <span className="flex items-center gap-2">
      <Switch
        id="policy-visibility"
        checked={isPublic}
        onCheckedChange={onToggle}
        disabled={!editable || update.isPending}
        aria-label="공개 상태"
      />
      <label htmlFor="policy-visibility" className="text-[0.8125rem] text-text-muted">
        {isPublic ? '공개' : '비공개'}
      </label>
    </span>
  )
}

/** 공개 페이지 링크 — private 이면 비활성 + 이유 툴팁(공개 페이지가 404 이므로). */
function PublicPageLink({ policy }: { policy: PolicyDto }) {
  const session = useSession()
  const orgSlug = session.data?.org.slug
  const isPublic = policy.visibility === 'public'

  if (isPublic && orgSlug) {
    return (
      <Button variant="secondary" size="sm" asChild>
        <a href={`/p/${orgSlug}/${policy.slug}`} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" />
          공개 페이지
        </a>
      </Button>
    )
  }
  return (
    <Tooltip content="비공개 정책은 공개 페이지가 열리지 않습니다 — 공개로 전환하면 링크가 활성화됩니다.">
      {/* disabled 버튼은 포인터/포커스 이벤트가 없어 툴팁이 안 뜨므로 focusable span 으로 감싼다
          (Radix 권장 패턴 — 키보드 사용자도 툴팁에 접근 가능하게 의도적으로 tabIndex 부여). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <span className="inline-flex" tabIndex={0}>
        <Button variant="secondary" size="sm" disabled aria-disabled="true">
          <ExternalLink className="size-4" />
          공개 페이지
        </Button>
      </span>
    </Tooltip>
  )
}

export default function PolicyDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const policy = usePolicy(slug)
  const versions = useVersions(policy.data?.id)
  const current = useVersion(policy.data?.currentVersionId ?? undefined)
  useDocumentTitle(policy.data?.name)

  if (policy.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (policy.isError || !policy.data) {
    return (
      <EmptyState title="정책을 찾을 수 없습니다" description="삭제되었거나 권한이 없습니다." />
    )
  }

  const p = policy.data

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '약관·정책', to: '/app/policies' }, { label: p.name }]}
        title={
          <span className="flex items-center gap-2.5">
            {p.name}
            <PolicyTypeBadge type={p.type} />
            {p.visibility === 'private' ? (
              <Badge tone="outline" size="sm">
                <EyeOff className="size-3" aria-hidden />
                비공개
              </Badge>
            ) : null}
          </span>
        }
        description={p.description ?? undefined}
        actions={
          <>
            <PublicPageLink policy={p} />
            <Button variant="secondary" size="sm" asChild>
              <a href={`/api/export/policies/${p.id}/versions.csv`} download>
                <Download className="size-4" />
                CSV
              </a>
            </Button>
            <Button size="sm" asChild>
              <Link to={`/app/policies/${p.slug}/versions/new`}>
                <FilePlus2 className="size-4" />새 버전
              </Link>
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetaItem label="slug">
            <span className="font-mono text-[0.8125rem]">{p.slug}</span>
          </MetaItem>
          <MetaItem label="관할">{p.jurisdiction}</MetaItem>
          <MetaItem label="현재 버전">
            {p.currentVersionId ? (
              <span className="flex items-center gap-2">
                <span className="font-mono">{p.currentVersionLabel}</span>
                <StatusPill status="published" size="sm" />
              </span>
            ) : (
              <Badge size="sm">미게시</Badge>
            )}
          </MetaItem>
          <MetaItem label="현재 해시">
            <HashTag hash={current.data?.contentHash ?? null} />
          </MetaItem>
          <MetaItem label="공개 상태">
            <VisibilityToggle policy={p} />
          </MetaItem>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <History className="size-4 text-text-subtle" />
                버전 타임라인
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {versions.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (versions.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={FilePlus2}
                title="버전이 없습니다"
                description="첫 버전 초안을 작성하고 게시하세요."
                action={
                  <Button size="sm" asChild>
                    <Link to={`/app/policies/${p.slug}/versions/new`}>새 버전 작성</Link>
                  </Button>
                }
              />
            ) : (
              <VersionTimeline
                versions={versions.data ?? []}
                currentVersionId={p.currentVersionId}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            action={
              current.data ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/app/versions/${current.data.id}`}>버전 상세</Link>
                </Button>
              ) : null
            }
          >
            <CardTitle>
              <span className="flex items-center gap-2">
                {p.currentVersionId ? <Lock className="size-4 text-accent-strong" /> : null}
                현재 발효 본문
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {current.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : current.data ? (
              <>
                {current.data.changeSummary ? (
                  <div className="mb-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[0.8125rem] text-text">
                    <span className="font-medium">변경 안내</span> · {current.data.changeSummary}
                  </div>
                ) : null}
                <div className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-md bg-surface-2/50 p-4 text-[0.8125rem] leading-relaxed text-text">
                  {current.data.body}
                </div>
                <p className="mt-2 text-xs text-text-subtle">
                  발효일 {formatDate(current.data.effectiveAt)} · 게시{' '}
                  {formatDate(current.data.publishedAt)}
                </p>
                <AddToCalendarButton policy={p} version={current.data} className="mt-3" />
              </>
            ) : (
              <EmptyState
                title="게시된 버전이 없습니다"
                description="초안을 게시하면 현재 발효 본문으로 표시됩니다."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
