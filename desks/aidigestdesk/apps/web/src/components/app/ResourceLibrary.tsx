import {
  getContentMetadataSearchText,
  getDomainFromUrl,
  getEffectiveDate,
  getLearningResourceMetadata,
  getSearchTerms,
  getSources,
  isRecent,
  providerCatalog,
  resolveResourceImage,
  type LearningResource,
  type ProviderId,
} from '@aidigestdesk/content'
import {
  BookOpen,
  ExternalLink,
  FileText,
  Library,
  MessagesSquare,
  PenLine,
  PlayCircle,
  Search,
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'

import type { ComponentType } from 'react'

import {
  BrandMark,
  MetadataChips,
  MultiSegmentBar,
  NewBadge,
  SectionHeader,
  SegmentBar,
  SortSelect,
  Thumbnail,
} from '@/components/app/CommonUi'
import {
  sourceKindFilters,
  sourceKindLabel,
  type SourceKindFilter,
} from '@/components/app/sourceLabels'
import { getLocaleAwareFilterDefaults } from '@/utils/environment'

type ResourceLanguageFilter = LearningResource['language'] | 'all' | 'koreanOrCaption'
type ResourceTypeFilter = LearningResource['type'] | 'all'
type ResourceLevelFilter = LearningResource['level'] | 'all'
type ResourceProviderFilter = ProviderId | 'all'
type ResourceSortMode = 'language' | 'type' | 'title' | 'level' | 'provider' | 'lastChecked'
type ResourceSortDirection = 'asc' | 'desc'
type ResourceSortValue = `${ResourceSortMode}-${ResourceSortDirection}`
type ResourceAccessFilter =
  | 'all'
  | 'free'
  | 'paid'
  | 'subscription'
  | 'publicFunded'
  | 'remote'
  | 'bootcamp'
  | 'events'
  | 'hackathons'
  | 'openSource'
type ResourceFocusFilter =
  | 'all'
  | 'modelChannels'
  | 'koreanCreators'
  | 'coursePlatforms'
  | 'inflearn'
  | 'publicTraining'
  | 'bootcamps'
  | 'books'
  | 'bookStores'
  | 'community'
  | 'events'
  | 'newsletters'
  | 'koreanLLM'
  | 'koreanBenchmarks'
  | 'officialKo'
  | 'codingTools'
type ActiveResourceTypeFilter = Exclude<ResourceTypeFilter, 'all'>
type ActiveResourceLevelFilter = Exclude<ResourceLevelFilter, 'all'>
type ActiveResourceFocusFilter = Exclude<ResourceFocusFilter, 'all'>
type ActiveResourceAccessFilter = Exclude<ResourceAccessFilter, 'all'>
type ActiveSourceKindFilter = Exclude<SourceKindFilter, 'all'>

function hasAnyTag(resource: LearningResource, tags: string[]) {
  return tags.some((tag) => resource.tags.includes(tag))
}

type ThumbnailRatio = 'video' | 'cover' | 'square'

const resourceTypeIcons: Record<
  LearningResource['type'],
  ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  '공식 문서': FileText,
  '강좌/영상': PlayCircle,
  '블로그/글': PenLine,
  도서: BookOpen,
  커뮤니티: MessagesSquare,
}

/** resolveResourceImage가 null일 때 카드 썸네일 비율을 자료형으로 결정한다. */
function getFallbackThumbnailRatio(type: LearningResource['type']): ThumbnailRatio {
  if (type === '강좌/영상') return 'video'
  if (type === '도서') return 'cover'
  return 'square'
}

function getResourceSearchableText(resource: LearningResource) {
  const metadata = getLearningResourceMetadata(resource)
  return [
    resource.id,
    resource.title,
    resource.author,
    resource.summary,
    getContentMetadataSearchText(metadata),
    ...resource.tags,
  ]
    .join(' ')
    .toLocaleLowerCase('ko-KR')
}

