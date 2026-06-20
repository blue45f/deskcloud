/**
 * useRealtime(channel) — RealtimeDesk 채널을 React 에 잇는 훅.
 *
 * publishable 키로 클라이언트를 만들어 connect → subscribe(channel) 하고,
 * presence(참여자)·연결 상태·최근 메시지를 리액티브 상태로 노출한다.
 * 언마운트/채널 변경 시 구독을 정리한다.
 *
 * 의존성: react(peer) + @realtimedesk/sdk(client). 외부 fetch 불필요(전부 WS).
 *
 *   const { status, presence, messages } = useRealtime('room:42', {
 *     publishableKey: 'pk_…', endpoint: 'https://realtime.example.com',
 *   })
 */
import {
  createRealtimeClient,
  type ConnectionStatus,
  type MessageDto,
  type PresenceDto,
  type RealtimeClient,
} from '@realtimedesk/sdk/client'
import { useEffect, useMemo, useRef, useState } from 'react'

export type { ConnectionStatus, MessageDto, PresenceDto }

export interface UseRealtimeOptions {
  /** publishable 키(pk_…). */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://realtime.example.com'. */
  endpoint: string
  /** socket.io 경로. 기본 '/realtime'(서버와 일치해야 함). */
  path?: string
  /** 메시지 버퍼 최대 길이(최근 N개 유지). 기본 50. 0이면 메시지 미수집. */
  maxMessages?: number
  /** 외부에서 만든 클라이언트 주입(공유/테스트). 주면 키/엔드포인트보다 우선. */
  client?: RealtimeClient
}

export interface UseRealtimeResult {
  /** 연결 상태. */
  status: ConnectionStatus
  /** 현재 채널 presence(참여 수·멤버). */
  presence: PresenceDto
  /** 최근 수신 메시지(오래된→최신, maxMessages 까지). */
  messages: MessageDto[]
  /** 연결되어 있는지(편의 플래그). */
  connected: boolean
  /** 마지막 서버 오류(있으면). */
  error: { code: string; message: string } | null
  /** 내부 클라이언트(고급 사용 — presence() 1회 조회 등). */
  client: RealtimeClient
}

const EMPTY_MESSAGES: MessageDto[] = []

export function useRealtime(channel: string, options: UseRealtimeOptions): UseRealtimeResult {
  const { publishableKey, endpoint, path, maxMessages = 50, client: injectedClient } = options

  // 클라이언트는 키/엔드포인트가 바뀔 때만 새로 만든다(주입 우선).
  const client = useMemo<RealtimeClient>(
    () => injectedClient ?? createRealtimeClient({ publishableKey, endpoint, path }),
    [injectedClient, publishableKey, endpoint, path]
  )

  const [status, setStatus] = useState<ConnectionStatus>(() => client.getStatus())
  const [presence, setPresence] = useState<PresenceDto>({
    channel,
    count: 0,
    members: [],
  })
  const [messages, setMessages] = useState<MessageDto[]>(EMPTY_MESSAGES)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)

  const maxRef = useRef(maxMessages)
  maxRef.current = maxMessages

  // 연결 상태·오류 구독(클라이언트 단위).
  useEffect(() => {
    const offStatus = client.onStatus(setStatus)
    const offError = client.onError((e) => setError(e))
    return () => {
      offStatus()
      offError()
    }
  }, [client])

  // 채널 구독(메시지 + presence). 채널/클라이언트 변경·언마운트 시 정리.
  useEffect(() => {
    let active = true
    // 채널이 바뀌면 표시 상태 초기화.
    setPresence({ channel, count: 0, members: [] })
    setMessages(EMPTY_MESSAGES)

    const presenceSub = client.onPresence(channel, (p) => {
      if (active) setPresence(p)
    })

    const messageSub = client.subscribe(channel, (msg) => {
      if (!active) return
      const limit = maxRef.current
      if (limit <= 0) return
      setMessages((prev) => {
        const next = prev.length >= limit ? prev.slice(prev.length - limit + 1) : prev.slice()
        next.push(msg)
        return next
      })
    })

    void client.connect().catch(() => {
      // 연결 실패는 onError 로 통지된다.
    })

    return () => {
      active = false
      presenceSub.off()
      void messageSub.unsubscribe()
    }
  }, [client, channel])

  return {
    status,
    presence,
    messages,
    connected: status === 'connected',
    error,
    client,
  }
}
