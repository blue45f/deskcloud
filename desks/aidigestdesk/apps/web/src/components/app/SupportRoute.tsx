import { CheckCircle2, Home, Inbox, MessageSquarePlus, RotateCcw, Send } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import type { AppRoute } from '@/components/app/appRoutes'
import type { FormEvent } from 'react'

import { Chip, EmptyState, SectionHeader } from '@/components/app/CommonUi'
import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  listInquiries,
  submitInquiry,
  type Inquiry,
  type InquiryCategory,
  type InquiryStatus,
} from '@/lib/inquiryApi'

const TITLE_MAX = 120
const BODY_MAX = 4000
const NAME_MAX = 80

const inputClass =
  'mt-1.5 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent'

const categoryHints: Record<InquiryCategory, string> = {
  partnership: '협업·제휴 제안',
  bug: '사이트 오류 신고',
  feedback: '개선 의견·제안',
  usage: '사용법·일반 문의',
}

/** 상태 뱃지 톤. 진행도에 따라 토큰 색을 매핑한다. */
const statusTone: Record<InquiryStatus, string> = {
  new: 'border-accent-2/30 bg-accent-2/10 text-accent-2',
  in_progress: 'border-accent-3/40 bg-accent-3/10 text-accent-3',
  resolved: 'border-accent/30 bg-accent/10 text-accent',
  closed: 'border-border bg-surface-2 text-text-subtle',
}

