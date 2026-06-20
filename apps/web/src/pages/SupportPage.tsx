import {
  createSupportPostSchema,
  supportCategories,
  type CreateSupportPostInput,
  type SupportCategory,
  type SupportPostDto,
} from '@termsdesk/shared'
import { Bug, ExternalLink, Handshake, Inbox, MessageSquareText, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import type { z } from 'zod'

import { OrgIcon } from '@/components/common/OrgIcon'
import { SealMark } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useCreateSupportPost, useSupportPosts } from '@/services/support'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/format'
import { zodFormResolver } from '@/utils/zodFormResolver'

const categoryMeta = {
  'site-inquiry': {
    label: '사이트 문의',
    tone: 'accent',
    icon: MessageSquareText,
  },
  partnership: {
    label: '제휴',
    tone: 'info',
    icon: Handshake,
  },
  bug: {
    label: '버그 신고',
    tone: 'danger',
    icon: Bug,
  },
} as const satisfies Record<
  SupportCategory,
  {
    label: string
    tone: 'accent' | 'info' | 'danger'
    icon: typeof MessageSquareText
  }
>

const filters: (SupportCategory | 'all')[] = ['all', ...supportCategories]
const supportPostFormSchema = createSupportPostSchema.omit({ projectSlug: true })

function categoryLabel(category: SupportCategory | 'all'): string {
  return category === 'all' ? '전체' : categoryMeta[category].label
}

function displayProjectName(projectSlug: string): string {
  return projectSlug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function SupportPostItem({ post }: { post: SupportPostDto }) {
  const meta = categoryMeta[post.category]
  const Icon = meta.icon

  return (
    <li className="rounded-lg border border-border bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-md border',
                meta.tone === 'danger'
                  ? 'border-danger/25 bg-danger-soft text-danger'
                  : meta.tone === 'info'
                    ? 'border-info/25 bg-info-soft text-info'
                    : 'border-accent-strong/25 bg-accent-soft text-accent-strong'
              )}
            >
              <Icon className="size-4" />
            </span>
            <Badge tone={meta.tone === 'danger' ? 'danger' : meta.tone} size="sm">
              {meta.label}
            </Badge>
            <span className="text-xs text-text-subtle">{formatRelative(post.createdAt)}</span>
          </div>
          <h2 className="mt-2 text-base font-semibold leading-snug text-text">{post.title}</h2>
        </div>
        <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[0.72rem] font-medium text-text-muted">
          {post.status === 'open' ? '접수' : post.status === 'in-review' ? '검토' : '해결'}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">
        {post.body}
      </p>
      <p className="mt-3 text-xs text-text-subtle">작성자 {post.authorName}</p>
    </li>
  )
}

