import { useThemeStore, type ThemeState } from './themeStore'

export type { Theme, Resolved } from './themeStore'
export type ThemeContextValue = ThemeState

/**
 * 테마 상태 훅. 내부 저장소는 zustand store 지만 반환 형태({ theme, resolved, setTheme, toggle })는
 * 그대로 유지한다.
 */
export function useTheme(): ThemeContextValue {
  const theme = useThemeStore((s) => s.theme)
  const resolved = useThemeStore((s) => s.resolved)
  const setTheme = useThemeStore((s) => s.setTheme)
  const toggle = useThemeStore((s) => s.toggle)
  return { theme, resolved, setTheme, toggle }
}
