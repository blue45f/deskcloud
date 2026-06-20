/**
 * <SearchBox> — 인라인 검색 박스(콤보박스 + 드롭다운 패널).
 *
 * 페이지 안에 자리 잡는 입력 + 포커스 시 결과 패널. 디바운스 검색·키보드 내비
 * (↑/↓/Enter)·하이라이트·그룹은 팔레트와 동일한 useSearch/ResultsList 를 공유한다.
 *
 * a11y: role="combobox"+aria-expanded/controls/activedescendant, listbox/option,
 * Esc 로 패널 닫기, blur 시 닫기(mousedown 선택은 보존), :focus-visible.
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

import { SearchIcon } from './icons'
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

export interface SearchBoxProps {
  publishableKey: string
  endpoint: string
  indexName?: string
  placeholder?: string
  limit?: number
  debounceMs?: number
  accent?: string
  accentInk?: string
  /** 결과 선택 콜백. 미지정 시 hit.url 로 이동. */
  onSelect?: (hit: SearchHitDto) => void
  /** 외부 클라이언트 주입(테스트/공유). */
  client?: SearchClient
}

export function SearchBox(props: SearchBoxProps): ReactElement {
  const {
    publishableKey,
    endpoint,
    indexName,
    placeholder = '검색…',
    limit,
    debounceMs,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    onSelect,
    client,
  } = props

  const [openPanel, setOpenPanel] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const reactId = useId()
  const inputId = `${reactId}-input`
  const listboxId = `${reactId}-listbox`

  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const search = useSearch({ publishableKey, endpoint, indexName, limit, debounceMs, client })
  const { query, setQuery, phase, hits, groups, error, retry } = search

  const theme: WidgetTheme = { accent, accentInk }

  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  useEffect(() => {
    setActiveIndex((i) => (i >= hits.length ? 0 : i))
  }, [hits.length])

  const selectHit = useCallback(
    (hit: SearchHitDto) => {
      setOpenPanel(false)
      if (onSelect) onSelect(hit)
      else if (hit.url) window.location.assign(hit.url)
    },
    [onSelect]
  )

  const move = useCallback(
    (delta: number) => {
      if (hits.length === 0) return
      setActiveIndex((i) => {
        const next = (i + delta + hits.length) % hits.length
        window.setTimeout(() => {
          panelRef.current
            ?.querySelector<HTMLElement>('[aria-selected="true"]')
            ?.scrollIntoView({ block: 'nearest' })
        }, 0)
        return next
      })
    },
    [hits.length]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (!openPanel) setOpenPanel(true)
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
        if (openPanel) {
          e.preventDefault()
          setOpenPanel(false)
        }
      }
    },
    [openPanel, move, hits, activeIndex, selectHit]
  )

  const showPanel = openPanel && (query.trim().length > 0 || phase === 'error')
  const activeDescendant = useMemo(
    () => (showPanel && hits.length > 0 ? `${reactId}-opt-${activeIndex}` : undefined),
    [showPanel, hits.length, reactId, activeIndex]
  )

  const rootStyle = themeVars(theme) as CSSProperties
  const busy = phase === 'loading'

  return (
    <div className="sk-root" style={rootStyle}>
      <div
        ref={rootRef}
        className="sk-box"
        onBlur={(e) => {
          // 패널 내부로 포커스가 이동하는 게 아니면 닫는다.
          if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpenPanel(false)
        }}
      >
        <div className="sk-box-inputbar">
          <SearchIcon className="sk-search-icon" />
          <input
            id={inputId}
            className="sk-input"
            type="text"
            role="combobox"
            aria-expanded={showPanel && hits.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpenPanel(true)
            }}
            onFocus={() => {
              if (query.trim().length > 0) setOpenPanel(true)
            }}
            onKeyDown={onKeyDown}
          />
          {busy ? <div className="sk-mini-spinner" aria-hidden="true" /> : null}
        </div>

        {showPanel ? (
          <div ref={panelRef} className="sk-box-panel">
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
          </div>
        ) : null}
      </div>
    </div>
  )
}
