import { type TenantCredentialsDto, type UpdateTenantInput } from '@notifydesk/shared'
import { Globe, KeyRound, Mail, RotateCcw, Save, Bell } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSessionStore } from '@/app/sessionStore'
import { CredentialsPanel } from '@/components/feature/CredentialsPanel'
import { Badge, PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Label, Select, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useRotateKeys, useTenant, useUpdateTenant } from '@/services/notifications'
import { formatDateTime } from '@/utils/format'

export default function SettingsPage() {
  useDocumentTitle('설정')
  const tenant = useTenant()
  const updateTenant = useUpdateTenant()
  const rotate = useRotateKeys()
  const signIn = useSessionStore((s) => s.signIn)
  const session = useSessionStore((s) => s.session)

  const [name, setName] = useState('')
  const [corsText, setCorsText] = useState('')
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotated, setRotated] = useState<TenantCredentialsDto | null>(null)

  // 테넌트가 로드/변경되면 폼을 서버 값으로 시드한다. effect 대신 렌더 중
  // 이전 식별자와 비교해 조정하는 패턴(react.dev "adjusting state when a prop changes")
  // 으로 set-state-in-effect 를 피한다.
  const data = tenant.data
  const [syncedId, setSyncedId] = useState<string | null>(null)
  if (data && data.id !== syncedId) {
    setSyncedId(data.id)
    setName(data.name)
    setCorsText(data.corsOrigins.join('\n'))
    setPlan(data.plan)
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    const corsOrigins = corsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const input: UpdateTenantInput = {
      name: name.trim() || undefined,
      corsOrigins,
      plan,
    }
    try {
      await updateTenant.mutateAsync(input)
      toast.success('설정이 저장되었습니다.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했습니다.')
    }
  }

  const doRotate = async () => {
    try {
      const result = await rotate.mutateAsync()
      setRotated(result)
      setRotateOpen(false)
      // 새 secret 키로 세션 갱신(secret 세션이었다면 끊기지 않게).
      if (session.kind === 'secret') {
        signIn({
          kind: 'secret',
          secretKey: result.secretKey,
          tenantId: result.id,
          publishableKey: result.publishableKey,
        })
      } else {
        signIn({ ...session, publishableKey: result.publishableKey })
      }
      toast.success('키가 새로 발급되었습니다. 이전 키는 더 이상 동작하지 않습니다.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '키 발급에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">설정</h1>
          <p className="mt-1 text-sm text-text-muted">테넌트 프로필 · CORS · 요금제 · 키 · 채널.</p>
        </div>
        {data ? <PlanBadge plan={data.plan} /> : null}
      </div>

      {tenant.isLoading ? (
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : tenant.isError || !data ? (
        <ErrorState
          title="테넌트 정보를 불러오지 못했습니다"
          description="세션이 만료되었거나 네트워크 문제일 수 있습니다. 다시 시도하거나 다시 로그인해 주세요."
          onRetry={() => void tenant.refetch()}
          retrying={tenant.isFetching}
        />
      ) : (
        <>
          {/* 프로필 / CORS / 플랜 */}
          <Card>
            <CardHeader>
              <CardTitle>테넌트 프로필</CardTitle>
              <CardDescription>
                CORS 허용목록은 publishable(pk_) 키로 호출 가능한 출처를 제한합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveSettings} className="space-y-4">
                <Field label="이름" htmlFor="set-name">
                  <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="slug" htmlFor="set-slug" hint="slug 는 변경할 수 없습니다.">
                  <Input id="set-slug" value={data?.slug ?? ''} className="font-mono" disabled />
                </Field>
                <Field
                  label="허용 Origin (CORS)"
                  htmlFor="set-cors"
                  hint="줄바꿈/쉼표 구분. * 는 전체 허용(개발). 예: https://app.example.com"
                >
                  <Textarea
                    id="set-cors"
                    value={corsText}
                    onChange={(e) => setCorsText(e.target.value)}
                    rows={3}
                    className="font-mono"
                  />
                </Field>
                <Field
                  label="요금제"
                  htmlFor="set-plan"
                  hint="free 는 소프트 캡 적용, pro 는 무제한."
                >
                  <Select
                    id="set-plan"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as 'free' | 'pro')}
                  >
                    <option value="free">Free (소프트 캡)</option>
                    <option value="pro">Pro (무제한)</option>
                  </Select>
                </Field>
                <Button type="submit" loading={updateTenant.isPending}>
                  <Save className="size-4" /> 저장
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 사용량 */}
          <Card>
            <CardHeader>
              <CardTitle>사용량</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-text-subtle">tenantId</dt>
                <dd className="flex items-center gap-2 font-mono text-text">
                  {data?.id}
                  {data ? <CopyButton value={data.id} label="tenantId 복사" /> : null}
                </dd>
                <dt className="text-text-subtle">누적 발송</dt>
                <dd className="font-mono text-text">{data?.usageCount ?? 0}</dd>
                <dt className="text-text-subtle">생성일</dt>
                <dd className="text-text">{formatDateTime(data?.createdAt)}</dd>
              </dl>
            </CardContent>
          </Card>

          {/* 키 */}
          <Card>
            <CardHeader>
              <CardTitle>API 키</CardTitle>
              <CardDescription>
                publishable(pk_)은 브라우저 안전. secret(sk_)은 서버 전용이며 해시로만 저장되어 다시
                볼 수 없습니다 — 분실 시 로테이션하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-1.5">Publishable key</Label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
                  <KeyRound className="size-3.5 shrink-0 text-accent-strong" aria-hidden />
                  <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
                    {data?.publishableKey}
                  </code>
                  {data ? (
                    <CopyButton value={data.publishableKey} label="publishable 키 복사" />
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                <span className="text-[0.8125rem] text-text-muted">
                  키를 새로 발급하면 이전 pk_/sk_ 는 즉시 무효화됩니다.
                </span>
                <Button variant="secondary" size="sm" onClick={() => setRotateOpen(true)}>
                  <RotateCcw className="size-4" /> 키 로테이션
                </Button>
              </div>

              {rotated ? (
                <div className="rounded-lg border border-border bg-surface-2 p-4">
                  <CredentialsPanel credentials={rotated} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* 채널 설정(서버 환경) */}
          <Card>
            <CardHeader>
              <CardTitle>채널 구성</CardTitle>
              <CardDescription>
                채널 동작은 서버 환경 변수로 정해집니다(아래는 안내). 테넌트 단위 토글은 발송 시
                선호(type×channel)로 제어합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <Bell className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
                  <div>
                    <p className="font-medium text-text">
                      in-app{' '}
                      <Badge tone="success" size="sm">
                        항상 켜짐
                      </Badge>
                    </p>
                    <p className="text-text-muted">모든 알림은 인박스에 저장됩니다(끌 수 없음).</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                  <div>
                    <p className="font-medium text-text">email</p>
                    <p className="text-text-muted">
                      서버 <code className="font-mono">SMTP_URL</code> 설정 시 SMTP, 없으면 콘솔
                      로그 어댑터. <code className="font-mono">EMAIL_FROM</code> 으로 발신자 지정.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Globe className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <div>
                    <p className="font-medium text-text">web-push</p>
                    <p className="text-text-muted">
                      <code className="font-mono">VAPID_PUBLIC_KEY</code>/
                      <code className="font-mono">VAPID_PRIVATE_KEY</code> 둘 다 설정 시 동작,
                      아니면 no-op.
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {/* 로테이션 확인 */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>키를 로테이션할까요?</DialogTitle>
            <DialogDescription>
              새 publishable·secret 키가 발급되고 기존 키는 즉시 무효화됩니다. 임베드된 위젯·서버
              SDK 의 키를 모두 교체해야 합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRotateOpen(false)}>
              취소
            </Button>
            <Button variant="danger" size="sm" loading={rotate.isPending} onClick={doRotate}>
              새 키 발급
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
