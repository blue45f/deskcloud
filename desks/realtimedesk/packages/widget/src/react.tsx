/**
 * @realtimedesk/widget/react — <PresenceBar> 컴포넌트.
 *
 * 채널에 누가 있는지(아바타 스택 + 카운트)를 실시간으로 보여주는 자급식 위젯.
 * publishable 키로 접속해 presence 를 구독하고, 참여/이탈 시 자동 갱신된다.
 *
 * 의존성은 react(peer) + @realtimedesk/sdk(client) 뿐. 외부 CSS 프레임워크 0(스코프 CSS).
 * 접근성: aria-live 로 카운트 변동을 보조기기에 알리고, 아바타엔 title/aria-label.
 */
import { useEffect, useMemo, type CSSProperties, type ReactElement } from 'react'

import {
  avatarColor,
  avatarInitial,
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'
import { useRealtime } from './useRealtime'

import type { RealtimeClient } from '@realtimedesk/sdk/client'

export interface PresenceBarProps {
  /** 참여자를 셀 채널. 예: 'room:42', 'doc:abc'. */
  channel: string
  /** publishable 키(pk_…). */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://realtime.example.com'. */
  endpoint: string
  /** socket.io 경로. 기본 '/realtime'(서버와 일치해야 함). */
  path?: string
  /** 아바타로 표시할 최대 인원(초과분은 +N). 기본 5. */
  maxAvatars?: number
  /** 강조색. 기본 #2f5fe0. */
  accent?: string
  /** accent 위 텍스트색(대비 보장). 기본 흰색. */
  accentInk?: string
  /** "LIVE" 상태 표시 점 노출. 기본 true. */
  showStatus?: boolean
  /** 라벨 포맷터(접근성/현지화). 기본: "N명 접속 중". */
  formatCount?: (count: number) => string
  /** 멤버 식별자를 표시용 라벨/이니셜로 변환(예: userId→이름). 기본 식별자 그대로. */
  labelFor?: (member: string) => string
  /** 외부에서 만든 클라이언트 주입(공유/테스트). */
  client?: RealtimeClient
}

const DEFAULT_FORMAT = (count: number): string =>
  count === 0 ? '아무도 없음' : `${count}명 접속 중`

export function PresenceBar(props: PresenceBarProps): ReactElement {
  const {
    channel,
    publishableKey,
    endpoint,
    path,
    maxAvatars = 5,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    showStatus = true,
    formatCount = DEFAULT_FORMAT,
    labelFor,
    client: injectedClient,
  } = props

  const { status, presence, connected } = useRealtime(channel, {
    publishableKey,
    endpoint,
    path,
    // PresenceBar 는 메시지를 모으지 않는다(presence 만).
    maxMessages: 0,
    client: injectedClient,
  })

  // 스타일 1회 주입(브라우저에서만)
  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  const theme: WidgetTheme = { accent, accentInk }
  const rootStyle = themeVars(theme) as CSSProperties

  const visible = useMemo(
    () => presence.members.slice(0, Math.max(0, maxAvatars)),
    [presence.members, maxAvatars]
  )
  const overflow = Math.max(0, presence.count - visible.length)
  const label = (m: string): string => (labelFor ? labelFor(m) : m)

  return (
    <div className="rt-root" style={rootStyle}>
      <div className="rt-bar">
        {showStatus ? (
          <span className="rt-status">
            <span className={`rt-dot${connected ? ' rt-live' : ''}`} aria-hidden="true" />
            <span className="rt-status-label">
              {status === 'connected' ? 'LIVE' : status === 'connecting' ? '연결 중' : '오프라인'}
            </span>
          </span>
        ) : null}

        {presence.count > 0 ? (
          <span className="rt-avatars" aria-hidden="true">
            {visible.map((member) => (
              <span
                key={member}
                className="rt-avatar"
                style={{ background: avatarColor(member) }}
                title={label(member)}
              >
                {avatarInitial(label(member))}
              </span>
            ))}
            {overflow > 0 ? (
              <span className="rt-avatar rt-avatar-more" title={`외 ${overflow}명`}>
                +{overflow}
              </span>
            ) : null}
          </span>
        ) : null}

        <span
          className={`rt-count${presence.count === 0 ? ' rt-empty' : ''}`}
          role="status"
          aria-live="polite"
        >
          {presence.count > 0 ? (
            <>
              <span className="rt-count-num">{presence.count}</span>
              {formatCount(presence.count).replace(String(presence.count), '')}
            </>
          ) : (
            formatCount(0)
          )}
        </span>
      </div>
    </div>
  )
}
