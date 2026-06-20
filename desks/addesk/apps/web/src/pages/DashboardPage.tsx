import {
  isAllowedImageType,
  type CampaignDto,
  type CreativeDto,
  type SlotDto,
  type StatsDto,
  type TenantDto,
} from '@addesk/shared'
import { AdSlot } from '@addesk/widget'
import { useCallback, useEffect, useState } from 'react'

import type { FormEvent, ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'
import {
  createCampaign,
  createCreative,
  createSlot,
  deleteCampaign,
  deleteCreative,
  deleteSlot,
  getStats,
  getTenant,
  listCampaigns,
  listCreatives,
  listSlots,
  readFileAsDataUrl,
  uploadImage,
} from '@/services/ads'
import { ApiError } from '@/services/api'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

interface DashboardData {
  tenant: TenantDto
  stats: StatsDto
  campaigns: CampaignDto[]
  creatives: CreativeDto[]
  slots: SlotDto[]
}

export function DashboardPage(): ReactElement {
  useDocumentTitle('대시보드')
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 새 캠페인/크리에이티브/슬롯 폼 상태.
  const [campaignName, setCampaignName] = useState('')
  const [slotKey, setSlotKey] = useState('')
  const [slotSizes, setSlotSizes] = useState('300x250')
  const [uploading, setUploading] = useState(false)
  const [crForm, setCrForm] = useState({
    campaignId: '',
    slotKey: '',
    imageUrl: '',
    linkUrl: '',
    alt: '',
    weight: '1',
  })

  const load = useCallback(async (): Promise<DashboardData> => {
    const [tenant, stats, campaigns, creatives, slots] = await Promise.all([
      getTenant(),
      getStats(),
      listCampaigns(),
      listCreatives(),
      listSlots(),
    ])
    return { tenant, stats, campaigns, creatives, slots }
  }, [])

  useEffect(() => {
    let ignore = false
    load()
      .then((d) => {
        if (!ignore) {
          setData(d)
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
  }, [load])

  const refresh = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      setData(await load())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '데이터를 불러오지 못했습니다')
    }
  }, [load])

  const run = async (fn: () => Promise<unknown>, fail: string): Promise<void> => {
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fail)
    }
  }

  const onCreateCampaign = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!campaignName.trim()) return
    await run(async () => {
      await createCampaign({ name: campaignName.trim(), status: 'active' })
      setCampaignName('')
    }, '캠페인 생성에 실패했습니다')
  }

  const onCreateSlot = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!slotKey.trim()) return
    const sizes = slotSizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    await run(async () => {
      await createSlot({ key: slotKey.trim(), sizes: sizes.length ? sizes : ['300x250'] })
      setSlotKey('')
      setSlotSizes('300x250')
    }, '슬롯 생성에 실패했습니다')
  }

  const onCreateCreative = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    await run(async () => {
      await createCreative({
        campaignId: crForm.campaignId,
        slotKey: crForm.slotKey.trim(),
        imageUrl: crForm.imageUrl.trim(),
        linkUrl: crForm.linkUrl.trim(),
        alt: crForm.alt.trim(),
        weight: Number(crForm.weight) || 1,
      })
      setCrForm({ campaignId: '', slotKey: '', imageUrl: '', linkUrl: '', alt: '', weight: '1' })
    }, '크리에이티브 생성에 실패했습니다')
  }

  // 이미지 파일 선택 → AdDesk 에 업로드 → 받은 절대 URL 을 imageUrl 에 채운다.
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 재선택 허용
    if (!file) return
    if (!isAllowedImageType(file.type)) {
      setError('지원하지 않는 이미지 형식입니다(PNG·JPEG·GIF·WebP·SVG)')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const result = await uploadImage({
        contentType: file.type,
        data: dataUrl,
        filename: file.name,
      })
      setCrForm((f) => ({ ...f, imageUrl: result.url }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '이미지 업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="ax-visually-hidden">대시보드를 불러오는 중입니다.</span>
        <div className="ax-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: 0 }}>대시보드</h1>
        </div>
        <div className="ax-grid cols-4" style={{ marginTop: 16 }}>
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="ax-skeleton" style={{ height: 96 }} />
          ))}
        </div>
        <div className="ax-skeleton" style={{ height: 180, marginTop: 24 }} />
      </div>
    )
  }

  // 초기 로드가 실패해 표시할 데이터가 전혀 없는 경우 — 친절한 안내 + 재시도.
  if (!data) {
    return (
      <>
        <div className="ax-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: 0 }}>대시보드</h1>
        </div>
        <div className="ax-card" style={{ marginTop: 16 }}>
          <div className="ax-alert ax-alert-error" style={{ marginBottom: 12 }} role="alert">
            {error ?? '데이터를 불러오지 못했습니다'}
          </div>
          <button type="button" className="ax-btn ax-btn-sm" onClick={() => void refresh()}>
            다시 시도
          </button>
        </div>
      </>
    )
  }

  const tenant = data.tenant
  const stats = data.stats
  const previewSlot = data.slots[0]?.key

  return (
    <>
      <div className="ax-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: 0 }}>대시보드</h1>
        {tenant ? (
          <span className="ax-badge">
            {tenant.name} · {tenant.plan}
          </span>
        ) : null}
      </div>

      {error ? <div className="ax-alert ax-alert-error">{error}</div> : null}

      <section className="ax-section" style={{ marginTop: 16 }}>
        <div className="ax-grid cols-4">
          <div className="ax-card">
            <p className="ax-stat-label">총 노출</p>
            <p className="ax-stat-value">
              {(stats?.totals.impressions ?? 0).toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="ax-card">
            <p className="ax-stat-label">총 클릭</p>
            <p className="ax-stat-value">{(stats?.totals.clicks ?? 0).toLocaleString('ko-KR')}</p>
          </div>
          <div className="ax-card">
            <p className="ax-stat-label">CTR</p>
            <p className="ax-stat-value">{stats?.totals.ctr ?? 0}%</p>
          </div>
          <div className="ax-card">
            <p className="ax-stat-label">publishable 키</p>
            <p className="ax-stat-value" style={{ fontSize: 15, fontFamily: 'var(--ax-mono)' }}>
              {tenant?.publishableKey ?? '—'}
            </p>
          </div>
        </div>
      </section>

      <section className="ax-section" aria-labelledby="ax-traffic-heading">
        <h2 id="ax-traffic-heading">트래픽 / 분석</h2>
        <div className="ax-grid cols-4">
          <div className="ax-card" role="group" aria-label="오늘 방문자">
            <p className="ax-stat-label">오늘 방문자</p>
            <p className="ax-stat-value">
              {(stats?.totals.todayVisits ?? 0).toLocaleString('ko-KR')}
            </p>
            <p className="ax-stat-caption">배포 이후 집계 · 광고 노출 기준</p>
          </div>
          <div className="ax-card" role="group" aria-label="총 트래픽">
            <p className="ax-stat-label">총 트래픽</p>
            <p className="ax-stat-value">{(tenant?.usageCount ?? 0).toLocaleString('ko-KR')}</p>
            <p className="ax-stat-caption">누적 광고 서빙 수</p>
          </div>
          <div className="ax-card" role="group" aria-label="오늘 신규 가입">
            <p className="ax-stat-label">오늘 신규 가입</p>
            <p className="ax-stat-value">
              {(stats?.totals.todayNewSignups ?? 0).toLocaleString('ko-KR')}
            </p>
            <p className="ax-stat-caption">오늘 등록한 캠페인·크리에이티브</p>
          </div>
          <div className="ax-card" role="group" aria-label="총 가입">
            <p className="ax-stat-label">총 가입</p>
            <p className="ax-stat-value">
              {(
                (stats?.totals.totalCampaigns ?? 0) + (stats?.totals.totalCreatives ?? 0)
              ).toLocaleString('ko-KR')}
            </p>
            <p className="ax-stat-caption">누적 광고 엔티티(캠페인+크리에이티브)</p>
          </div>
        </div>
      </section>

      <section className="ax-section">
        <h2>캠페인별 성과</h2>
        <div className="ax-card" style={{ padding: 0, overflowX: 'auto' }}>
          {stats && stats.campaigns.length > 0 ? (
            <table className="ax-table">
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>노출</th>
                  <th>클릭</th>
                  <th>CTR</th>
                </tr>
              </thead>
              <tbody>
                {stats.campaigns.map((c) => (
                  <tr key={c.campaignId}>
                    <td style={{ fontWeight: 600 }}>{c.campaignName}</td>
                    <td>{c.impressions.toLocaleString('ko-KR')}</td>
                    <td>{c.clicks.toLocaleString('ko-KR')}</td>
                    <td>{c.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ax-muted" style={{ padding: 22, margin: 0 }}>
              아직 노출 데이터가 없습니다. 캠페인·크리에이티브를 만들고 슬롯에 위젯을 임베드하세요.
            </p>
          )}
        </div>
      </section>

      {previewSlot ? (
        <section className="ax-section">
          <h2>
            라이브 미리보기 (<code className="ax-inline">{previewSlot}</code>)
          </h2>
          <div className="ax-card" style={{ display: 'flex', justifyContent: 'center' }}>
            <AdSlot
              slot={previewSlot}
              publishableKey={tenant?.publishableKey ?? ''}
              endpoint={API_BASE}
              fallback={<p className="ax-muted">이 슬롯에 노출할 활성 크리에이티브가 없습니다.</p>}
            />
          </div>
        </section>
      ) : null}

      <section className="ax-section">
        <div className="ax-grid cols-2">
          {/* 캠페인 */}
          <div className="ax-card">
            <h2 style={{ fontSize: 18 }}>캠페인 ({data?.campaigns.length ?? 0})</h2>
            <form className="ax-row" onSubmit={onCreateCampaign} style={{ marginBottom: 12 }}>
              <input
                className="ax-input"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="캠페인 이름"
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="ax-btn ax-btn-primary ax-btn-sm"
                disabled={!campaignName.trim()}
              >
                추가
              </button>
            </form>
            <ul className="ax-stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data?.campaigns.map((c) => (
                <li key={c.id} className="ax-row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {c.name}{' '}
                    <span className={`ax-badge ${c.status === 'active' ? 'ax-on' : ''}`}>
                      {c.status}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="ax-btn ax-btn-danger ax-btn-sm"
                    onClick={() => void run(() => deleteCampaign(c.id), '삭제 실패')}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 슬롯 */}
          <div className="ax-card">
            <h2 style={{ fontSize: 18 }}>슬롯 ({data?.slots.length ?? 0})</h2>
            <form className="ax-row" onSubmit={onCreateSlot} style={{ marginBottom: 12 }}>
              <input
                className="ax-input"
                value={slotKey}
                onChange={(e) => setSlotKey(e.target.value)}
                placeholder="key (예: sidebar)"
                style={{ flex: 1 }}
              />
              <input
                className="ax-input"
                value={slotSizes}
                onChange={(e) => setSlotSizes(e.target.value)}
                placeholder="300x250"
                style={{ width: 110 }}
              />
              <button
                type="submit"
                className="ax-btn ax-btn-primary ax-btn-sm"
                disabled={!slotKey.trim()}
              >
                추가
              </button>
            </form>
            <ul className="ax-stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data?.slots.map((s) => (
                <li key={s.id} className="ax-row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    <code className="ax-inline">{s.key}</code>{' '}
                    <span className="ax-muted">{s.sizes.join(', ')}</span>
                  </span>
                  <button
                    type="button"
                    className="ax-btn ax-btn-danger ax-btn-sm"
                    onClick={() => void run(() => deleteSlot(s.id), '삭제 실패')}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 크리에이티브 */}
      <section className="ax-section">
        <h2>크리에이티브 ({data?.creatives.length ?? 0})</h2>
        <form className="ax-card ax-stack" onSubmit={onCreateCreative}>
          <div className="ax-grid cols-2">
            <label className="ax-field" style={{ margin: 0 }}>
              <span className="ax-label">캠페인</span>
              <select
                className="ax-input"
                value={crForm.campaignId}
                onChange={(e) => setCrForm((f) => ({ ...f, campaignId: e.target.value }))}
                required
              >
                <option value="">선택…</option>
                {data?.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ax-field" style={{ margin: 0 }}>
              <span className="ax-label">슬롯 key</span>
              <input
                className="ax-input"
                value={crForm.slotKey}
                onChange={(e) => setCrForm((f) => ({ ...f, slotKey: e.target.value }))}
                placeholder="sidebar"
                required
              />
            </label>
          </div>
          <label className="ax-field" style={{ margin: 0 }}>
            <span className="ax-label">이미지 업로드</span>
            <input
              className="ax-input"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={(e) => void onPickImage(e)}
              disabled={uploading}
            />
            <span className="ax-muted" style={{ fontSize: 12 }}>
              {uploading
                ? '업로드 중…'
                : 'PNG·JPEG·GIF·WebP·SVG · 최대 2 MiB. 업로드하면 아래 URL이 채워집니다.'}
            </span>
          </label>
          {crForm.imageUrl ? (
            <div
              className="ax-row"
              style={{ gap: 12, alignItems: 'center', justifyContent: 'flex-start' }}
            >
              <img
                src={crForm.imageUrl}
                alt="미리보기"
                style={{
                  maxHeight: 96,
                  maxWidth: 220,
                  borderRadius: 8,
                  border: '1px solid var(--ax-border, #2a2a2a)',
                  objectFit: 'contain',
                }}
              />
              <button
                type="button"
                className="ax-btn ax-btn-sm"
                onClick={() => setCrForm((f) => ({ ...f, imageUrl: '' }))}
              >
                이미지 지우기
              </button>
            </div>
          ) : null}
          <label className="ax-field" style={{ margin: 0 }}>
            <span className="ax-label">이미지 URL (업로드하거나 직접 붙여넣기)</span>
            <input
              className="ax-input"
              value={crForm.imageUrl}
              onChange={(e) => setCrForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://cdn.example/banner.png"
              required
            />
          </label>
          <label className="ax-field" style={{ margin: 0 }}>
            <span className="ax-label">링크 URL</span>
            <input
              className="ax-input"
              value={crForm.linkUrl}
              onChange={(e) => setCrForm((f) => ({ ...f, linkUrl: e.target.value }))}
              placeholder="https://shop.example/landing"
              required
            />
          </label>
          <div className="ax-grid cols-2">
            <label className="ax-field" style={{ margin: 0 }}>
              <span className="ax-label">대체 텍스트(alt)</span>
              <input
                className="ax-input"
                value={crForm.alt}
                onChange={(e) => setCrForm((f) => ({ ...f, alt: e.target.value }))}
                placeholder="여름 세일 배너"
                required
              />
            </label>
            <label className="ax-field" style={{ margin: 0 }}>
              <span className="ax-label">가중치 (1~1000)</span>
              <input
                className="ax-input"
                type="number"
                min={1}
                max={1000}
                value={crForm.weight}
                onChange={(e) => setCrForm((f) => ({ ...f, weight: e.target.value }))}
              />
            </label>
          </div>
          <button type="submit" className="ax-btn ax-btn-primary">
            크리에이티브 추가
          </button>
        </form>

        <div className="ax-card" style={{ padding: 0, overflowX: 'auto', marginTop: 16 }}>
          {data && data.creatives.length > 0 ? (
            <table className="ax-table">
              <thead>
                <tr>
                  <th>배너</th>
                  <th>슬롯</th>
                  <th>가중치</th>
                  <th>노출</th>
                  <th>클릭</th>
                  <th aria-label="작업" />
                </tr>
              </thead>
              <tbody>
                {data.creatives.map((cr) => (
                  <tr key={cr.id}>
                    <td style={{ fontWeight: 600 }}>{cr.alt}</td>
                    <td>
                      <code className="ax-inline">{cr.slotKey}</code>
                    </td>
                    <td>{cr.weight}</td>
                    <td>{cr.impressions.toLocaleString('ko-KR')}</td>
                    <td>{cr.clicks.toLocaleString('ko-KR')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="ax-btn ax-btn-danger ax-btn-sm"
                        onClick={() => void run(() => deleteCreative(cr.id), '삭제 실패')}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ax-muted" style={{ padding: 22, margin: 0 }}>
              아직 크리에이티브가 없습니다. 위 폼으로 첫 배너를 추가하세요.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
