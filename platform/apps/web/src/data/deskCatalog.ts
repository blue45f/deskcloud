import {
  Bell,
  Boxes,
  FileText,
  Fingerprint,
  Image,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Radio,
  Search,
  Shield,
  Sparkles,
  Star,
  UploadCloud,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * DeskCloud 통합 디렉터리 — 모든 Desk SaaS 의 정적 카탈로그.
 *
 * 의도적으로 순수 데이터다(API 호출 없음). 각 Desk 는 독립 서비스지만, 이 포털은
 * 하나의 진입점에서 전체 패밀리를 소개하고 **공식 SDK 스니펫**을 제공한다.
 *
 * 통합 방식은 단일 npm 패키지 `@heejun/deskcloud` 다(Stripe/Supabase 모델):
 * 브라우저 우선 `pk_` 클라이언트(`createXClient`)는 메인 엔트리에서, 서버 전용 `sk_`
 * 어드민 클라이언트(`createXAdminClient`)는 `/server` 서브패스에서 가져온다. 의존성
 * 0(zero-dep, fetch 기반)·트리셰이커블·자체 타입. 앱은 위젯 임베드가 아니라 자기
 * 컴포넌트/디자인 토큰으로 **네이티브 렌더**한다.
 */
export type DeskStatus = 'live'

/** 공식 SDK npm 패키지 이름(설치 한 번으로 전체 패밀리). */
export const SDK_PACKAGE = '@heejun/deskcloud'

/** SDK 서버(sk_) 어드민 클라이언트가 사는 서브패스 import. */
export const SDK_SERVER_IMPORT = `${SDK_PACKAGE}/server`

/** 지원하는 패키지 매니저와 설치 명령 빌더. */
export interface PackageManager {
  id: 'npm' | 'pnpm' | 'yarn' | 'bun'
  label: string
  /** 패키지 이름을 받아 설치 명령 문자열을 만든다. */
  install: (pkg: string) => string
}

export const PACKAGE_MANAGERS: readonly PackageManager[] = [
  { id: 'npm', label: 'npm', install: (pkg) => `npm install ${pkg}` },
  { id: 'pnpm', label: 'pnpm', install: (pkg) => `pnpm add ${pkg}` },
  { id: 'yarn', label: 'yarn', install: (pkg) => `yarn add ${pkg}` },
  { id: 'bun', label: 'bun', install: (pkg) => `bun add ${pkg}` },
]

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
  /**
   * 브라우저(pk_) 클라이언트 팩토리 이름 — 예: 'createSurveyClient'.
   * 서버(sk_) 어드민 팩토리는 'Client' → 'AdminClient' 로 파생된다.
   * 코어(@desk/platform)는 per-Desk 클라이언트가 없어 생략한다.
   */
  sdkFactory?: string
  /** 스니펫에서 클라이언트를 담는 변수 이름 — 예: 'survey'. */
  sdkVar?: string
  /** 클라이언트 생성 뒤 이어지는 대표 호출 예시(스니펫 표시용). */
  sdkUsage?: string
  /** 핵심 수집/제공 메트릭(태그). */
  metrics: string[]
  /** 플랫폼 코어 자신인지(별도 카드 스타일). */
  isCore?: boolean
}

/** 통합 엔드포인트 — 빌드 타임 주입(VITE_API_BASE_URL), 없으면 데모 도메인. */
export function apiEndpoint(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'https://api.deskcloud.dev'
}

/** 브라우저(pk_) 팩토리 → 서버(sk_) 어드민 팩토리 이름. createXClient → createXAdminClient. */
export function adminFactory(sdkFactory: string): string {
  return sdkFactory.replace(/Client$/, 'AdminClient')
}

/**
 * Desk 의 공식 SDK 스니펫(import → 클라이언트 생성 → 대표 호출).
 * 모든 Desk 가 동일한 `createXClient({ endpoint, publishableKey })` 패턴을 따른다.
 * 설치 명령(npm/pnpm/yarn/bun)은 페이지 상단의 공유 InstallTabs 가 담당한다.
 */