export default function SupportPage() {
  const { projectSlug = 'termsdesk' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCategory = supportCategories.includes(
    searchParams.get('category') as SupportCategory
  )
    ? (searchParams.get('category') as SupportCategory)
    : 'all'
  const [category, setCategory] = useState<SupportCategory | 'all'>(initialCategory)
  const projectName = useMemo(() => displayProjectName(projectSlug), [projectSlug])

  usePageMeta({
    title: `${projectName} 지원 보드`,
    path: `/support/${projectSlug}`,
    description: `${projectName} 사이트 문의·제휴·버그 신고를 접수하고 처리 현황을 확인합니다.`,
  })

  const posts = useSupportPosts(projectSlug, category)
  const create = useCreateSupportPost(projectSlug)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<
    z.input<typeof supportPostFormSchema>,
    unknown,
    Omit<CreateSupportPostInput, 'projectSlug'>
  >({
    resolver: zodFormResolver(supportPostFormSchema),
    defaultValues: {
      category: initialCategory === 'all' ? 'site-inquiry' : initialCategory,
      name: '',
      contact: '',
      title: '',
      body: '',
    },
  })

  const onFilter = (next: SupportCategory | 'all') => {
    setCategory(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('category')
    else params.set('category', next)
    setSearchParams(params, { replace: true })
  }

  const onSubmit = (values: Omit<CreateSupportPostInput, 'projectSlug'>) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success('접수했습니다')
        reset({
          category: values.category,
          name: '',
          contact: '',
          title: '',
          body: '',
        })
        onFilter(values.category)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '접수에 실패했습니다'),
    })
  }

  const termsUrl = `/p/${projectSlug}/terms-of-service`
  const privacyUrl = `/p/${projectSlug}/privacy-policy`

  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <SealMark className="size-6 shrink-0" />
            <span className="truncate text-sm font-semibold">TermsDesk</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-muted hover:bg-surface-2 hover:text-text"
            >
              이용약관 <ExternalLink className="size-3.5" />
            </Link>
            <Link
              to={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-muted hover:bg-surface-2 hover:text-text"
            >
              개인정보처리방침 <ExternalLink className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:py-10">
        <section className="min-w-0" aria-labelledby="support-list-title">
          <div className="mb-5 flex items-center gap-3">
            <OrgIcon name={projectName} className="size-8 rounded-xl text-sm" />
            <div className="min-w-0">
              <p className="text-[0.78rem] font-semibold uppercase text-accent-strong">
                {projectSlug}
              </p>
              <h1 id="support-list-title" className="mt-0.5 text-2xl font-bold tracking-tight">
                {projectName} 지원 보드
              </h1>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2" aria-label="지원 유형 필터">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onFilter(filter)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent-strong',
                  category === filter
                    ? 'border-accent-strong bg-accent-soft text-text'
                    : 'border-border bg-surface text-text-muted hover:border-border-strong hover:text-text'
                )}
              >
                {categoryLabel(filter)}
              </button>
            ))}
          </div>

          {posts.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : posts.isError ? (
            <EmptyState
              icon={Inbox}
              title="게시글을 불러오지 못했습니다"
              description={posts.error instanceof Error ? posts.error.message : undefined}
            />
          ) : (posts.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={Inbox}
              title="접수된 글이 없습니다"
              description={`${categoryLabel(category)} 항목이 비어 있습니다.`}
            />
          ) : (
            <ul className="space-y-3">
              {posts.data?.items.map((post) => (
                <SupportPostItem key={post.id} post={post} />
              ))}
            </ul>
          )}
        </section>

        <aside className="lg:sticky lg:top-5 lg:self-start" aria-labelledby="support-form-title">
          <form
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
            className="rounded-lg border border-border bg-surface p-4 shadow-xs"
          >
            <h2 id="support-form-title" className="text-base font-semibold text-text">
              새 글
            </h2>
            <div className="mt-4 space-y-4">
              <Field label="유형" htmlFor="support-category" error={errors.category?.message}>
                <Select id="support-category" {...register('category')}>
                  {supportCategories.map((item) => (
                    <option key={item} value={item}>
                      {categoryMeta[item].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="이름" htmlFor="support-name" error={errors.name?.message}>
                <Input id="support-name" autoComplete="name" {...register('name')} />
              </Field>
              <Field
                label="회신 연락처"
                htmlFor="support-contact"
                hint="공개 목록에는 표시되지 않습니다."
                error={errors.contact?.message}
              >
                <Input
                  id="support-contact"
                  autoComplete="email"
                  inputMode="email"
                  {...register('contact')}
                />
              </Field>
              <Field label="제목" htmlFor="support-title" error={errors.title?.message}>
                <Input id="support-title" {...register('title')} />
              </Field>
              <Field label="내용" htmlFor="support-body" error={errors.body?.message}>
                <Textarea id="support-body" rows={7} {...register('body')} />
              </Field>
              <Button type="submit" loading={create.isPending} className="w-full">
                <Send className="size-4" />
                접수
              </Button>
            </div>
          </form>
        </aside>
      </main>
    </div>
  )
}
