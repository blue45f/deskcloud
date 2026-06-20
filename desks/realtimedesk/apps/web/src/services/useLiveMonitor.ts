import {
  createRealtimeClient,
  type ConnectionStatus,
  type MessageDto,
  type PresenceDto,
  type RealtimeClient,
} from '@realtimedesk/sdk'
import { useEffect, useMemo, useRef, useState } from 'react'

import { apiBase } from '@/services/api'

export type { ConnectionStatus, MessageDto, PresenceDto }

export interface LiveChannel {
  channel: string
  presence: PresenceDto
}

export interface UseLiveMonitorResult {
  status: ConnectionStatus
  connected: boolean
  /** 모니터 중인 채널별 presence(채널 추가 순). */
  channels: LiveChannel[]
  /** 모든 채널에서 수신한 최근 메시지(최신이 앞). */
  messages: MessageDto[]
  /** 전체 접속자(채널별 count 합 — 동일 소켓이 여러 채널이면 중복 가능). */
  totalPresence: number
  /** 마지막 서버 오류(잘못된 pk·Origin 등). */
  error: { code: string; message: string } | null
  /** 채널을 모니터 목록에 추가(중복 무시). */
  addChannel: (channel: string) => void
  /** 채널을 모니터 목록에서 제거. */
  removeChannel: (channel: string) => void
}

const MAX_MESSAGES = 100

/**
 * 라이브 모니터 — publishable 키로 브라우저 SDK 에 접속해 여러 채널의 presence·메시지를
 * 실시간으로 집계한다. 대시보드가 "지금 누가, 어떤 채널에 있고, 무엇이 흐르는지"를 보여줄 때 사용.
 *
 * pk 가 없으면(미인증/미동기) idle 로 머문다. 채널 집합이 바뀌면 구독을 조정한다.
 */
export function useLiveMonitor(
  publishableKey: string,
  initialChannels: string[]
): UseLiveMonitorResult {
  const [channelSet, setChannelSet] = useState<string[]>(() => dedupe(initialChannels))
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceDto>>({})
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [error, setError] = useState<{ code: string; message: string } | null>(null)

  const enabled = publishableKey.startsWith('pk_')

  // 클라이언트는 pk 가 바뀔 때만 새로 만든다.
  const client = useMemo<RealtimeClient | null>(() => {
    if (!enabled) return null
    return createRealtimeClient({ publishableKey, endpoint: apiBase || window.location.origin })
  }, [publishableKey, enabled])

  // 연결 상태·오류 구독 + cleanup. client 가 없으면(미인증) 반환값에서 status 를
  // 'idle' 로 강제하므로 여기서 별도 setState 는 불필요하다.
  useEffect(() => {
    if (!client) return
    const offStatus = client.onStatus(setStatus)
    const offError = client.onError((e) => setError(e))
    void client.connect().catch(() => {
      // onError 로 통지됨.
    })
    return () => {
      offStatus()
      offError()
      client.close()
    }
  }, [client])

  // 채널 구독 — channelSet 변경 시 조정. 각 채널의 presence·메시지를 맵/버퍼에 반영.
  const subsRef = useRef<Map<string, () => void>>(new Map())
  useEffect(() => {
    if (!client) return
    const subs = subsRef.current
    const wanted = new Set(channelSet)

    // 제거된 채널 정리.
    for (const [ch, dispose] of subs) {
      if (!wanted.has(ch)) {
        dispose()
        subs.delete(ch)
        setPresenceMap((prev) => {
          const next = { ...prev }
          delete next[ch]
          return next
        })
      }
    }

    // 추가된 채널 구독.
    for (const ch of channelSet) {
      if (subs.has(ch)) continue
      const presenceSub = client.onPresence(ch, (p) => {
        setPresenceMap((prev) => ({ ...prev, [p.channel]: p }))
      })
      const messageSub = client.subscribe(ch, (msg) => {
        setMessages((prev) => [msg, ...prev].slice(0, MAX_MESSAGES))
      })
      // 초기 presence 스냅샷을 위해 placeholder.
      setPresenceMap((prev) =>
        prev[ch] ? prev : { ...prev, [ch]: { channel: ch, count: 0, members: [] } }
      )
      subs.set(ch, () => {
        presenceSub.off()
        void messageSub.unsubscribe()
      })
    }
  }, [client, channelSet])

  const channels = useMemo<LiveChannel[]>(
    () =>
      channelSet.map((ch) => ({
        channel: ch,
        presence: presenceMap[ch] ?? { channel: ch, count: 0, members: [] },
      })),
    [channelSet, presenceMap]
  )

  const totalPresence = channels.reduce((a, c) => a + c.presence.count, 0)

  return {
    status: enabled ? status : 'idle',
    connected: status === 'connected',
    channels,
    messages,
    totalPresence,
    error,
    addChannel: (channel) => {
      const ch = channel.trim()
      if (!ch) return
      setChannelSet((prev) => (prev.includes(ch) ? prev : [...prev, ch]))
    },
    removeChannel: (channel) => setChannelSet((prev) => prev.filter((c) => c !== channel)),
  }
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))]
}
