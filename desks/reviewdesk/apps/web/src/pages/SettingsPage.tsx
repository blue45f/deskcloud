import {
  FREE_PLAN_LIMIT,
  PLANS,
  type Plan,
  type TenantCreatedDto,
  type TenantDto,
} from '@reviewdesk/shared'
import { AlertTriangle, Check, Plus, RotateCw, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
import { MiniBar } from '@/components/feature/MiniBar'
import { PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Label, Select } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRotateKeys, useTenant, useUpdateTenant } from '@/services/tenant'
import { reactWidgetSnippet, vanillaSnippet } from '@/utils/embed'
import { formatDate, formatNumber } from '@/utils/format'

const WIDGETS = [
  { id: 'ReviewStars', label: '별점 배지', desc: '평균 별 + 건수(컴팩트).' },
  {
    id: 'ReviewList',
    label: '리뷰 목록',
    desc: '집계 헤더 + 분포 막대 + 승인본.',
  },
  {
    id: 'ReviewForm',
    label: '리뷰 작성 폼',
    desc: '별점 picker + 입력 → 제출.',
  },
  {
    id: 'TestimonialWall',
    label: '후기 월',
    desc: '추천(featured) 후기 그리드.',
  },
] as const

export default function SettingsPage() {
  useDocumentTitle('테넌트 설정')
  const kind = useAuthStore((s) => s.kind)
  const tenantIdInput = useAuthStore((s) => s.tenantId)
  const setTenantId = useAuthStore((s) => s.setTenantId)

  const needsTenant = kind === 'admin' && !tenantIdInput
  const tenantQ = useTenant(!needsTenant)

  if (needsTenant) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">테넌트 설정</h1>
        <p className="mt-1 text-sm text-text-muted">
          글로벌 ADMIN_TOKEN 모드입니다. 관리할 테넌트 id 를 지정하세요.
        </p>
        <TenantPicker value={tenantIdInput} onSave={setTenantId} className="mt-6 max-w-md" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">테넌트 설정</h1>
          <p className="mt-1 text-sm text-text-muted">
            CORS 허용 도메인·자동 승인·요금제·키를 관리하고 임베드 스니펫을 복사합니다.
          </p>
        </div>
        {kind === 'admin' ? (
          <TenantPicker value={tenantIdInput} onSave={setTenantId} compact />
        ) : null}
      </div>

      {tenantQ.isLoading ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : tenantQ.isError || !tenantQ.data ? (
        <Card className="mt-8">
          <CardContent>
            <p className="text-sm text-danger">
              {tenantQ.error instanceof Error
                ? tenantQ.error.message
                : '테넌트 정보를 불러오지 못했습니다.'}
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => void tenantQ.refetch()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      ) : (
        <SettingsBody tenant={tenantQ.data} />
      )}
    </div>
  )
}

/* ── 글로벌 토큰 모드: 대상 테넌트 id 입력 ──────────────────────────────── */

function TenantPicker({
  value,
  onSave,
  className,
  compact,
}: {
  value: string
  onSave: (id: string) => void
  className?: string
  compact?: boolean
}) {
  // 외부 value(prop)가 바뀌면 로컬 draft 를 재동기화한다. 이펙트 대신 렌더 중
  // 이전 prop 과 비교해 조정하는 React 공식 패턴(파생 상태)을 사용한다.
  const [draft, setDraft] = useState(value)
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value)
  }

  if (compact) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(draft.trim())
          toast.success('대상 테넌트를 전환했습니다')
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="테넌트 id"
          className="h-8 w-44 font-mono text-xs"
          aria-label="대상 테넌트 id"
        />
        <Button type="submit" variant="secondary" size="sm">
          전환
        </Button>
      </form>
    )
  }

  return (
    <Card className={className}>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave(draft.trim())
            toast.success('대상 테넌트를 설정했습니다')
          }}
        >
          <Field
            label="대상 테넌트 id"
            htmlFor="tenant-id"
            hint="검수할 테넌트의 id(uuid). 가입 응답이나 다른 도구에서 확인하세요."
          >
            <Input
              id="tenant-id"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="font-mono"
            />
          </Field>
          <Button type="submit" className="mt-4">
            테넌트 설정
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/* ── 설정 본문 ──────────────────────────────────────────────────────────── */

