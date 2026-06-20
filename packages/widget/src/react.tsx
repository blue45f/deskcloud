/**
 * @moderationdesk/widget/react — <ReportButton> 컴포넌트.
 *
 * 콘텐츠 옆에 붙는 접근성 "신고" 버튼. 클릭하면 사유 선택(라디오) + 선택 상세를 받는
 * 접근성 다이얼로그를 열고, 제출 시 POST /api/reports(publishable 키) 로 보낸다.
 * idle → form → submitting → success / error 상태. 포커스 트랩 · Esc 닫기 · 라우트 포커스 복귀.
 *
 * 의존성은 react(peer)뿐. 외부 CSS 프레임워크 0(스코프 인라인 스타일).
 */
import { REPORT_REASON_MAX } from '@moderationdesk/shared'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'

import {
  createModerationDeskClient,
  type ModerationDeskClient,
  type SubmitReportInput,
} from './client'
import { AlertIcon, CheckIcon, CloseIcon, FlagIcon } from './icons'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

/** 기본 신고 사유(라벨 = 제출되는 reason 텍스트). consumer 가 reasons 로 덮어쓸 수 있다. */
export const DEFAULT_REASONS: readonly string[] = [
  '스팸/광고',
  '욕설/혐오 발언',
  '음란물/선정성',
  '폭력/위협',
  '개인정보 노출',
  '기타',
]

export interface ReportButtonProps {
  /** 신고 대상 종류. 예: 'comment', 'post', 'user', 'review'. */
  subjectType: string
  /** 신고 대상 식별자(앱 내부 id). */
  subjectId: string
  /** 발급받은 publishable 키(pk_...). 브라우저 노출 OK. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://moderate.example.com'. */
  endpoint: string
  /** 사유 목록(라벨=제출 reason). 미지정 시 DEFAULT_REASONS. */
  reasons?: readonly string[]
  /** 신고에 귀속할 신고자 식별자(로그인 사용자 등, 선택). */
  reporterId?: string
  /** 트리거 버튼 라벨. 기본 '신고'. */
  label?: string
  /** 텍스트만(테두리 없는) 트리거 스타일. 기본 false(pill). */
  bare?: boolean
  /** 강조색(버튼/선택). 기본 #c0362c. */
  accent?: string
  /** accent 위 텍스트색(대비 보장). 기본 흰색. */
  accentInk?: string
  /** 다이얼로그 제목. 기본 '신고하기'. */
  title?: string
  /** 상세 입력 표시 여부. 기본 true. */
  allowDetail?: boolean
  /** 제출 성공 콜백. */
  onSubmitted?: (receipt: { id: string; status: string }) => void
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유용). 주면 키/endpoint 보다 우선. */
  client?: ModerationDeskClient
}

