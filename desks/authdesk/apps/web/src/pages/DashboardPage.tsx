import { UNLIMITED } from '@authdesk/shared'
import { useCallback, useEffect, useState } from 'react'

import type {
  AuthStatsDto,
  EndUserDto,
  TenantDto,
  UsageMetricSummary,
  UsageSummaryDto,
} from '@authdesk/shared'
import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'
import { getOrCreateVid, shouldPingToday } from '@/app/visitorPing'
import { ApiError } from '@/services/api'
import { deleteUser, getStats, getTenant, getUsage, listUsers, trackVisit } from '@/services/auth'
import { reactSnippet, vanillaSnippet } from '@/utils/embed'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

interface DashboardData {
  tenant: TenantDto
  stats: AuthStatsDto
  usage: UsageSummaryDto
  users: EndUserDto[]
}

/** 쿼터 미터 한 줄 — used/limit 게이지(무제한은 게이지 없이 텍스트만). */
function QuotaMeter({ entry }: { entry: UsageMetricSummary }): ReactElement {
  const unlimited = entry.limit === UNLIMITED
  const pct = unlimited || entry.limit === 0 ? 0 : Math.min(100, (entry.used / entry.limit) * 100)
  const fillClass = pct >= 100 ? 'is-full' : pct >= 80 ? 'is-warn' : ''
  const fmt = (n: number): string => n.toLocaleString('en-US')
  return (
    <div className="ad-card">
      <div className="ad-quota-head">
        <p className="ad-stat-label">사용자 한도</p>
        <p className="ad-stat-label">
          {unlimited ? `${fmt(entry.used)} · 무제한` : `${fmt(entry.used)} / ${fmt(entry.limit)}`}
        </p>
      </div>
      {unlimited ? (
        <p className="ad-muted" style={{ margin: 0 }}>
          이 플랜은 사용자 수 제한이 없습니다.
        </p>
      ) : (
        <>
          <div
            className="ad-quota-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={entry.limit}
            aria-valuenow={entry.used}
            aria-label="사용자 한도 사용량"
          >
            <div className={`ad-quota-fill ${fillClass}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="ad-muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
            남은 여유 {fmt(entry.remaining)}명
          </p>
        </>
      )}
    </div>
  )
}

/** 숫자 천단위 구분 포맷(로케일 고정 — 서버/클라 일관). */
function fmtNum(n: number): string {
  return n.toLocaleString('en-US')
}

/** '추적 시작' 날짜를 한국어 라벨로(없으면 안내). */
function sinceLabel(since: string | null): string {
  if (!since) return '아직 추적된 방문이 없습니다'
  return `${new Date(`${since}T00:00:00`).toLocaleDateString('ko-KR')} 추적 시작 이후`
}

interface StatCardProps {
  label: string
  value: number
  caption: string
}

/** 분석 스탯 카드 — 라벨 + 큰 숫자 + 작은 캡션. 각 카드는 labelled group(스크린리더). */
function StatCard({ label, value, caption }: StatCardProps): ReactElement {
  return (
    <div className="ad-card" role="group" aria-label={`${label}: ${fmtNum(value)}`}>
      <p className="ad-stat-label">{label}</p>
      <p className="ad-stat-value">{fmtNum(value)}</p>
      <p className="ad-stat-caption">{caption}</p>
    </div>
  )
}

/**
 * 트래픽/가입 분석 패널 — 운영자 핵심 4지표를 한 줄로. 방문 지표는 신규-추적이라
 * '추적 시작 이후'로 정직하게 표기하고, 가입 지표는 실데이터(가입 시각)임을 캡션으로 구분한다.
 */
function AnalyticsPanel({ stats }: { stats: AuthStatsDto }): ReactElement {
  const { traffic } = stats
  const trafficCaption = sinceLabel(traffic.since)
  return (
    <section className="ad-section" style={{ marginTop: 16 }} aria-labelledby="analytics-heading">
      <div className="ad-panel-head">
        <h2 id="analytics-heading">트래픽 · 가입 분석</h2>
        <p className="ad-panel-note">방문 지표는 추적 시작 이후 누적 · 가입 지표는 실시간 집계</p>
      </div>
      <div className="ad-grid cols-4">
        <StatCard label="오늘 방문자 수" value={traffic.todayVisitors} caption={trafficCaption} />
        <StatCard label="총 트래픽" value={traffic.total} caption={trafficCaption} />
        <StatCard
          label="오늘 신규 가입자 수"
          value={stats.todaySignups}
          caption="오늘 가입한 사용자"
        />
        <StatCard label="총 가입 수" value={stats.userCount} caption="가입한 전체 사용자" />
      </div>
    </section>
  )
}

export function DashboardPage(): ReactElement {
  useDocumentTitle('대시보드')
  const [tenant, setTenant] = useState<TenantDto | null>(null)
  const [stats, setStats] = useState<AuthStatsDto | null>(null)
  const [usage, setUsage] = useState<UsageSummaryDto | null>(null)
  const [users, setUsers] = useState<EndUserDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 데이터 로드 — 순수 fetch(상태 변경 없음). 효과/콜백이 결과를 받아 setState 한다.
  const load = useCallback(async (): Promise<DashboardData> => {
    const [t, s, u, list] = await Promise.all([
      getTenant(),
      getStats(),
      getUsage(),
      listUsers({ limit: 50 }),
    ])
    return { tenant: t, stats: s, usage: u, users: list.items }
  }, [])

  const apply = useCallback((data: DashboardData) => {
    setTenant(data.tenant)
    setStats(data.stats)
    setUsage(data.usage)
    setUsers(data.users)
  }, [])

  // 마운트 시 1회 로드 — 외부 시스템(API)에서 구독하듯 비동기 결과를 콜백에서 반영.
  useEffect(() => {
    let ignore = false
    load()
      .then((data) => {
        if (!ignore) {
          apply(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof ApiError ? err.message : '데이터를 불러오지 못했습니다')
          setLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [load, apply])

  // 방문 핑 — 테넌트 pk_ 로 하루 1회만(테넌트·날짜 가드). fire-and-forget: 실패해도 무시한다.
  // 운영자가 대시보드를 연 것도 그 테넌트의 한 방문으로 정직하게 집계된다('추적 시작 이후').
  useEffect(() => {
    const pk = tenant?.publishableKey
    if (!pk || !shouldPingToday(pk)) return
    void trackVisit(pk, getOrCreateVid()).catch(() => undefined)
  }, [tenant?.publishableKey])

  const refresh = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      apply(await load())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '데이터를 불러오지 못했습니다')
    }
  }, [load, apply])

  const onDelete = async (id: string): Promise<void> => {
    try {
      await deleteUser(id)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제에 실패했습니다')
    }
  }

  if (loading) {
    return (
      <p className="ad-muted" role="status" aria-live="polite">
        대시보드를 불러오는 중…
      </p>
    )
  }

  return (
    <>
      <div className="ad-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: 0 }}>대시보드</h1>
        {tenant ? (
          <span className="ad-badge">
            {tenant.name} · {tenant.plan}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="ad-alert ad-alert-error" role="alert">
          {error}
        </div>
      ) : null}

      {stats ? <AnalyticsPanel stats={stats} /> : null}

      <section className="ad-section" style={{ marginTop: 16 }} aria-label="추가 지표">
        <div className="ad-grid cols-3">
          <StatCard
            label="최근 7일 가입"
            value={stats?.signups.last7d ?? 0}
            caption="지난 7일 신규 가입"
          />
          <StatCard label="누적 로그인" value={stats?.logins ?? 0} caption="로그인 성공 누적" />
          <StatCard label="인증 완료" value={stats?.verified ?? 0} caption="이메일 인증 사용자" />
        </div>
      </section>

      {(() => {
        const quota = usage?.metrics.find((m) => m.metric === 'auth_users')
        return quota ? (
          <section className="ad-section" style={{ marginTop: 16 }}>
            <QuotaMeter entry={quota} />
          </section>
        ) : null
      })()}

      {tenant ? (
        <section className="ad-section">
          <h2>키 & 임베드</h2>
          <div className="ad-card ad-stack">
            <div>
              <p className="ad-label">publishable 키 (pk_) — 브라우저 노출 안전</p>
              <pre className="ad-code">{tenant.publishableKey}</pre>
            </div>
            <div>
              <p className="ad-label">React 임베드</p>
              <pre className="ad-code">
                {reactSnippet({
                  publishableKey: tenant.publishableKey,
                  endpoint: API_BASE || 'https://auth.example.com',
                })}
              </pre>
            </div>
            <div>
              <p className="ad-label">바닐라(비-React) 임베드</p>
              <pre className="ad-code">
                {vanillaSnippet({
                  publishableKey: tenant.publishableKey,
                  endpoint: API_BASE || 'https://auth.example.com',
                })}
              </pre>
            </div>
          </div>
        </section>
      ) : null}

      <section className="ad-section">
        <h2>사용자 ({users.length})</h2>
        <div className="ad-card" style={{ padding: 0, overflowX: 'auto' }}>
          {users.length === 0 ? (
            <p className="ad-muted" style={{ padding: 22, margin: 0 }}>
              아직 가입한 사용자가 없습니다. 임베드 위젯으로 첫 사용자를 받아보세요.
            </p>
          ) : (
            <table className="ad-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>인증</th>
                  <th>가입</th>
                  <th aria-label="작업" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td className="ad-muted">{u.email}</td>
                    <td>
                      <span className={`ad-badge ${u.verified ? 'ad-verified' : 'ad-unverified'}`}>
                        {u.verified ? 'verified' : 'unverified'}
                      </span>
                    </td>
                    <td className="ad-muted">
                      {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="ad-btn ad-btn-danger ad-btn-sm"
                        onClick={() => void onDelete(u.id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  )
}
