import { createVersionSchema, type CreateVersionInput } from '@termsdesk/shared'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import type { z } from 'zod'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useCreateVersion, usePolicy, useUpdateVersion, useVersion } from '@/services/policies'
import { zodFormResolver } from '@/utils/zodFormResolver'

export default function VersionEditorPage() {
  const { slug, versionId } = useParams<{ slug?: string; versionId?: string }>()
  const isEdit = Boolean(versionId)
  const navigate = useNavigate()

  const existing = useVersion(versionId)
  const policyForCreate = usePolicy(slug)
  const policyForEdit = usePolicy(existing.data?.policyId)
  const policy = isEdit ? policyForEdit : policyForCreate
  const policyId = isEdit ? existing.data?.policyId : policyForCreate.data?.id

  useDocumentTitle(isEdit ? '버전 편집' : '새 버전 작성')

  const create = useCreateVersion(policyId ?? '')
  const update = useUpdateVersion(versionId ?? '')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<z.input<typeof createVersionSchema>, unknown, CreateVersionInput>({
    resolver: zodFormResolver(createVersionSchema),
    defaultValues: { title: '', body: '', locale: 'ko', changeSummary: '' },
  })

  useEffect(() => {
    if (isEdit && existing.data) {
      reset({
        title: existing.data.title,
        body: existing.data.body,
        locale: existing.data.locale,
        changeSummary: existing.data.changeSummary ?? '',
      })
    }
  }, [isEdit, existing.data, reset])

  const onSubmit = (values: CreateVersionInput) => {
    if (isEdit) {
      update.mutate(values, {
        onSuccess: (v) => {
          toast.success('초안을 저장했습니다')
          navigate(`/app/versions/${v.id}`)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '저장에 실패했습니다'),
      })
    } else {
      create.mutate(values, {
        onSuccess: (v) => {
          toast.success('새 버전 초안을 만들었습니다')
          navigate(`/app/versions/${v.id}`)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '작성에 실패했습니다'),
      })
    }
  }

  if (isEdit && existing.isLoading) {
    return <Skeleton className="h-96 w-full" />
  }
  if (isEdit && existing.data && existing.data.status !== 'draft') {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-text">
            게시된 버전은 수정할 수 없습니다(불변). 새 버전을 만들어 변경하세요.
          </p>
          <Button className="mt-4" asChild>
            <Link to={`/app/versions/${versionId}`}>버전으로 돌아가기</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: '약관·정책', to: '/app/policies' },
          {
            label: policy.data?.name ?? '정책',
            to: policy.data ? `/app/policies/${policy.data.slug}` : undefined,
          },
          { label: isEdit ? '초안 편집' : '새 버전' },
        ]}
        title={isEdit ? '초안 편집' : '새 버전 작성'}
        description="회사가 보유한 약관 문안을 붙여넣어 초안을 만듭니다. 게시 전까지는 자유롭게 수정할 수 있습니다."
      />

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field label="제목" htmlFor="title" error={errors.title?.message} required>
                <Input id="title" placeholder="예: 이용약관 v2" {...register('title')} />
              </Field>
              <Field label="언어" htmlFor="locale">
                <Select id="locale" {...register('locale')}>
                  <option value="ko">한국어 (ko)</option>
                  <option value="en">English (en)</option>
                  <option value="ja">日本語 (ja)</option>
                </Select>
              </Field>
            </div>
            <Field
              label="본문"
              htmlFor="body"
              error={errors.body?.message}
              hint="게시 시 이 본문이 동결되고 SHA-256 해시가 부여됩니다."
              required
            >
              <Textarea
                id="body"
                rows={18}
                className="font-mono leading-relaxed"
                placeholder="약관 전문을 붙여넣으세요…"
                {...register('body')}
              />
            </Field>
            <Field
              label="변경 요약"
              htmlFor="changeSummary"
              error={errors.changeSummary?.message}
              hint="이전 버전 대비 무엇이 바뀌었는지(재동의 안내에 노출)"
            >
              <Textarea
                id="changeSummary"
                rows={2}
                placeholder="예: 제4조 게시물 관리 조항 추가"
                {...register('changeSummary')}
              />
            </Field>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                취소
              </Button>
              <Button
                type="submit"
                loading={create.isPending || update.isPending}
                disabled={isEdit && !isDirty}
              >
                {isEdit ? '초안 저장' : '초안 만들기'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
