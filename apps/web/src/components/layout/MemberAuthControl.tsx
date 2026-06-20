import { LogIn, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'

import { IconButton } from '@/components/app/CommonUi'
import { AuthDialog, useAuth } from '@/lib/firebaseAuth'

/**
 * 헤더 통합 회원 로그인 진입점 — Firebase Auth 기반.
 *
 * 이 컨트롤은 기존 로컬/AuthDesk 회원 로그인(/account 라우트)과 **별개의 추가 옵션**이다.
 * 로그아웃 상태면 "회원 로그인" 버튼으로 AuthDialog 를 열고(이메일 로그인 ⇄ 가입 +
 * 게스트로 시작하기), 로그인 상태면 이메일(또는 "게스트")과 로그아웃을 보여준다.
 *
 * 환경변수(VITE_FIREBASE_*) 미설정이면 로딩만 잠깐 거치고 로그아웃 상태로 보이며,
 * 로그인 시도 시 AuthDialog 가 친절한 안내 에러를 노출한다(크래시 없음).
 */
export function MemberAuthControl() {
  const { user, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (loading) {
    // 초기 onAuthStateChanged 해석 전 — 레이아웃 점프 방지용 플레이스홀더.
    return <div className="h-9 w-9 animate-pulse rounded-md bg-surface-2 sm:w-28" aria-hidden />
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text sm:inline-flex"
        >
          <LogIn className="size-3.5" aria-hidden />
          회원 로그인
        </button>
        <span className="sm:hidden">
          <IconButton label="회원 로그인" onClick={() => setOpen(true)}>
            <LogIn className="size-4" aria-hidden />
          </IconButton>
        </span>
        <AuthDialog open={open} onOpenChange={setOpen} />
      </>
    )
  }

  const label = user.isAnonymous ? '게스트' : (user.email ?? '회원')

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="hidden max-w-[10rem] items-center gap-1.5 truncate rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted sm:inline-flex"
        title={label}
      >
        <UserRound className="size-3.5 shrink-0 text-text-subtle" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <IconButton label={`${label} 로그아웃`} onClick={() => void signOut()}>
        <LogOut className="size-4" aria-hidden />
      </IconButton>
    </div>
  )
}