function matchesResourceFocus(resource: LearningResource, focus: ResourceFocusFilter) {
  const tagSet = new Set(resource.tags)
  const searchable = getResourceSearchableText(resource)

  switch (focus) {
    case 'modelChannels':
      return (
        tagSet.has('모델별') ||
        tagSet.has('공식 채널') ||
        tagSet.has('후보 채널') ||
        resource.id.includes('model-')
      )
    case 'koreanCreators':
      return (
        resource.language === '한국어' &&
        (tagSet.has('유튜브') ||
          tagSet.has('유튜버') ||
          tagSet.has('코드팩토리') ||
          tagSet.has('개발동생') ||
          resource.id.includes('youtube'))
      )
    case 'coursePlatforms':
      return (
        tagSet.has('강좌 플랫폼') ||
        tagSet.has('인프런') ||
        tagSet.has('인프런 대체') ||
        tagSet.has('원격 교육') ||
        tagSet.has('K-디지털')
      )
    case 'inflearn':
      return (
        tagSet.has('인프런') || searchable.includes('inflearn') || searchable.includes('인프런')
      )
    case 'publicTraining':
      return hasAnyTag(resource, [
        'K-디지털',
        '국비지원',
        '내일배움카드',
        '공공 교육',
        '공개강좌',
        '무료 강좌',
      ])
    case 'bootcamps':
      return hasAnyTag(resource, [
        '부트캠프',
        'SSAFY',
        'SW마에스트로',
        'SeSAC',
        '카카오테크',
        '모집 상태',
      ])
    case 'books':
      return resource.type === '도서'
    case 'bookStores':
      return (
        resource.type === '도서' &&
        (hasAnyTag(resource, ['도서', '신간', '출판사']) ||
          searchable.includes('yes24') ||
          searchable.includes('알라딘') ||
          searchable.includes('교보') ||
          searchable.includes('서점') ||
          searchable.includes('길벗') ||
          searchable.includes('위키북스') ||
          searchable.includes('한빛미디어') ||
          searchable.includes('제이펍') ||
          searchable.includes('에이콘'))
      )
    case 'community':
      return resource.type === '커뮤니티'
    case 'events':
      return hasAnyTag(resource, ['이벤트', '웨비나', '모집 상태', '학생 혜택'])
    case 'newsletters':
      return hasAnyTag(resource, ['뉴스레터', '웹진', 'GeekNews', '요즘IT', 'Disquiet'])
    case 'koreanLLM':
      return hasAnyTag(resource, [
        '국내 LLM',
        'HyperCLOVA X',
        'Solar Pro 3',
        'EXAONE',
        'Kanana',
        '한국어 성능',
      ])
    case 'koreanBenchmarks':
      return hasAnyTag(resource, [
        '한국어 벤치마크',
        'KMMLU',
        'KMMMU',
        'KoBALT',
        'HRET',
        'KITE',
        'HAE-RAE',
      ])
    case 'officialKo':
      return resource.type === '공식 문서' && resource.language === '한국어'
    case 'codingTools':
      return (
        tagSet.has('AI 코딩') ||
        tagSet.has('AI 코딩 도구') ||
        tagSet.has('AI IDE') ||
        tagSet.has('CLI') ||
        tagSet.has('바이브 코딩')
      )
    default:
      return true
  }
}

function matchesResourceAccess(resource: LearningResource, access: ResourceAccessFilter) {
  const searchable = getResourceSearchableText(resource)

  switch (access) {
    case 'free':
      return (
        searchable.includes('무료') ||
        searchable.includes('공개강좌') ||
        searchable.includes('공공 교육') ||
        searchable.includes('free')
      )
    case 'paid':
      return (
        searchable.includes('유료') ||
        searchable.includes('가격') ||
        searchable.includes('pricing') ||
        searchable.includes('플랜') ||
        searchable.includes('크레딧') ||
        searchable.includes('credit')
      )
    case 'subscription':
      return (
        searchable.includes('구독') ||
        searchable.includes('subscription') ||
        searchable.includes('class101') ||
        searchable.includes('데이스쿨')
      )
    case 'publicFunded':
      return (
        searchable.includes('국비지원') ||
        searchable.includes('k-디지털') ||
        searchable.includes('내일배움카드') ||
        searchable.includes('공공 교육')
      )
    case 'remote':
      return (
        searchable.includes('원격 교육') ||
        searchable.includes('온라인') ||
        searchable.includes('remote')
      )
    case 'bootcamp':
      return (
        searchable.includes('부트캠프') ||
        searchable.includes('모집 상태') ||
        searchable.includes('데브코스') ||
        searchable.includes('캠퍼스')
      )
    case 'events':
      return (
        searchable.includes('이벤트') ||
        searchable.includes('웨비나') ||
        searchable.includes('학생 혜택') ||
        searchable.includes('무료 체험')
      )
    case 'hackathons':
      return (
        searchable.includes('해커톤') ||
        searchable.includes('경진대회') ||
        searchable.includes('dacon') ||
        searchable.includes('데이콘') ||
        searchable.includes('daker')
      )
    case 'openSource':
      return (
        searchable.includes('오픈소스') ||
        searchable.includes('오픈웨이트') ||
        searchable.includes('로컬 모델') ||
        searchable.includes('자체배포')
      )
    default:
      return true
  }
}