type Phase = 'form' | 'submitting' | 'success'

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function ReportButton(props: ReportButtonProps): ReactElement {
  const {
    subjectType,
    subjectId,
    publishableKey,
    endpoint,
    reasons = DEFAULT_REASONS,
    reporterId,
    label = '신고',
    bare = false,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    title = '신고하기',
    allowDetail = true,
    onSubmitted,
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<ModerationDeskClient>(
    () =>
      injectedClient ??
      createModerationDeskClient({ publishableKey, endpoint, fetch: customFetch }),
    [injectedClient, publishableKey, endpoint, customFetch]
  )

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('form')
  const [reason, setReason] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const theme: WidgetTheme = { accent, accentInk }
  const titleId = useId()
  const reasonGroupId = useId()

  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  const reset = useCallback(() => {
    setPhase('form')
    setReason(null)
    setDetail('')
    setFieldError(null)
    setFormError(null)
  }, [])

  const openDialog = useCallback(() => {
    reset()
    setOpen(true)
  }, [reset])

  const closeDialog = useCallback(() => {
    setOpen(false)
    // 트리거로 포커스 복귀(라우트/모달 포커스 관리)
    triggerRef.current?.focus()
  }, [])

  // Esc 닫기 + 포커스 트랩
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeDialog()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      )
      if (nodes.length === 0) return
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, closeDialog])

  // 열리면 다이얼로그 안으로 포커스 이동
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const root = dialogRef.current
      if (!root) return
      root.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }, 20)
    return () => window.clearTimeout(t)
  }, [open, phase])

  const pickReason = useCallback((value: string) => {
    setReason(value)
    setFieldError(null)
  }, [])

  const submit = useCallback(() => {
    if (!reason) {
      setFieldError('신고 사유를 선택해 주세요.')
      return
    }
    setPhase('submitting')
    setFormError(null)
    const input: SubmitReportInput = {
      subjectType,
      subjectId,
      reason: detail.trim() ? `${reason} — ${detail.trim()}` : reason,
      ...(reporterId ? { reporterId } : {}),
    }
    client
      .submitReport(input)
      .then((receipt) => {
        setPhase('success')
        onSubmitted?.({ id: receipt.id, status: receipt.status })
      })
      .catch((e: unknown) => {
        setPhase('form')
        setFormError(
          e instanceof Error ? e.message : '신고 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.'
        )
      })
  }, [reason, detail, subjectType, subjectId, reporterId, client, onSubmitted])

  const rootStyle = themeVars(theme) as CSSProperties
  const detailMax = REPORT_REASON_MAX - 64 // reason 라벨 여유 확보

  return (
    <span className="md-root" style={rootStyle}>
      <button
        ref={triggerRef}
        type="button"
        className={`md-report-trigger${bare ? ' md-bare' : ''}`}
        aria-haspopup="dialog"
        onClick={openDialog}
      >
        <FlagIcon />
        {label}
      </button>

      {open ? (
        <div
          className="md-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog()
          }}
        >
          <div
            ref={dialogRef}
            className="md-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {phase === 'success' ? (
              <div className="md-state" role="status">
                <div className="md-state-icon md-ok">
                  <CheckIcon />
                </div>
                <h2 className="md-state-title">신고가 접수되었습니다</h2>
                <p className="md-state-text">검토 후 적절한 조치를 취하겠습니다. 감사합니다.</p>
                <div style={{ marginTop: 18 }}>
                  <button type="button" className="md-btn md-btn-primary" onClick={closeDialog}>
                    닫기
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="md-header">
                  <div className="md-header-text">
                    <h2 className="md-title" id={titleId}>
                      {title}
                    </h2>
                    <p className="md-subtitle">신고 사유를 선택해 주세요. 검토 후 조치됩니다.</p>
                  </div>
                  <button
                    type="button"
                    className="md-close"
                    aria-label="닫기"
                    onClick={closeDialog}
                  >
                    <CloseIcon />
                  </button>
                </div>

                <form
                  className="md-body"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    submit()
                  }}
                >
                  {formError ? (
                    <p className="md-form-error" role="alert">
                      <AlertIcon /> {formError}
                    </p>
                  ) : null}

                  <fieldset
                    className="md-field"
                    style={{ border: 0, margin: 0, padding: 0, minInlineSize: 'auto' }}
                  >
                    <legend className="md-label" id={reasonGroupId} style={{ padding: 0 }}>
                      신고 사유
                      <span className="md-req" aria-hidden="true">
                        *
                      </span>
                    </legend>
                    <div className="md-reasons" role="radiogroup" aria-labelledby={reasonGroupId}>
                      {reasons.map((r) => (
                        <label key={r} className={`md-reason${reason === r ? ' md-checked' : ''}`}>
                          <input
                            type="radio"
                            name="md-reason"
                            value={r}
                            checked={reason === r}
                            onChange={() => pickReason(r)}
                          />
                          <span>{r}</span>
                        </label>
                      ))}
                    </div>
                    {fieldError ? (
                      <p className="md-field-error" role="alert">
                        {fieldError}
                      </p>
                    ) : null}
                  </fieldset>

                  {allowDetail ? (
                    <div className="md-field">
                      <label className="md-label" htmlFor={`${titleId}-detail`}>
                        상세 내용{' '}
                        <span style={{ fontWeight: 400, color: 'var(--md-muted)' }}>(선택)</span>
                      </label>
                      <textarea
                        id={`${titleId}-detail`}
                        className="md-textarea"
                        placeholder="신고 내용을 자세히 알려 주시면 검토에 도움이 됩니다."
                        maxLength={detailMax}
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                      />
                      <div className="md-count">
                        {detail.length}/{detailMax}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    style={{ display: 'none' }}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </form>

                <div className="md-footer">
                  <a
                    className="md-brand"
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ModerationDesk
                  </a>
                  <span className="md-footer-spacer" />
                  <button type="button" className="md-btn md-btn-ghost" onClick={closeDialog}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="md-btn md-btn-primary"
                    disabled={phase === 'submitting'}
                    onClick={submit}
                  >
                    {phase === 'submitting' ? '접수 중…' : '신고 제출'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </span>
  )
}
