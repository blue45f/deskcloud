import { create } from 'zustand'

/**
 * 선택된 appId(테넌트) — 대시보드·에디터가 공유한다. SurveyDesk API 에는 "appId 목록"
 * 엔드포인트가 없으므로(멀티테넌트, 임의 문자열), 클라이언트가 최근 본 appId 를
 * localStorage 에 기억해 빠른 전환 칩으로 노출한다. 데모 시드(demo·offhours)를 기본 추천.
 */
const SELECTED_KEY = 'sd-app-id'
const RECENT_KEY = 'sd-app-id-recent'
const SEED_APP_IDS = ['demo', 'offhours']
const MAX_RECENT = 8

function readSelected(): string {
  if (typeof localStorage === 'undefined') return SEED_APP_IDS[0]!
  return localStorage.getItem(SELECTED_KEY) ?? SEED_APP_IDS[0]!
}

function readRecent(): string[] {
  if (typeof localStorage === 'undefined') return [...SEED_APP_IDS]
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    const list = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    return [...new Set([...list, ...SEED_APP_IDS])].slice(0, MAX_RECENT)
  } catch {
    return [...SEED_APP_IDS]
  }
}

export interface AppIdState {
  appId: string
  recent: string[]
  select: (appId: string) => void
}

const initialSelected = readSelected()
const initialRecent = readRecent()

export const useAppIdStore = create<AppIdState>((set, get) => ({
  appId: initialSelected,
  recent: initialRecent,
  select: (raw) => {
    const appId = raw.trim().toLowerCase()
    if (!appId || appId === get().appId) {
      if (appId && appId !== get().appId) set({ appId })
      return
    }
    const recent = [appId, ...get().recent.filter((a) => a !== appId)].slice(0, MAX_RECENT)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SELECTED_KEY, appId)
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    }
    set({ appId, recent })
  },
}))
