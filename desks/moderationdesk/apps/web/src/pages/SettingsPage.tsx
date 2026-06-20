import { FREE_PLAN_LIMIT, type Plan, type TenantCreatedDto } from '@moderationdesk/shared'
import { Activity, KeyRound, RefreshCw, Save, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
import { StatCard } from '@/components/feature/StatCard'
import { Badge, PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { useCredKey } from '@/hooks/useCredKey'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useRotateKeys, useTenant, useUpdateTenant } from '@/services/moderation'
import { formatDate, formatNumber } from '@/utils/format'

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: 'free', label: 'Free (소프트 한도 적용)' },
  { value: 'pro', label: 'Pro' },
  { value: 'scale', label: 'Scale' },
]

export default function SettingsPage() {
  useDocumentTitle('설정')
  const credKey = useCredKey()
  const authKind = useAuthStore((s) => s.kind)
  const tenantQ = useTenant(credKey)
  const updateTenant = useUpdateTenant(credKey)
  const rotate = useRotateKeys(credKey)

  const tenant = tenantQ.data

  const [name, setName] = useState('')
  const [plan, setPlan] = useState<Plan>('free')
  const [origins, setOrigins] = useState('')
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotated, setRotated] = useState<TenantCreatedDto | null>(null)

  // 테넌트가 로드되면 폼을 초기화한다. 비동기 서버 데이터→폼 상태 동기화라 effect 가 올바른
  // 도구다(React Compiler set-state-in-effect 휴리스틱만 의도적으로 완화한다).
  useEffect(() => {
    if (tenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 로드된 테넌트→폼 동기화
      setName(tenant.name)
      setPlan(tenant.plan)
      setOrigins(tenant.corsOrigins.join('\n'))
    }
  }, [tenant])

  if (tenantQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (tenantQ.isError || !tenant) {
    return (
      <EmptyState
        icon={KeyRound}
        title="테넌트 정보를 불러오지 못했습니다"
        description={
          tenantQ.error instanceof Error ? tenantQ.error.message : '자격증명을 확인해 주세요.'
        }
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void tenantQ.refetch()}
            loading={tenantQ.isFetching}
          >
            <RefreshCw className="size-4" />
            다시 시도
          </Button>
        }
      />
    )
  }

  const limit = tenant.plan === 'free' ? FREE_PLAN_LIMIT : null
  const usageHint =
    limit != null
      ? `무료 한도 ${formatNumber(limit)} 중 ${formatNumber(tenant.usageCount)} 사용`
      : '한도 없음 (유료)'

  const saveSettings = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('서비스 이름을 입력해 주세요.')
      return
    }
    const corsOrigins = origins
      .split(/[\n,]/)
      .map((o) => o.trim())
      .filter(Boolean)

    updateTenant.mutate(
      { name: trimmedName, plan, corsOrigins },
      {
        onSuccess: () => toast.success('설정이 저장되었습니다.'),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : '저장에 실패했습니다.'),
      }
    )
  }

  const doRotate = () => {
    rotate.mutate(undefined, {
      onSuccess: (data) => {
        setRotated(data)
        setRotateOpen(false)
        toast.success('키가 회전되었습니다. 새 secret 키를 저장하세요.')
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : '회전에 실패했습니다.'),
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">설정</h1>
        <p className="mt-1 text-sm text-text-muted">
          테넌트 <span className="font-mono font-medium text-text">{tenant.slug}</span> 의
          설정·키·사용량.
        </p>
      </div>

      {/* 사용량 */}
      <section aria-label="사용량" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Activity}
          label="누적 검사 (usage)"
          value={formatNumber(tenant.usageCount)}
          hint={usageHint}
          tone={limit != null && tenant.usageCount >= limit ? 'danger' : 'neutral'}
        />
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-text-subtle">
            <span className="text-xs font-medium">요금제</span>
          </div>
          <div className="mt-2.5">
            <PlanBadge plan={tenant.plan} />
          </div>
          <p className="mt-2 text-xs text-text-subtle">가입일 {formatDate(tenant.createdAt)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-text-subtle">
            <Sparkles className="size-4" aria-hidden />
            <span className="text-xs font-medium">AI 보조</span>
          </div>
          <p className="mt-2.5 text-sm text-text-muted">
            서버 환경 변수{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
              ANTHROPIC_API_KEY
            </code>{' '}
            로 제어됩니다. 검사별로 useAi 로 끌 수 있습니다(검사 테스트 참고).
          </p>
        </div>
      </section>

      {/* 기본 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="서비스 이름" htmlFor="set-name" required>
              <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field
              label="요금제"
              htmlFor="set-plan"
              hint={
                authKind === 'admin'
                  ? '운영자가 플랜을 조정할 수 있습니다.'
                  : '플랜 변경은 데모용입니다.'
              }
            >
              <Select id="set-plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="허용 Origin (CORS)"
            htmlFor="set-origins"
            hint="브라우저(pk) 호출을 허용할 origin. 줄바꿈/쉼표로 여러 개. '*' = 전체 허용. 비우면 Origin 없는 호출만 통과."
          >
            <Textarea
              id="set-origins"
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              placeholder={'https://app.example.com\n*'}
              className="min-h-24 font-mono text-[0.8125rem]"
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveSettings} loading={updateTenant.isPending}>
              <Save className="size-4" />
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 키 */}
      <Card>
        <CardHeader>
          <CardTitle>API 키</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[0.8125rem] font-medium text-text">Publishable 키</span>
              <Badge tone="info" size="sm">
                브라우저 안전
              </Badge>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-text">
                {tenant.publishableKey}
              </code>
              <CopyButton value={tenant.publishableKey} label="publishable 키 복사" />
            </div>
          </div>
          <div className="rounded-md border border-border bg-surface-2/60 p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-5 shrink-0 text-text-subtle" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">Secret 키 회전</p>
                <p className="mt-0.5 text-[0.8125rem] text-text-muted">
                  secret 키는 보안상 다시 표시할 수 없습니다. 노출되었거나 분실했다면 회전하세요.
                  회전하면 새 publishable·secret 키가 발급되고 기존 키는 즉시 무효가 됩니다.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setRotateOpen(true)}
                >
                  <RefreshCw className="size-4" />키 회전
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 회전 확인 다이얼로그 */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>키를 회전할까요?</DialogTitle>
            <DialogDescription>
              기존 publishable·secret 키가 즉시 무효가 됩니다. 위젯·서버에 배포된 키도 모두 교체해야
              합니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">취소</Button>
            </DialogClose>
            <Button variant="danger" onClick={doRotate} loading={rotate.isPending}>
              회전
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 회전 결과(새 secret 1회 노출) */}
      <Dialog open={rotated !== null} onOpenChange={(o) => !o && setRotated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 키가 발급되었습니다</DialogTitle>
            <DialogDescription>
              새 secret 키는 지금 단 한 번만 표시됩니다. 안전한 곳에 저장하세요.
            </DialogDescription>
          </DialogHeader>
          {rotated ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-text-subtle">Publishable 키</p>
                <CodeBlock code={rotated.publishableKey} language="text" />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-subtle">Secret 키 (1회 노출)</p>
                <CodeBlock code={rotated.secretKey} language="text" />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setRotated(null)}>저장했습니다</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
