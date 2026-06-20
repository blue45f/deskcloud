import { Component, Home, LayoutGrid, Palette, ToggleLeft, Type } from 'lucide-react'
import { useMemo, useState, useSyncExternalStore } from 'react'

import type { AppRoute } from '@/components/app/appRoutes'
import type { SourceKind } from '@aidigestdesk/content'
import type { ReactNode } from 'react'

import {
  ActiveFilterChips,
  BrandMark,
  Chip,
  EmptyState,
  MetadataChips,
  MetricCard,
  MultiSegmentBar,
  NewBadge,
  ResultSummary,
  SearchField,
  SectionHeader,
  SegmentBar,
  Select,
  SortSelect,
  SourceKindBadge,
  TextList,
  Thumbnail,
  type ChipTone,
} from '@/components/app/CommonUi'


/** /design 라우트에서 노출하는 테마 토큰. CSS 변수명과 Tailwind 유틸을 1:1로 묶는다. */
const colorTokens: Array<{ token: string; cssVar: string; utility: string; note: string }> = [
  { token: 'bg', cssVar: '--color-bg', utility: 'bg-bg', note: '페이지 바탕' },
  { token: 'surface', cssVar: '--color-surface', utility: 'bg-surface', note: '카드/패널 표면' },
  { token: 'surface-2', cssVar: '--color-surface-2', utility: 'bg-surface-2', note: '보조 표면·썸네일 바탕' },
  { token: 'border', cssVar: '--color-border', utility: 'border-border', note: '기본 경계선' },
  { token: 'border-strong', cssVar: '--color-border-strong', utility: 'border-border-strong', note: '강조 경계·호버' },
  { token: 'text', cssVar: '--color-text', utility: 'text-text', note: '본문 기본 텍스트' },
  { token: 'text-muted', cssVar: '--color-text-muted', utility: 'text-text-muted', note: '보조 설명 텍스트' },
  { token: 'text-subtle', cssVar: '--color-text-subtle', utility: 'text-text-subtle', note: '라벨·캡션 텍스트' },
  { token: 'ink', cssVar: '--color-ink', utility: 'bg-ink', note: '선택 상태 바탕' },
  { token: 'ink-fg', cssVar: '--color-ink-fg', utility: 'text-ink-fg', note: 'ink 위 텍스트' },
  { token: 'accent', cssVar: '--color-accent', utility: 'text-accent', note: '주 강조(그린)' },
  { token: 'accent-2', cssVar: '--color-accent-2', utility: 'text-accent-2', note: '공식/블루' },
  { token: 'accent-3', cssVar: '--color-accent-3', utility: 'text-accent-3', note: '벤치마크/앰버' },
  { token: 'accent-4', cssVar: '--color-accent-4', utility: 'text-accent-4', note: '커뮤니티/코랄' },
]

const typeScale: Array<{ utility: string; usage: string }> = [
  { utility: 'text-2xl', usage: '라우트 h1 · 메트릭 값' },
  { utility: 'text-xl', usage: '섹션 대제목' },
  { utility: 'text-lg', usage: 'SectionHeader 제목' },
  { utility: 'text-sm', usage: '본문 기본(line-height 1.6)' },
  { utility: 'text-xs', usage: '라벨·캡션·칩' },
]

const TYPE_SAMPLE = '다람쥐 헌 쳇바퀴에 타고파 — AI 다이제스트 데스크'

const chipTones: ChipTone[] = ['neutral', 'accent', 'blue', 'amber', 'coral', 'ink']
const chipToneLabels: Record<ChipTone, string> = {
  neutral: 'neutral',
  accent: 'accent',
  blue: 'blue',
  amber: 'amber',
  coral: 'coral',
  ink: 'ink',
}

const sourceKinds: SourceKind[] = ['official', 'benchmark', 'publisher', 'community']

type SegmentValue = 'cards' | 'table'
type SampleTag = 'react' | 'vite' | 'tailwind'
type SortValue = 'recent' | 'name' | 'popular'
type SelectValue = 'all' | 'official' | 'community'

const segmentItems: Array<{ id: SegmentValue; label: string }> = [
  { id: 'cards', label: '카드' },
  { id: 'table', label: '표' },
]

