import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

import type { SessionDto } from '@termsdesk/shared'

import { cn } from '@/utils/cn'
import { useTossInApp } from '@/utils/tossEnv'

export function AppLayout({ session }: { session: SessionDto }) {
  const [open, setOpen] = useState(false)
  const isDemo = session.org.slug === 'demo'
  // 토스 인앱(WebView) 감지 — 노치/홈인디케이터 안전영역 패딩을 더해 네이티브감을 맞춘다.
  const tossInApp = useTossInApp()

  return (
    <div className="flex min-h-screen bg-bg" data-toss-inapp={tossInApp || undefined}>
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar session={session} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {isDemo ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs text-text">
            <span>
              👀 <span className="font-semibold">읽기 전용 데모</span> — 여기 약관 문안은 예시
              샘플입니다. TermsDesk는 약관을 작성하지 않고, 버전 관리·게시·증거만 담당합니다.
            </span>
            <Link to="/register" className="font-semibold text-accent-strong hover:underline">
              회원가입하고 내 조직 만들기 →
            </Link>
          </div>
        ) : null}
        <Topbar session={session} onMenu={() => setOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <div
            className={cn(
              'mx-auto w-full max-w-[1140px] px-4 py-6 sm:px-6 lg:px-8',
              tossInApp && 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[oklch(0.2_0.01_75/0.45)] data-[state=open]:animate-[fade-in_150ms_ease-out] lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] border-r border-border bg-surface outline-none data-[state=open]:animate-[slide-in-left_220ms_cubic-bezier(0.22,1,0.36,1)] lg:hidden">
            <DialogPrimitive.Title className="sr-only">메뉴</DialogPrimitive.Title>
            <Sidebar session={session} onNavigate={() => setOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
