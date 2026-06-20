/**
 * @reviewdesk/widget/react — 4개의 self-contained 임베드 위젯.
 *
 *  1) <ReviewStars subjectId />     — 컴팩트 집계 배지(평균 별 + 건수)
 *  2) <ReviewList subjectId />      — 승인 리뷰 목록 + 분포 막대 + 집계 헤더
 *  3) <ReviewForm subjectId />      — 리뷰 제출(별점 picker + 이름/제목/본문) → 성공/감사/에러
 *  4) <TestimonialWall />           — featured/approved 후기 그리드
 *
 * 공통 props: publishableKey(pk_...) + endpoint. 의존성은 react(peer)뿐,
 * 외부 CSS 프레임워크 0(스코프 인라인 CSS). 모두 접근성 준수(focus-visible·
 * reduced-motion·roving star radios·대비).
 */
import {
  RATING_MAX,
  RATING_MIN,
  REVIEW_AUTHOR_MAX,
  REVIEW_BODY_MAX,
  REVIEW_TITLE_MAX,
  submitReviewSchema,
  type PublicReviewDto,
  type SubmitReviewInput,
} from '@reviewdesk/shared'
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
  createReviewDeskClient,
  type PublicReviewsDto,
  type ReviewAggregate,
  type ReviewDeskClient,
  type ReviewWallDto,
} from './client'
import { AlertIcon, CheckIcon, StarIcon } from './icons'
import { Avatar, formatDate, Stars, type StarSize } from './parts'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

/* ============================ shared props/types ============================ */

export interface CommonWidgetProps {
  /** publishable 키(pk_...). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://reviews.example.com'. */
  endpoint: string
  /** 강조색(버튼/포커스). 기본 #2f5fe0. */
  accent?: string
  /** accent 위 텍스트색(대비 보장). 기본 흰색. */
  accentInk?: string
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유). 주면 publishableKey/endpoint 보다 우선. */
  client?: ReviewDeskClient
}

type LoadPhase = 'loading' | 'ready' | 'error'

