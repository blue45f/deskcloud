import { CheckCircle2, Inbox, MessageSquarePlus, Moon, RotateCcw, Send, Sun } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import type { FormEvent } from 'react'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
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
import { formatDate, formatRelative } from '@/utils/format'

const TITLE_MAX = 120
const BODY_MAX = 4000
const NAME_MAX = 80

/** 상태 → Badge 톤. 진행도에 맞춰 디자인 토큰 톤을 매핑한다. */
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

/** ISO 날짜를 최근 1주 미만은 상대 표기로, 그 이상은 절대(YYYY.MM.DD) 표기로. */
function displayDate(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const days = (Date.now() - then.getTime()) / 86_400_000
  return days < 7 ? formatRelative(iso) : formatDate(iso)
}

function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="outline" size="sm">
          {INQUIRY_CATEGORY_LABELS[inquiry.category] ?? inquiry.category}
        </Badge>
        <StatusBadge status={inquiry.status} />
        <span className="ml-auto text-xs text-text-subtle">{displayDate(inquiry.createdAt)}</span>
      </div>
      <h3 className="mt-2.5 text-sm font-semibold text-text">{inquiry.title}</h3>
      <p className="mt-1 line-clamp-3 text-[0.8125rem] leading-6 text-text-muted">{inquiry.body}</p>
      <p className="mt-2.5 text-xs text-text-subtle">{inquiry.authorName?.trim() || '익명'}</p>
    </Card>
  )
}

type BoardState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; items: Inquiry[] }

// 게시판 본체. 마운트(또는 key 변경 시 재마운트)마다 'loading' 상태로 시작하므로
// 새 데이터를 가져오는 동안 항상 스켈레톤이 보인다. 이렇게 하면 effect 안에서
// 동기적으로 setState 를 호출하지 않아도 되어 cascading render 를 피할 수 있다.
function InquiryBoardBody({ onReload }: { onReload: () => void }) {
  const [state, setState] = useState<BoardState>({ phase: 'loading' })

  // 목록 조회. 상태 변경은 모두 비동기 콜백/cleanup 에서만 한다.
  useEffect(() => {
    const controller = new AbortController()
    listInquiries(20, 0)
      .then((list) => {
        if (controller.signal.aborted) return
        setState({ phase: 'ready', items: list.items })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setState({
          phase: 'error',
          message: cause instanceof Error ? cause.message : '문의 목록을 불러오지 못했습니다.',
        })
      })
    return () => controller.abort()
  }, [])

  const loading = state.phase === 'loading'
  const reload = onReload

  return (
    <section className="space-y-4" aria-labelledby="support-board-heading">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="support-board-heading"
          className="flex items-center gap-2 text-base font-semibold text-text"
        >
          <Inbox className="size-4 text-text-subtle" aria-hidden />
          최근 문의
        </h2>
        <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
          <RotateCcw className="size-3.5" aria-hidden />
          새로고침
        </Button>
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {state.phase === 'loading' ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((key) => (
              <li key={key}>
                <Skeleton className="h-32 w-full" />
              </li>
            ))}
          </ul>
        ) : state.phase === 'error' ? (
          <Card className="border-danger/30 bg-danger-soft p-5">
            <p className="text-sm font-semibold text-danger">{state.message}</p>
            <Button variant="secondary" size="sm" onClick={reload} className="mt-3">
              <RotateCcw className="size-3.5" aria-hidden />
              다시 시도
            </Button>
          </Card>
        ) : state.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="아직 등록된 문의가 없습니다"
            description="첫 문의를 남겨 주세요. 등록된 문의는 이 게시판에 공개로 표시됩니다."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {state.items.map((inquiry) => (
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
 * 게시판 래퍼 — 새로고침/등록 시 본체를 key 로 재마운트해 'loading' 부터 다시 시작한다.
 * 외부(폼 등록)에서 오는 reloadKey 변화도 동일하게 재조회를 트리거한다.
 */
function InquiryBoard({ reloadKey }: { reloadKey: number }) {
  const [localKey, setLocalKey] = useState(0)
  return (
    <InquiryBoardBody
      key={`${reloadKey}-${localKey}`}
      onReload={() => setLocalKey((value) => value + 1)}
    />
  )
}

function CharCount({ value, max }: { value: number; max: number }) {
  return (
    <span className="ml-2 font-normal text-text-subtle">
      {value}/{max}
    </span>
  )
}

/**
 * 문의(Inquiry) 게시판(공개) — desk-platform 공개 API로 문의를 등록하고, 같은 앱의
 * 공개 게시판을 함께 노출한다. 전화·이메일 대신 이 페이지로 문의를 통합한다.
 */
export default function SupportPage() {
  useDocumentTitle('문의')
  const { resolved, toggle } = useTheme()
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
  // 새 문의 등록 시 게시판을 다시 불러오기 위한 키.
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
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">홈</Link>
            </Button>
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
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl space-y-8 px-4 py-10 outline-none sm:px-6"
      >
        <section>
          <p className="text-xs font-semibold text-accent-strong">문의 · /support</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-1.5 text-2xl font-semibold tracking-tight text-balance text-text outline-none"
          >
            무엇을 도와드릴까요?
          </h1>
          <p className="mt-2.5 max-w-2xl text-pretty text-text-muted">
            제휴·버그·의견·이용 문의를 남겨 주세요. 접수된 문의는 아래 게시판에 공개로 표시되며,
            운영자가 확인 후 상태를 업데이트합니다. 전화·이메일 대신 이 게시판으로 문의를
            통합했습니다.
          </p>
        </section>

        {submitted ? (
          <Card className="border-success/30 bg-success-soft">
            <CardContent className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <div className="min-w-0">
                <p role="status" className="text-sm font-semibold text-text">
                  문의가 접수되었습니다.
                </p>
                <p className="mt-1 text-[0.8125rem] leading-6 text-text-muted">
                  아래 게시판에서 등록된 문의를 확인할 수 있습니다. 운영자가 확인 후 상태를
                  업데이트합니다.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSubmitted(false)}
                  className="mt-3"
                >
                  <MessageSquarePlus className="size-3.5" aria-hidden />
                  문의 더 남기기
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                <fieldset>
                  <legend className="mb-2 text-[0.8125rem] font-medium text-text">카테고리</legend>
                  <div className="flex flex-wrap gap-1.5">
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
                            'rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
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
                  required
                  hint={<CharCount value={title.length} max={TITLE_MAX} />}
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
                  required
                  hint={<CharCount value={body.length} max={BODY_MAX} />}
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
                  <Field label="이름" htmlFor={`${fieldId}-name`} hint="게시판에 표시될 이름(선택)">
                    <Input
                      id={`${fieldId}-name`}
                      value={authorName}
                      onChange={(event) => setAuthorName(event.target.value)}
                      maxLength={NAME_MAX}
                      autoComplete="name"
                      placeholder="익명"
                    />
                  </Field>
                  <Field
                    label="이메일"
                    htmlFor={`${fieldId}-email`}
                    hint="답변 받을 이메일 · 비공개(선택)"
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

                {/* 검증·등록 에러는 aria-live로 announce. */}
                <p role="alert" aria-live="assertive" className="min-h-0">
                  {error ? (
                    <span className="block rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                      {error}
                    </span>
                  ) : null}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" loading={submitting} disabled={submitting}>
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

        <div className="border-t border-border pt-6">
          <InquiryBoard reloadKey={boardKey} />
        </div>
      </main>
    </div>
  )
}
