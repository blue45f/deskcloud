import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aidigestdesk.colorScheme.v1'

type StoredScheme = 'light' | 'dark'

function readStored(): StoredScheme | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'light' || raw === 'dark' ? raw : null
  } catch {
    return null
  }
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** 저장된 선택이 있으면 그 값을, 없으면 OS 선호도를 초기값으로 쓴다. */
function getInitialDark(): boolean {
  const stored = readStored()
  if (stored) return stored === 'dark'
  return prefersDark()
}

export type ColorScheme = {
  dark: boolean
  toggle: () => void
}

/**
 * 다크 모드 상태를 OS 선호도로 시작하고 localStorage에 사용자 선택을 보존한다.
 * - 사용자가 직접 토글하기 전에는 OS 테마 변경을 실시간으로 따라간다.
 * - `dark` 변경 시 `<html class="dark">`를 토글하고 `color-scheme` 메타를 맞춰 폼/스크롤바도 일관되게 한다.
 */
export function useColorScheme(): ColorScheme {
  const [dark, setDark] = useState(getInitialDark)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  // 사용자가 명시적으로 고르기 전이면 OS 테마 변경을 따라간다.
  useEffect(() => {
    if (readStored()) return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      if (readStored()) return
      setDark(event.matches)
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const toggle = useCallback(() => {
    setDark((current) => {
      const next = !current
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      } catch {
        // 저장 실패는 비치명적 — 세션 동안에는 동작한다.
      }
      return next
    })
  }, [])

  return { dark, toggle }
}
