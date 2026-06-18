import { ArrowRight, CircleCheck, KeyRound, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { TenantWithSecretDto } from '@desk/shared/browser'

import { useSessionStore } from '@/app/sessionStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton, Banner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError, signup } from '@/services/api'

/** 발급된 키 한 줄 — 라벨 + 모노 값 + 복사 버튼. */
function KeyRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-subtle">{label}</span>
        <CopyButton value={value} label={`${label} 복사`} />
      </div>
      <code className="mt-1.5 block overflow-x-auto font-mono text-[0.8125rem] break-all text-text">
        {value}
      </code>
      <p className="mt-1.5 text-xs text-text-subtle">{hint}</p>
    </div>
  )
}

function Result({ result }: { result: TenantWithSecretDto }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <CircleCheck className="size-5 text-success" aria-hidden />
        <h2 className="text-lg font-semibold text-text">테넌트가 생성되었습니다</h2>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        <strong className="text-text">{result.name}</strong> ·{' '}
        <code className="font-mono">{result.slug}</code> ·{' '}
        <Badge tone="neutral" size="sm">
          {result.plan.toUpperCase()}
        </Badge>
      </p>

      <Banner tone="warning" className="mt-5">
        <span className="inline-flex items-center gap-1.5">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          secret 키는 <strong>지금 이 화면에서 한 번만</strong> 표시됩니다. 안전한 곳에 즉시
          저장하세요. 분실 시 키 회전으로 재발급해야 합니다.
        </span>
      </Banner>

      <div className="mt-4 space-y-3">
        <KeyRow
          label="Publishable 키 (pk_…)"
          value={result.publishableKey}
          hint="공개 안전 — 프론트엔드 임베드/위젯에 사용. CORS allowlist 와 함께 검증됩니다."
        />
        <KeyRow
          label="Secret 키 (sk_…)"
          value={result.secretKey}
          hint="서버 전용 시크릿 — 절대 프론트에 노출하지 마세요. 콘솔 로그인·빌링 API 에 사용합니다."
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface-2 p-4">
        <h3 className="text-sm font-semibold text-text">다음 단계</h3>
        <ol className="mt-2 space-y-1.5 text-[0.8125rem] text-text-muted">
          <li>1. secret 키로 콘솔에 로그인해 사용량·구독·키를 관리하세요.</li>
          <li>2. 카탈로그에서 Desk 를 골라 publishable 키로 한 줄 임베드하세요.</li>
          <li>3. 트래픽이 늘면 콘솔에서 Pro·Scale 로 업그레이드하세요.</li>
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/dashboard">
            콘솔로 이동 <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/catalog">서비스 카탈로그</Link>
        </Button>
      </div>
    </div>
  )
}

export default function SignupPage() {
  useDocumentTitle('가입')
  const setToken = useSessionStore((s) => s.setToken)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TenantWithSecretDto | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await signup({
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      })
      // 발급된 secret 키로 즉시 세션을 연다(콘솔 바로 진입 가능).
      setToken(res.secretKey)
      setResult(res)
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : '가입에 실패했습니다. 잠시 후 다시 시도하세요.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
        <Result result={result} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-20">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-fg">
          <KeyRound className="size-4.5" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-text">DeskCloud 시작하기</h1>
      </div>
      <p className="mt-2 text-sm text-text-muted">
        테넌트를 만들면 publishable/secret 키 한 쌍을 받습니다. 가입은 무료(Free 플랜)이며
        신용카드가 필요 없습니다.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field
          label="조직/앱 이름"
          htmlFor="signup-name"
          required
          hint="콘솔과 청구서에 표시됩니다."
        >
          <Input
            id="signup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: Acme Inc."
            required
            maxLength={120}
            autoComplete="organization"
          />
        </Field>
        <Field
          label="slug (선택)"
          htmlFor="signup-slug"
          hint="소문자·숫자·하이픈. 비우면 이름에서 자동 생성됩니다."
        >
          <Input
            id="signup-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="예: acme"
            maxLength={64}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
        </Field>

        {error ? <Banner tone="error">{error}</Banner> : null}

        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!name.trim()}>
          무료로 시작하기
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-text-muted">
        이미 키가 있나요?{' '}
        <Link to="/login" className="font-medium text-accent-strong hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
