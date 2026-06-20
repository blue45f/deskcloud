import {
  POLICY_TYPES,
  POLICY_TYPE_LABELS,
  formatKrw,
  upsertProviderProfileSchema,
  type PolicyType,
  type ProviderProfileDto,
  type UpsertProviderProfileInput,
} from '@termsdesk/shared'
import { BadgeCheck, Briefcase, Plus, Store, X } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import type { z } from 'zod'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, RatingStars, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Label, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMyProviderProfile, useUpsertProviderProfile } from '@/services/brokerage'
import { zodFormResolver } from '@/utils/zodFormResolver'

/** 정책 종류 라벨 — 칩 제안에 쓰는 추천 전문 분야. */
const SUGGESTED_SPECIALTIES: readonly PolicyType[] = POLICY_TYPES

type FormValues = z.input<typeof upsertProviderProfileSchema>

/** 콤마/엔터로 분리되는 전문 분야 칩 입력. */
function SpecialtyChips({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const tag = raw.trim().slice(0, 40)
    if (!tag) return
    if (value.includes(tag) || value.length >= 10) return
    onChange([...value, tag])
  }

  const commitDraft = () => {
    if (draft.trim()) {
      add(draft)
      setDraft('')
    }
  }

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag))

  const available = SUGGESTED_SPECIALTIES.map((t) => POLICY_TYPE_LABELS[t]).filter(
    (label) => !value.includes(label)
  )

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-surface p-2 focus-within:border-border-strong">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-fg"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`${tag} 제거`}
              className="rounded-full p-0.5 transition-colors hover:bg-surface-2 hover:text-text"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commitDraft()
            } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              remove(value[value.length - 1])
            }
          }}
          onBlur={commitDraft}
          placeholder={value.length === 0 ? '예: 이용약관, 개인정보, 해외 진출' : ''}
          aria-label="전문 분야 추가"
          className="min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-text outline-none placeholder:text-text-subtle"
        />
      </div>
      {available.length > 0 && value.length < 10 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {available.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => add(label)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              <Plus className="size-3" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** 마켓플레이스 노출 미리보기 — 다른 전문가 카드와 동일한 톤으로 자기 프로필을 보여 준다. */
function ProfilePreview({
  displayName,
  headline,
  specialties,
  hourlyRate,
  verified,
  completedCount,
  avgRating,
  reviewCount,
}: {
  displayName: string
  headline: string
  specialties: string[]
  hourlyRate: number | null
  verified: boolean
  completedCount: number
  avgRating: number | null
  reviewCount: number
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-text">
            <span className="truncate">{displayName || '이름 미입력'}</span>
            {verified ? (
              <BadgeCheck className="size-4 shrink-0 text-accent-strong" aria-label="검증됨" />
            ) : null}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-text-muted">
            {headline || '한 줄 소개를 입력하면 여기에 표시됩니다.'}
          </p>
        </div>
      </div>
      {specialties.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {specialties.map((tag) => (
            <Badge key={tag} tone="outline" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-subtle">
        <div className="inline-flex items-center gap-1">
          <dt className="sr-only">시간당 단가</dt>
          <dd className="font-medium text-text-muted">{formatKrw(hourlyRate)}</dd>
        </div>
        <div className="inline-flex items-center gap-1">
          <dt className="sr-only">완료 건수</dt>
          <dd>완료 {completedCount}건</dd>
        </div>
        <div className="inline-flex items-center gap-1">
          <dt className="sr-only">평점</dt>
          <dd>
            <RatingStars value={avgRating} count={reviewCount} />
          </dd>
        </div>
      </dl>
    </div>
  )
}

function ProfileForm({ profile }: { profile: ProviderProfileDto | null }) {
  const upsert = useUpsertProviderProfile()
  const isNew = profile == null

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues, unknown, UpsertProviderProfileInput>({
    resolver: zodFormResolver(upsertProviderProfileSchema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      headline: profile?.headline ?? '',
      bio: profile?.bio ?? '',
      specialties: profile?.specialties ?? [],
      jurisdictions: profile?.jurisdictions ?? 'KR',
      hourlyRate: profile?.hourlyRate ?? '',
      contact: profile?.contact ?? '',
      active: profile?.active ?? true,
    },
  })

  // 미리보기용 실시간 값.
  const displayNameDraft = watch('displayName')
  const headlineDraft = watch('headline')
  const specialtiesDraft = watch('specialties')
  const hourlyRateDraft = watch('hourlyRate')

  const onSubmit = (values: UpsertProviderProfileInput) => {
    upsert.mutate(values, {
      onSuccess: () => {
        toast.success(isNew ? '전문가로 등록했습니다' : '프로필을 저장했습니다')
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '저장에 실패했습니다'),
    })
  }

  const previewRate = typeof hourlyRateDraft === 'number' ? hourlyRateDraft : null

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>{isNew ? '전문가 프로필 등록' : '프로필 수정'}</CardTitle>
          <p className="mt-0.5 text-[0.8125rem] text-text-muted">
            입력한 정보는 의뢰 마켓플레이스와 전문가 디렉터리에 노출됩니다.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field
              label="표시 이름"
              htmlFor="ep-display-name"
              error={errors.displayName?.message}
              required
            >
              <Input id="ep-display-name" placeholder="예: 김약관" {...register('displayName')} />
            </Field>

            <Field
              label="한 줄 소개"
              htmlFor="ep-headline"
              error={errors.headline?.message}
              hint="전문성을 한 문장으로 — 카드 상단에 표시됩니다."
              required
            >
              <Input
                id="ep-headline"
                placeholder="예: SaaS·핀테크 약관 10년차, KR/EN 작성"
                {...register('headline')}
              />
            </Field>

            <Field
              label="소개"
              htmlFor="ep-bio"
              error={errors.bio?.message}
              hint="경력, 강점, 작업 방식 등을 자세히 적어 주세요."
              required
            >
              <Textarea
                id="ep-bio"
                rows={6}
                placeholder="어떤 약관·정책 작업을 도울 수 있는지 설명해 주세요."
                {...register('bio')}
              />
            </Field>

            <div>
              <Label htmlFor="ep-specialties">전문 분야</Label>
              <Controller
                control={control}
                name="specialties"
                render={({ field }) => (
                  <SpecialtyChips value={field.value ?? []} onChange={field.onChange} />
                )}
              />
              <p className="mt-1.5 text-xs text-text-subtle">최대 10개 · 콤마나 Enter 로 추가</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="활동 관할"
                htmlFor="ep-jurisdictions"
                error={errors.jurisdictions?.message}
                hint="예: KR, KR/EN"
              >
                <Input id="ep-jurisdictions" placeholder="KR" {...register('jurisdictions')} />
              </Field>
              <Field
                label="시간당 단가(₩)"
                htmlFor="ep-hourly-rate"
                error={errors.hourlyRate?.message}
                hint="선택 · 비우면 협의"
              >
                <Input
                  id="ep-hourly-rate"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="예: 80000"
                  {...register('hourlyRate', { valueAsNumber: true })}
                />
              </Field>
            </div>

            <Field
              label="연락처"
              htmlFor="ep-contact"
              error={errors.contact?.message}
              hint="선택 · 운영자와 매칭된 의뢰자에게만 보입니다."
            >
              <Input
                id="ep-contact"
                placeholder="이메일·전화 등 회신 받을 연락처"
                {...register('contact')}
              />
            </Field>

            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2/40 px-3.5 py-3">
                  <div className="min-w-0">
                    <Label htmlFor="ep-active" className="mb-0">
                      마켓플레이스 노출
                    </Label>
                    <p className="mt-0.5 text-xs text-text-subtle">
                      끄면 디렉터리에서 숨겨지고 새 제안을 보낼 수 없습니다.
                    </p>
                  </div>
                  <Switch
                    id="ep-active"
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" loading={upsert.isPending}>
                {isNew ? '전문가 등록' : '저장'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
            <Store className="size-4 text-text-subtle" aria-hidden />
            마켓 카드 미리보기
          </h2>
          <ProfilePreview
            displayName={displayNameDraft ?? ''}
            headline={headlineDraft ?? ''}
            specialties={specialtiesDraft ?? []}
            hourlyRate={previewRate}
            verified={profile?.verified ?? false}
            completedCount={profile?.completedCount ?? 0}
            avgRating={profile?.avgRating ?? null}
            reviewCount={profile?.reviewCount ?? 0}
          />
        </div>

        {profile ? (
          <div className="rounded-lg border border-border bg-surface-2/40 p-4">
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-text-subtle">검증 상태</dt>
                <dd>
                  {profile.verified ? (
                    <Badge tone="accent" size="sm">
                      <BadgeCheck className="size-3" aria-hidden />
                      검증됨
                    </Badge>
                  ) : (
                    <Badge tone="outline" size="sm">
                      미검증
                    </Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-text-subtle">완료한 작업</dt>
                <dd className="font-medium text-text">{profile.completedCount}건</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-text-subtle">
              검증 배지는 운영자가 부여합니다. 여기서는 변경할 수 없습니다.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-text-muted">
            등록 후 운영자 검증을 받으면 카드에 검증 배지가 표시됩니다.
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExpertProfilePage() {
  useDocumentTitle('전문가 프로필')
  const myProvider = useMyProviderProfile()

  return (
    <>
      <PageHeader
        title="전문가 활동"
        description="전문가 프로필을 등록하고 공개 의뢰에 제안을 보내세요. 약관 작성·검토·개정·번역 경험을 알리면 매칭 확률이 올라갑니다."
      />

      {myProvider.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <Skeleton className="h-[32rem] w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : myProvider.isError ? (
        <EmptyState
          icon={Briefcase}
          title="프로필을 불러오지 못했습니다"
          description={myProvider.error instanceof Error ? myProvider.error.message : undefined}
          action={
            <Button variant="secondary" asChild>
              <Link to="/app/marketplace">의뢰 마켓으로</Link>
            </Button>
          }
        />
      ) : (
        <ProfileForm profile={myProvider.data ?? null} />
      )}
    </>
  )
}
