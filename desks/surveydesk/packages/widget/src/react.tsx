/**
 * @surveydesk/widget/react — <FeedbackWidget> 컴포넌트.
 *
 * 우하단(기본)에 떠 있는 "피드백" 버튼 → 접근성 다이얼로그.
 * 마운트 시 활성 설문을 GET 하고, 질문(별점·NPS·객관식·자유서술)을 렌더하며,
 * 제출 시 페이지 메타와 함께 POST 한다. loading / form / submitting / success / error 상태.
 *
 * 의존성은 react(peer)뿐. 외부 CSS 프레임워크 0(스코프 인라인 스타일).
 */
import { validateAnswers } from '@surveydesk/shared'
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

import { createSurveyDeskClient, NoActiveSurveyError, type SurveyDeskClient } from './client'
import { AlertIcon, ChatIcon, CheckIcon, CloseIcon } from './icons'
import { QuestionField } from './QuestionField'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

import type { AnswerValue, SubmitResponseInput, SurveyDto } from '@surveydesk/shared'

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface FeedbackWidgetProps {
  /** 형제 앱 식별자(테넌트). 예: 'offhours'. */
  appId: string
  /** API 베이스 URL. 예: 'https://surveys.example.com'. */
  endpoint: string
  /** 선택 — 게이트웨이 토큰(Authorization: Bearer). */
  apiToken?: string
  /** launcher 위치. 기본 bottom-right. */
  position?: WidgetPosition
  /** 강조색(버튼/선택). 기본 #2f5fe0. accent 위 텍스트는 accentInk 로 보정. */
  accent?: string
  /** accent 위 텍스트색(대비 보장용). 기본 흰색. */
  accentInk?: string
  /** launcher 버튼 라벨. 기본 '피드백'. */
  label?: string
  /** 활성 설문이 없을 때 콘솔 경고 억제(기본 false — 조용히 숨김). */
  hideWhenNoSurvey?: boolean
  /** 응답에 귀속할 로그인 사용자(선택). */
  respondent?: SubmitResponseInput['respondent']
  /** 제출 성공 콜백. */
  onSubmitted?: (receipt: { id: string; surveyVersion: number }) => void
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유용). 주면 appId/endpoint 보다 우선. */
  client?: SurveyDeskClient
}

type Phase = 'idle' | 'loading' | 'ready' | 'submitting' | 'success' | 'load-error' | 'no-survey'