/** 위젯 루트 — 스타일 주입 + accent CSS 변수 + .rd-root 래퍼. */
function Root({
  accent = DEFAULT_ACCENT,
  accentInk = DEFAULT_ACCENT_INK,
  className,
  inline,
  children,
}: {
  accent?: string
  accentInk?: string
  className?: string
  inline?: boolean
  children: React.ReactNode
}): ReactElement {
  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])
  const theme: WidgetTheme = { accent, accentInk }
  const style = {
    ...(themeVars(theme) as CSSProperties),
    ...(inline ? { display: 'inline-flex' } : null),
  }
  return (
    <div className={`rd-root${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  )
}

function useClient(props: CommonWidgetProps): ReviewDeskClient {
  const { client, publishableKey, endpoint, fetch: customFetch } = props
  return useMemo<ReviewDeskClient>(
    () => client ?? createReviewDeskClient({ publishableKey, endpoint, fetch: customFetch }),
    [client, publishableKey, endpoint, customFetch]
  )
}

/* ================================================================== */
/* 1) ReviewStars — 컴팩트 집계 배지                                    */
/* ================================================================== */

export interface ReviewStarsProps extends CommonWidgetProps {
  /** 리뷰 대상 식별자(소문자·숫자·하이픈). */
  subjectId: string
  /** 별 크기. 기본 'sm'. */
  size?: StarSize
  /** 건수 텍스트 숨김(별 + 숫자만). 기본 false. */
  hideCount?: boolean
  /** 건수를 누르면 이동할 링크(예: 리뷰 섹션 #anchor). */
  href?: string
}

export function ReviewStars(props: ReviewStarsProps): ReactElement {
  const { subjectId, size = 'sm', hideCount = false, href, accent, accentInk } = props
  const client = useClient(props)
  const [phase, setPhase] = useState<LoadPhase>('loading')
  const [agg, setAgg] = useState<ReviewAggregate | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    client
      .getAggregate(subjectId, ctrl.signal)
      .then((a) => {
        setAgg(a)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted && !(e instanceof DOMException && e.name === 'AbortError')) {
          setPhase('error')
        }
      })
    return () => ctrl.abort()
  }, [client, subjectId])

  const avg = agg?.avgRating ?? 0
  const count = agg?.count ?? 0
  const countText = count === 1 ? '리뷰 1건' : `리뷰 ${count.toLocaleString()}건`
  const ariaLabel =
    count > 0
      ? `${RATING_MAX}점 만점에 평균 ${avg.toFixed(1)}점, ${countText}`
      : '아직 리뷰가 없습니다'

  return (
    <Root accent={accent} accentInk={accentInk} inline>
      {phase === 'loading' ? (
        <span className="rd-badge rd-skeleton" aria-busy="true" aria-label="평점 불러오는 중">
          <span className="rd-skel rd-skel-block" style={{ width: 88 }} />
        </span>
      ) : phase === 'error' || !agg || count === 0 ? (
        <span className="rd-badge">
          <Stars value={0} size={size} />
          <span className="rd-badge-empty">
            {phase === 'error' ? '평점 없음' : '아직 리뷰가 없어요'}
          </span>
        </span>
      ) : (
        <span className="rd-badge" role="img" aria-label={ariaLabel}>
          <Stars value={avg} size={size} />
          <span className="rd-badge-num" aria-hidden="true">
            {avg.toFixed(1)}
          </span>
          {!hideCount ? (
            <span className="rd-badge-count" aria-hidden="true">
              {href ? <a href={href}>{countText}</a> : countText}
            </span>
          ) : null}
        </span>
      )}
    </Root>
  )
}

/* ================================================================== */
/* 2) ReviewList — 집계 헤더 + 분포 막대 + 승인 리뷰 목록               */
/* ================================================================== */

export interface ReviewListProps extends CommonWidgetProps {
  subjectId: string
  /** 가져올 최대 건수. 기본 서버 기본값(20). */
  limit?: number
  /** 분포 막대 숨김. 기본 false. */
  hideDistribution?: boolean
  /** 제목 텍스트. 기본 '고객 리뷰'. */
  title?: string
}

function DistributionBars({ agg }: { agg: ReviewAggregate }): ReactElement {
  const total = agg.count || 1
  const rows = [5, 4, 3, 2, 1]
  return (
    <div className="rd-dist" aria-hidden="true">
      {rows.map((star) => {
        const n = agg.distribution[String(star)] ?? 0
        const pct = Math.round((n / total) * 100)
        return (
          <div className="rd-dist-row" key={star}>
            <span className="rd-dist-star">
              {star}
              <StarIcon filled />
            </span>
            <span className="rd-dist-track">
              <span className="rd-dist-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="rd-dist-n">{n}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ReviewSummary({
  agg,
  hideDistribution,
}: {
  agg: ReviewAggregate
  hideDistribution?: boolean
}): ReactElement {
  const avg = agg.avgRating ?? 0
  const countText = agg.count === 1 ? '리뷰 1건' : `리뷰 ${agg.count.toLocaleString()}건`
  return (
    <div className="rd-summary">
      <div className="rd-summary-score">
        <span className="rd-score-num" aria-hidden="true">
          {avg.toFixed(1)}
        </span>
        <Stars value={avg} size="sm" label={`${RATING_MAX}점 만점에 평균 ${avg.toFixed(1)}점`} />
        <span className="rd-score-meta">{countText}</span>
      </div>
      {!hideDistribution ? <DistributionBars agg={agg} /> : null}
    </div>
  )
}

export function ReviewItem({ review }: { review: PublicReviewDto }): ReactElement {
  return (
    <li className="rd-item">
      <div className="rd-item-head">
        <Avatar name={review.authorName} />
        <span className="rd-item-meta">
          <span className="rd-item-author">{review.authorName}</span>
          <span className="rd-item-date">{formatDate(review.createdAt)}</span>
        </span>
        {review.featured ? <span className="rd-featured-tag">추천</span> : null}
        <Stars
          value={review.rating}
          size="sm"
          label={`${RATING_MAX}점 만점에 ${review.rating}점`}
        />
      </div>
      {review.title ? <h4 className="rd-item-title">{review.title}</h4> : null}
      <p className="rd-item-body">{review.body}</p>
      {review.reply ? (
        <div className="rd-reply">
          <div className="rd-reply-label">운영자 답글</div>
          <p className="rd-reply-body">{review.reply}</p>
        </div>
      ) : null}
    </li>
  )
}

export function ReviewList(props: ReviewListProps): ReactElement {
  const { subjectId, limit, hideDistribution, title = '고객 리뷰', accent, accentInk } = props
  const client = useClient(props)
  const [phase, setPhase] = useState<LoadPhase>('loading')
  const [data, setData] = useState<PublicReviewsDto | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    client
      .getReviews(subjectId, limit, ctrl.signal)
      .then((d) => {
        setData(d)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted && !(e instanceof DOMException && e.name === 'AbortError')) {
          setPhase('error')
        }
      })
    return () => ctrl.abort()
  }, [client, subjectId, limit])

  return (
    <Root accent={accent} accentInk={accentInk}>
      <section className="rd-list rd-card" aria-label={title}>
        {phase === 'loading' ? (
          <div className="rd-state rd-loading" aria-busy="true">
            <div className="rd-spinner" />
            <p className="rd-state-text" style={{ marginTop: 12 }}>
              리뷰를 불러오는 중…
            </p>
          </div>
        ) : phase === 'error' || !data ? (
          <div className="rd-state">
            <div className="rd-state-icon rd-err">
              <AlertIcon />
            </div>
            <h3 className="rd-state-title">리뷰를 불러오지 못했어요</h3>
            <p className="rd-state-text">잠시 후 다시 시도해 주세요.</p>
          </div>
        ) : (
          <>
            <ReviewSummary agg={data.aggregate} hideDistribution={hideDistribution} />
            {data.items.length === 0 ? (
              <p className="rd-empty">아직 작성된 리뷰가 없어요. 첫 리뷰를 남겨 주세요!</p>
            ) : (
              <ul className="rd-items">
                {data.items.map((r) => (
                  <ReviewItem key={r.id} review={r} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </Root>
  )
}

/* ================================================================== */
/* 3) ReviewForm — 별점 picker + 입력 → 제출                            */
/* ================================================================== */

export interface ReviewFormProps extends CommonWidgetProps {
  subjectId: string
  /** subject 표시 라벨(서버에 함께 저장). 예: 'Pro 플랜'. */
  subjectLabel?: string
  /** 폼 제목. 기본 '리뷰 작성'. */
  title?: string
  /** 제목 아래 안내 문구. */
  subtitle?: string
  /** 이메일 입력 노출(선택·비공개). 기본 false. */
  collectEmail?: boolean
  /** 제출 성공 콜백 — 영수증(id·status) 전달. */
  onSubmitted?: (receipt: { id: string; status: string }) => void
}

const RATING_HINTS: Record<number, string> = {
  1: '별로예요',
  2: '그저 그래요',
  3: '괜찮아요',
  4: '좋아요',
  5: '최고예요',
}

export function ReviewForm(props: ReviewFormProps): ReactElement {
  const {
    subjectId,
    subjectLabel,
    title = '리뷰 작성',
    subtitle = '경험을 별점과 함께 남겨 주세요.',
    collectEmail = false,
    onSubmitted,
    accent,
    accentInk,
  } = props
  const client = useClient(props)

  const [rating, setRating] = useState(0)
  const [authorName, setAuthorName] = useState('')
  const [reviewTitle, setReviewTitle] = useState('')
  const [body, setBody] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'success'>('idle')

  const ratingGroupRef = useRef<HTMLDivElement>(null)
  const ratingErrId = useId()
  const nameErrId = useId()
  const bodyErrId = useId()
  const ratingLabelId = useId()

  const moveRating = useCallback((next: number) => {
    const clamped = Math.min(RATING_MAX, Math.max(RATING_MIN, next))
    setRating(clamped)
    setErrors((prev) => {
      if (!prev.rating) return prev
      const n = { ...prev }
      delete n.rating
      return n
    })
    // roving: 새 선택으로 포커스 이동
    window.setTimeout(() => {
      ratingGroupRef.current
        ?.querySelector<HTMLButtonElement>(`button[data-star="${clamped}"]`)
        ?.focus()
    }, 0)
  }, [])

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev
      const n = { ...prev }
      delete n[key]
      return n
    })

  const submit = useCallback(() => {
    const localErrors: Record<string, string> = {}
    if (rating < RATING_MIN) localErrors.rating = '별점을 선택해 주세요.'
    if (!authorName.trim()) localErrors.authorName = '이름을 입력해 주세요.'
    if (!body.trim()) localErrors.body = '리뷰 내용을 입력해 주세요.'
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors)
      setFormError('입력을 확인해 주세요.')
      return
    }

    const candidate = {
      subjectId,
      subjectLabel: subjectLabel || undefined,
      rating,
      title: reviewTitle.trim() || undefined,
      body: body.trim(),
      authorName: authorName.trim(),
      authorEmail: collectEmail && email.trim() ? email.trim() : undefined,
      source: 'widget',
      meta: {
        pageUrl: typeof location !== 'undefined' ? location.href : undefined,
        referrer:
          typeof document !== 'undefined' && document.referrer ? document.referrer : undefined,
      },
    }

    // 1차 클라이언트 검증(공유 스키마) — 서버가 2차로 다시 검증한다.
    const parsed = submitReviewSchema.safeParse(candidate)
    if (!parsed.success) {
      const map: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        map[key] = issue.message
      }
      setErrors(map)
      setFormError('입력을 확인해 주세요.')
      return
    }

    setPhase('submitting')
    setFormError(null)
    client
      .submitReview(parsed.data as SubmitReviewInput)
      .then((receipt) => {
        setPhase('success')
        onSubmitted?.({ id: receipt.id, status: receipt.status })
      })
      .catch((e: unknown) => {
        setPhase('idle')
        setFormError(
          e instanceof Error ? e.message : '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.'
        )
      })
  }, [
    rating,
    authorName,
    body,
    reviewTitle,
    email,
    collectEmail,
    subjectId,
    subjectLabel,
    client,
    onSubmitted,
  ])

  const reset = useCallback(() => {
    setRating(0)
    setAuthorName('')
    setReviewTitle('')
    setBody('')
    setEmail('')
    setErrors({})
    setFormError(null)
    setPhase('idle')
  }, [])

  return (
    <Root accent={accent} accentInk={accentInk}>
      <section className="rd-form-card rd-card" aria-label={title}>
        {phase === 'success' ? (
          <div className="rd-state" role="status">
            <div className="rd-state-icon rd-ok">
              <CheckIcon />
            </div>
            <h3 className="rd-state-title">소중한 리뷰 감사합니다</h3>
            <p className="rd-state-text">
              검수 후 게시돼요. 의견은 서비스 개선에 큰 도움이 됩니다.
            </p>
            <div style={{ marginTop: 18 }}>
              <button type="button" className="rd-btn rd-btn-ghost" onClick={reset}>
                다른 리뷰 작성
              </button>
            </div>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <h3 className="rd-form-title">{title}</h3>
            {subtitle ? <p className="rd-form-sub">{subtitle}</p> : null}

            {formError ? (
              <p className="rd-form-error" role="alert">
                {formError}
              </p>
            ) : null}

            {/* 별점 — roving radiogroup */}
            <div className="rd-field">
              <span className="rd-label" id={ratingLabelId}>
                별점
                <span className="rd-req" aria-hidden="true">
                  *
                </span>
              </span>
              <div
                className="rd-starpick"
                ref={ratingGroupRef}
                role="radiogroup"
                aria-labelledby={ratingLabelId}
                aria-describedby={errors.rating ? ratingErrId : undefined}
                aria-required="true"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    moveRating((rating || RATING_MIN) + (rating === 0 ? 0 : 1))
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault()
                    moveRating((rating || RATING_MIN) - 1)
                  } else if (e.key === 'Home') {
                    e.preventDefault()
                    moveRating(RATING_MIN)
                  } else if (e.key === 'End') {
                    e.preventDefault()
                    moveRating(RATING_MAX)
                  }
                }}
              >
                {Array.from({ length: RATING_MAX }, (_, i) => RATING_MIN + i).map((n) => {
                  const on = n <= rating
                  return (
                    <button
                      key={n}
                      type="button"
                      data-star={n}
                      className={`rd-starbtn${on ? ' rd-on' : ''}`}
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n}점 — ${RATING_HINTS[n]}`}
                      tabIndex={rating === n || (rating === 0 && n === RATING_MIN) ? 0 : -1}
                      onClick={() => moveRating(n)}
                    >
                      <StarIcon filled={on} />
                    </button>
                  )
                })}
                {rating > 0 ? (
                  <span className="rd-rating-hint" aria-hidden="true">
                    {RATING_HINTS[rating]}
                  </span>
                ) : null}
              </div>
              {errors.rating ? (
                <p className="rd-field-error" id={ratingErrId} role="alert">
                  {errors.rating}
                </p>
              ) : null}
            </div>

            {/* 이름 */}
            <div className="rd-field">
              <label className="rd-label" htmlFor={`${nameErrId}-name`}>
                이름
                <span className="rd-req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id={`${nameErrId}-name`}
                className="rd-input"
                type="text"
                value={authorName}
                maxLength={REVIEW_AUTHOR_MAX}
                placeholder="표시될 이름"
                autoComplete="name"
                aria-invalid={errors.authorName ? true : undefined}
                aria-describedby={errors.authorName ? nameErrId : undefined}
                onChange={(e) => {
                  setAuthorName(e.target.value)
                  clearError('authorName')
                }}
              />
              {errors.authorName ? (
                <p className="rd-field-error" id={nameErrId} role="alert">
                  {errors.authorName}
                </p>
              ) : null}
            </div>

            {/* 이메일(선택·비공개) */}
            {collectEmail ? (
              <div className="rd-field">
                <label className="rd-label" htmlFor={`${nameErrId}-email`}>
                  이메일{' '}
                  <span style={{ color: 'var(--rd-muted)', fontWeight: 400 }}>(선택·비공개)</span>
                </label>
                <input
                  id={`${nameErrId}-email`}
                  className="rd-input"
                  type="email"
                  value={email}
                  maxLength={320}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={errors.authorEmail ? true : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearError('authorEmail')
                  }}
                />
                {errors.authorEmail ? (
                  <p className="rd-field-error" role="alert">
                    {errors.authorEmail}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* 제목(선택) */}
            <div className="rd-field">
              <label className="rd-label" htmlFor={`${nameErrId}-title`}>
                제목 <span style={{ color: 'var(--rd-muted)', fontWeight: 400 }}>(선택)</span>
              </label>
              <input
                id={`${nameErrId}-title`}
                className="rd-input"
                type="text"
                value={reviewTitle}
                maxLength={REVIEW_TITLE_MAX}
                placeholder="한 줄 요약"
                onChange={(e) => setReviewTitle(e.target.value)}
              />
            </div>

            {/* 본문 */}
            <div className="rd-field">
              <label className="rd-label" htmlFor={`${bodyErrId}-body`}>
                리뷰 내용
                <span className="rd-req" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id={`${bodyErrId}-body`}
                className="rd-textarea"
                value={body}
                maxLength={REVIEW_BODY_MAX}
                placeholder="어떤 점이 좋았나요? 자유롭게 적어 주세요."
                aria-invalid={errors.body ? true : undefined}
                aria-describedby={errors.body ? bodyErrId : undefined}
                onChange={(e) => {
                  setBody(e.target.value)
                  clearError('body')
                }}
              />
              <div className="rd-count" aria-hidden="true">
                {body.length}/{REVIEW_BODY_MAX}
              </div>
              {errors.body ? (
                <p className="rd-field-error" id={bodyErrId} role="alert">
                  {errors.body}
                </p>
              ) : null}
            </div>

            <div className="rd-form-actions">
              <button
                type="submit"
                className="rd-btn rd-btn-primary"
                disabled={phase === 'submitting'}
              >
                {phase === 'submitting' ? '제출 중…' : '리뷰 제출'}
              </button>
            </div>
          </form>
        )}
      </section>
    </Root>
  )
}

