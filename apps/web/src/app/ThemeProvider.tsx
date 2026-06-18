import { type ReactNode } from 'react'

// 테마 상태는 zustand store(themeStore)가 소유. 이 import 가 모듈 부수효과(localStorage·다크클래스·
// 시스템테마 구독)를 배선한다.
import './themeStore'

/** 패스스루 — store 가 상태를 소유하지만 래핑 구조를 보존한다. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