function SettingsBody({ tenant }: { tenant: TenantDto }) {
  return (
    <Tabs defaultValue="general" className="mt-8">
      <TabsList>
        <TabsTrigger value="general">일반</TabsTrigger>
        <TabsTrigger value="keys">API 키</TabsTrigger>
        <TabsTrigger value="embed">임베드</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="pt-6">
        <GeneralTab tenant={tenant} />
      </TabsContent>
      <TabsContent value="keys" className="pt-6">
        <KeysTab tenant={tenant} />
      </TabsContent>
      <TabsContent value="embed" className="pt-6">
        <EmbedTab tenant={tenant} />
      </TabsContent>
    </Tabs>
  )
}

/* ── 일반: name · CORS · autoApprove · plan · usage ─────────────────────── */

function GeneralTab({ tenant }: { tenant: TenantDto }) {
  const update = useUpdateTenant()
  const [name, setName] = useState(tenant.name)
  const [origins, setOrigins] = useState<string[]>(
    tenant.corsOrigins.length ? tenant.corsOrigins : ['']
  )
  const [autoApprove, setAutoApprove] = useState(tenant.autoApprove)
  const [plan, setPlan] = useState<Plan>(tenant.plan)

  const setOrigin = (i: number, v: string) =>
    setOrigins((prev) => prev.map((o, idx) => (idx === i ? v : o)))
  const addOrigin = () => setOrigins((prev) => [...prev, ''])
  const removeOrigin = (i: number) =>
    setOrigins((prev) => (prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i)))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    update.mutate(
      {
        name: name.trim(),
        corsOrigins: origins.map((o) => o.trim()).filter(Boolean),
        autoApprove,
        plan,
      },
      {
        onSuccess: () => toast.success('설정을 저장했습니다'),
        onError: (err) => toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.'),
      }
    )
  }

  const limit = FREE_PLAN_LIMIT
  const usagePct = Math.min(100, Math.round((tenant.usageCount / limit) * 100))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>일반 설정</CardTitle>
          <CardDescription>이름·허용 도메인·검수 정책·요금제를 변경합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <Field label="서비스 이름" htmlFor="set-name" required>
              <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <div>
              <div className="flex items-center justify-between">
                <Label className="mb-0">허용 도메인 (CORS)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addOrigin}>
                  <Plus className="size-3.5" /> 추가
                </Button>
              </div>
              <p className="mt-1 mb-2 text-xs text-text-subtle">
                위젯을 띄울 도메인. <code className="font-mono">*</code> 는 전체 허용(개발용).
              </p>
              <div className="space-y-2">
                {origins.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={o}
                      onChange={(e) => setOrigin(i, e.target.value)}
                      placeholder="https://acme.com"
                      className="font-mono"
                      aria-label={`허용 도메인 ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOrigin(i)}
                      aria-label={`도메인 ${i + 1} 삭제`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-3">
              <Label htmlFor="set-auto" className="mb-0">
                자동 승인
                <span className="mt-0.5 block text-xs font-normal text-text-subtle">
                  켜면 제출 즉시 승인되어 위젯에 바로 노출됩니다.
                </span>
              </Label>
              <Switch id="set-auto" checked={autoApprove} onCheckedChange={setAutoApprove} />
            </div>

            <Field
              label="요금제"
              htmlFor="set-plan"
              hint="free 플랜은 누적 제출 소프트 한도가 적용됩니다."
            >
              <Select id="set-plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" loading={update.isPending}>
              <Save className="size-4" /> 저장
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>요금제 · 사용량</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">현재 요금제</span>
              <PlanBadge plan={tenant.plan} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-text-muted">누적 제출</span>
                <span className="font-mono text-text">
                  {formatNumber(tenant.usageCount)}
                  {tenant.plan === 'free' ? ` / ${formatNumber(limit)}` : ''}
                </span>
              </div>
              {tenant.plan === 'free' ? (
                <MiniBar
                  rows={[
                    {
                      label: '사용량',
                      count: usagePct,
                      tone: usagePct >= 90 ? 'danger' : 'accent',
                    },
                  ]}
                  total={100}
                  emptyText="아직 제출이 없습니다."
                />
              ) : (
                <p className="text-xs text-text-subtle">유료 플랜은 소프트 한도가 없습니다.</p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-y-1.5 border-t border-border pt-3 text-xs">
              <dt className="text-text-subtle">slug</dt>
              <dd className="text-right font-mono text-text-muted">{tenant.slug}</dd>
              <dt className="text-text-subtle">가입일</dt>
              <dd className="text-right font-mono text-text-muted">
                {formatDate(tenant.createdAt)}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ── API 키: publishable 표시 + secret 회전 ──────────────────────────────── */

function KeysTab({ tenant }: { tenant: TenantDto }) {
  const rotate = useRotateKeys()
  const [rotated, setRotated] = useState<TenantCreatedDto | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const doRotate = () => {
    rotate.mutate(undefined, {
      onSuccess: (data) => {
        setRotated(data)
        setConfirmOpen(false)
        toast.success('키를 회전했습니다 — 기존 키는 즉시 무효입니다.')
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : '키 회전에 실패했습니다.'),
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Publishable 키</CardTitle>
          <CardDescription>브라우저 노출 안전. 위젯에 사용합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-text">
              {rotated?.publishableKey ?? tenant.publishableKey}
            </code>
            <CopyButton
              value={rotated?.publishableKey ?? tenant.publishableKey}
              label="publishable 키 복사"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Secret 키</CardTitle>
          <CardDescription>서버 전용(검수·CRUD). 평문은 회전 직후에만 보입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rotated ? (
            <>
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-text">
                  {rotated.secretKey}
                </code>
                <CopyButton value={rotated.secretKey} label="secret 키 복사" />
              </div>
              <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="text-[0.8125rem]">
                  지금 복사해 두세요. 이 화면을 벗어나면 다시 볼 수 없습니다.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              secret 키 평문은 저장하지 않습니다(해시만 보관). 분실 시 아래에서 회전해 새 키를
              발급하세요.
            </p>
          )}

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              <RotateCw className="size-4" /> 키 회전(재발급)
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>키를 회전할까요?</DialogTitle>
                <DialogDescription>
                  새 publishable/secret 키가 발급되고 <strong>기존 키는 즉시 무효</strong>가 됩니다.
                  배포된 위젯의 키도 모두 교체해야 합니다.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  취소
                </Button>
                <Button variant="danger" onClick={doRotate} loading={rotate.isPending}>
                  회전 진행
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}

/* ── 임베드: 위젯별 스니펫 (React + script) ──────────────────────────────── */

function EmbedTab({ tenant }: { tenant: TenantDto }) {
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://reviews.example.com')
  const [subjectId, setSubjectId] = useState('pro-plan')

  const cfg = {
    publishableKey: tenant.publishableKey,
    endpoint: apiBase,
    subjectId: subjectId.trim() || 'pro-plan',
    subjectLabel: '',
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>설치</CardTitle>
          <CardDescription>
            React 앱은 패키지를, 비-React 사이트는 IIFE 스크립트를 씁니다. 위젯에는 publishable 키만
            들어갑니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock
            code={`npm i @reviewdesk/widget
# 또는: pnpm add @reviewdesk/widget`}
            language="bash"
          />
          <Field
            label="미리보기 subjectId"
            htmlFor="embed-subject"
            hint="스니펫에 들어갈 리뷰 대상 식별자(소문자·숫자·하이픈)."
          >
            <Input
              id="embed-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="max-w-xs font-mono"
            />
          </Field>
        </CardContent>
      </Card>

      {WIDGETS.map((w) => (
        <Card key={w.id}>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Check className="size-4 text-success" aria-hidden />
                {w.label}{' '}
                <code className="font-mono text-xs text-text-subtle">&lt;{w.id} /&gt;</code>
              </span>
            </CardTitle>
            <CardDescription>{w.desc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="react">
              <TabsList>
                <TabsTrigger value="react">React</TabsTrigger>
                <TabsTrigger value="script">&lt;script&gt;</TabsTrigger>
              </TabsList>
              <TabsContent value="react" className="pt-4">
                <CodeBlock code={reactWidgetSnippet(w.id, cfg)} language="tsx" />
              </TabsContent>
              <TabsContent value="script" className="pt-4">
                <CodeBlock code={vanillaSnippet(cfg)} language="html" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
