import { CheckCircle2, Lock, PencilLine, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AddToCalendarButton } from '@/components/feature/AddToCalendarButton'
import { DiffView } from '@/components/feature/DiffView'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, StatusPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState, HashTag, Skeleton } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePageMeta } from '@/hooks/usePageMeta'
import { usePolicy, usePublishVersion, useVersion, useVersions } from '@/services/policies'
import { formatDateTime } from '@/utils/format'

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{children}</dd>
    </div>
  )
}

export default function VersionDetailPage() {
  const { versionId } = useParams<{ versionId: string }>()
  const version = useVersion(versionId)
  const policy = usePolicy(version.data?.policyId)
  const versions = useVersions(version.data?.policyId)

  const prevId = useMemo(() => {
    if (!version.data || !versions.data) return undefined
    return versions.data.find((v) => v.versionNumber === version.data!.versionNumber - 1)?.id
  }, [version.data, versions.data])
  const prev = useVersion(prevId)

  usePageMeta({
    title: version.data ? `${policy.data?.name ?? ''} ${version.data.versionLabel}` : undefined,
    description: version.data
      ? `${policy.data?.name ?? '약관'} ${version.data.versionLabel} 버전 상세 — 본문·해시·이전 버전과의 diff.`
      : undefined,
  })

  if (version.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (version.isError || !version.data) {
    return <EmptyState title="버전을 찾을 수 없습니다" />
  }

  const v = version.data
  const isDraft = v.status === 'draft'
  const isPublished = v.status === 'published'

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: '약관·정책', to: '/app/policies' },
          {
            label: policy.data?.name ?? '정책',
            to: policy.data ? `/app/policies/${policy.data.slug}` : undefined,
          },
          { label: v.versionLabel },
        ]}
        title={
          <span className="flex items-center gap-2.5">
            <span className="font-mono">{v.versionLabel}</span>
            <StatusPill status={v.status} />
            {isPublished ? (
              <Badge tone="accent" size="sm">
                <Lock className="size-3" />
                불변
              </Badge>
            ) : null}
          </span>
        }
        description={v.title}
        actions={
          isDraft ? (
            <>
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/app/versions/${v.id}/edit`}>
                  <PencilLine className="size-4" />
                  편집
                </Link>
              </Button>
              <PublishDialog versionId={v.id} defaultSummary={v.changeSummary ?? ''} />
            </>
          ) : (
            <>
              {policy.data ? <AddToCalendarButton policy={policy.data} version={v} /> : null}
              <Button size="sm" asChild>
                <Link to={`/app/policies/${policy.data?.slug ?? ''}/versions/new`}>새 버전</Link>
              </Button>
            </>
          )
        }
      />

      {v.changeSummary ? (
        <div className="mb-5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-text">
          <span className="font-semibold">변경 안내</span> · {v.changeSummary}
          {v.requiresReconsent ? (
            <Badge tone="warning" size="sm" className="ml-2">
              재동의 필요
            </Badge>
          ) : null}
        </div>
      ) : null}

      <Card className="mb-5">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Meta label="content-hash">
            <HashTag hash={v.contentHash} />
          </Meta>
          <Meta label="언어">{v.locale}</Meta>
          <Meta label="발효일">{formatDateTime(v.effectiveAt)}</Meta>
          <Meta label="상태">
            <StatusPill status={v.status} size="sm" />
          </Meta>
          <Meta label="작성">
            {v.createdByName ?? '—'} · {formatDateTime(v.createdAt)}
          </Meta>
          <Meta label="게시">
            {v.publishedByName ? `${v.publishedByName} · ${formatDateTime(v.publishedAt)}` : '—'}
          </Meta>
        </CardContent>
      </Card>

      <Tabs defaultValue="body">
        <TabsList>
          <TabsTrigger value="body">본문</TabsTrigger>
          <TabsTrigger value="diff">변경 비교</TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="pt-4 outline-none">
          {isPublished ? (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-text-subtle">
              <Lock className="size-3.5" />
              게시본은 동결되어 변경할 수 없습니다. 해시로 무결성이 보장됩니다.
            </p>
          ) : null}
          <div className="prose-measure whitespace-pre-wrap rounded-lg border border-border bg-surface p-5 text-[0.875rem] leading-relaxed text-text">
            {v.body}
          </div>
        </TabsContent>

        <TabsContent value="diff" className="pt-4 outline-none">
          {!prevId ? (
            <EmptyState
              title="이전 버전이 없습니다"
              description="최초 버전이라 비교 대상이 없습니다."
            />
          ) : prev.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : prev.data ? (
            <DiffView before={prev.data.body} after={v.body} />
          ) : null}
        </TabsContent>
      </Tabs>
    </>
  )
}

function PublishDialog({
  versionId,
  defaultSummary,
}: {
  versionId: string
  defaultSummary: string
}) {
  const [open, setOpen] = useState(false)
  const [effectiveAt, setEffectiveAt] = useState('')
  const [reconsent, setReconsent] = useState(false)
  const [summary, setSummary] = useState(defaultSummary)
  const publish = usePublishVersion(versionId)

  const onPublish = () => {
    publish.mutate(
      {
        effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : undefined,
        requiresReconsent: reconsent,
        changeSummary: summary || undefined,
      },
      {
        onSuccess: () => {
          toast.success('게시했습니다. 본문이 동결되고 해시가 부여되었습니다.')
          setOpen(false)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '게시에 실패했습니다'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send className="size-4" />
          게시
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>버전 게시</DialogTitle>
          <DialogDescription>
            게시하면 본문이 동결되어 더 이상 수정할 수 없습니다. 현재 발효 버전으로 승격되고 이전
            버전은 보관됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field
            label="발효일"
            htmlFor="effectiveAt"
            hint="미입력 시 즉시 발효. 사전고지가 필요하면 미래 날짜로."
          >
            <Input
              id="effectiveAt"
              type="date"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
            />
          </Field>
          <Field label="변경 요약" htmlFor="summary">
            <Textarea
              id="summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="재동의 안내에 노출됩니다"
            />
          </Field>
          <label className="flex items-start gap-2.5 rounded-md border border-border bg-surface-2/40 p-3">
            <Checkbox
              checked={reconsent}
              onChange={(e) => setReconsent(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-text">
              <span className="font-medium">재동의가 필요한 중대한 변경</span>
              <span className="mt-0.5 block text-xs text-text-muted">
                이전 버전에만 동의한 사용자는 SDK에서 재동의 게이트가 열립니다.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={onPublish} loading={publish.isPending}>
            <CheckCircle2 className="size-4" />
            게시하고 동결
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
