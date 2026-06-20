import { type Plan, type TenantDto, type TenantWithKeysDto } from '@changelogdesk/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
import { KeyField } from '@/components/feature/KeyField'
import { PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorState, Spinner } from '@/components/ui/feedback'
import { Field, Select, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getTenant, rotateKeys, updateTenant } from '@/services/changelog'
import { cn } from '@/utils/cn'

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const over = used > limit
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">월간 공개 호출</span>
        <span className={cn('font-mono', over ? 'text-danger' : 'text-text')}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full transition-all', over ? 'bg-danger' : 'bg-accent')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * 구성 폼(허용 Origin·요금제) — 편집 가능한 폼 상태를 테넌트 값으로 초기화한다.
 * 부모는 `key={tenant.id}` 로 렌더해 테넌트가 바뀌면 이 컴포넌트를 리마운트하므로
 * useState 초기값만으로 동기화된다(이펙트·ref 불필요 → React Compiler 규칙 준수).
 */
function ConfigForm({ tenant, onSaved }: { tenant: TenantDto; onSaved: () => void }) {
  const [originsText, setOriginsText] = useState(() => tenant.corsOrigins.join('\n'))
  const [plan, setPlan] = useState<Plan>(tenant.plan)

  const saveMutation = useMutation({
    mutationFn: () => {
      const corsOrigins = originsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
      return updateTenant({ corsOrigins, plan })
    },
    onSuccess: () => {
      toast.success('설정을 저장했습니다.')
      onSaved()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>구성</CardTitle>
        <CardDescription>허용 Origin 과 요금제를 변경합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field
          label="허용 Origin (CORS)"
          htmlFor="cors-origins"
          hint="위젯을 임베드할 사이트 origin(줄/쉼표 구분). '*' 는 모두 허용(로컬·데모 전용, 운영 비권장)."
        >
          <Textarea
            id="cors-origins"
            value={originsText}
            onChange={(e) => setOriginsText(e.target.value)}
            placeholder={'https://app.example.com\nhttps://www.example.com'}
            className="min-h-24 font-mono text-[0.8125rem]"
          />
        </Field>
        <Field label="요금제" htmlFor="plan">
          <Select id="plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            <option value="free">Free — 월간 소프트 한도</option>
            <option value="pro">Pro — 한도 없음</option>
          </Select>
        </Field>
        <div className="flex justify-end">
          <Button
            variant="accent"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="size-4" /> 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  useDocumentTitle('테넌트 설정')
  const qc = useQueryClient()
  const login = useAuthStore((s) => s.login)
  const auth = useAuthStore((s) => ({
    credential: s.credential,
    mode: s.mode,
    tenantId: s.tenantId,
  }))

  const {
    data: tenant,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'tenant'],
    queryFn: getTenant,
  })

  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotated, setRotated] = useState<TenantWithKeysDto | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'tenant'] })

  const rotateMutation = useMutation({
    mutationFn: rotateKeys,
    onSuccess: (data) => {
      setRotateOpen(false)
      setRotated(data)
      toast.success('키가 회전되었습니다. 새 시크릿 키를 저장하세요.')
      // secret 모드로 로그인 중이었다면 새 시크릿 키로 자격증명을 갱신(기존 키는 무효화됨).
      if (auth.mode === 'secret') {
        login(data.secretKey)
      }
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (isError || !tenant) {
    return (
      <div className="mx-auto max-w-md py-16">
        <ErrorState
          title="테넌트 정보를 불러오지 못했습니다"
          description={(error as Error)?.message ?? undefined}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{tenant.name}</h1>
          <PlanBadge plan={tenant.plan} />
        </div>
        <p className="mt-1 text-pretty text-text-muted">
          slug{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">{tenant.slug}</code>{' '}
          · 가입{' '}
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
            new Date(tenant.createdAt)
          )}
        </p>
      </div>

      {/* 사용량 */}
      <Card>
        <CardHeader>
          <CardTitle>사용량</CardTitle>
          <CardDescription>
            free 플랜은 월간 공개 위젯 호출에 소프트 한도가 있습니다(초과해도 차단하지 않음).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UsageBar used={tenant.usageCount} limit={tenant.monthlyLimit} />
          {tenant.overLimit ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-text">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>소프트 한도를 초과했습니다. Pro 플랜으로 업그레이드를 고려하세요.</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 퍼블리시 키 */}
      <Card>
        <CardHeader>
          <CardTitle>퍼블리시 키</CardTitle>
          <CardDescription>
            브라우저·위젯에서 사용하는 읽기 전용 키입니다. 노출되어도 안전합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeyField value={tenant.publishableKey} label="퍼블리시 키" />
        </CardContent>
      </Card>

      {/* 설정 폼 — 테넌트 id 로 키잉해 테넌트 변경 시 폼 상태를 재초기화한다. */}
      <ConfigForm key={tenant.id} tenant={tenant} onSaved={invalidate} />

      {/* 키 회전(위험 구역) */}
      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle>키 회전</CardTitle>
          <CardDescription>
            새 pk/sk 를 발급하고 기존 키를 즉시 무효화합니다. 위젯·서버 설정을 모두 갱신해야 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="danger" onClick={() => setRotateOpen(true)}>
            <RefreshCw className="size-4" /> 키 회전
          </Button>
        </CardContent>
      </Card>

      {/* 회전 확인 다이얼로그 */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>키를 회전할까요?</DialogTitle>
            <DialogDescription>
              기존 퍼블리시·시크릿 키가 즉시 무효화됩니다. 임베드된 위젯과 서버 환경변수를 새 키로
              교체하기 전까지 요청이 실패할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">취소</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={rotateMutation.isPending}
              onClick={() => rotateMutation.mutate()}
            >
              <RefreshCw className="size-4" /> 회전 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 회전 결과(새 키 1회 노출) 다이얼로그 */}
      <Dialog open={rotated !== null} onOpenChange={(v) => !v && setRotated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 키가 발급되었습니다</DialogTitle>
            <DialogDescription>
              시크릿 키는 지금만 표시됩니다. 안전한 곳에 복사해 두세요.
            </DialogDescription>
          </DialogHeader>
          {rotated ? (
            <div className="space-y-4">
              <Field label="퍼블리시 키 (pk_)" htmlFor="rotated-pk">
                <KeyField value={rotated.publishableKey} label="퍼블리시 키" />
              </Field>
              <Field label="시크릿 키 (sk_)" htmlFor="rotated-sk">
                <KeyField value={rotated.secretKey} label="시크릿 키" secret />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="accent">확인했습니다</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
