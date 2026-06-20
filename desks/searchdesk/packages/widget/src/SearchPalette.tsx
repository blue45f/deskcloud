/**
 * <SearchPalette> — ⌘K(기본) 커맨드 팔레트 오버레이.
 *
 * 핫키로 열리는 접근성 모달: 입력 → 디바운스 검색 → 카테고리 그룹 결과 → 키보드 내비
 * (↑/↓ 이동, Enter 선택, Esc 닫기) → 하이라이트. 빈/로딩/에러 상태 처리.
 *
 * 의존성은 react(peer) + @searchdesk/sdk·shared(타입/런타임). 외부 CSS 프레임워크 0.
 * a11y: role="dialog"+aria-modal, role="combobox"(input)+listbox/option,
 * aria-activedescendant, 포커스 트랩, Esc, prefers-reduced-motion, :focus-visible.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'

import { EnterIcon, SearchIcon } from './icons'
import { ResultsList } from './ResultsList'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'
import { useSearch } from './use-search'

import type { SearchClient } from '@searchdesk/sdk'
import type { SearchHitDto } from '@searchdesk/shared'

export interface SearchPaletteProps {
  /** publishable 키(pk_…). 브라우저 노출 가능. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://search.example.com'. */
  endpoint: string
  /** 대상 인덱스(미지정 시 'default'). */
  indexName?: string
  /** 열기 핫키. 'mod+k'(기본, ⌘/Ctrl+K) · 'mod+/' · '/' 등. */
  hotkey?: string
  /** 입력 placeholder. */
  placeholder?: string
  /** 결과 개수. */
  limit?: number
  /** 디바운스(ms). 기본 160. */
  debounceMs?: number
  /** 강조색(선택 행/하이라이트). 기본 #2f5fe0. */
  accent?: string
  /** accent 위 텍스트색(대비 보장). 기본 흰색. */
  accentInk?: string
  /** 제어 모드 — 부모가 open 상태를 관리(핫키 비활성). */
  open?: boolean
  /** 제어 모드에서 닫기 요청. */
  onClose?: () => void
  /**
   * 결과 선택 시 콜백. 기본 동작: hit.url 이 있으면 그 URL 로 이동.
   * 콜백을 주면 기본 이동 대신 콜백만 실행한다(라우터 연동 등).
   */
  onSelect?: (hit: SearchHitDto) => void
  /** 외부 클라이언트 주입(테스트/공유). */
  client?: SearchClient
}

/** 'mod+k' 같은 핫키 문자열이 이벤트와 일치하는지 판정. */
function matchHotkey(hotkey: string, e: KeyboardEvent): boolean {
  const parts = hotkey
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
  const key = parts[parts.length - 1]!
  const wantMod = parts.includes('mod') || parts.includes('cmd') || parts.includes('meta')
  const wantCtrl = parts.includes('ctrl') || parts.includes('control')
  const wantShift = parts.includes('shift')
  const wantAlt = parts.includes('alt') || parts.includes('option')

  if (e.key.toLowerCase() !== key) return false
  // 'mod' = macOS 의 ⌘(metaKey) 또는 그 외의 Ctrl.
  if (wantMod && !(e.metaKey || e.ctrlKey)) return false
  if (wantCtrl && !e.ctrlKey) return false
  if (wantShift && !e.shiftKey) return false
  if (wantAlt && !e.altKey) return false
  // 'mod' 가 아닌데 ⌘/Ctrl 이 눌려 있으면(예: 단일 '/') 무시 — 단축키 충돌 방지.
  if (!wantMod && !wantCtrl && (e.metaKey || e.ctrlKey)) return false
  return true
}