/* ================================================================== */
/* 4) TestimonialWall — featured/approved 후기 그리드                   */
/* ================================================================== */

export interface TestimonialWallProps extends CommonWidgetProps {
  /** 가져올 최대 건수. 기본 서버 기본값(20). */
  limit?: number
  /** 섹션 라벨(스크린리더). 기본 '고객 후기'. */
  title?: string
}

export function TestimonialWall(props: TestimonialWallProps): ReactElement {
  const { limit, title = '고객 후기', accent, accentInk } = props
  const client = useClient(props)
  const [phase, setPhase] = useState<LoadPhase>('loading')
  const [data, setData] = useState<ReviewWallDto | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    client
      .getWall(limit, ctrl.signal)
      .then((d) => {
        setData(d)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted && !(e instanceof DOMException && e.name === 'AbortError')) {
          setPhase('error')
        }
      })
    return () => ctrl.abort()
  }, [client, limit])

  return (
    <Root accent={accent} accentInk={accentInk}>
      <section className="rd-wall" aria-label={title}>
        {phase === 'loading' ? (
          <div className="rd-state rd-loading" aria-busy="true">
            <div className="rd-spinner" />
            <p className="rd-state-text" style={{ marginTop: 12 }}>
              후기를 불러오는 중…
            </p>
          </div>
        ) : phase === 'error' || !data ? (
          <div className="rd-state">
            <div className="rd-state-icon rd-err">
              <AlertIcon />
            </div>
            <h3 className="rd-state-title">후기를 불러오지 못했어요</h3>
            <p className="rd-state-text">잠시 후 다시 시도해 주세요.</p>
          </div>
        ) : data.items.length === 0 ? (
          <p className="rd-empty">아직 후기가 없어요.</p>
        ) : (
          <ul className="rd-wall-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.items.map((t) => (
              <li key={t.id}>
                <TestimonialCard testimonial={t} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Root>
  )
}

export function TestimonialCard({ testimonial }: { testimonial: PublicReviewDto }): ReactElement {
  return (
    <figure className="rd-tcard" style={{ margin: 0, height: '100%' }}>
      <Stars
        value={testimonial.rating}
        size="sm"
        label={`${RATING_MAX}점 만점에 ${testimonial.rating}점`}
      />
      <blockquote className="rd-tcard-body" style={{ margin: 0 }}>
        {testimonial.title ? <strong>{testimonial.title}. </strong> : null}
        {testimonial.body}
      </blockquote>
      <figcaption className="rd-tcard-foot">
        <Avatar name={testimonial.authorName} />
        <span className="rd-item-meta">
          <span className="rd-item-author">{testimonial.authorName}</span>
          <span className="rd-item-date">{formatDate(testimonial.createdAt)}</span>
        </span>
      </figcaption>
    </figure>
  )
}
