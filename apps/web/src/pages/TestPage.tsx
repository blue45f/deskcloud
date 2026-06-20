import { MODERATE_TEXT_MAX, type ModerateResultDto } from '@moderationdesk/shared'
import { Play, ScanText, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { VerdictBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Field, Label, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { useCredKey } from '@/hooks/useCredKey'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useModerateCheck } from '@/services/moderation'

const SAMPLES = [
  'hello, great article!',
  'this is spam, visit example.spam',
  'buy now and save big',
  'you are an idiot honestly',
]

export default function TestPage() {
  useDocumentTitle('검사 테스트')
  const credKey = useCredKey()
  const check = useModerateCheck()

  const [text, setText] = useState('')
  const [useAi, setUseAi] = useState(false)
  const [result, setResult] = useState<ModerateResultDto | null>(null)
  // credKey 가 바뀌면(테넌트 전환) 직전 결과를 비워 혼동 방지.
  const [shownFor, setShownFor] = useState(credKey)
  if (shownFor !== credKey) {
    setShownFor(credKey)
    setResult(null)
  }

  const run = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      toast.error('검사할 텍스트를 입력해 주세요.')
      return
    }
    check.mutate(
      { text: trimmed, useAi, meta: { source: 'admin-test' } },
      {
        onSuccess: (data) => setResult(data),
        onError: (e) => {
          setResult(null)
          toast.error(e instanceof ApiError ? e.message : '검사에 실패했습니다.')
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">검사 테스트</h1>
        <p className="mt-1 max-w-2xl text-sm text-pretty text-text-muted">
          텍스트를 실제{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
            POST /api/moderate
          </code>{' '}
          로 검사해 verdict 와 매칭 규칙을 확인합니다. 이 검사도 사용량·로그에 기록됩니다.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>입력</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="검사할 텍스트" htmlFor="test-text">
              <Textarea
                id="test-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="검사할 콘텐츠를 입력하세요…"
                maxLength={MODERATE_TEXT_MAX}
                className="min-h-32"
              />
            </Field>

            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setText(s)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
              <div>
                <Label htmlFor="test-ai" className="mb-0">
                  AI 보조 사용
                </Label>
                <p className="mt-0.5 text-xs text-text-subtle">
                  서버에 ANTHROPIC_API_KEY 가 있을 때만 점수가 산출됩니다.
                </p>
              </div>
              <Switch id="test-ai" checked={useAi} onCheckedChange={setUseAi} />
            </div>

            <Button onClick={run} loading={check.isPending} className="w-full">
              <Play className="size-4" />
              검사 실행
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>결과</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <VerdictBadge verdict={result.verdict} />
                  <span className="text-sm text-text-muted">
                    {result.verdict === 'block'
                      ? '게시를 차단해야 합니다.'
                      : result.verdict === 'flag'
                        ? '검토가 필요한 콘텐츠입니다.'
                        : '문제가 발견되지 않았습니다.'}
                  </span>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-medium text-text">
                    <ScanText className="size-4 text-text-subtle" aria-hidden />
                    매칭된 규칙 ({result.matchedRules.length})
                  </p>
                  {result.matchedRules.length === 0 ? (
                    <p className="text-sm text-text-subtle">매칭된 금칙 규칙이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {result.matchedRules.map((m, i) => (
                        <li
                          key={`${m.id}-${i}`}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2"
                        >
                          <code className="min-w-0 truncate font-mono text-[0.8125rem] text-text">
                            {m.pattern}
                          </code>
                          <span className="shrink-0 font-mono text-xs text-text-subtle">
                            {m.kind} · {m.action}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-sm">
                  <Sparkles className="size-4 text-text-subtle" aria-hidden />
                  <span className="text-text-muted">AI 점수:</span>
                  {result.aiScore == null ? (
                    <span className="text-text-subtle">없음 (키 미설정 또는 useAi=false)</span>
                  ) : (
                    <span className="font-mono tabular-nums text-text">
                      {result.aiScore.toFixed(3)}
                    </span>
                  )}
                </div>

                <p className="border-t border-border pt-3 font-mono text-xs text-text-subtle">
                  logId: {result.logId}
                </p>
              </div>
            ) : (
              <EmptyState
                icon={ScanText}
                title="아직 결과가 없습니다"
                description="텍스트를 입력하고 검사를 실행하면 verdict 와 매칭 규칙이 여기에 표시됩니다."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
