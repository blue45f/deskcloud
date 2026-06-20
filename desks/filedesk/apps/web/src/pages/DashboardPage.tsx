import {
  formatBytes,
  type FileObjectDto,
  type FileStatsDto,
  type TenantDto,
} from '@filedesk/shared'
import { FileUpload } from '@filedesk/widget'
import { useCallback, useEffect, useState } from 'react'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'
import { ApiError } from '@/services/api'
import { deleteFile, getStats, getTenant, listFiles } from '@/services/files'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export function DashboardPage(): ReactElement {
  useDocumentTitle('대시보드')
  const [tenant, setTenant] = useState<TenantDto | null>(null)
  const [stats, setStats] = useState<FileStatsDto | null>(null)
  const [files, setFiles] = useState<FileObjectDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // 최초 로드 자체가 실패하면(테넌트/통계/목록 모두 없음) 화면 전체를 에러 상태로 보여준다.
  const [loadFailed, setLoadFailed] = useState(false)

  // 데이터 로드 — 순수 fetch(상태 변경 없음). 효과/콜백이 결과를 받아 setState 한다.
  const load = useCallback(async (): Promise<{
    tenant: TenantDto
    stats: FileStatsDto
    files: FileObjectDto[]
  }> => {
    const [t, s, list] = await Promise.all([getTenant(), getStats(), listFiles({ limit: 50 })])
    return { tenant: t, stats: s, files: list.items }
  }, [])

  const apply = useCallback(
    (data: { tenant: TenantDto; stats: FileStatsDto; files: FileObjectDto[] }) => {
      setTenant(data.tenant)
      setStats(data.stats)
      setFiles(data.files)
    },
    []
  )

  // 마운트 시 1회 로드 — 외부 시스템(API)에서 구독하듯 비동기 결과를 콜백에서 반영.
  // retryKey 가 바뀌면 재시도한다. (effect 본문에서 동기 setState 를 호출하지 않으려고
  // 로딩 리셋은 retry 핸들러에서만 한다 — 최초 마운트는 useState 기본값이 곧 로딩 상태다.)
  const [retryKey, setRetryKey] = useState(0)
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
          setLoadFailed(true)
          setLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [load, apply, retryKey])

  const retry = useCallback((): void => {
    setLoading(true)
    setLoadFailed(false)
    setError(null)
    setRetryKey((value) => value + 1)
  }, [])

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
      await deleteFile(id)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제에 실패했습니다')
    }
  }

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true">
        <p className="fd-muted" style={{ marginTop: 0 }}>
          대시보드를 불러오는 중…
        </p>
        <div className="fd-grid cols-3" style={{ marginTop: 16 }}>
          {[0, 1, 2].map((key) => (
            <div key={key} className="fd-skeleton" style={{ height: 92 }} />
          ))}
        </div>
        <div className="fd-skeleton" style={{ height: 160, marginTop: 16 }} />
      </div>
    )
  }

  // 최초 로드 실패 — 부분 데이터가 없으므로 화면 전체를 에러+재시도로 대체한다.
  if (loadFailed) {
    return (
      <section className="fd-hero" role="alert">
        <h1 style={{ fontSize: 28 }}>대시보드를 불러오지 못했습니다</h1>
        <p>{error ?? '데이터를 불러오지 못했습니다.'}</p>
        <p className="fd-muted" style={{ marginTop: -6, fontSize: 14 }}>
          네트워크나 secret 키를 확인한 뒤 다시 시도해 주세요.
        </p>
        <div className="fd-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="fd-btn fd-btn-primary" onClick={retry}>
            다시 시도
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="fd-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: 0 }}>대시보드</h1>
        {tenant ? (
          <span className="fd-badge">
            {tenant.name} · {tenant.plan}
          </span>
        ) : null}
      </div>

      {/* 부분 작업(삭제·새로고침) 실패는 인라인 알림 + 다시 시도로 회복한다. */}
      {error ? (
        <div className="fd-alert fd-alert-error" role="alert">
          <p style={{ margin: 0 }}>{error}</p>
          <button
            type="button"
            className="fd-btn fd-btn-sm"
            onClick={() => void refresh()}
            style={{ marginTop: 10 }}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      <section className="fd-section" style={{ marginTop: 16 }}>
        <div className="fd-grid cols-3">
          <div className="fd-card">
            <p className="fd-stat-label">총 파일</p>
            <p className="fd-stat-value">{stats?.metrics.files ?? 0}</p>
          </div>
          <div className="fd-card">
            <p className="fd-stat-label">총 저장 용량</p>
            <p className="fd-stat-value">{formatBytes(stats?.metrics.storage_bytes ?? 0)}</p>
          </div>
          <div className="fd-card">
            <p className="fd-stat-label">publishable 키</p>
            <p className="fd-stat-value" style={{ fontSize: 16, fontFamily: 'var(--fd-mono)' }}>
              {tenant?.publishableKey ?? '—'}
            </p>
          </div>
        </div>
      </section>

      {tenant ? (
        <section className="fd-section">
          <h2>업로드</h2>
          <div className="fd-card">
            <FileUpload
              publishableKey={tenant.publishableKey}
              endpoint={API_BASE}
              onUploaded={() => void refresh()}
            />
          </div>
        </section>
      ) : null}

      <section className="fd-section">
        <h2>파일 ({files.length})</h2>
        <div className="fd-card" style={{ padding: 0, overflowX: 'auto' }}>
          {files.length === 0 ? (
            <p className="fd-muted" style={{ padding: 22, margin: 0 }}>
              아직 업로드된 파일이 없습니다. 위 위젯으로 첫 파일을 올려보세요.
            </p>
          ) : (
            <table className="fd-table">
              <thead>
                <tr>
                  <th>파일명</th>
                  <th>형식</th>
                  <th>크기</th>
                  <th>가시성</th>
                  <th>업로드</th>
                  <th aria-label="작업" />
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>
                      <a href={`${API_BASE}/api/files/${f.key}`} target="_blank" rel="noreferrer">
                        {f.filename}
                      </a>
                    </td>
                    <td className="fd-muted">{f.contentType}</td>
                    <td>{formatBytes(f.sizeBytes)}</td>
                    <td>
                      <span className={`fd-badge fd-${f.visibility}`}>{f.visibility}</span>
                    </td>
                    <td className="fd-muted">
                      {new Date(f.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="fd-btn fd-btn-danger fd-btn-sm"
                        onClick={() => void onDelete(f.id)}
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
