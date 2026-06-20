/**
 * ChangelogDesk — 네이티브 플로팅 런처 + 미확인 배지.
 * ──────────────────────────────────────────────────────────────────────────
 * @heejun/deskcloud(createChangelogClient)로 미확인 개수를 가져와 앱의 Button·Badge
 * 디자인 토큰으로 표시하고, 클릭 시 네이티브 ChangelogPanel 을 엽니다.
 * VITE_CHANGELOGDESK_URL 미설정 시 아무것도 렌더하지 않습니다(first-party 폴백).
 * ──────────────────────────────────────────────────────────────────────────
 */
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useState } from 'react'

import { ChangelogPanel } from './ChangelogPanel'

import { getChangelogClient, isChangelogEnabled } from '@/services/deskcloud'
import { getAnonId } from '@/utils/anonId'

const POLL_MS = 60_000

export function ChangelogLauncher() {
  const [open, setOpen] = useState(false)
  const [anonId] = useState(getAnonId)

  const unread = useQuery({
    queryKey: ['deskcloud', 'changelog', 'unread', anonId],
    enabled: isChangelogEnabled && !open,
    refetchInterval: POLL_MS,
    queryFn: async ({ signal }) => {
      const client = getChangelogClient()
      if (!client) return 0
      const res = await client.getUnreadCount({ anonId, signal })
      return res.unreadCount
    },
  })

  if (!isChangelogEnabled) return null

  const count = open ? 0 : (unread.data ?? 0)
  const label = count > 0 ? `변경 이력 — 새 소식 ${count}건` : '변경 이력'

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-full border border-border bg-surface text-text shadow-lg outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-strong"
      >
        <Bell className="size-5" aria-hidden />
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 grid min-w-[1.125rem] place-items-center rounded-full border-2 border-bg bg-accent px-1 text-[0.625rem] font-bold leading-none text-accent-fg"
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      <ChangelogPanel
        open={open}
        onOpenChange={setOpen}
        onUnreadChange={() => void unread.refetch()}
      />
    </>
  )
}

export default ChangelogLauncher
