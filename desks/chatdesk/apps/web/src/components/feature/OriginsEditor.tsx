import { originSchema } from '@chatdesk/shared'
import { Globe, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'

/**
 * CORS Origin allowlist 편집기 — WS 핸드셰이크·pk 엔드포인트에서 허용할 Origin 목록.
 * `*` 는 모든 Origin 허용(데모). 항목은 zod originSchema 로 가볍게 검증한다.
 */
export function OriginsEditor({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const wildcard = value.includes('*')

  const add = () => {
    const raw = draft.trim()
    if (!raw) return
    const parsed = originSchema.safeParse(raw)
    if (!parsed.success) {
      setError('http(s)://host[:port] 형태이거나 * 여야 합니다')
      return
    }
    if (value.includes(parsed.data)) {
      setError('이미 추가된 Origin 입니다')
      return
    }
    onChange([...value, parsed.data])
    setDraft('')
    setError(null)
  }

  const remove = (origin: string) => onChange(value.filter((o) => o !== origin))

  const toggleWildcard = () => {
    if (wildcard) onChange(value.filter((o) => o !== '*'))
    else onChange(['*', ...value.filter((o) => o !== '*')])
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={wildcard ? 'accent' : 'secondary'}
          onClick={toggleWildcard}
        >
          <Globe className="size-3.5" />
          모든 Origin 허용 (*)
        </Button>
        {wildcard ? (
          <Badge tone="warning" size="sm">
            데모/개발용 — 운영에서는 도메인을 명시하세요
          </Badge>
        ) : null}
      </div>

      {value.filter((o) => o !== '*').length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {value
            .filter((o) => o !== '*')
            .map((o) => (
              <li key={o}>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pr-1 pl-3 font-mono text-xs text-text">
                  {o}
                  <button
                    type="button"
                    onClick={() => remove(o)}
                    aria-label={`${o} 제거`}
                    className="grid size-5 place-items-center rounded-full text-text-subtle transition-colors hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-accent-strong"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-text-subtle">
          {wildcard
            ? '와일드카드(*)만 설정되어 있습니다. 특정 도메인을 추가하면 그 도메인만 허용됩니다.'
            : '허용 Origin 이 없습니다. 위젯이 붙을 도메인을 추가하세요.'}
        </p>
      )}

      <div className="mt-3 flex items-start gap-2">
        <div className="flex-1">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="https://app.example.com"
            aria-label="허용할 Origin 추가"
            aria-invalid={error ? true : undefined}
            className="font-mono"
          />
          {error ? (
            <p role="alert" className="mt-1.5 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}>
          <Plus className="size-4" />
          추가
        </Button>
      </div>
    </div>
  )
}
