// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useThemeStore } from './themeStore'

// store 는 모듈 로드 시 1회 초기화·부수효과 배선을 한다(기존 ThemeProvider 동작 보존).
// 각 테스트는 공개 액션으로 상태를 정상화해 싱글톤 오염을 막는다.

const root = document.documentElement

beforeEach(() => {
  localStorage.clear()
  root.classList.remove('dark')
  useThemeStore.getState().setTheme('light')
})

afterEach(() => {
  useThemeStore.getState().setTheme('light')
})

describe('themeStore (Context→zustand 이전, 동작 보존)', () => {
  it('setTheme 가 td-theme 키에 평문 문자열로 보존한다 (persist JSON 봉투 아님)', () => {
    useThemeStore.getState().setTheme('dark')
    expect(localStorage.getItem('td-theme')).toBe('dark')

    useThemeStore.getState().setTheme('light')
    expect(localStorage.getItem('td-theme')).toBe('light')
  })

  it('다크일 때 documentElement 에 dark 클래스를 적용하고 라이트면 제거한다', () => {
    useThemeStore.getState().setTheme('dark')
    expect(root.classList.contains('dark')).toBe(true)
    expect(useThemeStore.getState().resolved).toBe('dark')

    useThemeStore.getState().setTheme('light')
    expect(root.classList.contains('dark')).toBe(false)
    expect(useThemeStore.getState().resolved).toBe('light')
  })

  it('toggle 은 light↔dark 를 뒤집고 system 에서는 dark 가 된다 (기존 toggle 의미 보존)', () => {
    useThemeStore.getState().setTheme('light')
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().theme).toBe('dark')

    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().theme).toBe('light')

    useThemeStore.getState().setTheme('system')
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it("theme='system' 이면 resolved 가 light/dark 중 하나로 해소되고 td-theme 엔 system 이 저장된다", () => {
    useThemeStore.getState().setTheme('system')
    expect(localStorage.getItem('td-theme')).toBe('system')
    expect(['light', 'dark']).toContain(useThemeStore.getState().resolved)
  })
})
