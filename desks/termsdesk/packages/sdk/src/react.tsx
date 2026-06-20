/**
 * @termsdesk/sdk/react — React 바인딩.
 *
 * <ConsentGate> 는 현재 게시된 약관을 보여주고, 사용자가 동의해야 children 을 렌더합니다.
 * 동의 시 변조 방지 영수증을 기록하고, 게시본이 바뀌면(재동의 필요) 자동으로 다시 게이트를 엽니다.
 *
 * 하우스 의존성(Radix 등) 없이 동작하도록 헤드리스에 가깝게 구현 — className 으로 스타일 주입 가능.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'

import type {
  TermsDeskClient,
  ConsentReceiptCreated,
  PublicPolicy,
  RecordConsentParams,
} from './index'

export interface UseTermsDeskPolicyResult {
  policy: PublicPolicy | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useTermsDeskPolicy(
  client: TermsDeskClient,
  params: { policySlug: string; subjectRef?: string; locale?: string }
): UseTermsDeskPolicyResult {
  const { policySlug, subjectRef, locale } = params
  const [policy, setPolicy] = useState<PublicPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    client
      .getCurrentPolicy({ policySlug, subjectRef, locale })
      .then((p) => {
        if (!cancelled) setPolicy(p)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [client, policySlug, subjectRef, locale, nonce])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])
  return { policy, loading, error, refetch }
}

export interface ConsentGateClassNames {
  root?: string
  header?: string
  title?: string
  meta?: string
  body?: string
  changeSummary?: string
  actions?: string
  acceptButton?: string
  declineButton?: string
  error?: string
}

export interface ConsentGateProps {
  client: TermsDeskClient
  policySlug: string
  subjectRef: string
  locale?: string
  method?: RecordConsentParams['method']
  children: ReactNode
  /** 본문 커스텀 렌더(기본: <pre> 텍스트) */
  renderBody?: (policy: PublicPolicy) => ReactNode
  /** 동의 완료 시 콜백 */
  onConsent?: (receipt: ConsentReceiptCreated) => void
  classNames?: ConsentGateClassNames
  acceptLabel?: string
  declineLabel?: string
  /** 거절 버튼 표시 여부 */
  allowDecline?: boolean
}

const baseStyles: Record<string, CSSProperties> = {
  root: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 20,
    maxWidth: 640,
    background: '#fff',
    color: '#0f172a',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: { fontSize: 16, fontWeight: 700, margin: 0 },
  meta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  body: {
    marginTop: 12,
    maxHeight: 240,
    overflow: 'auto',
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    background: '#f8fafc',
    borderRadius: 8,
    padding: 12,
  },
  changeSummary: {
    marginTop: 12,
    fontSize: 13,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: '8px 12px',
  },
  actions: { display: 'flex', gap: 8, marginTop: 16 },
  acceptButton: {
    background: '#4f46e5',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '9px 16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  declineButton: {
    background: 'transparent',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '9px 16px',
    cursor: 'pointer',
  },
  error: { marginTop: 12, color: '#dc2626', fontSize: 13 },
}

export function ConsentGate(props: ConsentGateProps): ReactNode {
  const {
    client,
    policySlug,
    subjectRef,
    locale,
    method = 'checkbox_clickwrap',
    children,
    renderBody,
    onConsent,
    classNames = {},
    acceptLabel = '동의하고 계속',
    declineLabel = '동의 안 함',
    allowDecline = false,
  } = props

  const { policy, loading, error, refetch } = useTermsDeskPolicy(client, {
    policySlug,
    subjectRef,
    locale,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<Error | null>(null)
  const [justConsented, setJustConsented] = useState(false)

  const styled = (key: keyof ConsentGateClassNames) =>
    classNames[key] ? { className: classNames[key] } : { style: baseStyles[key] }

  const submit = useCallback(
    async (decision: 'accepted' | 'declined') => {
      if (!policy) return
      setSubmitting(true)
      setSubmitError(null)
      try {
        const receipt = await client.recordConsent({
          subjectRef,
          policySlug,
          decision,
          method,
          locale,
          contentHash: policy.contentHash,
          evidence: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            referrer: typeof document !== 'undefined' ? document.referrer : undefined,
            buttonLabel: decision === 'accepted' ? acceptLabel : declineLabel,
            renderedHashEcho: policy.contentHash,
          },
        })
        if (decision === 'accepted') {
          setJustConsented(true)
          onConsent?.(receipt)
        } else {
          refetch()
        }
      } catch (e: unknown) {
        setSubmitError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        setSubmitting(false)
      }
    },
    [
      client,
      policy,
      subjectRef,
      policySlug,
      method,
      locale,
      onConsent,
      refetch,
      acceptLabel,
      declineLabel,
    ]
  )

  if (loading) return null
  if (error) {
    return (
      <div {...styled('root')} role="alert">
        <p {...styled('error')}>약관을 불러오지 못했습니다: {error.message}</p>
      </div>
    )
  }
  // 이미 현재 버전에 동의했거나 방금 동의함 → children 렌더
  if (justConsented || (policy && policy.reconsentRequired === false)) {
    return <>{children}</>
  }
  if (!policy) return <>{children}</>

  return (
    <div {...styled('root')} role="dialog" aria-modal="false" aria-label={`${policy.name} 동의`}>
      <div {...styled('header')}>
        <h2 {...styled('title')}>{policy.name}</h2>
        <p {...styled('meta')}>
          버전 {policy.versionLabel} · 해시 {policy.contentHash.slice(0, 12)}
          {policy.effectiveAt ? ` · 발효 ${policy.effectiveAt.slice(0, 10)}` : ''}
        </p>
      </div>
      {policy.changeSummary ? (
        <div {...styled('changeSummary')}>변경 안내: {policy.changeSummary}</div>
      ) : null}
      <div {...styled('body')}>{renderBody ? renderBody(policy) : policy.body}</div>
      {submitError ? <p {...styled('error')}>{submitError.message}</p> : null}
      <div {...styled('actions')}>
        <button
          type="button"
          {...styled('acceptButton')}
          disabled={submitting}
          onClick={() => void submit('accepted')}
        >
          {submitting ? '기록 중…' : acceptLabel}
        </button>
        {allowDecline ? (
          <button
            type="button"
            {...styled('declineButton')}
            disabled={submitting}
            onClick={() => void submit('declined')}
          >
            {declineLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
