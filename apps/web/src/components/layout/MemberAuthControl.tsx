import { useState } from 'react'

import type { ReactElement } from 'react'

import { AuthDialog, useAuth } from '@/lib/firebaseAuth'

/**
 * 헤더 회원 로그인 진입점 — Firebase Auth 기반.
 *
 * 이 컨트롤은 기존 어드민 secret 키 콘솔 로그인(/login → /dashboard)과 **별개**다(추가 옵션).
 * 로그아웃 상태면 "로그인" 버튼으로 AuthDialog 를 열고(이메일/가입/게스트), 로그인 상태면
 * 이메일(또는 "게스트")과 로그아웃을 보여준다. 통합 로그인 모듈의 데모 겸 실제 사용처.
 *
 * FileDesk 자체 CSS(`fd-*`) 디자인 시스템에 맞춤. useAuth API 는 정본과 동일.
 */
export function MemberAuthControl(): ReactElement | null {
  const { user, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (loading) {
    // 초기 onAuthStateChanged 해석 전 — 레이아웃 점프 방지용 플레이스홀더.
    return <span className="fd-member-skeleton" aria-hidden="true" />
  }

  if (!user) {
    return (
      <>
        <button type="button" className="fd-btn fd-btn-sm" onClick={() => setOpen(true)}>
          회원 로그인
        </button>
        <AuthDialog open={open} onOpenChange={setOpen} />
      </>
    )
  }

  const label = user.isAnonymous ? '게스트' : (user.email ?? '회원')

  return (
    <span className="fd-member">
      <span className="fd-member-id" title={label}>
        {label}
      </span>
      <button
        type="button"
        className="fd-btn fd-btn-sm"
        onClick={() => void signOut()}
        title="회원 로그아웃"
      >
        로그아웃
      </button>
    </span>
  )
}
