import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AuthGate } from '../components/AuthGate'
import { EmptyState } from '../components/EmptyState'
import { ListSummary } from '../components/ListSummary'
import { api, errorMessage } from '../lib/api'
import { useStore } from '../lib/store'

import type { AuditEvent } from '../lib/types'

export function AuditLog() {
  return (
    <AuthGate>
      <AuditLogBody />
    </AuthGate>
  )
}

type OutcomeFilter = 'all' | 'ok' | 'error'

function AuditLogBody() {
  const t = useStore((s) => s.t)
  const pushToast = useStore((s) => s.pushToast)
  const setError = useStore((s) => s.setGlobalError)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [brokenAt, setBrokenAt] = useState<number | null>(null)
  // verify 진행 표시 — 읽기 fetch 의 isFetching 과 합쳐 종전 busy 동작을 재현.
  const [verifying, setVerifying] = useState(false)
  // 클라이언트 측 필터 — 원본 fetch 는 건드리지 않고 표시만 좁힌다.
  const [filter, setFilter] = useState('')
  const [outcome, setOutcome] = useState<OutcomeFilter>('all')

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => setIsMobile(globalThis.innerWidth < 768)
    check()
    globalThis.addEventListener('resize', check)
    return () => globalThis.removeEventListener('resize', check)
  }, [])

  const {
    data: events = [],
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit'],
    queryFn: async ({ signal }) => {
      const r = await api<{ ok: true; events: AuditEvent[] }>(
        'GET',
        '/admin/api/audit',
        undefined,
        {
          signal,
        }
      )
      return r.events ?? []
    },
  })

  // 종전 busy: 읽기 로드 중 + verify 중 둘 다 버튼 비활성.
  const busy = isFetching || verifying

  const load = () => {
    void refetch()
  }

  // 전역 에러 배너 동기화 — 성공 시 비우고, 실패 시 메시지 표면화(종전 setError 동작 보존).
  useEffect(() => {
    setError(error ? errorMessage(error) : '')
  }, [error, setError])

  // at-a-glance 카운트(outcome 분포) — 전체 이벤트 기준, 필터와 무관하게 항상 총량을 보여준다.
  const counts = useMemo(() => {
    let ok = 0
    let err = 0
    for (const e of events) {
      if (e.outcome === 'ok') ok += 1
      else err += 1
    }
    return { total: events.length, ok, error: err }
  }, [events])

  // 표시용 필터링 — 텍스트(actor/action/target) + outcome 세그먼트.
  const q = filter.trim().toLowerCase()
  const visible = useMemo(
    () =>
      events.filter((e) => {
        if (outcome !== 'all' && e.outcome !== outcome) return false
        if (!q) return true
        return [e.actor, e.action, e.target].some((f) => f?.toLowerCase().includes(q))
      }),
    [events, q, outcome]
  )

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard?.writeText(hash)
      pushToast(t('audit.copyHash.done'), 'success')
    } catch {
      pushToast(t('toast.clipboard.denied'), 'warn')
    }
  }

  // 필터된 뷰를 그대로 JSON 으로 — 외부 검토/보존용 스냅샷. 브라우저만으로 다운로드.
  function exportJson() {
    if (visible.length === 0) {
      pushToast(t('audit.export.empty'), 'warn')
      return
    }
    try {
      const blob = new Blob([JSON.stringify(visible, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `audit-log-${new Date().toISOString().slice(0, 19).replaceAll(':', '')}.json`
      document.body.append(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
      pushToast(`${t('audit.export.done')}: ${visible.length}`, 'success')
    } catch (e) {
      pushToast(errorMessage(e), 'error')
    }
  }

  async function verify() {
    setVerifying(true)
    try {
      const r = await api<{ ok: true; verified: boolean; brokenAt: number | null }>(
        'GET',
        '/admin/api/audit/verify'
      )
      setVerified(r.verified)
      setBrokenAt(r.brokenAt)
      pushToast(
        r.verified ? t('audit.ok') : `${t('audit.broken')} (idx ${r.brokenAt})`,
        r.verified ? 'success' : 'error'
      )
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
    } finally {
      setVerifying(false)
    }
  }

  const outcomes: Array<{ key: OutcomeFilter; label: string }> = [
    { key: 'all', label: t('audit.outcome.all') },
    { key: 'ok', label: t('audit.outcome.ok') },
    { key: 'error', label: t('audit.outcome.error') },
  ]

  return (
    <section className="space-y-4" data-testid="page-audit">
      <div className="alert alert--warn">
        <h3 className="font-semibold mb-1">{t('audit.title')}</h3>
        <p>{t('audit.desc')}</p>
      </div>

      {events.length > 0 ? (
        <ListSummary
          stats={[
            { label: t('audit.summary.total'), value: counts.total, tone: 'accent' },
            { label: t('audit.summary.ok'), value: counts.ok, tone: 'ok' },
            { label: t('audit.summary.error'), value: counts.error, tone: 'warn' },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-sm font-medium"
          onClick={load}
          disabled={busy}
        >
          {t('audit.refresh')}
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-sm font-medium"
          onClick={verify}
          disabled={busy}
        >
          {t('audit.verify')}
        </button>
        {events.length > 0 ? (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-sm font-medium"
            onClick={exportJson}
          >
            {t('audit.export')}
          </button>
        ) : null}
        {verified !== null ? (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 text-sm ${verified ? 'text-ok-fg' : 'text-err-fg'}`}
          >
            {verified ? (
              <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <CircleX className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            )}
            {verified ? t('audit.ok') : `${t('audit.broken')} brokenAt=${brokenAt}`}
          </span>
        ) : null}
      </div>

      {events.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className="input min-w-48 flex-1 px-3 py-2 text-sm sm:max-w-xs"
            placeholder={t('audit.filter.placeholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={t('audit.filter.placeholder')}
          />
          <div
            className="inline-flex rounded-md border border-line p-0.5"
            role="group"
            aria-label={t('audit.summary.total')}
          >
            {outcomes.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={outcome === o.key}
                className={`rounded px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  outcome === o.key ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink'
                }`}
                onClick={() => setOutcome(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-xs text-ink-subtle tabular-nums">
            {t('audit.count')
              .replace('{shown}', String(visible.length))
              .replace('{total}', String(events.length))}
          </span>
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="panel">
          <EmptyState title={t('audit.empty')} hint={t('audit.empty.hint')} />
        </div>
      ) : visible.length === 0 ? (
        <div className="panel">
          <EmptyState title={t('audit.filter.none')} />
        </div>
      ) : isMobile ? (
        /* Mobile Timeline view */
        <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-line">
          {visible.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="relative pl-8">
              <span
                className={`absolute left-[9px] top-4 w-[10px] h-[10px] rounded-full border-2 border-surface ${e.outcome === 'ok' ? 'bg-ok' : 'bg-err'}`}
              />
              <div className="panel p-3 bg-panel space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-ink-muted">{e.ts?.slice(11, 19) ?? '-'}</span>
                  {e.hash ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-mono bg-panel-2 px-1.5 py-0.5 rounded text-[10px] text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => copyHash(e.hash ?? '')}
                      title={t('audit.copyHash')}
                      aria-label={`${t('audit.copyHash')}: ${e.hash}`}
                    >
                      {e.hash.slice(0, 12)}…
                      <Copy className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="font-mono bg-panel-2 px-1.5 py-0.5 rounded text-[10px] text-ink-subtle">
                      -
                    </span>
                  )}
                </div>
                <div className="text-sm text-ink font-semibold">
                  {e.actor} <span className="font-normal text-ink-muted">action:</span>{' '}
                  <code className="text-xs px-1 bg-panel-2 rounded">{e.action}</code>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span>outcome:</span>
                  <span className={`badge ${e.outcome === 'ok' ? 'badge--ok' : 'badge--err'}`}>
                    {e.outcome}
                  </span>
                </div>
                {e.target && (
                  <div className="text-xs font-mono bg-panel-2 p-1.5 rounded truncate text-ink-muted max-w-full">
                    {e.target}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop Table view */
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">timestamp</th>
                <th className="px-3 py-2 text-left">actor</th>
                <th className="px-3 py-2 text-left">action</th>
                <th className="px-3 py-2 text-left">target</th>
                <th className="px-3 py-2 text-left">outcome</th>
                <th className="px-3 py-2 text-left">hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((e, i) => (
                <tr key={`${e.ts}-${i}`} className="hover:bg-panel-2">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                    {e.ts?.slice(11, 19) ?? '-'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.actor}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2 font-mono text-xs truncate max-w-xs">
                    {e.target ?? '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`badge ${e.outcome === 'ok' ? 'badge--ok' : 'badge--err'}`}>
                      {e.outcome}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-ink-subtle">
                    {e.hash ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={() => copyHash(e.hash ?? '')}
                        title={t('audit.copyHash')}
                        aria-label={`${t('audit.copyHash')}: ${e.hash}`}
                      >
                        {e.hash.slice(0, 12)}…
                        <Copy className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
