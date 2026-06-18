import {
  Bell,
  Boxes,
  FileText,
  Image,
  LayoutGrid,
  MessageCircle,
  MessageSquareText,
  Radio,
  Search,
  Shield,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * DeskCloud 통합 디렉터리 — 모든 Desk SaaS 의 정적 카탈로그.
 *
 * 의도적으로 순수 데이터다(API 호출 없음). 각 Desk 는 독립 서비스지만, 이 포털은
 * 하나의 진입점에서 전체 패밀리를 소개하고 "한 줄 임베드" 스니펫을 제공한다.
 * 모든 Desk 는 동일한 @desk/platform 멀티테넌트 + 빌링 코어를 공유한다.
 */
export type DeskStatus = 'live'

export interface DeskEntry {
  /** 슬러그(라우팅·키). */
  id: string
  /** 표시 이름. */
  name: string
  /** 한 줄 태그라인. */
  tagline: string
  /** 무엇을 하는 서비스인지 1–2문장. */
  what: string
  /** 카드 아이콘. */
  icon: LucideIcon
  /** 강조 색 토큰(accent | info | success | warning). 카드 글리프 배경에만 사용. */
  tone: 'accent' | 'info' | 'success' | 'warning'
  /** 상태 배지. */
  status: DeskStatus
  /** 통합에 쓰는 SDK/위젯 전역 이름(예: SurveyDesk). */
  sdkGlobal: string
  /** 위젯 스크립트 경로(상대). */
  widgetSrc: string
  /** init() 에 넘기는 추가 옵션 라인(스니펫 표시용). 없으면 appId 만. */
  initExtra?: string
  /** 핵심 수집/제공 메트릭(태그). */
  metrics: string[]
  /** 플랫폼 코어 자신인지(별도 카드 스타일). */
  isCore?: boolean
}

/** 임베드 엔드포인트 — 빌드 타임 주입(VITE_API_BASE_URL), 없으면 데모 도메인. */
export function embedEndpoint(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'https://api.deskcloud.dev'
}

/** Desk 한 줄 임베드 스니펫(script 태그) — 모든 Desk 가 동일 패턴을 따른다. */
export function embedSnippet(desk: DeskEntry, appId = 'my-app'): string {
  const endpoint = embedEndpoint()
  const extra = desk.initExtra ? `, ${desk.initExtra}` : ''
  return `<script src="${endpoint}${desk.widgetSrc}" defer></script>
<script>
  ${desk.sdkGlobal}.init({ appId: '${appId}', endpoint: '${endpoint}'${extra} })
</script>`
}

/** REST 패턴 스니펫 — 위젯 없이 직접 호출하는 Desk(검색 등)용. */
export function restSnippet(path: string, appId = 'my-app'): string {
  return `curl ${embedEndpoint()}${path} \\
  -H 'Authorization: Bearer pk_…' \\
  -H 'X-Desk-App: ${appId}'`
}

export const DESK_CATALOG: readonly DeskEntry[] = [
  {
    id: 'platform',
    name: '@desk/platform',
    tagline: '멀티테넌트 + 빌링 코어',
    what: '모든 Desk 가 공유하는 계정·테넌트·플랜·사용량·결제 기반. 가입 한 번으로 전체 패밀리에 접근합니다.',
    icon: Boxes,
    tone: 'accent',
    status: 'live',
    sdkGlobal: 'DeskCloud',
    widgetSrc: '/platform.js',
    metrics: ['tenants', 'plans', 'usage', 'billing'],
    isCore: true,
  },
  {
    id: 'termsdesk',
    name: 'TermsDesk',
    tagline: '약관·동의 버전 관리',
    what: '약관/개인정보처리방침을 버전으로 관리하고, content_hash 불변·append-only 로 동의 이력을 남깁니다.',
    icon: FileText,
    tone: 'info',
    status: 'live',
    sdkGlobal: 'TermsDesk',
    widgetSrc: '/terms-widget.js',
    initExtra: "doc: 'privacy'",
    metrics: ['약관 버전', '동의 기록', 'audit log'],
  },
  {
    id: 'surveydesk',
    name: 'SurveyDesk',
    tagline: '임베드 설문·피드백',
    what: '별점·NPS·객관식·자유서술을 임베드 위젯으로 수집하고, 평균·NPS·분포로 집계합니다.',
    icon: MessageSquareText,
    tone: 'accent',
    status: 'live',
    sdkGlobal: 'SurveyDesk',
    widgetSrc: '/feedback-widget.js',
    metrics: ['응답', 'NPS', '별점', '분포'],
  },
  {
    id: 'changelogdesk',
    name: 'ChangelogDesk',
    tagline: '변경 로그·릴리스 노트',
    what: '제품 변경사항을 발행하고, 임베드 위젯으로 "What\'s new" 패널과 미확인 배지를 노출합니다.',
    icon: Sparkles,
    tone: 'info',
    status: 'live',
    sdkGlobal: 'ChangelogDesk',
    widgetSrc: '/changelog-widget.js',
    metrics: ['릴리스', '조회', '미확인 배지'],
  },
  {
    id: 'reviewdesk',
    name: 'ReviewDesk',
    tagline: '리뷰·평점 수집',
    what: '제품/콘텐츠 리뷰와 별점을 모으고, 평균·분포·하이라이트를 위젯과 대시보드로 보여 줍니다.',
    icon: Star,
    tone: 'warning',
    status: 'live',
    sdkGlobal: 'ReviewDesk',
    widgetSrc: '/review-widget.js',
    initExtra: "subject: 'product:123'",
    metrics: ['리뷰', '평점', '하이라이트'],
  },
  {
    id: 'mediadesk',
    name: 'MediaDesk',
    tagline: '업로드·이미지 변환',
    what: '파일 업로드·서명 URL·이미지 리사이즈/포맷 변환을 제공하는 미디어 파이프라인입니다.',
    icon: Image,
    tone: 'success',
    status: 'live',
    sdkGlobal: 'MediaDesk',
    widgetSrc: '/media-widget.js',
    metrics: ['업로드', '변환', 'storage'],
  },
  {
    id: 'notifydesk',
    name: 'NotifyDesk',
    tagline: '이메일·웹훅·인앱 알림',
    what: '멀티채널(이메일·웹훅·인앱) 알림을 템플릿으로 발송하고, 인앱 알림 센터 위젯을 임베드합니다.',
    icon: Bell,
    tone: 'accent',
    status: 'live',
    sdkGlobal: 'NotifyDesk',
    widgetSrc: '/notify-widget.js',
    metrics: ['발송', '채널', '인앱 센터'],
  },
  {
    id: 'moderationdesk',
    name: 'ModerationDesk',
    tagline: '콘텐츠 검수·신고',
    what: '텍스트/이미지 모더레이션 큐, 신고 처리, 규칙 기반 자동 분류를 제공합니다.',
    icon: Shield,
    tone: 'warning',
    status: 'live',
    sdkGlobal: 'ModerationDesk',
    widgetSrc: '/moderation-widget.js',
    metrics: ['검수 큐', '신고', '규칙'],
  },
  {
    id: 'realtimedesk',
    name: 'RealtimeDesk',
    tagline: '실시간 채널·프레즌스',
    what: 'WebSocket 채널·프레즌스·브로드캐스트를 한 줄로. 라이브 커서·온라인 상태에 바로 씁니다.',
    icon: Radio,
    tone: 'info',
    status: 'live',
    sdkGlobal: 'RealtimeDesk',
    widgetSrc: '/realtime.js',
    initExtra: "channel: 'room:lobby'",
    metrics: ['채널', '프레즌스', '메시지'],
  },
  {
    id: 'searchdesk',
    name: 'SearchDesk',
    tagline: '풀텍스트·즉시 검색',
    what: '문서를 색인하고 오타 보정·하이라이트가 포함된 즉시 검색(instant search) 박스를 임베드합니다.',
    icon: Search,
    tone: 'accent',
    status: 'live',
    sdkGlobal: 'SearchDesk',
    widgetSrc: '/search-widget.js',
    metrics: ['색인 문서', '쿼리', '클릭'],
  },
  {
    id: 'communitydesk',
    name: 'CommunityDesk',
    tagline: '게시판·카페·포럼',
    what: '게시판/카페형 커뮤니티(글·댓글·좋아요·카테고리)를 멀티테넌트로 운영합니다.',
    icon: Users,
    tone: 'success',
    status: 'live',
    sdkGlobal: 'CommunityDesk',
    widgetSrc: '/community-widget.js',
    metrics: ['글', '댓글', '멤버'],
  },
  {
    id: 'chatdesk',
    name: 'ChatDesk',
    tagline: '쪽지·1:1 채팅',
    what: '사용자 간 쪽지/1:1 채팅과 읽음 표시를 제공하는 임베드 메시징입니다.',
    icon: MessageCircle,
    tone: 'info',
    status: 'live',
    sdkGlobal: 'ChatDesk',
    widgetSrc: '/chat-widget.js',
    metrics: ['대화', '메시지', '읽음'],
  },
]

/** 코어를 제외한 "제품" Desk 들. */
export const PRODUCT_DESKS: readonly DeskEntry[] = DESK_CATALOG.filter((d) => !d.isCore)

/** 직접 디렉터리 아이콘(랜딩 등에서 작은 그리드용). */
export const DIRECTORY_ICON = LayoutGrid
