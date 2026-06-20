/**
 * @searchdesk/widget — 임베드 검색 위젯.
 *
 * - React 소비자: `import { SearchPalette, SearchBox } from '@searchdesk/widget'`
 * - SDK 클라이언트만 필요: `import { createSearchClient } from '@searchdesk/widget'`(재노출)
 * - 바닐라(비-React) 사이트: `@searchdesk/widget/vanilla` 또는 IIFE 빌드(window.SearchDesk)
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

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export {
  mountPalette,
  mountBox,
  init,
  type MountPaletteOptions,
  type MountBoxOptions,
  type WidgetHandle,
} from './vanilla'

// SDK 검색 클라이언트/색인기를 위젯에서 바로 쓸 수 있게 재노출.
export {
  createSearchClient,
  createIndexer,
  SearchDeskError,
  type SearchClient,
  type Indexer,
} from '@searchdesk/sdk'
export type { SearchResponseDto, SearchHitDto, DocumentInput } from '@searchdesk/shared'
