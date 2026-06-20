import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Inbox, MessageSquarePlus, Moon, RotateCcw, Send, Sun } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_HINTS,
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  listInquiries,
  submitInquiry,
  type Inquiry,
  type InquiryCategory,
  type InquiryStatus,
} from '@/services/inquiryApi'
import { cn } from '@/utils/cn'

const TITLE_MAX = 120
const BODY_MAX = 4000
const NAME_MAX = 80

function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      onClick={toggle}
      aria-label={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {resolved === 'dark' ? (
        <Sun className="size-[1.05rem]" />
      ) : (
        <Moon className="size-[1.05rem]" />
      )}
    </Button>
  )
}

/** status → Badge 톤. 진행도에 따라 디자인 토큰 색을 매핑한다. */
const STATUS_TONE: Record<InquiryStatus, BadgeProps['tone']> = {
  new: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
}

function StatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} size="sm">
      {INQUIRY_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

/** ISO 날짜를 짧은 상대 표기로. 1주 이상은 YYYY.MM.DD 절대 표기로 폴백. */
function shortRelativeDate(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const diffMs = Date.now() - then.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return then.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="outline" size="sm">
          {INQUIRY_CATEGORY_LABELS[inquiry.category] ?? inquiry.category}
        </Badge>
        <StatusBadge status={inquiry.status} />
        <span className="ml-auto text-xs text-text-subtle">
          {shortRelativeDate(inquiry.createdAt)}
        </span>
      </div>
      <h3 className="mt-2.5 text-sm font-semibold text-text">{inquiry.title}</h3>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-text-muted">{inquiry.body}</p>
      <p className="mt-2.5 text-xs text-text-subtle">{inquiry.authorName?.trim() || '익명'}</p>
    </Card>
  )
}