const POSITION_CLASS: Record<WidgetPosition, string> = {
  'bottom-right': 'sd-pos-br',
  'bottom-left': 'sd-pos-bl',
  'top-right': 'sd-pos-tr',
  'top-left': 'sd-pos-tl',
}

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function FeedbackWidget(props: FeedbackWidgetProps): ReactElement | null {
  const {
    appId,
    endpoint,
    apiToken,
    position = 'bottom-right',
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    label = '피드백',
    respondent,
    onSubmitted,
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<SurveyDeskClient>(
    () =>
      injectedClient ?? createSurveyDeskClient({ appId, endpoint, apiToken, fetch: customFetch }),
    [injectedClient, appId, endpoint, apiToken, customFetch]
  )

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [survey, setSurvey] = useState<SurveyDto | null>(null)
  const [answers, setAnswers] = useState<Record<string, AnswerValue | undefined>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const theme: WidgetTheme = { accent, accentInk }
  const titleId = useId()
  const introId = useId()

  const dialogRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const firstFieldRef = useRef<HTMLDivElement>(null)

  // 스타일 1회 주입(브라우저에서만)
  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  const loadSurvey = useCallback(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    setFormError(null)
    client
      .getActiveSurvey(ctrl.signal)
      .then((s) => {
        setSurvey(s)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        if (e instanceof NoActiveSurveyError) {
          setPhase('no-survey')
        } else {
          setPhase('load-error')
        }
      })
    return ctrl
  }, [client])

  // 열릴 때 (아직 안 받았으면) 설문 로드
  const openDialog = useCallback(() => {
    setOpen(true)
    if (phase === 'idle' || phase === 'load-error') loadSurvey()
  }, [phase, loadSurvey])

  const closeDialog = useCallback(() => {
    setOpen(false)
    // 제출 완료 후 닫으면 다음 오픈을 위해 폼 초기화
    if (phase === 'success') {
      setAnswers({})
      setErrors({})
      setPhase(survey ? 'ready' : 'idle')
    }
    launcherRef.current?.focus()
  }, [phase, survey])

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

  // 열리면 다이얼로그 안으로 포커스 이동(라우트/모달 포커스 관리)
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const root = dialogRef.current
      if (!root) return
      const target = root.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }, 20)
    return () => window.clearTimeout(t)
  }, [open, phase])

  const setAnswer = useCallback((qid: string, value: AnswerValue | undefined) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
    setErrors((prev) => {
      if (!prev[qid]) return prev
      const next = { ...prev }
      delete next[qid]
      return next
    })
  }, [])

  const submit = useCallback(() => {
    if (!survey) return
    // 1차 클라이언트 검증(공유 순수 함수) — 서버가 2차로 다시 검증한다.
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(answers)) if (v !== undefined) cleaned[k] = v
    const result = validateAnswers(survey.questions, cleaned)
    if (!result.ok) {
      const map: Record<string, string> = {}
      for (const err of result.errors) map[err.questionId] = err.message
      setErrors(map)
      setFormError('입력을 확인해 주세요.')
      // 첫 에러 필드로 포커스 이동
      window.setTimeout(() => {
        dialogRef.current?.querySelector<HTMLElement>('.sd-q-error')?.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        })
      }, 0)
      return
    }

    setPhase('submitting')
    setFormError(null)
    const meta = {
      pageUrl: typeof location !== 'undefined' ? location.href : undefined,
      referrer:
        typeof document !== 'undefined' && document.referrer ? document.referrer : undefined,
    }
    const input: SubmitResponseInput = {
      answers: result.value as SubmitResponseInput['answers'],
      respondent,
      meta,
    }
    client
      .submitResponse(input)
      .then((receipt) => {
        setPhase('success')
        onSubmitted?.({ id: receipt.id, surveyVersion: receipt.surveyVersion })
      })
      .catch((e: unknown) => {
        setPhase('ready')
        setFormError(
          e instanceof Error ? e.message : '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.'
        )
      })
  }, [survey, answers, respondent, client, onSubmitted])

  // 활성 설문이 없으면 launcher 자체를 숨긴다(조용히)
  if (phase === 'no-survey') return null

  const rootStyle = themeVars(theme) as CSSProperties

  return (
    <div className="sd-root" style={rootStyle}>
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          className={`sd-launcher ${POSITION_CLASS[position]}`}
          aria-haspopup="dialog"
          onClick={openDialog}
        >
          <ChatIcon />
          {label}
        </button>
      ) : null}

      {open ? (
        <div
          // 배경 클릭 닫기는 마우스 편의 기능일 뿐이다. 키보드 사용자는 Escape
          // (위 useEffect) 또는 닫기 버튼으로 닫으므로 배경은 presentation 으로 둔다.
          role="presentation"
          className="sd-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog()
          }}
        >
          <div
            ref={dialogRef}
            className="sd-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={survey ? titleId : undefined}
            aria-describedby={survey?.intro ? introId : undefined}
            aria-label={survey ? undefined : '피드백'}
          >
            {phase === 'loading' ? (
              <div className="sd-state" aria-busy="true">
                <div className="sd-spinner" />
                <p className="sd-state-text" style={{ marginTop: 14 }}>
                  설문을 불러오는 중…
                </p>
              </div>
            ) : null}

            {phase === 'load-error' ? (
              <div className="sd-state">
                <div className="sd-state-icon sd-err">
                  <AlertIcon />
                </div>
                <h2 className="sd-state-title">설문을 불러오지 못했어요</h2>
                <p className="sd-state-text">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
                <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button type="button" className="sd-btn sd-btn-ghost" onClick={closeDialog}>
                    닫기
                  </button>
                  <button
                    type="button"
                    className="sd-btn sd-btn-primary"
                    onClick={() => loadSurvey()}
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            ) : null}

            {phase === 'success' ? (
              <div className="sd-state" role="status">
                <div className="sd-state-icon sd-ok">
                  <CheckIcon />
                </div>
                <h2 className="sd-state-title">소중한 의견 감사합니다</h2>
                <p className="sd-state-text">보내 주신 피드백은 서비스 개선에 활용할게요.</p>
                <div style={{ marginTop: 18 }}>
                  <button type="button" className="sd-btn sd-btn-primary" onClick={closeDialog}>
                    닫기
                  </button>
                </div>
              </div>
            ) : null}

            {(phase === 'ready' || phase === 'submitting') && survey ? (
              <>
                <div className="sd-header">
                  <div className="sd-header-text">
                    <h2 className="sd-title" id={titleId}>
                      {survey.title}
                    </h2>
                    {survey.intro ? (
                      <p className="sd-intro" id={introId}>
                        {survey.intro}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="sd-close"
                    aria-label="닫기"
                    onClick={closeDialog}
                  >
                    <CloseIcon />
                  </button>
                </div>

                <form
                  className="sd-body"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    submit()
                  }}
                >
                  {formError ? (
                    <p className="sd-form-error" role="alert">
                      {formError}
                    </p>
                  ) : null}

                  <div ref={firstFieldRef}>
                    {survey.questions.map((q) => (
                      <QuestionField
                        key={q.id}
                        question={q}
                        value={answers[q.id]}
                        error={errors[q.id]}
                        onChange={(v) => setAnswer(q.id, v)}
                      />
                    ))}
                  </div>

                  {/* 폼 제출 트리거(엔터 키 지원) */}
                  <button
                    type="submit"
                    style={{ display: 'none' }}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </form>

                <div className="sd-footer">
                  <a
                    className="sd-brand"
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    SurveyDesk
                  </a>
                  <span className="sd-footer-spacer" />
                  <button type="button" className="sd-btn sd-btn-ghost" onClick={closeDialog}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="sd-btn sd-btn-primary"
                    disabled={phase === 'submitting'}
                    onClick={submit}
                  >
                    {phase === 'submitting' ? '제출 중…' : '제출'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