export function sdkSnippet(desk: DeskEntry): string {
  if (!desk.sdkFactory || !desk.sdkVar) return restSnippet('/api/billing/plans')
  const endpoint = apiEndpoint()
  const usage = desk.sdkUsage ? `\n\n${desk.sdkUsage}` : ''
  return `import { ${desk.sdkFactory} } from '${SDK_PACKAGE}'

const ${desk.sdkVar} = ${desk.sdkFactory}({
  endpoint: '${endpoint}',
  publishableKey: 'pk_…',
})${usage}`
}

/**
 * REST 패턴 스니펫 — SDK 없이 직접 호출하거나 공개 엔드포인트를 보여줄 때.
 * 공개 키(pk_)는 SDK 와 동일하게 `x-pk` 헤더로 보낸다(Desk 가드가 읽는 방식).
 * 공개 엔드포인트(/api/billing/plans 등)는 키 없이도 동작한다.
 */
export function restSnippet(path: string): string {
  return `curl '${apiEndpoint()}${path}' \\
  -H 'x-pk: pk_…'`
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
    metrics: ['tenants', 'plans', 'usage', 'billing'],
    isCore: true,
  },
  {
    id: 'termsdesk',
    name: 'TermsDesk',
    tagline: '약관·동의·의뢰 중계',
    what: '약관/개인정보처리방침의 불변 버전과 동의 영수증을 관리하고, 전문가 의뢰 중계·검수·첨부·실시간 알림까지 한 흐름에서 처리합니다.',
    icon: FileText,
    tone: 'info',
    status: 'live',
    sdkFactory: 'createTermsClient',
    sdkVar: 'terms',
    sdkUsage: "const policy = await terms.getCurrent({ slug: 'privacy' })",
    metrics: ['약관 버전', '동의 기록', '의뢰 중계', '실시간 알림'],
  },
  {
    id: 'surveydesk',
    name: 'SurveyDesk',
    tagline: '설문·피드백 수집',
    what: '별점·NPS·객관식·자유서술을 SDK 로 수집하고, 평균·NPS·분포로 집계합니다.',
    icon: MessageSquareText,
    tone: 'accent',
    status: 'live',
    sdkFactory: 'createSurveyClient',
    sdkVar: 'survey',
    sdkUsage: "const active = await survey.getActive('my-app')",
    metrics: ['응답', 'NPS', '별점', '분포'],
  },
  {
    id: 'changelogdesk',
    name: 'ChangelogDesk',
    tagline: '변경 로그·릴리스 노트',
    what: '제품 변경사항을 발행하고, "What\'s new" 패널과 미확인 배지를 네이티브로 렌더합니다.',
    icon: Sparkles,
    tone: 'info',
    status: 'live',
    sdkFactory: 'createChangelogClient',
    sdkVar: 'changelog',
    sdkUsage: 'const wall = await changelog.getWall({ limit: 20 })',
    metrics: ['릴리스', '조회', '미확인 배지'],
  },
  {
    id: 'reviewdesk',
    name: 'ReviewDesk',
    tagline: '리뷰·평점 수집',
    what: '제품/콘텐츠 리뷰와 별점을 모으고, 평균·분포·하이라이트를 SDK 와 대시보드로 보여 줍니다.',
    icon: Star,
    tone: 'warning',
    status: 'live',
    sdkFactory: 'createReviewClient',
    sdkVar: 'reviews',
    sdkUsage: "const { items } = await reviews.list({ subjectId: 'pro-plan', limit: 20 })",
    metrics: ['리뷰', '평점', '하이라이트'],
  },
  {
    id: 'mediadesk',
    name: 'MediaDesk',
    tagline: '이미지·미디어 변환 CDN',
    what: '이미지 리사이즈·포맷 변환(WebP/AVIF)과 서명 URL 전송에 특화된 미디어 파이프라인입니다.',
    icon: Image,
    tone: 'success',
    status: 'live',
    sdkFactory: 'createMediaClient',
    sdkVar: 'media',
    sdkUsage: "const asset = await media.upload({ file, folder: 'avatars' })",
    metrics: ['리사이즈', '포맷 변환', '전송'],
  },
  {
    id: 'notifydesk',
    name: 'NotifyDesk',
    tagline: '이메일·웹훅·인앱 알림',
    what: '멀티채널(이메일·웹훅·인앱) 알림을 템플릿으로 발송하고, 인앱 알림 센터를 네이티브로 렌더합니다.',
    icon: Bell,
    tone: 'accent',
    status: 'live',
    sdkFactory: 'createNotifyClient',
    sdkVar: 'notify',
    sdkUsage: "const inbox = await notify.getInbox({ recipientId: 'user_42', limit: 20 })",
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
    sdkFactory: 'createModerationClient',
    sdkVar: 'moderation',
    sdkUsage: 'const { verdict } = await moderation.check({ text: comment })',
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
    sdkFactory: 'createRealtimeClient',
    sdkVar: 'rt',
    sdkUsage: "const conn = await rt.connect()\nawait conn.subscribe('room:42')",
    metrics: ['채널', '프레즌스', '메시지'],
  },
  {
    id: 'searchdesk',
    name: 'SearchDesk',
    tagline: '풀텍스트·즉시 검색',
    what: '문서를 색인하고 오타 보정·하이라이트가 포함된 즉시 검색(instant search)을 SDK 로 붙입니다.',
    icon: Search,
    tone: 'accent',
    status: 'live',
    sdkFactory: 'createSearchClient',
    sdkVar: 'search',
    sdkUsage: "const res = await search.search({ q: 'invoice', limit: 10 })",
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
    sdkFactory: 'createCommunityClient',
    sdkVar: 'community',
    sdkUsage: "const { items } = await community.listPosts({ boardSlug: 'notice', limit: 20 })",
    metrics: ['글', '댓글', '멤버'],
  },
  {
    id: 'chatdesk',
    name: 'ChatDesk',
    tagline: '쪽지·1:1 채팅',
    what: '사용자 간 쪽지/1:1 채팅과 읽음 표시를 SDK 로 제공하는 메시징입니다.',
    icon: MessageCircle,
    tone: 'info',
    status: 'live',
    sdkFactory: 'createChatClient',
    sdkVar: 'chat',
    sdkUsage:
      "const convo = await chat.createConversation({ kind: 'dm', memberIds: ['u1', 'u2'] })",
    metrics: ['대화', '메시지', '읽음'],
  },
  {
    id: 'addesk',
    name: 'AdDesk',
    tagline: '배너·광고 송출',
    what: '슬롯 단위로 가중치 기반 배너/광고를 송출하고, 노출·클릭을 추적하는 인하우스 광고 플랫폼입니다.',
    icon: Megaphone,
    tone: 'warning',
    status: 'live',
    sdkFactory: 'createAdClient',
    sdkVar: 'ads',
    sdkUsage: "const ad = await ads.serve({ slot: 'sidebar' })",
    metrics: ['슬롯', '노출', '클릭'],
  },
  {
    id: 'authdesk',
    name: 'AuthDesk',
    tagline: '로그인·회원 인증',
    what: '이메일/비밀번호 회원가입·로그인·세션(JWT)을 멀티테넌트로 제공하는 드롭인 인증입니다.',
    icon: Fingerprint,
    tone: 'info',
    status: 'live',
    sdkFactory: 'createAuthClient',
    sdkVar: 'auth',
    sdkUsage: 'const { user, token } = await auth.login({ email, password })',
    metrics: ['회원', '세션', 'JWT'],
  },
  {
    id: 'filedesk',
    name: 'FileDesk',
    tagline: 'S3형 파일 스토리지',
    what: '범용 파일 스토리지 — 공개/비공개 가시성과 서명 URL 다운로드로 접근을 제어합니다.',
    icon: UploadCloud,
    tone: 'success',
    status: 'live',
    sdkFactory: 'createFileClient',
    sdkVar: 'files',
    sdkUsage:
      "const res = await files.upload({ filename: 'a.png', contentType: 'image/png', dataBase64 })",
    metrics: ['스토리지', '가시성', '서명 URL'],
  },
]

/** 코어를 제외한 "제품" Desk 들. */
export const PRODUCT_DESKS: readonly DeskEntry[] = DESK_CATALOG.filter((d) => !d.isCore)

/** 직접 디렉터리 아이콘(랜딩 등에서 작은 그리드용). */
export const DIRECTORY_ICON = LayoutGrid