/** 하단 공개 게시판 — listInquiries 를 react-query 로 최신순 조회. */
function InquiryBoard() {
  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['inquiries', 20, 0],
    queryFn: () => listInquiries(20, 0),
  })

  const items = data?.items ?? []

  return (
    <section className="space-y-4" aria-labelledby="support-board-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="support-board-heading" className="text-lg font-semibold text-text">
          최근 문의
        </h2>
        <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RotateCcw className={cn('size-3.5', isFetching && 'animate-spin')} aria-hidden />
          새로고침
        </Button>
      </div>

      <div aria-live="polite" aria-busy={isPending || isFetching}>
        {isPending ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((key) => (
              <li key={key}>
                <Skeleton className="h-32 rounded-lg" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <ErrorState
            title="문의 목록을 불러오지 못했습니다"
            description={error instanceof Error ? error.message : undefined}
            onRetry={() => void refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="아직 등록된 문의가 없습니다"
            description="첫 문의를 남겨 주세요. 등록된 문의는 이 게시판에 공개로 표시됩니다."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((inquiry) => (
              <li key={inquiry.id}>
                <InquiryCard inquiry={inquiry} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/**
 * 문의 게시판 — 카테고리 선택 + 폼(제목/내용/선택 이름·이메일 + 허니팟) →
 * desk-platform 공개 API 로 등록(POST), 하단에 공개 게시판 목록(GET).
 * 전화·이메일로 문의 남기는 수단은 이 페이지로 통합했다.
 */
export default function SupportPage() {
  useDocumentTitle('문의')
  const fieldId = useId()

  const [category, setCategory] = useState<InquiryCategory>('usage')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [website, setWebsite] = useState('') // 허니팟 — 사람은 채우지 않는다.
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [boardKey, setBoardKey] = useState(0)

  const headingRef = useRef<HTMLHeadingElement>(null)

  // 라우트 진입 시 페이지 제목으로 포커스를 옮긴다(스크린리더 컨텍스트 + 키보드 시작점).
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const validate = (): string | null => {
    if (!title.trim()) return '제목을 입력해 주세요.'
    if (title.trim().length > TITLE_MAX) return `제목은 ${TITLE_MAX}자 이하로 입력해 주세요.`
    if (!body.trim()) return '내용을 입력해 주세요.'
    if (body.trim().length > BODY_MAX) return `내용은 ${BODY_MAX}자 이하로 입력해 주세요.`
    if (authorName.trim().length > NAME_MAX) return `이름은 ${NAME_MAX}자 이하로 입력해 주세요.`
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return '올바른 이메일 형식을 입력해 주세요.'
    }
    return null
  }

  const resetForm = () => {
    setTitle('')
    setBody('')
    setAuthorName('')
    setContactEmail('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitted(false)

    // 허니팟이 채워졌으면 봇으로 간주하고 조용히 성공 처리한다(서버도 202 무음).
    if (website.trim()) {
      setSubmitted(true)
      resetForm()
      return
    }

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      await submitInquiry({
        category,
        title: title.trim(),
        body: body.trim(),
        authorName: authorName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      })
      setSubmitted(true)
      resetForm()
      setBoardKey((value) => value + 1)
      toast.success('문의가 접수되었습니다.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '문의 등록에 실패했습니다.'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="ChangelogDesk 홈으로">
            <Brand />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/demo">데모</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">로그인</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-10 outline-none sm:px-6"
      >
        <div className="space-y-8">
          <section>
            <p className="text-xs font-semibold text-accent-strong">문의 · /support</p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 text-2xl font-semibold tracking-tight text-balance text-text outline-none"
            >
              무엇을 도와드릴까요?
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-text-muted">
              ChangelogDesk 에 대한 제휴·버그·의견·이용 문의를 남겨 주세요. 접수된 문의는 아래
              게시판에 공개로 표시되며, 운영자가 확인 후 상태를 업데이트합니다. 전화·이메일 대신 이
              게시판으로 문의를 통합했습니다.
            </p>
          </section>

          {submitted ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-soft p-4"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">문의가 접수되었습니다.</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  아래 게시판에서 등록된 문의를 확인할 수 있습니다. 운영자가 확인 후 상태를
                  업데이트합니다.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setSubmitted(false)}
                >
                  <MessageSquarePlus className="size-3.5" aria-hidden />
                  문의 더 남기기
                </Button>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent>
                <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                  <fieldset>
                    <legend className="text-[0.8125rem] font-medium text-text">카테고리</legend>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {INQUIRY_CATEGORIES.map((value) => {
                        const selected = value === category
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            title={INQUIRY_CATEGORY_HINTS[value]}
                            onClick={() => setCategory(value)}
                            className={cn(
                              'rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
                              selected
                                ? 'border-ink bg-ink text-ink-fg'
                                : 'border-border bg-surface text-text-muted hover:border-border-strong hover:bg-surface-2 hover:text-text'
                            )}
                          >
                            {INQUIRY_CATEGORY_LABELS[value]}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-xs text-text-subtle">
                      {INQUIRY_CATEGORY_HINTS[category]}
                    </p>
                  </fieldset>

                  <Field
                    label="제목"
                    htmlFor={`${fieldId}-title`}
                    hint={`${title.length}/${TITLE_MAX}자`}
                    required
                  >
                    <Input
                      id={`${fieldId}-title`}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={TITLE_MAX}
                      required
                      placeholder="문의 제목을 한 줄로 적어 주세요"
                    />
                  </Field>

                  <Field
                    label="내용"
                    htmlFor={`${fieldId}-body`}
                    hint={`${body.length}/${BODY_MAX}자`}
                    required
                  >
                    <Textarea
                      id={`${fieldId}-body`}
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      maxLength={BODY_MAX}
                      required
                      rows={6}
                      placeholder="문의 내용을 자세히 적어 주세요. 버그 신고라면 재현 방법과 환경을 함께 알려 주시면 빠르게 확인할 수 있습니다."
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="이름 (선택)"
                      htmlFor={`${fieldId}-name`}
                      hint="게시판에 표시될 이름"
                    >
                      <Input
                        id={`${fieldId}-name`}
                        value={authorName}
                        onChange={(event) => setAuthorName(event.target.value)}
                        maxLength={NAME_MAX}
                        autoComplete="name"
                        placeholder="비우면 익명으로 표시됩니다"
                      />
                    </Field>
                    <Field
                      label="이메일 (선택)"
                      htmlFor={`${fieldId}-email`}
                      hint="답변 받을 이메일 (비공개)"
                    >
                      <Input
                        id={`${fieldId}-email`}
                        type="email"
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                    </Field>
                  </div>

                  {/* 허니팟: 스크린리더·일반 사용자에게 숨김. 봇이 채우면 무음 처리. */}
                  <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <label htmlFor={`${fieldId}-website`}>웹사이트(입력하지 마세요)</label>
                    <input
                      id={`${fieldId}-website`}
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                    />
                  </div>

                  {/* 검증 에러는 aria-live 로 announce. */}
                  <div role="alert" aria-live="assertive">
                    {error ? (
                      <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                        {error}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" variant="accent" loading={submitting}>
                      <Send className="size-4" aria-hidden />
                      {submitting ? '접수 중…' : '문의 접수'}
                    </Button>
                    <span className="text-xs text-text-subtle">
                      이메일은 비공개로 운영자만 확인합니다.
                    </span>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-6 text-xs font-semibold text-text-subtle">
            <Inbox className="size-3.5" aria-hidden />
            공개 게시판
          </div>
          <InquiryBoard key={boardKey} />
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-text-subtle sm:flex-row sm:px-6">
          <Brand compact />
          <p>문의는 이 게시판으로 통합되어 운영됩니다</p>
          <Link to="/" className="font-medium text-accent-strong hover:text-accent">
            홈으로
          </Link>
        </div>
      </footer>
    </div>
  )
}
