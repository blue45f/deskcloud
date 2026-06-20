/**
 * @moderationdesk/widget — 클라이언트 사전검사(pre-check) 훅 + 배지.
 *
 * `useModerationCheck` 는 텍스트(예: 작성 중인 댓글)를 디바운스해 publishable 키로
 * POST /api/moderate 를 호출하고 verdict 를 돌려준다. `<ModerationBadge>` 는 그 결과를
 * 작은 배지로 보여 준다(flag/block 일 때만, allow 면 null).
 *
 * 중요: 이는 **UX 힌트**일 뿐입니다. publishable 키는 브라우저에 노출되므로 신뢰 경계가
 * 아니며, 최종 차단/게이트는 반드시 서버(@moderationdesk/sdk, secret 키)가 해야 합니다.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'

import { createModerationDeskClient, type ModerationDeskClient } from './client'
import { AlertIcon } from './icons'
import { ensureStyles } from './styles'

import type { ModerateResultDto, Verdict } from '@moderationdesk/shared'

export interface UseModerationCheckOptions {
  publishableKey: string
  endpoint: string
  /** 입력 정지 후 검사까지 대기(ms). 기본 500. */
  debounceMs?: number
  /** 이 길이 미만이면 검사하지 않음(0=allow 취급). 기본 1. */
  minLength?: number
  /** 커스텀 fetch / 외부 클라이언트(테스트). */
  fetch?: typeof fetch
  client?: ModerationDeskClient
}

export interface ModerationCheckState {
  verdict: Verdict
  /** 검사 진행 중. */
  loading: boolean
  /** 마지막 검사 결과 전체(있으면). */
  result: ModerateResultDto | null
  /** 검사 호출 자체가 실패했는지(네트워크/권한). verdict 는 보수적으로 allow 유지. */
  error: Error | null
}

const EMPTY: ModerationCheckState = { verdict: 'allow', loading: false, result: null, error: null }

/**
 * 디바운스 클라이언트 사전검사 훅. text 가 바뀌면 debounce 후 검사하고 verdict 를 반환.
 * 빈/짧은 입력은 검사 없이 allow. 검사 실패 시 verdict 는 allow(보수적) + error 노출.
 */
export function useModerationCheck(
  text: string,
  options: UseModerationCheckOptions
): ModerationCheckState {
  const { publishableKey, endpoint, debounceMs = 500, minLength = 1, fetch: customFetch, client: injectedClient } =
    options

  const client = useMemo<ModerationDeskClient>(
    () =>
      injectedClient ??
      createModerationDeskClient({ publishableKey, endpoint, fetch: customFetch }),
    [injectedClient, publishableKey, endpoint, customFetch]
  )

  const [state, setState] = useState<ModerationCheckState>(EMPTY)
  // 응답 경합 방지 — 가장 최근 요청만 반영.
  const seqRef = useRef(0)

  useEffect(() => {
    const trimmed = text.trim()
    if (trimmed.length < minLength) {
      seqRef.current += 1 // 진행 중 요청 무효화
      setState(EMPTY)
      return
    }

    const seq = ++seqRef.current
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true }))

    const timer = window.setTimeout(() => {
      client
        .check(trimmed, { signal: ctrl.signal })
        .then((result) => {
          if (seq !== seqRef.current) return
          setState({ verdict: result.verdict, loading: false, result, error: null })
        })
        .catch((e: unknown) => {
          if (ctrl.signal.aborted || seq !== seqRef.current) return
          // 보수적으로 allow 유지(검사 실패가 게시를 막아선 안 됨) — 게이트는 서버.
          setState({
            verdict: 'allow',
            loading: false,
            result: null,
            error: e instanceof Error ? e : new Error(String(e)),
          })
        })
    }, debounceMs)

    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [text, client, debounceMs, minLength])

  return state
}

export interface ModerationBadgeProps extends UseModerationCheckOptions {
  /** 검사할 텍스트(작성 중인 콘텐츠). */
  text: string
  /** flag 일 때 라벨. 기본 '주의가 필요한 표현'. */
  flagLabel?: string
  /** block 일 때 라벨. 기본 '게시할 수 없는 내용'. */
  blockLabel?: string
}

/**
 * 작성 중 콘텐츠의 사전검사 결과 배지. allow/loading 이면 아무것도 렌더하지 않는다
 * (조용함). flag/block 일 때만 작은 배지로 경고. 차단 강제는 하지 않음(UX 힌트).
 */
export function ModerationBadge(props: ModerationBadgeProps): ReactElement | null {
  const {
    text,
    flagLabel = '주의가 필요한 표현',
    blockLabel = '게시할 수 없는 내용',
    ...checkOptions
  } = props

  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  const { verdict } = useModerationCheck(text, checkOptions)
  if (verdict === 'allow') return null

  return (
    <span className="md-root" style={{ display: 'inline' }}>
      <span
        className={`md-badge ${verdict === 'block' ? 'md-badge-block' : 'md-badge-flag'}`}
        role="status"
      >
        <AlertIcon />
        {verdict === 'block' ? blockLabel : flagLabel}
      </span>
    </span>
  )
}
