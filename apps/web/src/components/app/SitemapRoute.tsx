import { Home } from 'lucide-react'

import { routePath, type AppRoute } from '@/components/app/appRoutes'

type SitemapSection = {
  id: string
  route: AppRoute
  title: string
  description: string
  links: Array<{ href?: string; label: string; note: string }>
}

const sitemapSections: SitemapSection[] = [
  {
    id: 'portal',
    route: 'portal',
    title: '홈 대시보드',
    description: '오늘의 브리핑과 새로 등록된 정보를 먼저 확인하는 시작 화면입니다.',
    links: [
      { href: '#updates', label: '오늘의 브리핑', note: '최신 업데이트 + 핵심 영향' },
      { href: '#fresh', label: '따끈따끈 신규 등록', note: '신간·신규 영상·세미나 최신순' },
    ],
  },
  {
    id: 'models',
    route: 'models',
    title: '모델·벤치마크·비용',
    description: '제공사별 모델 스펙, 분야별 벤치마크, 비교표, 토큰 비용을 비교합니다.',
    links: [
      { href: '#comparison', label: '모델 카드', note: '제공사별 스펙·강점·주의점' },
      { href: '#benchmarks', label: '벤치마크', note: '분야별 점수·속도' },
      { href: '#costs', label: '비용', note: '토큰 단가·이벤트 비용' },
    ],
  },
  {
    id: 'tools',
    route: 'tools',
    title: 'AI 도구·확장',
    description: '작업 추천, IDE·CLI 도구, 플러그인·훅·스킬·MCP 확장 디렉터리입니다.',
    links: [
      { href: '#task-recommendations', label: '작업별 추천', note: '코딩·PPT·리서치·비용' },
      { href: '#ai-tools', label: 'AI 코딩 도구', note: 'IDE·CLI·PR 리뷰·에이전트' },
      { href: '#extensions', label: '확장 디렉터리', note: '플러그인·훅·스킬·MCP·워크플로우' },
      { href: '#cli-manual', label: 'CLI 비교·매뉴얼', note: '설치·실행·적합도 비교' },
      { href: '#vibe-coding', label: 'CLI 명령어', note: 'CLI/API/IDE 실행형 비교' },
      { href: '#cli-comparison', label: 'CLI 비교표', note: '표면·강점·주의점 비교' },
      { href: '#design', label: '디자인 워크플로', note: '프롬프트·산출물 제작 흐름' },
    ],
  },
  {
    id: 'deals',
    route: 'deals',
    title: 'LLM 할인·혜택',
    description: '학생/교육, 무료 크레딧, 가격 인하, 국내 혜택과 일정/이벤트를 추적합니다.',
    links: [
      { href: '#deals', label: '할인·혜택', note: '학생·크레딧·가격 인하·국내 우선' },
      { href: '#events', label: '일정/이벤트', note: '해커톤·컨퍼런스·웨비나' },
    ],
  },
  {
    id: 'resources',
    route: 'resources',
    title: '강좌·자료·출처',
    description: '한국어 강좌, 도서, 블로그, 사용법, 직군별 플레이북, 출처를 탐색합니다.',
    links: [
      { href: '#learning', label: '강좌/자료', note: '언어·형식·난이도·태그 필터' },
      { href: '#glossary', label: 'AI/LLM 용어 사전', note: '카테고리별 용어 검색' },
      { href: '#manuals', label: '사용법', note: '입문·실무·고급 가이드' },
      { href: '#webzine', label: '뉴스 웹진', note: '한국어 커뮤니티·강좌형 콘텐츠' },
      { href: '#translated', label: '해외 소식(번역)', note: '큐레이션 번역·요약' },
      { href: '#sources', label: '출처', note: '공식·벤치마크·출판·커뮤니티' },
    ],
  },
  {
    id: 'about',
    route: 'about',
    title: '소개·사용 가이드',
    description: 'AIDigestDesk가 어떤 곳인지, 어떻게 쓰는지 4단계로 안내합니다.',
    links: [{ label: '소개·가이드 열기', note: '검색→필터→비교→출처 검증' }],
  },
  {
    id: 'community',
    route: 'community',
    title: '커뮤니티',
    description: '채팅방·게시판·카페로 모델·할인·도움 요청을 나눕니다. (베타 · 브라우저 로컬 저장)',
    links: [{ label: '커뮤니티 열기', note: '토론 채팅방·게시판·카페' }],
  },
  {
    id: 'account',
    route: 'account',
    title: '내 계정',
    description:
      '회원가입, 로그인, 프로필, 회원 탈퇴를 관리합니다. 계정은 브라우저에만 저장됩니다.',
    links: [{ label: '로그인 / 회원가입', note: '데모 인증 · localStorage' }],
  },
  {
    id: 'support',
    route: 'support',
    title: '문의',
    description: '제휴·버그·의견·이용 문의를 남기고 공개 게시판에서 확인하는 내부 문의 창구입니다.',
    links: [{ label: '문의 남기기', note: '제휴 · 버그 · 의견 · 이용' }],
  },
  {
    id: 'terms',
    route: 'terms',
    title: '약관·정책',
    description: '이용약관과 개인정보처리방침을 내부 페이지로 제공합니다.',
    links: [{ label: '약관·정책 열기', note: '이용약관 · 개인정보처리방침' }],
  },
  {
    id: 'design',
    route: 'design',
    title: '디자인 시스템',
    description:
      '컬러 토큰, 타이포그래피, 컴포넌트, 상태를 코드와 동기화해 보여주는 리빙 스타일가이드입니다.',
    links: [{ label: '디자인 시스템 열기', note: '토큰 · 컴포넌트 · 상태' }],
  },
]

export function SitemapRoute({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const jumpTo = (route: AppRoute, href?: string) => {
    onNavigate(route)
    if (href && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${routePath[route]}${href}`)
      window.dispatchEvent(new Event('hashchange'))
    }
    if (!href) return
    setTimeout(() => {
      const targetId = href.startsWith('#') ? href.slice(1) : href
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  return (
    <main id="main-content" tabIndex={-1} className="px-4 py-5 outline-none lg:px-6">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-accent">사이트맵 · /sitemap</p>
              <h1 className="mt-1 text-2xl font-semibold text-text">AI Digest Desk 전체 지도</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
                모든 페이지와 주요 섹션으로 한 번에 이동할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('portal')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              <Home className="size-3.5" aria-hidden />
              포털 열기
            </button>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sitemapSections.map((section) => (
            <article key={section.id} className="rounded-lg border border-border bg-surface p-5">
              <button
                type="button"
                onClick={() => jumpTo(section.route)}
                className="text-left text-sm font-semibold text-text transition hover:text-accent"
              >
                {section.title}
              </button>
              <p className="mt-2 text-xs leading-5 text-text-muted">{section.description}</p>
              <div className="mt-4 space-y-2">
                {section.links.map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => jumpTo(section.route, link.href)}
                    className="w-full rounded-md border border-border bg-bg p-3 text-left transition hover:border-border-strong"
                  >
                    <p className="text-sm font-semibold text-text">{link.label}</p>
                    <p className="mt-1 text-xs text-text-subtle">{link.note}</p>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