function StatusBadge({ status }: { status: InquiryStatus }) {
  const label = INQUIRY_STATUS_LABELS[status] ?? status
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold ${statusTone[status] ?? statusTone.closed}`}
    >
      {label}
    </span>
  )
}

/** ISO 날짜를 간단한 상대 표기로. 1주 이상은 YYYY.MM.DD 절대 표기로 폴백. */
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
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="ink">{INQUIRY_CATEGORY_LABELS[inquiry.category] ?? inquiry.category}</Chip>
        <StatusBadge status={inquiry.status} />
        <span className="ml-auto text-xs text-text-subtle">
          {shortRelativeDate(inquiry.createdAt)}
        </span>
      </div>
      <h3 className="mt-2.5 text-sm font-semibold text-text">{inquiry.title}</h3>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-text-muted">{inquiry.body}</p>
      <p className="mt-2.5 text-xs text-text-subtle">{inquiry.authorName?.trim() || '익명'}</p>
    </article>
  )
}

type BoardState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; items: Inquiry[] }

function InquiryBoard() {
  const [state, setState] = useState<BoardState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  // 목록 조회. set-state-in-effect를 피하기 위해 상태 변경은 모두 비동기 콜백에서만 한다.
  // 재조회 시 로딩 표시는 reloadKey가 바뀔 때 호출부 setState로 처리한다(아래 새로고침 핸들러).
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
  }, [reloadKey])

  const loading = state.phase === 'loading'
  const reload = () => {
    setState({ phase: 'loading' })
    setReloadKey((value) => value + 1)
  }

  return (
    <section className="space-y-4" aria-labelledby="support-board-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="support-board-heading" className="text-lg font-semibold text-text">
          최근 문의
        </h2>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          새로고침
        </button>
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {state.phase === 'loading' ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((key) => (
              <li
                key={key}
                className="h-32 animate-pulse rounded-lg border border-border bg-surface-2"
              />
            ))}
          </ul>
        ) : state.phase === 'error' ? (
          <div className="rounded-lg border border-accent-4/30 bg-accent-4/10 p-5">
            <p className="text-sm font-semibold text-accent-4">{state.message}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-accent-4/40 bg-accent-4/10 px-3 py-1.5 text-xs font-semibold text-accent-4 transition hover:bg-accent-4/20"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              다시 시도
            </button>
          </div>
        ) : state.items.length === 0 ? (
          <EmptyState
            title="아직 등록된 문의가 없습니다"
            body="첫 문의를 남겨 주세요. 등록된 문의는 이 게시판에 공개로 표시됩니다."
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

export function SupportRoute({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
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
  // 새 문의를 등록하면 게시판을 다시 불러오기 위한 키.
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '문의 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="px-4 py-5 outline-none lg:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-accent">문의 · /support</p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-1 text-2xl font-semibold text-text outline-none"
              >
                무엇을 도와드릴까요?
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-muted">
                제휴·버그·의견·이용 문의를 남겨 주세요. 접수된 문의는 아래 게시판에 공개로 표시되며,
                운영자가 확인 후 상태를 업데이트합니다. 전화·이메일 대신 이 게시판으로 문의를
                통합했습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('portal')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              <Home className="size-3.5" aria-hidden />
              포털로
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={MessageSquarePlus}
            title="문의 남기기"
            description="카테고리를 고르고 제목과 내용을 작성하세요. 이름·이메일은 선택 사항입니다."
          />

          {submitted ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/10 p-4"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">문의가 접수되었습니다.</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  아래 게시판에서 등록된 문의를 확인할 수 있습니다. 운영자가 확인 후 상태를
                  업데이트합니다.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
                >
                  <MessageSquarePlus className="size-3.5" aria-hidden />
                  문의 더 남기기
                </button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-5 rounded-lg border border-border bg-surface p-5"
              onSubmit={handleSubmit}
              noValidate
            >
              <fieldset>
                <legend className="text-xs font-semibold text-text-subtle">카테고리</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {INQUIRY_CATEGORIES.map((value) => {
                    const selected = value === category
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        title={categoryHints[value]}
                        onClick={() => setCategory(value)}
                        className={
                          selected
                            ? 'rounded-md border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-ink-fg'
                            : 'rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text'
                        }
                      >
                        {INQUIRY_CATEGORY_LABELS[value]}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-text-subtle">{categoryHints[category]}</p>
              </fieldset>

              <div>
                <label htmlFor={`${fieldId}-title`} className="block">
                  <span className="flex items-center justify-between text-xs font-semibold text-text-subtle">
                    제목
                    <span className="font-normal text-text-subtle">
                      {title.length}/{TITLE_MAX}
                    </span>
                  </span>
                  <input
                    id={`${fieldId}-title`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={TITLE_MAX}
                    required
                    placeholder="문의 제목을 한 줄로 적어 주세요"
                    className={`${inputClass} h-10`}
                  />
                </label>
              </div>

              <div>
                <label htmlFor={`${fieldId}-body`} className="block">
                  <span className="flex items-center justify-between text-xs font-semibold text-text-subtle">
                    내용
                    <span className="font-normal text-text-subtle">
                      {body.length}/{BODY_MAX}
                    </span>
                  </span>
                  <textarea
                    id={`${fieldId}-body`}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={BODY_MAX}
                    required
                    rows={6}
                    placeholder="문의 내용을 자세히 적어 주세요. 버그 신고라면 재현 방법과 환경을 함께 알려 주시면 빠르게 확인할 수 있습니다."
                    className={`${inputClass} resize-y py-2.5 leading-6`}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label htmlFor={`${fieldId}-name`} className="block">
                  <span className="text-xs font-semibold text-text-subtle">
                    이름 <span className="font-normal text-text-subtle">(선택)</span>
                  </span>
                  <input
                    id={`${fieldId}-name`}
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    maxLength={NAME_MAX}
                    autoComplete="name"
                    placeholder="게시판에 표시될 이름"
                    className={`${inputClass} h-10`}
                  />
                </label>
                <label htmlFor={`${fieldId}-email`} className="block">
                  <span className="text-xs font-semibold text-text-subtle">
                    이메일 <span className="font-normal text-text-subtle">(선택)</span>
                  </span>
                  <input
                    id={`${fieldId}-email`}
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="답변 받을 이메일 (비공개)"
                    className={`${inputClass} h-10`}
                  />
                </label>
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

              {/* 검증 에러는 aria-live로 announce. */}
              <p role="alert" aria-live="assertive" className="min-h-0">
                {error ? (
                  <span className="block rounded-md border border-accent-4/30 bg-accent-4/10 px-3 py-2 text-xs font-semibold text-accent-4">
                    {error}
                  </span>
                ) : null}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-ink bg-ink px-4 text-sm font-semibold text-ink-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="size-4" aria-hidden />
                  {submitting ? '접수 중…' : '문의 접수'}
                </button>
                <span className="text-xs text-text-subtle">
                  이메일은 비공개로 운영자만 확인합니다.
                </span>
              </div>
            </form>
          )}
        </section>

        <div className="flex items-center gap-2 border-t border-border pt-2 text-xs font-semibold text-text-subtle">
          <Inbox className="size-3.5" aria-hidden />
          공개 게시판
        </div>
        <InquiryBoard key={boardKey} />
      </div>
    </main>
  )
}
