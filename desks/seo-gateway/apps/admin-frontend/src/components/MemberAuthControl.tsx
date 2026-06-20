import { LogIn, LogOut, User as UserIcon } from 'lucide-react'
import { useState } from 'react'

import { AuthDialog, useAuth } from '../lib/firebaseAuth'

/**
 * 헤더 회원 로그인 진입점 — Firebase Auth 기반.
 *
 * 이 컨트롤은 기존 관리자 토큰 콘솔 로그인(LoginForm → /admin/api/login)과 **별개**다.
 * 통합 로그인(deskcloud-fleet-auth) 모듈을 이메일/게스트 옵션으로 **추가** 제공한다.
 * 로그아웃 상태면 "로그인" 버튼으로 AuthDialog 를 열고, 로그인 상태면 이메일(또는
 * "게스트")과 로그아웃을 보여준다.
 */
export function MemberAuthControl({ className }: { className?: string }) {
  const { user, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (loading) {
    // 초기 onAuthStateChanged 해석 전 — 레이아웃 점프 방지용 플레이스홀더.
    return (
      <div
        className={`h-8 w-20 animate-pulse rounded-md bg-panel-2 ${className ?? ''}`}
        aria-hidden
      />
    )
  }

  if (!user) {
    return (
      <div className={className}>
        <button
          type="button"
          className="btn-ghost inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
          onClick={() => setOpen(true)}
        >
          <LogIn className="size-4" aria-hidden />
          <span className="hidden sm:inline">회원 로그인</span>
        </button>
        <AuthDialog open={open} onOpenChange={setOpen} />
      </div>
    )
  }

  const label = user.isAnonymous ? '게스트' : (user.email ?? '회원')

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <span
        className="hidden max-w-[12rem] items-center gap-1.5 truncate rounded-md bg-panel-2 px-2.5 py-1 text-[0.8125rem] text-ink-muted sm:inline-flex"
        title={label}
      >
        <UserIcon className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <button
        type="button"
        className="btn-ghost inline-flex size-8 shrink-0 items-center justify-center"
        onClick={() => void signOut()}
        aria-label={`${label} 로그아웃`}
        title="로그아웃"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  )
}
