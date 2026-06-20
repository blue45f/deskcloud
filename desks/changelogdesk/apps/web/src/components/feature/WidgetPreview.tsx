import { Bell, Sparkles } from 'lucide-react'

import type { EntryTag } from '@changelogdesk/shared'

import { TagBadge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

type PreviewEntry = {
  tag: EntryTag
  title: string
  body: string
  when: string
}

const ENTRIES: PreviewEntry[] = [
  {
    tag: 'new',
    title: '인앱 What’s new 위젯',
    body: '벨 버튼 + 미읽음 배지로 새 소식을 바로 알립니다.',
    when: '방금 전',
  },
  {
    tag: 'improved',
    title: '마크다운 본문 렌더링 개선',
    body: '코드 블록·목록·링크를 더 안전하게 표시합니다.',
    when: '2일 전',
  },
  {
    tag: 'fixed',
    title: '다크 모드 대비 보정',
    body: '저조도에서 배지 가독성을 높였습니다.',
    when: '5일 전',
  },
]

/**
 * 히어로용 "What's new" 위젯 프리뷰 — 실제 위젯의 느낌(벨·미읽음 배지·패널·항목 카드)을
 * 정적으로 재현한 장식 카드. 데이터 호출 없이 브랜드 톤만 전달한다.
 * 전부 aria-hidden=false 의 읽을 수 있는 텍스트지만 순수 데모이므로 인터랙션은 없다.
 */
export function WidgetPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* 부유 패널 */}
      <div className="cd-float relative w-full max-w-sm rounded-2xl border border-border-strong/70 bg-surface shadow-lg ring-1 ring-black/[0.02]">
        {/* 패널 헤더 */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent-fg">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-text">새 소식</span>
          </div>
          {/* 벨 + 미읽음 핑 */}
          <span className="relative grid size-8 place-items-center rounded-full bg-surface-2 text-text-muted">
            <span className="cd-ping absolute inset-0 rounded-full bg-accent/40" aria-hidden />
            <Bell className="cd-bell size-4 text-accent-strong" aria-hidden />
            <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-accent-fg">
              3
            </span>
          </span>
        </div>

        {/* 항목 목록 */}
        <ul className="divide-y divide-border">
          {ENTRIES.map((e) => (
            <li key={e.title} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <TagBadge tag={e.tag} />
                <span className="text-[0.6875rem] text-text-subtle">{e.when}</span>
              </div>
              <p className="mt-1.5 text-[0.8125rem] font-semibold text-text">{e.title}</p>
              <p className="mt-0.5 text-xs text-pretty text-text-muted">{e.body}</p>
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-4 py-2.5 text-center text-[0.6875rem] font-medium text-text-subtle">
          ChangelogDesk 위젯
        </div>
      </div>
    </div>
  )
}