const tagItems: Array<{ id: SampleTag | 'all'; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'react', label: 'React' },
  { id: 'vite', label: 'Vite' },
  { id: 'tailwind', label: 'Tailwind' },
]

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: 'recent', label: '최신순' },
  { value: 'name', label: '이름순' },
  { value: 'popular', label: '인기순' },
]

const selectOptions: Array<{ value: SelectValue; label: string }> = [
  { value: 'all', label: '전체 출처' },
  { value: 'official', label: '공식 문서' },
  { value: 'community', label: '커뮤니티' },
]

/** 라벨 + 데모 본체를 묶는 작은 캡션 래퍼. 데모마다 컴포넌트 이름을 단다. */
function Demo({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-subtle">{name}</p>
      {children}
    </div>
  )
}

function readResolvedTokens(): Record<string, string> {
  if (typeof document === 'undefined') return {}
  const styles = getComputedStyle(document.documentElement)
  const next: Record<string, string> = {}
  for (const { cssVar } of colorTokens) {
    next[cssVar] = styles.getPropertyValue(cssVar).trim()
  }
  return next
}

function ColorSwatches() {
  // 라이트/다크 토글 시 갱신되도록 외부 스토어(문서 클래스)를 구독해 매번 다시 읽는다.
  const resolved = useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange)
      if (typeof document !== 'undefined') {
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      }
      return () => observer.disconnect()
    },
    () => document.documentElement.className,
    () => ''
  )
  // className(resolved)이 바뀔 때마다 토큰 값을 다시 읽는다.
  const tokens = useMemo(() => {
    void resolved
    return readResolvedTokens()
  }, [resolved])

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {colorTokens.map(({ token, cssVar, utility, note }) => (
        <div
          key={token}
          className="flex items-center gap-3 rounded-md border border-border bg-bg p-3"
        >
          <span
            className="size-12 shrink-0 rounded-md border border-border"
            style={{ background: `var(${cssVar})` }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">{token}</p>
            <p className="font-mono text-[0.6875rem] text-text-muted">{utility}</p>
            <p className="truncate font-mono text-[0.6875rem] text-text-subtle">
              {tokens[cssVar] || cssVar}
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-text-subtle">{note}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function ComponentGallery() {
  const [segment, setSegment] = useState<SegmentValue>('cards')
  const [tags, setTags] = useState<SampleTag[]>(['react'])
  const [sort, setSort] = useState<SortValue>('recent')
  const [source, setSource] = useState<SelectValue>('all')
  const [search, setSearch] = useState('')

  const activeChips = [
    ...tags.map((tag) => ({
      key: `tag-${tag}`,
      label: tagItems.find((item) => item.id === tag)?.label ?? tag,
      onRemove: () => setTags((current) => current.filter((value) => value !== tag)),
    })),
    ...(source !== 'all'
      ? [
          {
            key: 'source',
            label: selectOptions.find((option) => option.value === source)?.label ?? source,
            onRemove: () => setSource('all'),
          },
        ]
      : []),
    ...(search.trim()
      ? [{ key: 'search', label: `검색: ${search.trim()}`, onRemove: () => setSearch('') }]
      : []),
  ]

  const totalSample = 24
  const shownSample = Math.max(0, totalSample - activeChips.length * 4)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Demo name="MetricCard">
          <MetricCard
            label="컴포넌트"
            value="22"
            detail="CommonUi 공유 프리미티브 수"
            icon={Component}
          />
        </Demo>
        <Demo name="MetricCard">
          <MetricCard
            label="컬러 토큰"
            value="14"
            detail="라이트/다크 양쪽 정의"
            icon={Palette}
          />
        </Demo>
        <Demo name="MetricCard">
          <MetricCard
            label="타입 스케일"
            value="5"
            detail="text-2xl ~ text-xs"
            icon={Type}
          />
        </Demo>
      </div>

      <Demo name="Chip (전체 톤)">
        <div className="flex flex-wrap gap-1.5">
          {chipTones.map((tone) => (
            <Chip key={tone} tone={tone}>
              {chipToneLabels[tone]}
            </Chip>
          ))}
        </div>
      </Demo>

      <Demo name="SourceKindBadge (전체 종류)">
        <div className="flex flex-wrap gap-1.5">
          {sourceKinds.map((kind) => (
            <SourceKindBadge key={kind} kind={kind} />
          ))}
        </div>
      </Demo>

      <Demo name="NewBadge">
        <div className="flex flex-wrap gap-1.5">
          <NewBadge />
          <NewBadge label="업데이트" />
        </div>
      </Demo>

      <Demo name="BrandMark (provider · domain 폴백)">
        <div className="flex flex-wrap items-center gap-3">
          <BrandMark providerId="openai" label="OpenAI" />
          <BrandMark providerId="anthropic" label="Anthropic" />
          <BrandMark domain="github.com" label="GitHub" />
          <BrandMark domain={null} label="폴백 글리프" />
        </div>
      </Demo>

      <div className="grid gap-3 sm:grid-cols-3">
        <Demo name="Thumbnail (video · 실 이미지)">
          <Thumbnail
            src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
            alt="유튜브 썸네일 예시"
            ratio="video"
          />
        </Demo>
        <Demo name="Thumbnail (video · 플레이스홀더)">
          <Thumbnail
            alt="플레이스홀더 예시"
            ratio="video"
            icon={LayoutGrid}
            caption="썸네일 없음"
          />
        </Demo>
        <Demo name="Thumbnail (cover · 플레이스홀더)">
          <Thumbnail alt="표지 플레이스홀더" ratio="cover" icon={Type} caption="표지 준비 중" />
        </Demo>
      </div>

      <Demo name="MetadataChips">
        <MetadataChips
          items={[
            { label: '제공사', value: 'Anthropic' },
            { label: '형식', value: '문서' },
            { label: '난이도', value: '중급' },
            { label: '언어', value: '한국어' },
            { label: '빈 값', value: '' },
          ]}
        />
      </Demo>

      <div className="grid gap-4 rounded-md border border-border bg-bg p-4 xl:grid-cols-2">
        <Demo name="SegmentBar">
          <SegmentBar label="보기 모드" items={segmentItems} value={segment} onChange={setSegment} />
        </Demo>
        <Demo name="MultiSegmentBar">
          <MultiSegmentBar label="태그" items={tagItems} value={tags} onChange={setTags} />
        </Demo>
        <Demo name="Select">
          <Select label="출처" value={source} onChange={setSource} options={selectOptions} />
        </Demo>
        <Demo name="SortSelect">
          <SortSelect value={sort} onChange={setSort} options={sortOptions} />
        </Demo>
        <Demo name="SearchField">
          <SearchField
            label="검색"
            value={search}
            onChange={setSearch}
            placeholder="예: 에이전트 워크플로"
          />
        </Demo>
        <Demo name="ResultSummary">
          <ResultSummary
            shown={shownSample}
            total={totalSample}
            onReset={() => {
              setTags([])
              setSource('all')
              setSearch('')
            }}
            resetDisabled={activeChips.length === 0}
          />
        </Demo>
      </div>

      <Demo name="ActiveFilterChips">
        {activeChips.length ? (
          <ActiveFilterChips chips={activeChips} />
        ) : (
          <p className="text-xs text-text-subtle">활성 필터가 없습니다. 위 컨트롤을 조작해 보세요.</p>
        )}
      </Demo>

      <Demo name="EmptyState">
        <EmptyState
          title="결과가 없습니다"
          body="필터 조건을 완화하거나 초기화 버튼으로 모든 항목을 다시 표시하세요."
        />
      </Demo>
    </div>
  )
}

function StateShowcase() {
  const [selected, setSelected] = useState(true)

  return (
    <div className="space-y-5">
      <Demo name="버튼 — 기본 · 선택(ink) · 비활성">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(false)}
            className={
              selected
                ? 'rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text'
                : 'rounded-md border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-ink-fg'
            }
          >
            기본
          </button>
          <button
            type="button"
            onClick={() => setSelected(true)}
            className={
              selected
                ? 'rounded-md border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-ink-fg'
                : 'rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text'
            }
          >
            선택됨
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted opacity-50"
          >
            비활성
          </button>
        </div>
        <p className="text-[0.6875rem] text-text-subtle">
          포커스 링은 키보드 Tab으로 확인하세요. 전역 :focus-visible 토큰(accent 2px)을 사용합니다.
        </p>
      </Demo>

      <Demo name="입력 — 포커스 링 · 비활성">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            defaultValue="포커스 시 accent 보더"
            className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
          />
          <input
            disabled
            value="비활성 입력"
            className="h-10 w-full cursor-not-allowed rounded-md border border-border bg-surface-2 px-3 text-sm text-text-muted opacity-60 outline-none"
            readOnly
          />
        </div>
      </Demo>

      <TextList
        title="상태 규칙"
        items={[
          '호버: 보더를 border-strong로, 텍스트를 text로 끌어올린다.',
          '포커스: 전역 :focus-visible(accent 2px, offset 2px)에 의존하고 개별 ring을 덮어쓰지 않는다.',
          '선택: bg-ink + text-ink-fg로 단일 강조한다(색 변형 금지).',
          '비활성: opacity-50~60 + cursor-not-allowed, 색상 토큰은 유지한다.',
        ]}
      />
    </div>
  )
}

export function DesignRoute({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="px-4 py-5 outline-none lg:px-6">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-accent">디자인 시스템 · /design</p>
              <h1 className="mt-1 text-2xl font-semibold text-text">AIDigestDesk 디자인 시스템</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
                실제 테마 토큰과 공유 컴포넌트를 코드에서 직접 렌더링하는 리빙 스타일가이드입니다.
                값은 런타임에 해석되므로 디자인과 구현이 분리되지 않습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('portal')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              <Home className="size-3.5" aria-hidden />
              포털로
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Palette}
            title="컬러 토큰"
            description="라이트/다크 양쪽에서 정의되는 OKLCH 토큰. 해석값은 현재 테마 기준으로 런타임에 읽어옵니다."
          />
          <div className="rounded-lg border border-border bg-surface p-5">
            <ColorSwatches />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Type}
            title="타이포그래피"
            description="Pretendard(시스템 폰트 폴백) 기반 타입 스케일. 본문 줄간격은 1.6입니다."
          />
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="space-y-4">
              {typeScale.map((item) => (
                <div
                  key={item.utility}
                  className="flex flex-col gap-1 border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[0.6875rem] text-text-subtle">{item.utility}</span>
                    <span className="text-[0.6875rem] text-text-subtle">·</span>
                    <span className="text-[0.6875rem] text-text-subtle">{item.usage}</span>
                  </div>
                  <p className={`${item.utility} font-semibold text-text`}>{TYPE_SAMPLE}</p>
                </div>
              ))}
              <p className="text-xs leading-6 text-text-muted">
                폰트 스택: Pretendard Variable → Pretendard → system-ui → Apple SD Gothic Neo →
                Malgun Gothic. 숫자는 tnum(고정폭)으로 렌더링합니다.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Component}
            title="컴포넌트"
            description="CommonUi 공유 프리미티브를 실제 로컬 상태에 연결해 인터랙티브하게 렌더링합니다."
            badge={<Chip tone="accent">live</Chip>}
          />
          <div className="rounded-lg border border-border bg-surface p-5">
            <ComponentGallery />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={ToggleLeft}
            title="상태"
            description="hover · focus-visible · active · disabled · selected 상태를 실제 컨트롤로 보여줍니다."
          />
          <div className="rounded-lg border border-border bg-surface p-5">
            <StateShowcase />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={LayoutGrid}
            title="레이아웃·원칙"
            description="모든 화면이 따르는 시각·구조 규칙. 새 섹션을 추가할 때 이 목록을 기준으로 검토합니다."
          />
          <div className="rounded-lg border border-border bg-surface p-5">
            <TextList
              title="디자인 원칙"
              items={[
                '카드 반경은 8px 이하(rounded-md/rounded-lg)로 제한한다.',
                '카드 안에 카드를 중첩하지 않는다.',
                '좌우 스트라이프 보더를 쓰지 않는다.',
                '그라디언트 텍스트를 쓰지 않는다.',
                '색은 상태·제공사 의미로만 쓰고 장식으로 쓰지 않는다.',
                '본문 텍스트 대비는 4.5:1 이상을 유지한다.',
                'prefers-reduced-motion을 준수해 모션을 줄인다.',
              ]}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
