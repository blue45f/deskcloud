/**
 * ResultsList — listbox 결과 렌더러(팔레트·박스 공용).
 *
 * - role="listbox" + role="option" / aria-selected(활성 행) / aria-activedescendant(부모가 input 에 연결)
 * - 카테고리 그룹 헤더, 제목·스니펫 하이라이트(<mark>, 서버가 이스케이프해 안전)
 * - 빈/로딩/에러/입력안내 상태
 *
 * 키보드 내비/선택 상태(activeIndex)는 부모가 관리하고, 클릭/호버 콜백만 위임받는다.
 */
import type { ResultGroup, SearchPhase } from './use-search'
import type { SearchHitDto } from '@searchdesk/shared'
import type { ReactElement } from 'react'

export interface ResultsListProps {
  phase: SearchPhase
  query: string
  groups: ResultGroup[]
  flatHits: SearchHitDto[]
  activeIndex: number
  error: string | null
  /** option DOM id 프리픽스(aria-activedescendant 연결용). */
  idPrefix: string
  /** listbox 엘리먼트 id. */
  listboxId: string
  onSelect: (hit: SearchHitDto, index: number) => void
  onHover: (index: number) => void
  onRetry: () => void
}

/** 서버가 이스케이프 후 <mark> 만 넣은 HTML 을 그대로 렌더(XSS 안전). */
function Highlighted({ html, className }: { html: string; className: string }): ReactElement {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export function ResultsList(props: ResultsListProps): ReactElement {
  const {
    phase,
    query,
    groups,
    flatHits,
    activeIndex,
    error,
    idPrefix,
    listboxId,
    onSelect,
    onHover,
    onRetry,
  } = props

  // 입력 전(idle): 안내.
  if (phase === 'idle' && query.trim().length === 0) {
    return (
      <div className="sk-state">
        <p className="sk-state-title">무엇을 찾고 계신가요?</p>
        <p className="sk-state-text">검색어를 입력하면 결과가 바로 표시됩니다.</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="sk-state" role="alert">
        <p className="sk-state-title">검색에 실패했어요</p>
        <p className="sk-state-text">{error ?? '네트워크 상태를 확인해 주세요.'}</p>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="sk-kbd" onClick={onRetry} style={{ cursor: 'pointer' }}>
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  // 로딩 중 + 이전 결과 없음 → 스피너. (결과가 이미 있으면 입력바의 미니 스피너만 돈다.)
  if (phase === 'loading' && flatHits.length === 0) {
    return (
      <div className="sk-state" aria-busy="true">
        <div className="sk-spinner" />
        <p className="sk-state-text">검색 중…</p>
      </div>
    )
  }

  if (flatHits.length === 0) {
    return (
      <div className="sk-state">
        <p className="sk-state-title">결과가 없습니다</p>
        <p className="sk-state-text">
          <strong>{query.trim()}</strong> 에 대한 검색 결과를 찾지 못했어요.
        </p>
      </div>
    )
  }

  // 평탄화 인덱스 — 그룹을 가로지르며 0..n. activeIndex 와 매칭.
  let flatIndex = -1

  return (
    <ul className="sk-results" role="listbox" id={listboxId} aria-label="검색 결과">
      {groups.map((group) => (
        <li key={group.category} role="presentation">
          <div className="sk-group-label" role="presentation">
            {group.category}
          </div>
          <ul role="presentation" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {group.hits.map((hit) => {
              flatIndex += 1
              const index = flatIndex
              const selected = index === activeIndex
              return (
                <li
                  key={`${hit.index}:${hit.id}`}
                  id={`${idPrefix}-opt-${index}`}
                  role="option"
                  aria-selected={selected}
                  className="sk-option"
                  onMouseEnter={() => onHover(index)}
                  onMouseDown={(e) => {
                    // mousedown 으로 처리해 input blur 전에 선택(박스 변형에서 패널이 닫히기 전).
                    e.preventDefault()
                    onSelect(hit, index)
                  }}
                >
                  <div className="sk-option-main">
                    <Highlighted className="sk-option-title" html={hit.titleHighlight} />
                    {hit.snippet ? (
                      <Highlighted className="sk-option-snippet" html={hit.snippet} />
                    ) : null}
                  </div>
                  {hit.tags.length > 0 ? (
                    <div className="sk-option-tags" aria-hidden="true">
                      {hit.tags.slice(0, 2).map((t) => (
                        <span key={t} className="sk-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}
