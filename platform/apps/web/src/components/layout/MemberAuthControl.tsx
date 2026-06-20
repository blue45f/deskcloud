import { LogIn, LogOut, User as UserIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { AuthDialog, useAuth } from '@/lib/firebaseAuth'
import { cn } from '@/utils/cn'

/**
 * 헤더 회원 로그인 진입점 — Firebase Auth 기반.
 *
 * 이 컨트롤은 기존 테넌트 secret 키 콘솔 로그인(/login → /dashboard)과 **별개**다.
 * 로그아웃 상태면 "로그인" 버튼으로 AuthDialog 를 열고, 로그인 상태면 이메일(또는
 * "게스트")과 로그아웃을 보여준다. 통합 로그인 모듈의 데모 겸 실제 사용처.
 */
export function MemberAuthControl({ className }: { className?: string }) {
  const { user, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (loading) {
    // 초기 onAuthStateChanged 해석 전 — 레이아웃 점프 방지용 플레이스홀더.
    return (
      <div
        className={cn('h-8 w-20 animate-pulse rounded-md bg-surface-2', className)}
        aria-hidden
      />
    )
  }

  if (!user) {
    return (
      <div className={className}>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <LogIn className="size-4" aria-hidden />
          <span className="hidden sm:inline">로그인</span>
        </Button>
        <AuthDialog open={open} onOpenChange={setOpen} />
      </div>
    )
  }

  const label = user.isAnonymous ? '게스트' : (user.email ?? '회원')

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className="hidden max-w-[12rem] items-center gap-1.5 truncate rounded-md bg-surface-2 px-2.5 py-1 text-[0.8125rem] text-text-muted sm:inline-flex"
        title={label}
      >
        <UserIcon className="size-3.5 shrink-0 text-text-subtle" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => void signOut()}
        aria-label={`${label} 로그아웃`}
        title="로그아웃"
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
