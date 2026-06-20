import {
  PLAN_IDS,
  PLAN_LABELS,
  PLAN_PRICES_KRW,
  PLAN_TAGLINES,
  ROLES,
  ROLE_LABELS,
  can,
  formatPlanLimit,
  formatPlanPrice,
  inviteMemberSchema,
  isUnlimited,
  orgLogoUrlSchema,
  planLimitBullets,
  updateOrgSchema,
  type InviteMemberInput,
  type OrgDto,
  type PlanId,
  type UpdateOrgInput,
} from '@termsdesk/shared'
import { Check, Pencil, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { z } from 'zod'

import { OrgIcon } from '@/components/common/OrgIcon'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  useChangePlan,
  useInviteMember,
  useMembers,
  usePlanUsage,
  useUpdateOrg,
} from '@/services/admin'
import { useSession } from '@/services/auth'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'
import { zodFormResolver } from '@/utils/zodFormResolver'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  )
}

export default function SettingsPage() {
  useDocumentTitle('설정')
  const session = useSession()
  const members = useMembers()

  return (
    <>
      <PageHeader title="설정" description="조직 정보와 멤버를 관리합니다." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            action={
              session.data && can(session.data.user.role, 'member.manage') ? (
                <EditOrgDialog
                  key={`${session.data.org.name}:${session.data.org.logoUrl ?? ''}`}
                  org={session.data.org}
                />
              ) : null
            }
          >
            <CardTitle>조직</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label="이름">{session.data?.org.name ?? '—'}</Row>
              <Row label="slug">
                <span className="font-mono text-xs">{session.data?.org.slug}</span>
              </Row>
              <Row label="로고">
                <span className="flex items-center gap-2">
                  <span className="text-xs text-text-subtle">
                    {session.data?.org.logoUrl
                      ? '공개 약관 페이지에 표시 중'
                      : '미설정 — 이니셜 모노그램'}
                  </span>
                  <OrgIcon
                    name={session.data?.org.name ?? '?'}
                    logoUrl={session.data?.org.logoUrl}
                    className="size-6"
                  />
                </span>
              </Row>
              <Row label="배포 형태">
                <Badge tone={session.data?.mode === 'saas' ? 'info' : 'accent'} size="sm">
                  {session.data?.mode === 'saas' ? 'SaaS (멀티테넌트)' : 'self-hosted (사내 설치)'}
                </Badge>
              </Row>
              <Row label="생성일">{formatDate(session.data?.org.createdAt)}</Row>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader action={<InviteMemberDialog />}>
            <CardTitle>멤버</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {members.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <THead>
                  <TR className="bg-surface-2/50">
                    <TH>이름</TH>
                    <TH className="hidden sm:table-cell">이메일</TH>
                    <TH>역할</TH>
                  </TR>
                </THead>
                <TBody>
                  {members.data?.map((m) => (
                    <TR key={m.id}>
                      <TD className="font-medium text-text">{m.name}</TD>
                      <TD className="hidden text-text-muted sm:table-cell">{m.email}</TD>
                      <TD>
                        <Badge tone="outline" size="sm">
                          {ROLE_LABELS[m.role]}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <PlanSection />
    </>
  )
}

/** 플랜 현황 + 사용량 미터 + 3티어 비교/변경 — 청구는 mock(결정 기록만, 실제 결제 없음). */
function PlanSection() {
  const session = useSession()
  const usage = usePlanUsage()
  const change = useChangePlan()
  const [target, setTarget] = useState<PlanId | null>(null)
  const canManage = session.data ? can(session.data.user.role, 'member.manage') : false
  const data = usage.data

  const confirm = () => {
    if (!target) return
    change.mutate(target, {
      onSuccess: (org) => {
        toast.success(`${PLAN_LABELS[org.plan]} 플랜으로 변경했습니다 — 데모(실제 결제 없음)`)
        setTarget(null)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '플랜 변경에 실패했습니다'),
    })
  }

  return (
    <section aria-label="플랜 및 사용량" className="mt-5 space-y-5">
      <Card>
        <CardHeader
          action={
            <Badge tone="outline" size="sm">
              데모 — 실제 결제 없음
            </Badge>
          }
        >
          <CardTitle>플랜 · 사용량</CardTitle>
        </CardHeader>
        <CardContent>
          {usage.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : usage.isError || !data ? (
            <p className="py-6 text-center text-sm text-text-subtle">
              플랜 정보를 불러오지 못했습니다.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xl font-semibold tracking-tight text-text">
                  {PLAN_LABELS[data.plan]}
                </span>
                <span className="text-sm text-text-muted">
                  월 {formatPlanPrice(PLAN_PRICES_KRW[data.plan])}
                </span>
                <span className="text-xs text-text-subtle">
                  {data.planChangedAt
                    ? `마지막 변경 ${formatDate(data.planChangedAt)}`
                    : '가입 이후 변경 이력 없음'}
                </span>
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                <UsageMeter label="멤버" used={data.usage.members} limit={data.limits.members} />
                <UsageMeter
                  label="활성 정책"
                  used={data.usage.policies}
                  limit={data.limits.policies}
                />
                <UsageMeter label="API 키" used={data.usage.apiKeys} limit={data.limits.apiKeys} />
                <UsageMeter
                  label={`API 호출 · ${data.month}`}
                  used={data.usage.apiCallsThisMonth}
                  limit={data.limits.apiCallsPerMonth}
                />
              </dl>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const current = data?.plan === id
          return (
            <Card key={id} className={cn('flex flex-col', current && 'border-accent')}>
              <CardContent className="flex flex-1 flex-col">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-text">{PLAN_LABELS[id]}</h4>
                  {current ? (
                    <Badge tone="accent" size="sm">
                      현재 플랜
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-text-muted">{PLAN_TAGLINES[id]}</p>
                <p className="mt-3 text-xl font-semibold text-text">
                  {formatPlanPrice(PLAN_PRICES_KRW[id])}
                  <span className="ml-1 text-xs font-normal text-text-subtle">/ 월</span>
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-text-muted">
                  {planLimitBullets(id).map((b) => (
                    <li key={b} className="flex items-center gap-1.5">
                      <Check className="size-3.5 shrink-0 text-success" />
                      {b}
                    </li>
                  ))}
                </ul>
                {canManage ? (
                  <Button
                    variant={current ? 'secondary' : 'primary'}
                    size="sm"
                    className="mt-4"
                    disabled={current || !data}
                    onClick={() => setTarget(id)}
                  >
                    {current ? '사용 중' : '이 플랜으로 변경'}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
      {canManage ? null : (
        <p className="text-xs text-text-subtle">플랜 변경은 소유자·관리자만 할 수 있습니다.</p>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => (open ? null : setTarget(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>플랜 변경</DialogTitle>
            <DialogDescription>
              변경 즉시 새 한도가 적용됩니다. 다운그레이드 시 기존 데이터는 유지되고, 새 한도를 넘는
              신규 생성만 차단됩니다.
            </DialogDescription>
          </DialogHeader>
          {target && data ? (
            <div className="space-y-3">
              <p className="text-sm text-text">
                <span className="font-semibold">{PLAN_LABELS[data.plan]}</span>
                {' → '}
                <span className="font-semibold">{PLAN_LABELS[target]}</span> · 월{' '}
                {formatPlanPrice(PLAN_PRICES_KRW[target])}
              </p>
              <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-text-subtle">
                데모 환경 — 실제 결제가 발생하지 않으며, 변경 결정만 감사 로그에 기록됩니다.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setTarget(null)}>
              취소
            </Button>
            <Button type="button" loading={change.isPending} onClick={confirm}>
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** 사용량/한도 미터 — 무제한 한도는 막대 없이 수치만 표기. */
function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = isUnlimited(limit)
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100))
  return (
    <div>
      <dt className="text-xs text-text-subtle">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-text">
        {used.toLocaleString('ko-KR')}
        <span className="font-normal text-text-subtle"> / {formatPlanLimit(limit)}</span>
      </dd>
      {unlimited ? null : (
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} 사용률`}
        >
          <div
            className={cn(
              'h-full',
              pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-accent'
            )}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function InviteMemberDialog() {
  const [open, setOpen] = useState(false)
  const invite = useInviteMember()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof inviteMemberSchema>, unknown, InviteMemberInput>({
    resolver: zodFormResolver(inviteMemberSchema),
    defaultValues: { role: 'viewer', email: '', name: '', password: '' },
  })

  const onSubmit = (values: InviteMemberInput) => {
    invite.mutate(values, {
      onSuccess: () => {
        toast.success('멤버를 추가했습니다')
        setOpen(false)
        reset()
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '추가에 실패했습니다'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <UserPlus className="size-4" />
          멤버 추가
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>멤버 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름" htmlFor="m-name" error={errors.name?.message} required>
              <Input id="m-name" {...register('name')} />
            </Field>
            <Field label="역할" htmlFor="m-role">
              <Select id="m-role" {...register('role')}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="이메일" htmlFor="m-email" error={errors.email?.message} required>
            <Input id="m-email" type="email" {...register('email')} />
          </Field>
          <Field
            label="초기 비밀번호"
            htmlFor="m-pw"
            error={errors.password?.message}
            hint="최소 8자"
            required
          >
            <Input id="m-pw" type="text" {...register('password')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" loading={invite.isPending}>
              추가
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditOrgDialog({ org }: { org: OrgDto }) {
  const [open, setOpen] = useState(false)
  const update = useUpdateOrg()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof updateOrgSchema>, unknown, UpdateOrgInput>({
    resolver: zodFormResolver(updateOrgSchema),
    defaultValues: { name: org.name, logoUrl: org.logoUrl ?? '' },
  })

  // 입력 중 실시간 미리보기 — 유효한 http(s) URL일 때만 이미지를 시도(아니면 모노그램).
  const nameDraft = watch('name')
  const logoDraft = watch('logoUrl')
  const previewUrl =
    typeof logoDraft === 'string' && orgLogoUrlSchema.safeParse(logoDraft.trim()).success
      ? logoDraft.trim()
      : null

  const onSubmit = (values: UpdateOrgInput) => {
    update.mutate(values, {
      onSuccess: () => {
        toast.success('조직 정보를 변경했습니다')
        setOpen(false)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '변경에 실패했습니다'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Pencil className="size-4" />
          수정
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>조직 정보 수정</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="조직 이름" htmlFor="org-name" error={errors.name?.message} required>
            <Input id="org-name" autoFocus placeholder="우리 회사" {...register('name')} />
          </Field>
          <Field
            label="로고 URL"
            htmlFor="org-logo"
            error={errors.logoUrl?.message}
            hint="공개 약관 페이지 헤더에 표시됩니다. http(s) 이미지 URL — 비우면 이니셜 모노그램."
          >
            <div className="flex items-center gap-2">
              <OrgIcon name={nameDraft || org.name} logoUrl={previewUrl} className="size-8" />
              <Input
                id="org-logo"
                type="url"
                inputMode="url"
                placeholder="https://example.com/icon.png"
                {...register('logoUrl')}
              />
              {logoDraft ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="로고 제거"
                  onClick={() => setValue('logoUrl', '', { shouldDirty: true })}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" loading={update.isPending}>
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
