import { Layers } from 'lucide-react'
import { useState } from 'react'

import { useAppIdStore } from '@/app/appIdStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { cn } from '@/utils/cn'

/**
 * 테넌트(appId) 선택기 — 최근 본 appId 칩 + 자유 입력. 대시보드·에디터 상단에서 공유한다.
 * SurveyDesk 는 appId 가 임의 문자열이라 목록 API 가 없고, 최근값을 클라이언트가 기억한다.
 */
export function AppIdSelector({ className }: { className?: string }) {
  const appId = useAppIdStore((s) => s.appId)
  const recent = useAppIdStore((s) => s.recent)
  const select = useAppIdStore((s) => s.select)
  const [draft, setDraft] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = draft.trim().toLowerCase()
    if (v) {
      select(v)
      setDraft('')
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-subtle">
          <Layers className="size-3.5" aria-hidden />앱
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="앱 선택">
          {recent.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => select(id)}
              aria-pressed={id === appId}
              className={cn(
                'rounded-full border px-3 py-1 font-mono text-xs transition-colors',
                id === appId
                  ? 'border-transparent bg-accent-soft font-semibold text-accent-fg'
                  : 'border-border text-text-muted hover:border-border-strong hover:text-text'
              )}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={submit} className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="다른 appId 입력 (예: resume)"
          aria-label="appId 입력"
          className="h-8 max-w-56 text-xs"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!draft.trim()}>
          전환
        </Button>
      </form>
    </div>
  )
}
