import { useModerationCheck } from '@moderationdesk/widget'
import { Loader2, ShieldCheck, Sparkles, WifiOff } from 'lucide-react'
import { useState } from 'react'

import { VerdictBadge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

/* ──────────────────────────────────────────────────────────────────────────
   히어로 인터랙티브 플레이그라운드 — 데모 테넌트(pk_demo)로 실시간 사전검사.
   타이핑하거나 예시 칩을 누르면 verdict(allow/flag/block)·매칭 규칙·AI 점수가 즉시 갱신된다.
   API 가 닿지 않으면(빌드/오프라인) 조용히 안내만 띄우고 verdict 는 보수적으로 allow 유지.
   publishable 키만 쓰므로 브라우저 안전 — 실제 차단 게이트는 서버(secret).
   ────────────────────────────────────────────────────────────────────────── */

const SAMPLES = [
  { label: '깨끗한 댓글', text: '정말 잘 만든 서비스네요. 잘 쓰겠습니다!' },
  { label: '스팸', text: 'this is spam, visit example.spam for cheap deals' },
  { label: '욕설/혐오', text: '너 진짜 멍청하다 꺼져' },
] as const

const DEFAULT_SAMPLE = SAMPLES[1].text

const VERDICT_COPY: Record<'allow' | 'flag' | 'block', string> = {
  allow: '게시할 수 있어요',
  flag: '주의가 필요한 표현이에요',
  block: '게시를 막아야 하는 내용이에요',
}

export function LandingPlayground({ endpoint }: { endpoint: string }) {
  const [text, setText] = useState<string>(DEFAULT_SAMPLE)

  const { verdict, loading, result, error } = useModerationCheck(text, {
    publishableKey: 'pk_demo',
    endpoint,
    debounceMs: 350,
  })

  const matched = result?.matchedRules ?? []
  const aiScore = result?.aiScore ?? null
  const hasText = text.trim().length > 0

  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-lg backdrop-blur sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-text-muted">
          <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-accent-strong">
            <ShieldCheck className="size-3.5" aria-hidden />
          </span>
          <span className="text-[0.8125rem] font-semibold text-text">실시간 검사</span>
          <span className="hidden text-xs text-text-subtle sm:inline">· 데모 테넌트(pk_demo)</span>
        </div>
        <span aria-live="polite" className="flex items-center">
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-subtle">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> 검사 중
            </span>
          ) : hasText && !error ? (
            <VerdictBadge verdict={verdict} size="sm" />
          ) : null}
        </span>
      </div>

      <label htmlFor="hero-playground" className="sr-only">
        검사할 텍스트
      </label>
      <textarea
        id="hero-playground"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder="여기에 댓글을 입력해 보세요…"
        className={cn(
          'w-full resize-none rounded-lg border bg-bg px-3.5 py-2.5 font-mono text-[0.8125rem] leading-relaxed text-text outline-none transition-colors',
          'placeholder:text-text-subtle focus-visible:ring-2 focus-visible:ring-accent-strong',
          verdict === 'block' && !loading
            ? 'border-danger/60'
            : verdict === 'flag' && !loading
              ? 'border-warning/60'
              : 'border-border focus-visible:border-border-strong'
        )}
      />

      {/* 예시 칩 — 누르면 즉시 검사 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="self-center text-xs text-text-subtle">예시:</span>
        {SAMPLES.map((s) => {
          const active = s.text === text
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setText(s.text)}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-accent-strong/40 bg-accent-soft text-accent-strong'
                  : 'border-border text-text-muted hover:border-border-strong hover:bg-surface-2 hover:text-text'
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* 결과 요약 — 판정 문구 · 매칭 규칙 · AI 점수 / 또는 오프라인 안내 */}
      <div className="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2/70 px-3.5 py-2.5 text-[0.8125rem]">
        {error ? (
          <p className="flex items-center gap-1.5 text-text-subtle">
            <WifiOff className="size-3.5 shrink-0" aria-hidden />
            데모 API 에 연결할 수 없어요. 가입 후 본인 키로 검사해 보세요.
          </p>
        ) : !hasText ? (
          <p className="text-text-subtle">텍스트를 입력하면 verdict 가 여기에 표시됩니다.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="font-medium text-text">{VERDICT_COPY[verdict]}</span>
            {matched.length > 0 ? (
              <span className="text-text-muted">
                매칭 규칙{' '}
                <span className="font-mono text-text">
                  {matched.map((m) => m.pattern).join(', ')}
                </span>
              </span>
            ) : null}
            {aiScore != null ? (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <Sparkles className="size-3.5 text-accent-strong" aria-hidden />
                AI 독성 {Math.round(aiScore * 100)}%
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
