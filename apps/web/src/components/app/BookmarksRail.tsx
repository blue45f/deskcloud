import { Bookmark as BookmarkIcon, ExternalLink, Trash2, X } from 'lucide-react'

import type { AppRoute } from '@/components/app/appRoutes'
import type { BookmarkKind } from '@/lib/bookmarks'

import { Chip, SectionHeader } from '@/components/app/CommonUi'
import { clearBookmarks, removeBookmark, useBookmarks } from '@/lib/bookmarks'

const kindLabel: Record<BookmarkKind, string> = {
  model: '모델',
  benchmark: '벤치마크',
  deal: '할인·혜택',
  resource: '강좌·자료',
}

/**
 * 홈 대시보드의 "내 북마크" 레일. 저장한 항목이 없으면 렌더하지 않아 빈 섹션을 만들지 않는다.
 * 클릭하면 원래 라우트(+anchor)로 이동하거나 외부 링크를 새 탭으로 연다.
 */
export function BookmarksRail({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const bookmarks = useBookmarks()
  if (!bookmarks.length) return null

  return (
    <section id="bookmarks" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader
          icon={BookmarkIcon}
          title="내 북마크"
          description="저장한 모델·벤치마크·할인·자료를 한곳에서 다시 엽니다. 브라우저에 로컬 저장됩니다."
          badge={<Chip tone="accent">{bookmarks.length}건</Chip>}
        />
        <button
          type="button"
          onClick={clearBookmarks}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
        >
          <Trash2 className="size-3.5" aria-hidden />
          전체 비우기
        </button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {bookmarks.map((bookmark) => {
          const openItem = () => {
            if (bookmark.href) {
              window.open(bookmark.href, '_blank', 'noopener,noreferrer')
              return
            }
            onNavigate(bookmark.route)
            if (bookmark.anchor) {
              window.requestAnimationFrame(() => {
                document.getElementById(bookmark.anchor as string)?.scrollIntoView({
                  block: 'start',
                })
              })
            }
          }

          return (
            <li key={bookmark.id} className="relative">
              <button
                type="button"
                onClick={openItem}
                className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3.5 pr-10 text-left transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_12px_28px_-18px_color-mix(in_oklch,var(--color-ink),transparent_55%)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <Chip tone="neutral">{kindLabel[bookmark.kind]}</Chip>
                    {bookmark.href ? (
                      <ExternalLink className="size-3 text-text-subtle" aria-hidden />
                    ) : null}
                  </span>
                  <span className="mt-2 block truncate text-sm font-semibold text-text">
                    {bookmark.title}
                  </span>
                  {bookmark.subtitle ? (
                    <span className="mt-0.5 block truncate text-xs text-text-muted">
                      {bookmark.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeBookmark(bookmark.id)}
                aria-label={`${bookmark.title} 북마크 제거`}
                className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-md text-text-subtle transition hover:bg-surface-2 hover:text-text"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
