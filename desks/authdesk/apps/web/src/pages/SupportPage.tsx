import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { FormEvent, ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'
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

const TITLE_MAX = 120
const BODY_MAX = 4000
const NAME_MAX = 80

/** 상태 뱃지. 진행도에 따라 토큰 색을 매핑한다(.is-<status>). */
function StatusBadge({ status }: { status: InquiryStatus }): ReactElement {
  return (
    <span className={`ad-status is-${status}`}>{INQUIRY_STATUS_LABELS[status] ?? status}</span>
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

function InquiryCard({ inquiry }: { inquiry: Inquiry }): ReactElement {
  return (
    <article className="ad-inquiry">
      <div className="ad-inquiry-meta">
        <span className="ad-badge ad-accentish">
          {INQUIRY_CATEGORY_LABELS[inquiry.category] ?? inquiry.category}
        </span>
        <StatusBadge status={inquiry.status} />
        <span className="ad-inquiry-date">{shortRelativeDate(inquiry.createdAt)}</span>
      </div>
      <h3 className="ad-inquiry-title">{inquiry.title}</h3>
      <p className="ad-inquiry-body">{inquiry.body}</p>
      <p className="ad-inquiry-author">{inquiry.authorName?.trim() || '익명'}</p>
    </article>
  )
}

type BoardState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; items: Inquiry[] }

function InquiryBoard({ reloadKey }: { reloadKey: number }): ReactElement {
  const [state, setState] = useState<BoardState>({ phase: 'loading' })
  const [retryKey, setRetryKey] = useState(0)

  // 목록 조회. set-state-in-effect 규칙을 지키기 위해 상태 변경은 모두 비동기 콜백에서만 한다.
  // 로딩 표시는 reload/retry 핸들러가 키를 바꾸기 전에 setState로 처리한다(효과 본문 X).
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
  }, [reloadKey, retryKey])

  const loading = state.phase === 'loading'
  const reload = (): void => {
    setState({ phase: 'loading' })
    setRetryKey((value) => value + 1)
  }

  return (
    <section aria-labelledby="support-board-heading">
      <div className="ad-section-head">
        <h2 id="support-board-heading">최근 문의</h2>
        <button type="button" className="ad-btn ad-btn-sm" onClick={reload} disabled={loading}>
          새로고침
        </button>
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {state.phase === 'loading' ? (
          <div className="ad-grid cols-2">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="ad-skeleton" />
            ))}
          </div>
        ) : state.phase === 'error' ? (
          <div className="ad-alert ad-alert-error" role="alert">
            <p style={{ margin: '0 0 10px' }}>{state.message}</p>
            <button type="button" className="ad-btn ad-btn-sm" onClick={reload}>
              다시 시도
            </button>
          </div>
        ) : state.items.length === 0 ? (
          <div className="ad-empty">
            <h3>아직 등록된 문의가 없습니다</h3>
            <p>첫 문의를 남겨 주세요. 등록된 문의는 이 게시판에 공개로 표시됩니다.</p>
          </div>
        ) : (
          <div className="ad-grid cols-2">
            {state.items.map((inquiry) => (
              <InquiryCard key={inquiry.id} inquiry={inquiry} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** /support — 문의 게시판. 폼으로 desk-platform 공개 API에 등록하고, 하단에 공개 목록을 노출한다. */
export function SupportPage(): ReactElement {
  useDocumentTitle('문의')
  const fieldId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

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

  const resetForm = (): void => {
    setTitle('')
    setBody('')
    setAuthorName('')
    setContactEmail('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 28 }}>
      <section className="ad-support-head">
        <div>
          <p className="ad-eyebrow">문의 · /support</p>
          <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 30, letterSpacing: '-0.03em', margin: '0 0 10px' }}>
            무엇을 도와드릴까요?
          </h1>
          <p className="ad-muted" style={{ margin: 0, maxWidth: '60ch' }}>
            제휴·버그·의견·이용 문의를 남겨 주세요. 접수된 문의는 아래 게시판에 공개로 표시되며,
            운영자가 확인 후 상태를 업데이트합니다. 전화·이메일 대신 이 게시판으로 문의를 통합했습니다.
          </p>
        </div>
        <Link to="/" className="ad-btn ad-btn-sm">
          홈으로
        </Link>
      </section>

      <section>
        {submitted ? (
          <div className="ad-card" role="status">
            <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>문의가 접수되었습니다.</h2>
            <p className="ad-muted" style={{ margin: '0 0 14px' }}>
              아래 게시판에서 등록된 문의를 확인할 수 있습니다. 운영자가 확인 후 상태를
              업데이트합니다.
            </p>
            <button type="button" className="ad-btn ad-btn-sm" onClick={() => setSubmitted(false)}>
              문의 더 남기기
            </button>
          </div>
        ) : (
          <form className="ad-card" onSubmit={handleSubmit} noValidate>
            <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
              <legend className="ad-label" style={{ marginBottom: 8 }}>
                카테고리
              </legend>
              <div className="ad-row">
                {INQUIRY_CATEGORIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="ad-chip"
                    aria-pressed={value === category}
                    title={INQUIRY_CATEGORY_HINTS[value]}
                    onClick={() => setCategory(value)}
                  >
                    {INQUIRY_CATEGORY_LABELS[value]}
                  </button>
                ))}
              </div>
              <p className="ad-muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                {INQUIRY_CATEGORY_HINTS[category]}
              </p>
            </fieldset>

            <div className="ad-field">
              <div className="ad-label-row">
                <label className="ad-label" htmlFor={`${fieldId}-title`} style={{ margin: 0 }}>
                  제목
                </label>
                <span className="ad-count">
                  {title.length}/{TITLE_MAX}
                </span>
              </div>
              <input
                id={`${fieldId}-title`}
                className="ad-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={TITLE_MAX}
                required
                placeholder="문의 제목을 한 줄로 적어 주세요"
              />
            </div>

            <div className="ad-field">
              <div className="ad-label-row">
                <label className="ad-label" htmlFor={`${fieldId}-body`} style={{ margin: 0 }}>
                  내용
                </label>
                <span className="ad-count">
                  {body.length}/{BODY_MAX}
                </span>
              </div>
              <textarea
                id={`${fieldId}-body`}
                className="ad-textarea"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={BODY_MAX}
                required
                rows={6}
                placeholder="문의 내용을 자세히 적어 주세요. 버그 신고라면 재현 방법과 환경을 함께 알려 주시면 빠르게 확인할 수 있습니다."
              />
            </div>

            <div className="ad-grid cols-2">
              <div className="ad-field" style={{ marginBottom: 0 }}>
                <label className="ad-label" htmlFor={`${fieldId}-name`}>
                  이름 <span className="ad-optional">(선택)</span>
                </label>
                <input
                  id={`${fieldId}-name`}
                  className="ad-input"
                  value={authorName}
                  onChange={(event) => setAuthorName(event.target.value)}
                  maxLength={NAME_MAX}
                  autoComplete="name"
                  placeholder="게시판에 표시될 이름"
                />
              </div>
              <div className="ad-field" style={{ marginBottom: 0 }}>
                <label className="ad-label" htmlFor={`${fieldId}-email`}>
                  이메일 <span className="ad-optional">(선택)</span>
                </label>
                <input
                  id={`${fieldId}-email`}
                  className="ad-input"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="답변 받을 이메일 (비공개)"
                />
              </div>
            </div>

            {/* 허니팟: 일반 사용자·스크린리더 흐름에서 숨김. 봇이 채우면 무음 처리. */}
            <div className="ad-visually-hidden" aria-hidden="true">
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
            <div role="alert" aria-live="assertive">
              {error ? (
                <div className="ad-alert ad-alert-error" style={{ marginTop: 16, marginBottom: 0 }}>
                  {error}
                </div>
              ) : null}
            </div>

            <div className="ad-row" style={{ marginTop: 18 }}>
              <button type="submit" className="ad-btn ad-btn-primary" disabled={submitting}>
                {submitting ? '접수 중…' : '문의 접수'}
              </button>
              <span className="ad-muted" style={{ fontSize: 13 }}>
                이메일은 비공개로 운영자만 확인합니다.
              </span>
            </div>
          </form>
        )}
      </section>

      <InquiryBoard key={boardKey} reloadKey={boardKey} />
    </div>
  )
}