const FOCUSABLE =
  'a[href],input:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function SearchPalette(props: SearchPaletteProps): ReactElement | null {
  const {
    publishableKey,
    endpoint,
    indexName,
    hotkey = 'mod+k',
    placeholder = '검색…',
    limit,
    debounceMs,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    open: controlledOpen,
    onClose,
    onSelect,
    client,
  } = props

  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const [activeIndex, setActiveIndex] = useState(0)

  const reactId = useId()
  const inputId = `${reactId}-input`
  const listboxId = `${reactId}-listbox`

  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const search = useSearch({ publishableKey, endpoint, indexName, limit, debounceMs, client })
  const { query, setQuery, phase, hits, groups, error, retry } = search

  const theme: WidgetTheme = { accent, accentInk }

  // 스타일 1회 주입(브라우저에서만).
  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  const close = useCallback(() => {
    if (isControlled) onClose?.()
    else setUncontrolledOpen(false)
  }, [isControlled, onClose])

  const openPalette = useCallback(() => {
    if (!isControlled) setUncontrolledOpen(true)
  }, [isControlled])

  // 핫키(비제어 모드만) — 전역 keydown 으로 열기. 입력 필드 안에서도 mod+k 는 동작.
  useEffect(() => {
    if (isControlled) return
    const onKey = (e: KeyboardEvent) => {
      if (matchHotkey(hotkey, e)) {
        e.preventDefault()
        openPalette()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isControlled, hotkey, openPalette])

  // 결과가 바뀌면 활성 인덱스를 맨 위로(범위 밖 방지).
  useEffect(() => {
    setActiveIndex((i) => (i >= hits.length ? 0 : i))
  }, [hits.length])

  // 열릴 때: 포커스 저장 → input 포커스. 닫힐 때: 포커스 복귀 + 쿼리 초기화.
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null
      const t = window.setTimeout(() => inputRef.current?.focus(), 20)
      return () => window.clearTimeout(t)
    }
    setQuery('')
    setActiveIndex(0)
    restoreFocusRef.current?.focus?.()
    return undefined
  }, [open, setQuery])

  const selectHit = useCallback(
    (hit: SearchHitDto) => {
      close()
      if (onSelect) {
        onSelect(hit)
      } else if (hit.url) {
        window.location.assign(hit.url)
      }
    },
    [close, onSelect]
  )

  const move = useCallback(
    (delta: number) => {
      if (hits.length === 0) return
      setActiveIndex((i) => {
        const next = (i + delta + hits.length) % hits.length
        // 활성 행을 보이게 스크롤.
        window.setTimeout(() => {
          dialogRef.current
            ?.querySelector<HTMLElement>(`[aria-selected="true"]`)
            ?.scrollIntoView({ block: 'nearest' })
        }, 0)
        return next
      })
    },
    [hits.length]
  )

  // 다이얼로그 키보드: ↑/↓ 이동 · Enter 선택 · Esc 닫기 · Tab 포커스 트랩.
  const onDialogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        move(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        move(-1)
      } else if (e.key === 'Enter') {
        const hit = hits[activeIndex]
        if (hit) {
          e.preventDefault()
          selectHit(hit)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab') {
        // 포커스 트랩 — 다이얼로그 안에서 순환.
        const root = dialogRef.current
        if (!root) return
        const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => n.offsetParent !== null || n === document.activeElement
        )
        if (nodes.length === 0) return
        const first = nodes[0]!
        const last = nodes[nodes.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [move, hits, activeIndex, selectHit, close]
  )

  const activeDescendant = useMemo(
    () => (hits.length > 0 ? `${reactId}-opt-${activeIndex}` : undefined),
    [hits.length, reactId, activeIndex]
  )

  if (!open) return null

  const rootStyle = themeVars(theme) as CSSProperties
  const busy = phase === 'loading'

  return (
    <div className="sk-root" style={rootStyle}>
      <div
        className="sk-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div
          ref={dialogRef}
          className="sk-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="검색"
          onKeyDown={onDialogKeyDown}
        >
          <div className="sk-inputbar">
            <SearchIcon className="sk-search-icon" />
            <input
              ref={inputRef}
              id={inputId}
              className="sk-input"
              type="text"
              role="combobox"
              aria-expanded={hits.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendant}
              aria-autocomplete="list"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {busy ? <div className="sk-mini-spinner" aria-hidden="true" /> : null}
            <kbd className="sk-kbd" aria-hidden="true">
              Esc
            </kbd>
          </div>

          <ResultsList
            phase={phase}
            query={query}
            groups={groups}
            flatHits={hits}
            activeIndex={activeIndex}
            error={error}
            idPrefix={reactId}
            listboxId={listboxId}
            onSelect={(hit) => selectHit(hit)}
            onHover={setActiveIndex}
            onRetry={retry}
          />

          <div className="sk-footer">
            <span className="sk-foot-key">
              <kbd className="sk-kbd">↑</kbd>
              <kbd className="sk-kbd">↓</kbd>
              이동
            </span>
            <span className="sk-foot-key">
              <kbd className="sk-kbd">
                <EnterIcon />
              </kbd>
              선택
            </span>
            <span className="sk-footer-spacer" />
            <a className="sk-brand" href="https://github.com" target="_blank" rel="noreferrer">
              SearchDesk
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
