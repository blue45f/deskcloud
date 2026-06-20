import { useCallback, useSyncExternalStore } from 'react'

import { listBookmarks, subscribeBookmarks, type Bookmark } from './bookmarkStore'

const EMPTY: Bookmark[] = []

// 동일 참조를 반환해 useSyncExternalStore 무한 루프를 막는다(변경 시에만 새 배열).
let cachedRaw: string | null = null
let cachedValue: Bookmark[] = EMPTY

function getSnapshot(): Bookmark[] {
  const next = listBookmarks()
  const serialized = next.map((bookmark) => `${bookmark.id}@${bookmark.savedAt}`).join('|')
  if (serialized !== cachedRaw) {
    cachedRaw = serialized
    cachedValue = next
  }
  return cachedValue
}

function getServerSnapshot(): Bookmark[] {
  return EMPTY
}

/** 현재 북마크 목록을 구독한다. 다른 탭 변경도 반영된다. */
export function useBookmarks(): Bookmark[] {
  const subscribe = useCallback((onChange: () => void) => subscribeBookmarks(onChange), [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
