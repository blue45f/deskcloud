import { MediaUploader } from '@mediadesk/widget'
import {
  Files,
  FolderOpen,
  HardDrive,
  Images,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useSessionStore } from '@/app/sessionStore'
import { AssetCard } from '@/components/feature/AssetCard'
import { StatCard } from '@/components/feature/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiEndpoint } from '@/services/api'
import {
  useAssets,
  useDeleteAsset,
  useFolders,
  useMe,
  useOverview,
  useStorageInfo,
} from '@/services/media'
import { formatBytes, formatDate, formatNumber } from '@/utils/format'

const PAGE_SIZE = 60
const ACCENT = '#3b6fe0'

export default function DashboardPage() {
  useDocumentTitle('자산 라이브러리')
  const me = useMe()
  const storage = useStorageInfo()
  const folders = useFolders()
  const publishableKey = useSessionStore((s) => s.publishableKey)
  // 마스터 토큰 세션만 운영 지표(방문/트래픽/가입)를 본다. 테넌트 secret 키 세션은 숨김.
  const isMaster = useSessionStore((s) => s.adminToken.length > 0)
  const overview = useOverview()

  const [folder, setFolder] = useState('')
  const [page, setPage] = useState(0)
  const [uploadFolder, setUploadFolder] = useState('uploads')
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const assets = useAssets(folder, page * PAGE_SIZE, PAGE_SIZE)
  const del = useDeleteAsset()
  const endpoint = apiEndpoint()

  const items = assets.data?.items ?? []
  const total = assets.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const folderChips = useMemo(() => folders.data ?? [], [folders.data])

  // 마스터 토큰 세션이고 publishable 키가 없으면(테넌트 미선택) 위젯 업로드 불가 → me 에서 보충.
  const effectivePk = publishableKey || me.data?.publishableKey || ''

  const handleDelete = (key: string) => {
    setDeletingKey(key)
    del.mutate(key, {
      onSuccess: () => toast.success('자산을 삭제했습니다.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.'),
      onSettled: () => setDeletingKey(null),
    })
  }

  const refresh = () => {
    void assets.refetch()
    void folders.refetch()
    void me.refetch()
    if (isMaster) void overview.refetch()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">자산 라이브러리</h1>
          <p className="mt-1 text-pretty text-text-muted">
            {me.data ? `${me.data.name} · ${me.data.slug}` : '워크스페이스'} 의 미디어 자산을
            업로드·조회·관리합니다.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" />
          새로고침
        </Button>
      </div>

      {/* 운영 지표(마스터 토큰 전용) — 방문/트래픽은 신규 집계, 가입은 실데이터 */}
      {isMaster ? <OperatorMetrics overview={overview} /> : null}

      {/* 지표 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="자산 수"
          value={me.data ? formatNumber(me.data.usage.count) : '—'}
          hint={
            me.data?.usage.maxCount ? `한도 ${formatNumber(me.data.usage.maxCount)}` : '무제한(Pro)'
          }
          icon={Files}
        />
        <StatCard
          label="저장 용량"
          value={me.data ? formatBytes(me.data.usage.bytes) : '—'}
          hint={
            me.data?.usage.maxBytes ? `한도 ${formatBytes(me.data.usage.maxBytes)}` : '무제한(Pro)'
          }
          icon={Images}
          tone="accent"
        />
        <StatCard
          label="스토리지"
          value={storage.data ? (storage.data.driver === 's3' ? 'S3(스텁)' : 'Local FS') : '—'}
          hint={
            storage.data?.transformAvailable ? 'sharp 변환 사용 가능' : 'sharp 없음 · 원본 서빙'
          }
          icon={HardDrive}
        />
      </div>

      {/* 업로드(위젯) */}
      <Card>
        <CardHeader
          action={
            <div className="flex items-center gap-2">
              <label htmlFor="upload-folder" className="text-xs text-text-muted">
                폴더
              </label>
              <Input
                id="upload-folder"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value.replace(/[^a-z0-9/_-]/gi, ''))}
                className="h-8 w-40 font-mono text-xs"
                placeholder="예: avatars"
              />
            </div>
          }
        >
          <CardTitle>업로드</CardTitle>
        </CardHeader>
        <CardContent>
          {effectivePk ? (
            <MediaUploader
              publishableKey={effectivePk}
              endpoint={endpoint}
              folder={uploadFolder || undefined}
              accent={ACCENT}
              onUploaded={(asset) => {
                toast.success(`업로드됨: ${asset.key.split('/').pop()}`)
                refresh()
              }}
              onError={(err) => toast.error(err.message)}
            />
          ) : (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
              위젯 업로드는 테넌트 publishable 키가 필요합니다. 테넌트 secret 키로 로그인하거나,
              마스터 토큰 세션이라면 단일 테넌트가 자동 선택됩니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 폴더 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <FolderOpen className="size-3.5" aria-hidden />
          폴더
        </span>
        <FolderChip
          label="전체"
          active={folder === ''}
          onClick={() => {
            setFolder('')
            setPage(0)
          }}
        />
        {folderChips.map((f) => (
          <FolderChip
            key={f}
            label={f}
            active={folder === f}
            onClick={() => {
              setFolder(f)
              setPage(0)
            }}
          />
        ))}
      </div>

      {/* 그리드 */}
      {assets.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
          ))}
        </div>
      ) : assets.isError ? (
        <ErrorState
          title="자산 목록을 불러오지 못했어요"
          error={assets.error}
          onRetry={() => void assets.refetch()}
          retrying={assets.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Images}
          title={folder ? `'${folder}' 폴더가 비어 있어요` : '아직 자산이 없어요'}
          description="위 업로더로 이미지·파일을 올리면 여기 그리드에 나타납니다."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((asset) => (
              <AssetCard
                key={asset.key}
                asset={asset}
                onDelete={handleDelete}
                deleting={deletingKey === asset.key}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-text-muted">
                {formatNumber(total)}개 중 {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, total)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  이전
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  다음
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <p className="text-xs text-text-subtle">
        임베드 스니펫과 SDK 사용법은{' '}
        <Link to="/app/embed" className="font-medium text-accent-strong hover:text-accent">
          임베드 탭
        </Link>
        에서 확인하세요.
      </p>
    </div>
  )
}

function FolderChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-fg'
          : 'rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text'
      }
    >
      {label}
    </button>
  )
}

