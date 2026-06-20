/**
 * @searchdesk/widget/react — React 컴포넌트 진입점.
 *
 * - <SearchPalette> — ⌘K 커맨드 팔레트 오버레이.
 * - <SearchBox>     — 인라인 검색 박스(콤보박스 + 드롭다운).
 *
 * 둘 다 publishable 키로 디바운스 검색·카테고리 그룹·키보드 내비·하이라이트를 제공한다.
 * 의존성은 react(peer)뿐(외부 CSS 프레임워크 0).
 */
export { SearchPalette, type SearchPaletteProps } from './SearchPalette'
export { SearchBox, type SearchBoxProps } from './SearchBox'
export {
  useSearch,
  groupHits,
  type UseSearchConfig,
  type UseSearchState,
  type ResultGroup,
  type SearchPhase,
} from './use-search'
