import { useEffect, useId, useRef, useState } from 'react'

import type { Inquiry, InquiryCategory, InquiryStatus } from '@/services/inquiryApi'
import type { FormEvent, ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'
import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_HINTS,
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  listInquiries,
  submitInquiry,
} from '@/services/inquiryApi'

const TITLE_MAX = 120
const BODY_MAX = 4000
const NAME_MAX = 80

function StatusBadge({ status }: { status: InquiryStatus }): ReactElement {
  const label = INQUIRY_STATUS_LABELS[status] ?? status
  return <span className={`fd-badge fd-status-${status}`}>{label}</span>
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
    <article className="fd-inquiry-card">
      <div className="fd-row">
        <span className="fd-badge">
          {INQUIRY_CATEGORY_LABELS[inquiry.category] ?? inquiry.category}
        </span>
        <StatusBadge status={inquiry.status} />
        <span className="fd-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {shortRelativeDate(inquiry.createdAt)}
        </span>
      </div>
      <h3>{inquiry.title}</h3>
      <p className="fd-inquiry-body">{inquiry.body}</p>
      <p className="fd-inquiry-meta">{inquiry.authorName?.trim() || '익명'}</p>
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

  // 목록 조회. set-state-in-effect를 피하려고 상태 변경은 모두 비동기 콜백에서만 한다.
  // 로딩 표시는 초기 state(loading)와 retry/새로고침 핸들러에서만 켠다.
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
  const retry = (): void => {
    setState({ phase: 'loading' })
    setRetryKey((value) => value + 1)
  }

  return (
    <section className="fd-section" aria-labelledby="fd-board-heading">
      <div className="fd-row" style={{ justifyContent: 'space-between' }}>
        <h2 id="fd-board-heading" style={{ margin: 0 }}>
          최근 문의
        </h2>
        <button
          type="button"
          className="fd-btn fd-btn-sm"
          onClick={retry}
          disabled={loading}
        >
          새로고침
        </button>
      </div>

      <div aria-live="polite" aria-busy={loading} style={{ marginTop: 16 }}>
        {state.phase === 'loading' ? (
          <div className="fd-grid cols-2">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="fd-skeleton" />
            ))}
          </div>
        ) : state.phase === 'error' ? (
          <div className="fd-alert fd-alert-error" style={{ marginBottom: 0 }}>
            <p style={{ margin: 0 }}>{state.message}</p>
            <button
              type="button"
              className="fd-btn fd-btn-sm"
              onClick={retry}
              style={{ marginTop: 10 }}
            >
              다시 시도
            </button>
          </div>
        ) : state.items.length === 0 ? (
          <div className="fd-empty">
            <p>아직 등록된 문의가 없습니다.</p>
            <p>첫 문의를 남겨 주세요. 등록된 문의는 이 게시판에 공개로 표시됩니다.</p>
          </div>
        ) : (
          <ul
            className="fd-grid cols-2"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
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

/** /support — 내부 문의 게시판. 등록(POST) + 공개 목록(GET)을 한 화면에. */
export function SupportPage(): ReactElement {
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
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <section>
        <p className="fd-muted" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
          문의 · /support
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: 30, letterSpacing: '-0.02em', margin: '4px 0 8px', outline: 'none' }}
        >
          무엇을 도와드릴까요?
        </h1>
        <p className="fd-muted" style={{ margin: 0 }}>
          제휴·버그·의견·이용 문의를 남겨 주세요. 접수된 문의는 아래 게시판에 공개로 표시되며,
          운영자가 확인 후 상태를 업데이트합니다. 전화·이메일 대신 이 게시판으로 문의를 통합했습니다.
        </p>
      </section>

      <section className="fd-section">
        {submitted ? (
          <div className="fd-card" role="status">
            <div className="fd-alert fd-alert-success" style={{ marginBottom: 12 }}>
              문의가 접수되었습니다.
            </div>
            <p className="fd-muted" style={{ marginTop: 0 }}>
              아래 게시판에서 등록된 문의를 확인할 수 있습니다. 운영자가 확인 후 상태를
              업데이트합니다.
            </p>
            <button type="button" className="fd-btn" onClick={() => setSubmitted(false)}>
              문의 더 남기기
            </button>
          </div>
        ) : (
          <form className="fd-card" onSubmit={handleSubmit} noValidate>
            <fieldset className="fd-field" style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
              <legend className="fd-label" style={{ padding: 0 }}>
                카테고리
              </legend>
              <div className="fd-choice-group">
                {INQUIRY_CATEGORIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="fd-choice"
                    aria-pressed={value === category}
                    title={INQUIRY_CATEGORY_HINTS[value]}
                    onClick={() => setCategory(value)}
                  >
                    {INQUIRY_CATEGORY_LABELS[value]}
                  </button>
                ))}
              </div>
              <p className="fd-muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                {INQUIRY_CATEGORY_HINTS[category]}
              </p>
            </fieldset>

            <label className="fd-field" htmlFor={`${fieldId}-title`}>
              <span className="fd-label">
                제목{' '}
                <span className="fd-char-count">
                  {title.length}/{TITLE_MAX}
                </span>
              </span>
              <input
                id={`${fieldId}-title`}
                className="fd-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={TITLE_MAX}
                required
                placeholder="문의 제목을 한 줄로 적어 주세요"
              />
            </label>

            <label className="fd-field" htmlFor={`${fieldId}-body`}>
              <span className="fd-label">
                내용{' '}
                <span className="fd-char-count">
                  {body.length}/{BODY_MAX}
                </span>
              </span>
              <textarea
                id={`${fieldId}-body`}
                className="fd-input"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={BODY_MAX}
                required
                rows={6}
                style={{ resize: 'vertical', lineHeight: 1.55 }}
                placeholder="문의 내용을 자세히 적어 주세요. 버그 신고라면 재현 방법과 환경을 함께 알려 주시면 빠르게 확인할 수 있습니다."
              />
            </label>

            <div className="fd-grid cols-2">
              <label className="fd-field" htmlFor={`${fieldId}-name`} style={{ marginBottom: 0 }}>
                <span className="fd-label">
                  이름 <span className="fd-char-count">(선택)</span>
                </span>
                <input
                  id={`${fieldId}-name`}
                  className="fd-input"
                  value={authorName}
                  onChange={(event) => setAuthorName(event.target.value)}
                  maxLength={NAME_MAX}
                  autoComplete="name"
                  placeholder="게시판에 표시될 이름"
                />
              </label>
              <label className="fd-field" htmlFor={`${fieldId}-email`} style={{ marginBottom: 0 }}>
                <span className="fd-label">
                  이메일 <span className="fd-char-count">(선택)</span>
                </span>
                <input
                  id={`${fieldId}-email`}
                  className="fd-input"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="답변 받을 이메일 (비공개)"
                />
              </label>
            </div>

            {/* 허니팟: 시각적으로 숨기고 스크린리더에서도 라벨로 안내. 봇이 채우면 무음 처리. */}
            <div className="fd-visually-hidden" aria-hidden="true">
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
            <p role="alert" aria-live="assertive" style={{ margin: '16px 0 0', minHeight: 0 }}>
              {error ? (
                <span className="fd-alert fd-alert-error" style={{ display: 'block', margin: 0 }}>
                  {error}
                </span>
              ) : null}
            </p>

            <div className="fd-row" style={{ marginTop: 16 }}>
              <button type="submit" className="fd-btn fd-btn-primary" disabled={submitting}>
                {submitting ? '접수 중…' : '문의 접수'}
              </button>
              <span className="fd-muted" style={{ fontSize: 13 }}>
                이메일은 비공개로 운영자만 확인합니다.
              </span>
            </div>
          </form>
        )}
      </section>

      <InquiryBoard reloadKey={boardKey} />
    </div>
  )
}