export function ResourceLibrary({ resources }: { resources: LearningResource[] }) {
  const localeAwareDefaults = getLocaleAwareFilterDefaults()
  const [language, setLanguage] = useState<ResourceLanguageFilter>(
    () => localeAwareDefaults.resourceLanguage
  )
  const [resourceTypes, setResourceTypes] = useState<ActiveResourceTypeFilter[]>([])
  const [levels, setLevels] = useState<ActiveResourceLevelFilter[]>([])
  const [resourceProvider, setResourceProvider] = useState<ProviderId[]>([])
  const [focuses, setFocuses] = useState<ActiveResourceFocusFilter[]>([])
  const [accesses, setAccesses] = useState<ActiveResourceAccessFilter[]>([])
  const [sourceKinds, setSourceKinds] = useState<ActiveSourceKindFilter[]>([])
  const [sortMode, setSortMode] = useState<ResourceSortMode>('language')
  const [sortDirection, setSortDirection] = useState<ResourceSortDirection>('asc')
  const [tags, setTags] = useState<string[]>([])
  const [resourceQuery, setResourceQuery] = useState('')
  const deferredResourceQuery = useDeferredValue(resourceQuery)
  const resourceSearchTerms = useMemo(
    () => getSearchTerms(deferredResourceQuery),
    [deferredResourceQuery]
  )

  const supportsKoreanOrCaption = useMemo(
    () => (resource: LearningResource) => {
      if (resource.language === '한국어') return true
      const searchable = getResourceSearchableText(resource)
      return searchable.includes('자막')
    },
    []
  )
  const languageFilters: Array<{ id: ResourceLanguageFilter; label: string }> = [
    { id: 'koreanOrCaption', label: '기본(한국어/자막)' },
    { id: 'all', label: '전체' },
    { id: '한국어', label: '한국어' },
    { id: '영어', label: '영어' },
  ]
  const typeFilters: Array<{ id: ResourceTypeFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: '공식 문서', label: '공식 문서' },
    { id: '강좌/영상', label: '유튜브/영상' },
    { id: '블로그/글', label: '블로그/글' },
    { id: '도서', label: '도서' },
    { id: '커뮤니티', label: '커뮤니티' },
  ]
  const levelFilters: Array<{ id: ResourceLevelFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: '입문', label: '입문' },
    { id: '실무', label: '실무' },
    { id: '고급', label: '고급' },
  ]
  const providerResourceFilters: Array<{
    id: ResourceProviderFilter
    label: string
  }> = [
    { id: 'all', label: '전체 제공사' },
    ...providerCatalog.map((provider) => ({
      id: provider.id,
      label: provider.label,
    })),
  ]
  const focusFilters: Array<{ id: ResourceFocusFilter; label: string }> = [
    { id: 'all', label: '전체 묶음' },
    { id: 'modelChannels', label: '모델별 채널' },
    { id: 'koreanCreators', label: '국내 유튜버' },
    { id: 'coursePlatforms', label: '강좌 플랫폼' },
    { id: 'inflearn', label: '인프런' },
    { id: 'publicTraining', label: '국비/공개강좌' },
    { id: 'bootcamps', label: '부트캠프' },
    { id: 'books', label: '도서/신간' },
    { id: 'bookStores', label: '서점/출판사' },
    { id: 'community', label: '커뮤니티' },
    { id: 'events', label: '이벤트/웨비나' },
    { id: 'newsletters', label: '뉴스레터/웹진' },
    { id: 'koreanLLM', label: '국내 LLM' },
    { id: 'koreanBenchmarks', label: '한국어 벤치마크' },
    { id: 'officialKo', label: '한국어 공식' },
    { id: 'codingTools', label: 'AI 코딩 도구' },
  ]
  const accessFilters: Array<{ id: ResourceAccessFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: 'free', label: '무료/공개' },
    { id: 'paid', label: '유료/가격' },
    { id: 'subscription', label: '구독형' },
    { id: 'publicFunded', label: '국비/공공' },
    { id: 'remote', label: '온라인/원격' },
    { id: 'bootcamp', label: '모집/부트캠프' },
    { id: 'events', label: '혜택/이벤트' },
    { id: 'hackathons', label: '해커톤/대회' },
    { id: 'openSource', label: '오픈소스/로컬' },
  ]
  const sortOptions: Array<{ value: ResourceSortValue; label: string }> = [
    { value: 'language-asc', label: '언어순(한국어 먼저)' },
    { value: 'language-desc', label: '언어순(영어 먼저)' },
    { value: 'type-asc', label: '자료형 A→Z' },
    { value: 'type-desc', label: '자료형 Z→A' },
    { value: 'title-asc', label: '제목 A→Z' },
    { value: 'title-desc', label: '제목 Z→A' },
    { value: 'level-asc', label: '난이도 입문→고급' },
    { value: 'level-desc', label: '난이도 고급→입문' },
    { value: 'provider-asc', label: '제공사 A→Z' },
    { value: 'provider-desc', label: '제공사 Z→A' },
    { value: 'lastChecked-desc', label: '최근 확인일 최신순' },
    { value: 'lastChecked-asc', label: '최근 확인일 오래된순' },
  ]
  const getLatestSourceCheckDate = (resource: LearningResource) => {
    return getSources(resource.sourceIds)
      .map((source) => source.lastChecked)
      .toSorted((a, b) => b.localeCompare(a))[0]
  }
  const tagFilters = useMemo(() => {
    const tags = new Set<string>()
    for (const resource of resources) {
      for (const resourceTag of resource.tags) tags.add(resourceTag)
    }
    return [
      { id: 'all', label: '전체 태그' },
      ...[...tags]
        .toSorted((a, b) => a.localeCompare(b, 'ko'))
        .map((item) => ({
          id: item,
          label: item,
        })),
    ]
  }, [resources])
  const filteredResources = useMemo(
    () =>
      resources
        .filter(
          (resource) =>
            (language === 'all'
              ? true
              : language === 'koreanOrCaption'
                ? supportsKoreanOrCaption(resource)
                : resource.language === language) &&
            (resourceTypes.length === 0 || resourceTypes.includes(resource.type)) &&
            (levels.length === 0 || levels.includes(resource.level)) &&
            (resourceProvider.length === 0 ||
              resourceProvider.some((providerId) => resource.providerIds?.includes(providerId))) &&
            (focuses.length === 0 ||
              focuses.some((focus) => matchesResourceFocus(resource, focus))) &&
            (accesses.length === 0 ||
              accesses.some((access) => matchesResourceAccess(resource, access))) &&
            (sourceKinds.length === 0 ||
              getSources(resource.sourceIds).some((source) => sourceKinds.includes(source.kind))) &&
            (tags.length === 0 || tags.some((tag) => resource.tags.includes(tag))) &&
            (!resourceSearchTerms.length ||
              resourceSearchTerms.some((searchTerm) =>
                [
                  resource.title,
                  resource.author,
                  resource.summary,
                  resource.type,
                  resource.language,
                  resource.level,
                  ...resource.tags,
                  ...getSources(resource.sourceIds).flatMap((source) => [
                    source.title,
                    source.publisher,
                    source.note,
                  ]),
                ]
                  .join(' ')
                  .toLocaleLowerCase('ko-KR')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .includes(searchTerm)
              ))
        )
        .toSorted((a, b) => {
          const direction = sortDirection === 'asc' ? 1 : -1
          switch (sortMode) {
            case 'language': {
              if (a.language === b.language) return a.type.localeCompare(b.type)
              return (a.language === '한국어' ? -1 : 1) * direction
            }
            case 'type': {
              const byType = a.type.localeCompare(b.type)
              if (byType !== 0) return byType * direction
              return a.title.localeCompare(b.title) * direction
            }
            case 'title':
              return a.title.localeCompare(b.title) * direction
            case 'level': {
              const order: Record<LearningResource['level'], number> = {
                입문: 0,
                실무: 1,
                고급: 2,
              }
              const byLevel = order[a.level] - order[b.level]
              if (byLevel !== 0) return byLevel * direction
              return a.title.localeCompare(b.title) * direction
            }
            case 'provider': {
              const firstProviderA = a.providerIds?.[0] ?? 'zzzz'
              const firstProviderB = b.providerIds?.[0] ?? 'zzzz'
              if (firstProviderA === firstProviderB) {
                return a.title.localeCompare(b.title) * direction
              }
              return firstProviderA.localeCompare(firstProviderB) * direction
            }
            case 'lastChecked': {
              const checkedA = getLatestSourceCheckDate(a)
              const checkedB = getLatestSourceCheckDate(b)
              if (!checkedA && !checkedB) return 0
              if (!checkedA) return 1 * direction
              if (!checkedB) return -1 * direction
              return checkedB.localeCompare(checkedA) * direction
            }
            default:
              return a.title.localeCompare(b.title)
          }
        }),
    [
      accesses,
      focuses,
      language,
      levels,
      resourceProvider,
      resourceTypes,
      resources,
      resourceSearchTerms,
      supportsKoreanOrCaption,
      sourceKinds,
      tags,
      sortMode,
      sortDirection,
    ]
  )
  const grouped = useMemo(() => {
    return {
      official: filteredResources.filter((resource) => resource.type === '공식 문서'),
      videos: filteredResources.filter((resource) => resource.type === '강좌/영상'),
      blogs: filteredResources.filter((resource) => resource.type === '블로그/글'),
      books: filteredResources.filter((resource) => resource.type === '도서'),
      community: filteredResources.filter((resource) => resource.type === '커뮤니티'),
    }
  }, [filteredResources])
  const coverageItems = useMemo(() => {
    const countByType = (type: LearningResource['type']) =>
      filteredResources.filter((resource) => resource.type === type).length
    const sourceCount = new Set(filteredResources.flatMap((resource) => resource.sourceIds)).size

    return [
      {
        label: '한국어',
        value: filteredResources.filter((resource) => resource.language === '한국어').length,
      },
      { label: '영상', value: countByType('강좌/영상') },
      { label: '도서', value: countByType('도서') },
      { label: '공식', value: countByType('공식 문서') },
      { label: '출처', value: sourceCount },
    ]
  }, [filteredResources])

  return (
    <section id="learning" className="space-y-4">
      <SectionHeader
        icon={Library}
        title="강좌와 도서"
        description="공식 문서, 한국어 유튜브, 교육기관, 원격 강좌, 기술 블로그, 도서 검색 허브를 언어·형식·난이도·제공사·태그로 좁혀 봅니다."
      />
      <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1fr_1.35fr_1fr_1fr]">
        <label className="block xl:col-span-2">
          <span className="text-xs font-semibold text-text-subtle">자료실 검색</span>
          <span className="relative mt-2 block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
            <input
              value={resourceQuery}
              onChange={(event) => setResourceQuery(event.target.value)}
              placeholder="인프런, 국비지원, Cursor, 한국어 벤치마크, 도서 검색"
              className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
            />
          </span>
        </label>
        <SegmentBar
          label="자료 언어"
          items={languageFilters}
          value={language}
          onChange={setLanguage}
        />
        <MultiSegmentBar
          label="자료 형식"
          items={typeFilters}
          value={resourceTypes}
          onChange={setResourceTypes}
        />
        <MultiSegmentBar label="난이도" items={levelFilters} value={levels} onChange={setLevels} />
        <SortSelect
          label="정렬"
          value={`${sortMode}-${sortDirection}` satisfies ResourceSortValue}
          onChange={(next) => {
            const splitAt = next.lastIndexOf('-')
            setSortMode(next.slice(0, splitAt) as ResourceSortMode)
            setSortDirection(next.slice(splitAt + 1) as ResourceSortDirection)
          }}
          options={sortOptions}
        />
        <MultiSegmentBar
          label="출처 성격"
          items={sourceKindFilters}
          value={sourceKinds}
          onChange={setSourceKinds}
        />
        <MultiSegmentBar
          label="자료 묶음"
          items={focusFilters}
          value={focuses}
          onChange={setFocuses}
        />
        <MultiSegmentBar
          label="관련 제공사"
          items={providerResourceFilters}
          value={resourceProvider}
          onChange={setResourceProvider}
        />
        <MultiSegmentBar
          label="접근/비용"
          items={accessFilters}
          value={accesses}
          onChange={setAccesses}
        />
        <div className="xl:col-span-2">
          <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-bg p-3">
            <MultiSegmentBar label="세부 태그" items={tagFilters} value={tags} onChange={setTags} />
          </div>
        </div>
        <div className="rounded-md border border-border bg-bg p-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-text-subtle">필터 결과</p>
              <p className="mt-1 text-lg font-semibold text-text">{filteredResources.length}개</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLanguage(localeAwareDefaults.resourceLanguage)
                setResourceTypes([])
                setLevels([])
                setSortMode('language')
                setSortDirection('asc')
                setResourceProvider([])
                setFocuses([])
                setAccesses([])
                setSourceKinds([])
                setTags([])
                setResourceQuery('')
              }}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              초기화
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {coverageItems.map((item) => (
              <span
                key={item.label}
                className="rounded-md border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle"
              >
                {item.label} {item.value}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-5">
        <ResourceColumn title="공식 문서" resources={grouped.official} />
        <ResourceColumn title="유튜브/영상" resources={grouped.videos} />
        <ResourceColumn title="블로그/글" resources={grouped.blogs} />
        <ResourceColumn title="도서" resources={grouped.books} />
        <ResourceColumn title="커뮤니티" resources={grouped.community} />
      </div>
    </section>
  )
}

function ResourceColumn({ title, resources }: { title: string; resources: LearningResource[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="mt-3 space-y-3">
        {resources.length ? (
          resources.map((resource) => {
            const metadata = getLearningResourceMetadata(resource)
            const resourceSources = getSources(resource.sourceIds)
            const primarySource = resourceSources[0]
            const sourceKinds = [
              ...new Set(resourceSources.map((source) => sourceKindLabel(source.kind))),
            ]
            const lastChecked = resourceSources
              .map((source) => source.lastChecked)
              .toSorted((a, b) => b.localeCompare(a))[0]
            const resolvedImage = resolveResourceImage(resource)
            const thumbnailRatio = resolvedImage?.ratio ?? getFallbackThumbnailRatio(resource.type)
            const TypeIcon = resourceTypeIcons[resource.type]
            const isNew = isRecent(getEffectiveDate(metadata))
            const firstProviderId = resource.providerIds?.[0]
            const resourceDomain = getDomainFromUrl(resource.url)

            return (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border border-border bg-bg p-3 transition hover:border-border-strong"
              >
                <Thumbnail
                  src={resolvedImage?.src ?? undefined}
                  alt={resource.title}
                  ratio={thumbnailRatio}
                  icon={TypeIcon}
                  caption={resource.type}
                />
                <span className="mt-3 flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-text">{resource.title}</span>
                      {isNew ? <NewBadge /> : null}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-text-subtle">
                      {firstProviderId ? (
                        <BrandMark providerId={firstProviderId} label={resource.author} size="sm" />
                      ) : resourceDomain ? (
                        <BrandMark domain={resourceDomain} label={resource.author} size="sm" />
                      ) : null}
                      <span className="min-w-0 truncate">
                        {resource.author} · {resource.language} · {resource.level}
                      </span>
                    </span>
                  </span>
                  <ExternalLink className="size-3.5 shrink-0 text-text-subtle" aria-hidden />
                </span>
                <span className="mt-2 block text-xs leading-5 text-text-muted">
                  {resource.summary}
                </span>
                <MetadataChips
                  items={[
                    { label: '작성자', value: metadata.authorNames?.join(', ') },
                    { label: '출처', value: metadata.newsSources?.slice(0, 2).join(', ') },
                    { label: '도메인', value: metadata.sourceDomains?.slice(0, 2).join(', ') },
                    { label: '수집일', value: metadata.collectedAt },
                    { label: '확인일', value: metadata.lastCheckedAt },
                    { label: '자료형', value: metadata.contentType },
                    { label: '언어', value: metadata.language },
                  ]}
                  limit={6}
                />
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {primarySource ? (
                    <span className="rounded-md border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle">
                      {primarySource.publisher}
                    </span>
                  ) : null}
                  {sourceKinds.map((kind) => (
                    <span
                      key={kind}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle"
                    >
                      {kind}
                    </span>
                  ))}
                  {lastChecked ? (
                    <span className="rounded-md border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle">
                      확인 {lastChecked}
                    </span>
                  ) : null}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {resource.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </a>
            )
          })
        ) : (
          <p className="rounded-md border border-border bg-bg p-3 text-xs leading-5 text-text-subtle">
            현재 필터에 맞는 항목이 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}
