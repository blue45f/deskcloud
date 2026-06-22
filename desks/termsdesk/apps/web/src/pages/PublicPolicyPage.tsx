import { POLICY_TYPE_LABELS, type PublicRenderDto, type PublicVerifyDto } from '@termsdesk/shared'
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Link2,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { OrgIcon } from '@/components/common/OrgIcon'
import { SealMark } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/feedback'
import { apiUrl, publicSiteUrl } from '@/config/urls'
import { usePageMeta } from '@/hooks/usePageMeta'
import { downloadIcs } from '@/utils/buildIcs'
import { cn } from '@/utils/cn'

const HEADING_RE = /^(제\s*\d+\s*조|#{1,6}\s+)/
const HOUR_MS = 60 * 60 * 1000

/** 본문을 줄 단위로 — `제N조`/`#` 로 시작하면 소제목, 빈 줄은 간격, 나머지는 문단. */
function PolicyBody({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  return (
    <div className="space-y-1">
      {lines.map((raw, i) => {
        const line = raw.trimEnd()
        if (line.trim() === '') return <div key={i} className="h-3" aria-hidden="true" />
        if (HEADING_RE.test(line.trim())) {
          const text = line.trim().replace(/^#{1,6}\s+/, '')
          return (
            <h2
              key={i}
              className="pt-5 text-[1.02rem] font-bold tracking-tight text-text first:pt-0"
            >
              {text}
            </h2>
          )
        }
        return (
          <p key={i} className="break-keep leading-[1.85] text-text [overflow-wrap:anywhere]">
            {line}
          </p>
        )
      })}
    </div>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** ?theme=light|dark 가 오면 그 동안만 전역 다크 클래스를 강제(언마운트 시 복원). */
function useThemeOverride(theme: string | null) {
  useEffect(() => {
    if (theme !== 'light' && theme !== 'dark') return
    const root = document.documentElement
    const had = root.classList.contains('dark')
    root.classList.toggle('dark', theme === 'dark')
    return () => {
      root.classList.toggle('dark', had)
    }
  }, [theme])
}

export default function PublicPolicyPage() {
  const { orgSlug = '_', slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  useThemeOverride(searchParams.get('theme'))

  const [data, setData] = useState<PublicRenderDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; message: string } | null>(
    null
  )

  const qs = searchParams.toString()
  usePageMeta({
    title: data ? `${data.name} · ${data.orgName}` : '약관',
    description: data
      ? `${data.orgName}의 ${data.name} (${POLICY_TYPE_LABELS[data.type]}) ${data.versionLabel} — 변조 방지 게시본. content_hash로 무결성 검증.`
      : undefined,
  })

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    setVerifyResult(null)
    fetch(`${apiUrl(`public/${orgSlug}/policies/${slug}`)}${qs ? `?${qs}` : ''}`, {
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const json: unknown = await res.json().catch(() => null)
        if (!res.ok) {
          const msg = (json as { message?: string } | null)?.message
          throw new Error(msg ?? '약관을 불러오지 못했습니다')
        }
        setData(json as PublicRenderDto)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : '약관을 불러오지 못했습니다')
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [orgSlug, slug, qs])

  const selectVersion = (version: string) => {
    const next = new URLSearchParams(searchParams)
    if (version) next.set('version', version)
    else next.delete('version')
    setSearchParams(next, { replace: true })
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(globalThis.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard 차단 환경 — 무시 */
    }
  }

  /** 게시본 무결성 검증 — 서버가 저장 본문을 다시 해싱해 게시 시점 해시와 대조한다. */
  const verifyIntegrity = async () => {
    if (!data || verifying) return
    setVerifying(true)
    try {
      const res = await fetch(
        `${apiUrl(`public/${orgSlug}/policies/${slug}/verify`)}?version=${encodeURIComponent(
          data.versionLabel
        )}`,
        { headers: { accept: 'application/json' } }
      )
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = (json as { message?: string } | null)?.message
        throw new Error(msg ?? '검증 요청에 실패했습니다')
      }
      const dto = json as PublicVerifyDto
      setVerifyResult(
        dto.verified
          ? {
              verified: true,
              message: '검증됨 — 서버가 재계산한 해시가 게시 시점 해시와 일치합니다',
            }
          : { verified: false, message: `검증 실패 — ${dto.reason ?? '해시 불일치'}` }
      )
    } catch (e: unknown) {
      setVerifyResult({
        verified: false,
        message: e instanceof Error ? e.message : '검증 요청에 실패했습니다',
      })
    } finally {
      setVerifying(false)
    }
  }

  /** 시행 예정(effectiveAt 이 미래)인 게시본을 ICS 로 내보낸다 — 시행일 리마인드 용도. */
  const addToCalendar = () => {
    if (!data?.effectiveAt) return
    const startAt = new Date(data.effectiveAt)
    const notes = [`${data.orgName} ${data.name} ${data.versionLabel} 시행`]
    if (data.changeSummary) notes.push(`변경 요약: ${data.changeSummary}`)

    downloadIcs(
      {
        uid: `termsdesk-version-${data.versionId}`,
        title: `[약관 시행] ${data.name} ${data.versionLabel}`,
        description: notes.join('\n'),
        startAt,
        endAt: new Date(startAt.getTime() + HOUR_MS),
        url: publicSiteUrl(`/p/${orgSlug}/${data.policySlug}?version=${data.versionLabel}`),
      },
      `termsdesk-${data.policySlug}-${data.versionLabel}.ics`
    )
  }

  const currentVersion = searchParams.get('version') ?? ''
  const typeLabel = useMemo(() => (data ? POLICY_TYPE_LABELS[data.type] : ''), [data])
  const upcomingEffective = !!data?.effectiveAt && new Date(data.effectiveAt).getTime() > Date.now()

  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {data ? (
              <OrgIcon name={data.orgName} logoUrl={data.orgLogoUrl} className="size-6" />
            ) : (
              <SealMark className="size-5 shrink-0" />
            )}
            <span className="truncate text-sm font-semibold text-text">
              {data?.orgName ?? '약관'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {data && data.availableVersions.length > 1 && (
              <select
                aria-label="버전 선택"
                value={currentVersion || data.versionLabel}
                onChange={(e) => selectVersion(e.target.value)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                {data.availableVersions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                    {v === data.availableVersions[0] ? ' (현재)' : ''}
                  </option>
                ))}
              </select>
            )}
            {upcomingEffective && (
              <button
                type="button"
                onClick={addToCalendar}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                <CalendarPlus className="size-3.5" />
                캘린더
              </button>
            )}
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
            >
              {copied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Link2 className="size-3.5" />
              )}
              {copied ? '복사됨' : '링크'}
            </button>
            <button
              type="button"
              onClick={() => globalThis.print()}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
            >
              <Printer className="size-3.5" />
              인쇄
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        {loading && (
          <div
            className="grid min-h-[40vh] place-items-center"
            role="status"
            aria-label="불러오는 중"
          >
            <Spinner className="size-6" />
          </div>
        )}

        {!loading && error && (
          <div className="mx-auto max-w-md py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft">
              <AlertTriangle className="size-6 text-danger" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-text">약관을 표시할 수 없습니다</h1>
            <p className="mt-1.5 text-sm text-text-muted">{error}</p>
          </div>
        )}

        {!loading && data && (
          <article>
            <div className="flex items-center gap-2">
              <OrgIcon name={data.orgName} logoUrl={data.orgLogoUrl} className="size-7" />
              <div className="text-[0.78rem] font-semibold uppercase tracking-wide text-accent-strong">
                {data.orgName}
              </div>
            </div>
            <h1 className="mt-1.5 text-[1.7rem] font-bold leading-tight tracking-tight text-text sm:text-[2rem]">
              {data.name}
            </h1>
            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.82rem] text-text-muted">
              <Badge tone="accent" size="sm">
                {data.versionLabel}
              </Badge>
              <span>{typeLabel}</span>
              <span>
                시행일 <span className="font-medium text-text">{formatDate(data.effectiveAt)}</span>
              </span>
              <span>
                게시일 <span className="font-medium text-text">{formatDate(data.publishedAt)}</span>
              </span>
            </div>

            {data.unresolvedVars.length > 0 && (
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[0.8rem] text-text print:hidden">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  치환되지 않은 변수:{' '}
                  {data.unresolvedVars.map((v, i) => (
                    <Fragment key={v}>
                      {i > 0 && ', '}
                      <code className="font-mono text-xs">{`{{${v}}}`}</code>
                    </Fragment>
                  ))}
                  . URL 파라미터로 값을 전달하세요(예{' '}
                  <code className="font-mono text-xs">?{data.unresolvedVars[0]}=값</code>).
                </span>
              </div>
            )}

            <div className="mt-8 border-t border-border pt-8 text-[0.95rem]">
              <PolicyBody body={data.body} />
            </div>

            <footer className="mt-12 border-t border-border pt-6 text-[0.72rem] leading-relaxed text-text-subtle">
              <div>
                변조 방지 게시본 · 콘텐츠 해시(SHA-256){' '}
                <span className="break-all font-mono text-text-muted">
                  {data.contentHash || '—'}
                </span>{' '}
                <button
                  type="button"
                  onClick={verifyIntegrity}
                  disabled={verifying}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 align-middle text-xs font-medium text-text-muted transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-50 print:hidden"
                >
                  <ShieldCheck className="size-3.5" />
                  {verifying ? '검증 중…' : '이 게시본 검증'}
                </button>
              </div>
              {verifyResult && (
                <div
                  role="status"
                  className={cn(
                    'mt-2 flex items-start gap-1.5 print:hidden',
                    verifyResult.verified ? 'text-success' : 'text-danger'
                  )}
                >
                  {verifyResult.verified ? (
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                  ) : (
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  )}
                  <span>{verifyResult.message}</span>
                </div>
              )}
              <div className="mt-2 flex items-center gap-1.5">
                <SealMark className="size-4" />
                <Link
                  to="/"
                  className="rounded transition-colors hover:text-text hover:underline focus-visible:ring-2 focus-visible:ring-accent-strong"
                >
                  Powered by TermsDesk
                </Link>
              </div>
            </footer>
          </article>
        )}
      </main>
    </div>
  )
}
