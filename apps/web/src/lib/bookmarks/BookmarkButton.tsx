import { Bookmark as BookmarkIcon, BookmarkCheck } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import { isBookmarked, subscribeBookmarks, toggleBookmark, type Bookmark } from './bookmarkStore'

import { useToast } from '@/lib/toast'

type BookmarkButtonProps = Omit<Bookmark, 'id' | 'savedAt'> & {
  /** 원본 콘텐츠 id(kind와 합쳐 전역 키가 된다). */
  sourceId: string
  /** 'icon'=아이콘만(카드 코너용), 'pill'=라벨 포함. 기본 icon. */
  variant?: 'icon' | 'pill'
}

/**
 * 콘텐츠를 북마크(즐겨찾기)에 추가/제거하는 토글 버튼. localStorage 기반이라 백엔드가 없어도 동작한다.
 * 상태는 외부 스토어를 구독하므로 같은 항목의 모든 인스턴스가 동기화된다. 토글 시 토스트로 안내한다.
 */
export function BookmarkButton({
  sourceId,
  kind,
  title,
  subtitle,
  route,
  anchor,
  href,
  variant = 'icon',
}: BookmarkButtonProps) {
  const toast = useToast()
  const active = useSyncExternalStore(
    subscribeBookmarks,
    () => isBookmarked(kind, sourceId),
    () => false
  )

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const added = toggleBookmark({ sourceId, kind, title, subtitle, route, anchor, href })
    toast.show({
      message: added ? `북마크에 저장했습니다 · ${title}` : `북마크에서 제거했습니다 · ${title}`,
      tone: added ? 'success' : 'neutral',
    })
  }

  const label = active ? `${title} 북마크 해제` : `${title} 북마크`

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        title={label}
        className={
          active
            ? 'inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent transition'
            : 'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text'
        }
      >
        {active ? (
          <BookmarkCheck className="size-3.5" aria-hidden />
        ) : (
          <BookmarkIcon className="size-3.5" aria-hidden />
        )}
        {active ? '저장됨' : '북마크'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={
        active
          ? 'grid size-8 shrink-0 place-items-center rounded-md border border-accent/40 bg-accent/10 text-accent transition'
          : 'grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface text-text-subtle transition hover:border-border-strong hover:text-text'
      }
    >
      {active ? (
        <BookmarkCheck className="size-4" aria-hidden />
      ) : (
        <BookmarkIcon className="size-4" aria-hidden />
      )}
    </button>
  )
}
