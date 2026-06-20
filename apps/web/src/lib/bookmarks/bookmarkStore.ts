import type { AppRoute } from '@/components/app/appRoutes'

const STORAGE_KEY = 'aidigestdesk.bookmarks.v1'
const EVENT_NAME = 'aidigestdesk:bookmarks-changed'

/** 북마크 가능한 콘텐츠 종류. 새 종류를 붙일 때 라벨/배지 매핑만 늘리면 된다. */
export type BookmarkKind = 'model' | 'benchmark' | 'deal' | 'resource'

export type Bookmark = {
  /** 종류+원본 id를 합친 전역 고유 키. */
  id: string
  kind: BookmarkKind
  /** 표시용 제목. */
  title: string
  /** 부가 설명(제공사/분야 등). */
  subtitle?: string
  /** 이동할 라우트(클릭 시 해당 페이지로). */
  route: AppRoute
  /** 라우트 내 anchor(#id). 있으면 라우트 뒤에 붙는다. */
  anchor?: string
  /** 외부 링크. route 대신 새 탭으로 연다. */
  href?: string
  /** 저장 시각(ISO). 최신순 정렬에 사용. */
  savedAt: string
}

function makeId(kind: BookmarkKind, sourceId: string): string {
  return `${kind}:${sourceId}`
}

function readAll(): Bookmark[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is Bookmark =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Bookmark).id === 'string' &&
        typeof (item as Bookmark).title === 'string'
    )
  } catch {
    return []
  }
}

function writeAll(bookmarks: Bookmark[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    // 저장 실패는 비치명적.
  }
}

export function listBookmarks(): Bookmark[] {
  // 저장 시각 내림차순. 같은 ms에 추가돼 savedAt이 동률이면 나중에 추가된 항목(배열 뒤)을 먼저 보여준다.
  const all = readAll()
  return all
    .map((bookmark, index) => ({ bookmark, index }))
    .toSorted((a, b) => b.bookmark.savedAt.localeCompare(a.bookmark.savedAt) || b.index - a.index)
    .map((entry) => entry.bookmark)
}

export function isBookmarked(kind: BookmarkKind, sourceId: string): boolean {
  const id = makeId(kind, sourceId)
  return readAll().some((bookmark) => bookmark.id === id)
}

/** 북마크를 토글한다. 추가되면 true, 제거되면 false를 반환한다. */
export function toggleBookmark(
  input: Omit<Bookmark, 'id' | 'savedAt'> & { sourceId: string }
): boolean {
  const { sourceId, ...rest } = input
  const id = makeId(input.kind, sourceId)
  const current = readAll()
  const existing = current.find((bookmark) => bookmark.id === id)

  if (existing) {
    writeAll(current.filter((bookmark) => bookmark.id !== id))
    return false
  }

  const next: Bookmark = { ...rest, id, savedAt: new Date().toISOString() }
  writeAll([...current, next])
  return true
}

export function removeBookmark(id: string): void {
  writeAll(readAll().filter((bookmark) => bookmark.id !== id))
}

export function clearBookmarks(): void {
  writeAll([])
}

/** 북마크 변경(이 탭의 토글 또는 다른 탭의 storage 이벤트)을 구독한다. */
export function subscribeBookmarks(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener(EVENT_NAME, listener)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(EVENT_NAME, listener)
    window.removeEventListener('storage', handleStorage)
  }
}
