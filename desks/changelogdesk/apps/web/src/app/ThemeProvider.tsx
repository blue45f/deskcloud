import { type ReactNode } from 'react'

// 테마 상태는 zustand store(themeStore)가 소유한다. store 는 모듈 로드 시 localStorage 읽기·
// 다크 클래스 적용·시스템 테마 구독을 자체 배선하므로, 이 import 가 부수효과를 보장한다.
import './themeStore'

/** 하위 호환 패스스루 — store 가 상태를 소유하지만 래핑 구조를 보존한다. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
