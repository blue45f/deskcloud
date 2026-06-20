import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'

export interface ThemeState {
  theme: Theme
  resolved: Resolved
  setTheme: (t: Theme) => void
  toggle: () => void
}

const STORAGE_KEY = 'td-theme'

function systemTheme(): Resolved {
  // matchMedia 가드는 useRouteAnnouncer 와 동일한 컨벤션 — 브라우저엔 항상 존재하므로
  // 실제 동작은 동일하고, jsdom/SSR 처럼 없는 환경에서는 light 로 안전하게 떨어진다.
  return typeof window !== 'undefined' &&
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-color-scheme: dark)').matches
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
 * 테마(라이트/다크/시스템) — 작은 클라이언트 UI 상태. 기존 ThemeContext 를 대체한다.
 * localStorage 는 이전과 동일하게 'td-theme' 키에 평문 문자열로 보존한다(persist 미들웨어의 JSON 봉투를
 * 쓰지 않아 기존 사용자 값과 호환). 시스템 테마 변화 구독은 store 외부에서 1회 배선한다.
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
  if (typeof window === 'undefined' || typeof globalThis.matchMedia !== 'function') return
  // theme === 'system' 일 때만 prefers-color-scheme 변화를 추적한다(기존 동작 보존).
  if (theme === 'system') {
    if (systemMq) return
    systemMq = globalThis.matchMedia('(prefers-color-scheme: dark)')
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
  // resolved 값은 setTheme/toggle 의 set 과 별개로 항상 theme 에서 재계산해 일관성을 맞춘다.
  if (useThemeStore.getState().resolved !== r) {
    useThemeStore.setState({ resolved: r })
  }
  apply(r)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme)
  }
  wireSystemListener(theme)
}

// 첫 페인트 동기화(기존 ThemeProvider 마운트 effect 와 동일한 초기 적용).
syncSideEffects(initialTheme)

// theme 변경 시마다 부수효과 재적용(기존 [theme] 의존성 effect 와 동일).
useThemeStore.subscribe((state, prev) => {
  if (state.theme !== prev.theme) syncSideEffects(state.theme)
})
