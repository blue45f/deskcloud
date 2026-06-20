import { SNAPSHOT_DATE } from '@aidigestdesk/content'
import {
  BadgePercent,
  BookOpen,
  Boxes,
  CheckCircle2,
  Filter,
  Home,
  MessageSquarePlus,
  MessagesSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  UserRound,
} from 'lucide-react'

import type { AppRoute } from '@/components/app/appRoutes'
import type { ComponentType } from 'react'

import { Chip, SectionHeader } from '@/components/app/CommonUi'

type NavIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

const steps: Array<{ icon: NavIcon; title: string; body: string }> = [
  {
    icon: Search,
    title: '1. 검색으로 시작',
    body: '상단 검색창에 모델·기능·벤치마크·강좌·할인 키워드를 입력하면 모든 카테고리에서 한 번에 찾습니다. "클로드", "제미니" 같은 한글 별칭도 인식합니다.',
  },
  {
    icon: Filter,
    title: '2. 제공사로 좁히기',
    body: '모델·도구·자료 페이지의 제공사 필터로 GPT·Claude·Gemini 등 원하는 제공사만 추립니다. 활성 필터는 칩으로 표시되고 한 번에 초기화할 수 있습니다.',
  },
  {
    icon: Table2,
    title: '3. 비교·정렬',
    body: '각 섹션의 정렬 컨트롤로 최신순·이름순·관련도순 등으로 정렬합니다. 모델 카드, 벤치마크, 비교표, 비용 계산기로 후보를 좁히세요.',
  },
  {
    icon: ShieldCheck,
    title: '4. 출처로 검증',
    body: '모든 항목은 공식 문서·벤치마크·출판/교육·커뮤니티로 구분된 출처를 가집니다. 카드의 출처 링크로 원문을 확인하고 스냅샷 날짜로 최신성을 판단하세요.',
  },
]

const features: Array<{ route: AppRoute; icon: NavIcon; title: string; body: string }> = [
  {
    route: 'models',
    icon: Table2,
    title: '모델·벤치마크·비용',
    body: '제공사별 스펙, 분야별 벤치마크 점수, 비교표, 토큰 단가 계산기를 한 화면에서 비교합니다.',
  },
  {
    route: 'tools',
    icon: Boxes,
    title: 'AI 도구·확장 디렉터리',
    body: 'IDE·CLI 도구와 플러그인·훅·스킬·MCP·워크플로우를 종류·플랫폼·카테고리로 세분화해 검색합니다.',
  },
  {
    route: 'deals',
    icon: BadgePercent,
    title: 'LLM 할인·혜택',
    body: '학생/교육, 무료 크레딧, API 가격 인하, 국내 전용 혜택을 국내 사용자 기준으로 정리했습니다.',
  },
  {
    route: 'resources',
    icon: BookOpen,
    title: '강좌·자료',
    body: '한국어 강좌·도서·블로그·사용법·직군별 플레이북을 썸네일과 함께 탐색합니다.',
  },
  {
    route: 'community',
    icon: MessagesSquare,
    title: '커뮤니티',
    body: '토론 채팅방에서 모델·할인·도움 요청을 나눕니다. (베타 · 브라우저 로컬 저장)',
  },
  {
    route: 'account',
    icon: UserRound,
    title: '회원·계정',
    body: '회원가입·로그인으로 커뮤니티에 닉네임으로 참여하세요. 계정은 서버 없이 브라우저에만 저장됩니다.',
  },
  {
    route: 'support',
    icon: MessageSquarePlus,
    title: '문의',
    body: '제휴·버그·의견·이용 문의를 남기고 공개 게시판에서 처리 상태를 확인하세요. 전화·이메일 대신 이 창구로 통합했습니다.',
  },
]

const principles = [
  '모든 항목에 출처와 스냅샷 날짜를 표기해 최신성과 근거를 명확히 합니다.',
  '공식 문서 값(제품 스펙)과 외부 벤치마크 값(별도 평가)을 분리해 보여줍니다.',
  '국내 사용자 기준으로 한국어 자료·국내 혜택·적용 팁을 우선 배치합니다.',
  '투자·구매·도입 판단의 최종 책임은 이용자에게 있으며, 본 포털은 데모/포트폴리오 목적입니다.',
]

export function AboutRoute({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="px-4 py-5 outline-none lg:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-lg border border-border bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-accent">소개·가이드 · /about</p>
              <h1 className="mt-1 text-2xl font-semibold text-text text-balance">
                AIDigestDesk는 어떤 곳인가요?
              </h1>
              <p className="mt-3 text-sm leading-7 text-text-muted">
                GPT·Claude·Gemini·Grok·Manus 등 주요 상용 AI/LLM의 업데이트·벤치마크·기능 비교·비용·할인·도구
                확장·강좌를 <strong className="font-semibold text-text">한국어로 큐레이션</strong>하는
                포털입니다. 흩어진 정보를 출처와 함께 한 곳에 모아, 무엇이 바뀌었고 무엇을 골라야 할지 빠르게
                판단하도록 돕습니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Chip tone="accent" icon={Sparkles}>
                  {SNAPSHOT_DATE} 스냅샷
                </Chip>
                <Chip tone="blue">출처 기반</Chip>
                <Chip tone="amber">국내 사용자 우선</Chip>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('portal')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              <Home className="size-3.5" aria-hidden />
              포털로
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Search}
            title="사용 방법 4단계"
            description="검색 → 필터 → 비교/정렬 → 출처 검증 순서로 원하는 정보에 빠르게 도달하세요."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map((step) => (
              <article key={step.title} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-bg text-accent">
                    <step.icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="text-sm font-semibold text-text">{step.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-muted">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Boxes}
            title="무엇을 볼 수 있나요?"
            description="페이지별로 정보를 분리했습니다. 카드를 눌러 바로 이동하세요."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <button
                key={feature.route}
                type="button"
                onClick={() => onNavigate(feature.route)}
                className="flex h-full items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left transition hover:border-border-strong"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-bg text-accent">
                  <feature.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">{feature.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-text-muted">{feature.body}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={ShieldCheck}
            title="콘텐츠 원칙"
            description="신뢰할 수 있는 큐레이션을 위해 다음 원칙을 지킵니다."
          />
          <ul className="space-y-2 rounded-lg border border-border bg-surface p-5">
            {principles.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-text-muted">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-sm font-semibold text-text">바로 시작하기</h2>
            <p className="mt-1 text-sm text-text-muted">홈 대시보드에서 오늘의 브리핑과 신규 등록을 확인하세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('portal')}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-ink bg-ink px-4 text-sm font-semibold text-ink-fg transition hover:opacity-90"
            >
              홈으로
            </button>
            <button
              type="button"
              onClick={() => onNavigate('models')}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-bg px-4 text-sm font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
            >
              모델 비교 보기
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