/**
 * 운영 지표 패널(마스터 토큰 전용) — 오늘 방문자·총 트래픽·오늘 신규 가입·총 가입.
 * 정직성: 가입 두 카드는 실데이터, 방문/트래픽 두 카드는 롤아웃 시점부터의 신규 집계임을
 * 캡션으로 명시한다(소급 백필 없음 → 초기 숫자는 작은 게 정상).
 */
function OperatorMetrics({ overview }: { overview: ReturnType<typeof useOverview> }) {
  const d = overview.data
  const num = (v: number | undefined): string => (v === undefined ? '—' : formatNumber(v))

  // 방문/트래픽 캡션 — 데이터가 쌓이기 전엔 '신규 집계', 시작일이 있으면 그 날짜를 보여준다.
  const trafficCaption = d?.trafficSince ? `집계 시작 ${formatDate(d.trafficSince)}` : '신규 집계'

  return (
    <section aria-labelledby="operator-metrics-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="operator-metrics-heading"
          className="text-sm font-semibold tracking-tight text-text"
        >
          운영 지표
        </h2>
        <p className="text-xs text-text-subtle">마스터 토큰 전용 · 60초마다 갱신</p>
      </div>

      {overview.isError ? (
        <ErrorState
          title="운영 지표를 불러오지 못했어요"
          error={overview.error}
          onRetry={() => void overview.refetch()}
          retrying={overview.isFetching}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="오늘 방문자 수"
            value={num(d?.todayVisitors)}
            hint={trafficCaption}
            icon={Users}
            tone="accent"
          />
          <StatCard
            label="총 트래픽"
            value={num(d?.totalTraffic)}
            hint={d ? `오늘 ${formatNumber(d.todayHits)}회 · ${trafficCaption}` : trafficCaption}
            icon={TrendingUp}
          />
          <StatCard
            label="오늘 신규 가입자 수"
            value={num(d?.todaySignups)}
            hint="실시간 집계"
            icon={UserPlus}
          />
          <StatCard
            label="총 가입 수"
            value={num(d?.totalSignups)}
            hint="전체 테넌트 누적"
            icon={Users}
          />
        </div>
      )}
    </section>
  )
}
