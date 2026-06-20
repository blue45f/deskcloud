import { useState } from 'react'

import type { ReactElement } from 'react'

import { AuthDialog, useAuth } from '@/lib/firebaseAuth'

/**
 * 헤더 회원 로그인 진입점 — Firebase Auth 기반(통합 로그인 모듈).
 *
 * 이 컨트롤은 기존 어드민 secret 키 콘솔 로그인(/login → /dashboard)과 **별개**다.
 * 로그아웃 상태면 "로그인" 버튼으로 AuthDialog 를 열고(이메일/비번 + 게스트),
 * 로그인 상태면 이메일(또는 "게스트")과 로그아웃을 보여준다. 둘은 공존한다 —
 * 회원 로그인을 추가할 뿐 어드민 콘솔 로그인을 대체하지 않는다.
 */
export function MemberAuthControl(): ReactElement {
  const { user, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (loading) {
    // 초기 onAuthStateChanged 해석 전 — 레이아웃 점프 방지용 플레이스홀더.
    return <span className="ax-member-skel" aria-hidden="true" />
  }

  if (!user) {
    return (
      <>
        <button type="button" className="ax-btn ax-btn-sm" onClick={() => setOpen(true)}>
          로그인
        </button>
        <AuthDialog open={open} onOpenChange={setOpen} />
      </>
    )
  }

  const label = user.isAnonymous ? '게스트' : (user.email ?? '회원')

  return (
    <span className="ax-member">
      <span className="ax-member-name" title={label}>
        {label}
      </span>
      <button
        type="button"
        className="ax-btn ax-btn-sm"
        onClick={() => void signOut()}
        aria-label={`${label} 로그아웃`}
        title="로그아웃"
      >
        로그아웃
      </button>
    </span>
  )
}
