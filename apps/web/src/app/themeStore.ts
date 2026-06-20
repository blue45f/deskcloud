import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'

export interface ThemeState {
  theme: Theme
  resolved: Resolved
  setTheme: (t: Theme) => void
  toggle: () => void
}

const STORAGE_KEY = 'md-theme'

function systemTheme(): Resolved {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function apply(resolved: Resolved): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }
}

function readStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light'
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'light'
}

function resolveFor(theme: Theme): Resolved {
  return theme === 'system' ? systemTheme() : theme
}

const initialTheme = readStoredTheme()

/**
 * 테마(라이트/다크/시스템) — 작은 클라이언트 UI 상태. localStorage 는 'md-theme' 키에
 * 평문 문자열로 보존한다. 시스템 테마 변화 구독은 store 외부에서 1회 배선한다.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  resolved: resolveFor(initialTheme),
  setTheme: (t) => {
    if (get().theme === t) return
    set({ theme: t })
  },
  toggle: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
}))

// --- 부수효과 배선 (모듈 로드 시 1회) ---------------------------------------

let systemMq: MediaQueryList | null = null
let systemHandler: (() => void) | null = null

function wireSystemListener(theme: Theme): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  if (theme === 'system') {
    if (systemMq) return
    systemMq = window.matchMedia('(prefers-color-scheme: dark)')
    systemHandler = () => {
      const r = systemTheme()
      useThemeStore.setState({ resolved: r })
      apply(r)
    }
    systemMq.addEventListener('change', systemHandler)
  } else if (systemMq && systemHandler) {
    systemMq.removeEventListener('change', systemHandler)
    systemMq = null
    systemHandler = null
  }
}

function syncSideEffects(theme: Theme): void {
  const r = resolveFor(theme)
  if (useThemeStore.getState().resolved !== r) {
    useThemeStore.setState({ resolved: r })
  }
  apply(r)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme)
  }
  wireSystemListener(theme)
}

// 첫 페인트 동기화.
syncSideEffects(initialTheme)

// theme 변경 시마다 부수효과 재적용.
useThemeStore.subscribe((state, prev) => {
  if (state.theme !== prev.theme) syncSideEffects(state.theme)
})
