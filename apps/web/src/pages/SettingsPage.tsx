import { type Plan, type TenantCreatedDto } from '@communitydesk/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, KeyRound, Plus, RefreshCw, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StatCard } from '@/components/feature/StatCard'
import { Badge } from '@/components/ui/badge'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { CopyButton, EmptyState, Spinner } from '@/components/ui/feedback'
import { Field, Input, Label, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { getTenant, rotateKeys, updateTenant } from '@/services/community'
import { formatDate, formatNumber } from '@/utils/format'

const PLAN_LABEL: Record<Plan, string> = { free: 'Free', pro: 'Pro', scale: 'Scale' }
const PLAN_TONE: Record<Plan, 'neutral' | 'accent' | 'success'> = {
  free: 'neutral',
  pro: 'accent',
  scale: 'success',
}

export default function SettingsPage() {
  useDocumentTitle('테넌트 설정')
  const qc = useQueryClient()
  const tenantQ = useQuery({ queryKey: ['tenant'], queryFn: getTenant })

  const [name, setName] = useState('')
  const [plan, setPlan] = useState<Plan>('free')
  const [origins, setOrigins] = useState<string[]>([''])
  const [rotated, setRotated] = useState<TenantCreatedDto | null>(null)

  // 서버에서 받은 테넌트 값으로 편집 가능한 폼을 초기화한다(비동기 데이터 도착 시 시드).
  // 편집 폼은 로컬 상태가 필요하므로 외부(서버) 상태를 effect 에서 로컬로 동기화하는 것이
  // 적절하다 — 이 한 블록에 한해 set-state-in-effect 를 끈다(렌더 중 파생 불가).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const t = tenantQ.data
    if (!t) return
    setName(t.name)
    setPlan(t.plan)
    setOrigins(t.corsOrigins.length > 0 ? t.corsOrigins : [''])
  }, [tenantQ.data])
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useMutation({
    mutationFn: () =>
      updateTenant({
        name: name.trim(),
        plan,
        corsOrigins: origins.map((o) => o.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant'] })
      toast.success('설정을 저장했습니다.')
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : '저장에 실패했습니다.'),
  })

  const rotate = useMutation({
    mutationFn: rotateKeys,
    onSuccess: (res) => {
      setRotated(res)
      void qc.invalidateQueries({ queryKey: ['tenant'] })
      toast.success('키를 회전했습니다. 기존 키는 즉시 무효입니다.')
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : '키 회전에 실패했습니다.'),
  })

  if (tenantQ.isLoading) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-text-muted">
        <Spinner /> 설정을 불러오는 중…
      </div>
    )
  }

  const tenant = tenantQ.data
  if (!tenant) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="테넌트 정보를 불러올 수 없습니다"
        description="ADMIN_TOKEN 으로 로그인했다면 대상 테넌트를 지정해야 합니다. secret 키로 다시 로그인해 보세요."
      />
    )
  }

  const setOrigin = (i: number, v: string) =>
    setOrigins((prev) => prev.map((o, idx) => (idx === i ? v : o)))
  const addOrigin = () => setOrigins((prev) => [...prev, ''])
  const removeOrigin = (i: number) =>
    setOrigins((prev) => (prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i)))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">테넌트 설정</h1>
        <p className="mt-1 text-pretty text-text-muted">
          이름·플랜·CORS 허용 origin 을 관리하고, 사용량을 확인하고, 키를 회전합니다.
        </p>
      </div>

      {/* 사용량 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="누적 글 작성"
          value={formatNumber(tenant.postsCount)}
          hint="무료 플랜 소프트 한도 검사 기준"
        />
        <StatCard label="누적 글 읽기" value={formatNumber(tenant.readsCount)} tone="info" />
        <StatCard
          label="현재 플랜"
          value={<Badge tone={PLAN_TONE[tenant.plan]}>{PLAN_LABEL[tenant.plan]}</Badge>}
          hint={`가입일 ${formatDate(tenant.createdAt)}`}
        />
      </div>

      {/* 기본 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="서비스 이름" htmlFor="set-name">
              <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field
              label="플랜"
              htmlFor="set-plan"
              hint="free 는 누적 글 작성 소프트 한도가 적용됩니다."
            >
              <Select id="set-plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
                {(Object.keys(PLAN_LABEL) as Plan[]).map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABEL[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="cors-0" className="mb-0">
                허용 Origin (CORS)
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={addOrigin}>
                <Plus className="size-3.5" /> 추가
              </Button>
            </div>
            <div className="space-y-2">
              {origins.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    id={`cors-${i}`}
                    value={o}
                    onChange={(e) => setOrigin(i, e.target.value)}
                    placeholder="https://app.example.com  (또는 *)"
                    className="font-mono"
                    aria-label={`허용 origin ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeOrigin(i)}
                    aria-label="이 origin 제거"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-text-subtle">
              공개 위젯이 호출할 사이트의 origin 허용목록. <code className="font-mono">*</code> 는
              전체 허용(개발/데모용).
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              <Save className="size-4" /> 저장
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
            <p className="mb-1.5 text-[0.8125rem] font-medium text-text">
              Publishable 키 <span className="text-text-subtle">(브라우저 노출 안전)</span>
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
                {tenant.publishableKey}
              </code>
              <CopyButton value={tenant.publishableKey} label="publishable 키 복사" />
            </div>
          </div>
          <div className="rounded-md border border-border bg-surface-2/60 p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-text-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">Secret 키 회전</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  새 publishable·secret 키를 발급합니다.{' '}
                  <strong className="text-danger">기존 키는 즉시 무효</strong> 가 되어, 임베드한
                  모든 곳의 키를 교체해야 합니다.
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="danger" size="sm">
                    <RefreshCw className="size-4" /> 키 회전
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>키를 회전할까요?</DialogTitle>
                    <DialogDescription>
                      현재 publishable·secret 키가 즉시 무효가 됩니다. 위젯·서버에 박힌 키를 모두 새
                      값으로 교체해야 정상 동작합니다. 되돌릴 수 없습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost" size="sm">
                        취소
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => rotate.mutate()}
                        loading={rotate.isPending}
                      >
                        회전 실행
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 회전 결과 — secret 1회 노출 */}
      <Dialog open={rotated !== null} onOpenChange={(o) => !o && setRotated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 키가 발급됐습니다</DialogTitle>
            <DialogDescription>
              secret 키는 지금 한 번만 표시됩니다. 안전한 곳(서버 환경변수)에 보관하세요.
            </DialogDescription>
          </DialogHeader>
          {rotated ? (
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[0.8125rem] font-medium text-text">Publishable 키</p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
                    {rotated.publishableKey}
                  </code>
                  <CopyButton value={rotated.publishableKey} label="publishable 키 복사" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[0.8125rem] font-medium text-text">
                  Secret 키 <span className="text-danger">(1회 노출)</span>
                </p>
                <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger-soft/40 px-3 py-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
                    {rotated.secretKey}
                  </code>
                  <CopyButton value={rotated.secretKey} label="secret 키 복사" />
                </div>
              </div>
              <CodeBlock
                code={`COMMUNITYDESK_PUBLISHABLE_KEY=${rotated.publishableKey}\nCOMMUNITYDESK_SECRET_KEY=${rotated.secretKey}`}
                language="bash"
              />
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm">확인</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
