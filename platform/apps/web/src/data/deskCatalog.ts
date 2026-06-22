import { workspaceDeskManifestById, type Plan, type UsageMetric } from '@desk/shared/browser'
import {
  Bell,
  Boxes,
  Bug,
  FileText,
  Fingerprint,
  Globe2,
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

const deskcloudPublicUrlFromEnv = (import.meta.env.VITE_DESKCLOUD_PUBLIC_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, '')

export const DESKCLOUD_PUBLIC_URL =
  deskcloudPublicUrlFromEnv && deskcloudPublicUrlFromEnv.length > 0
    ? deskcloudPublicUrlFromEnv
    : 'https://desk-platform.vercel.app'

/** TermsDesk 공개 진입 경로. EC2/nip.io origin은 Vercel rewrite 뒤 백엔드 경계로만 숨긴다. */
const termsdeskPublicUrlFromEnv = (import.meta.env.VITE_TERMSDESK_PUBLIC_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, '')

export const TERMSDESK_PUBLIC_URL =
  termsdeskPublicUrlFromEnv && termsdeskPublicUrlFromEnv.length > 0
    ? termsdeskPublicUrlFromEnv
    : `${DESKCLOUD_PUBLIC_URL}/termsdesk`

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

export const USAGE_METRIC_LABEL: Record<UsageMetric, string> = {
  api_calls: 'API 호출',
  events: '이벤트',
  storage_mb: '저장량',
  seats: '좌석',
}

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
  /**
   * DeskCloud SDK에 네이티브로 포함된 Desk인지, 모노레포 workspace에 흡수된 별도 런타임인지,
   * 별도 저장소/배포를 운영 콘솔에 연결한 Desk인지.
   * 생략하면 native로 간주한다.
   */
  integrationMode?: 'native' | 'workspace' | 'linked'
  /** workspace/linked Desk가 자체 SDK/패키지를 유지할 때 표시할 패키지 이름. */
  integrationPackage?: string
  /** workspace에 흡수된 소스 경로. */
  workspacePath?: string
  /** workspace/linked Desk의 현재 운영 URL. */
  liveUrl?: string
  /** linked Desk의 원격 저장소. */
  sourceRepositoryUrl?: string
}

export interface DeskOperations {
  /** 중앙 콘솔에서 해당 Desk 운영 표면으로 진입하는 경로. */
  adminPath: string
  /** 배포 게이트웨이 기준 REST/WS 베이스 경로. */
  gatewayPath: string
  /** 요금/한도 설명에서 우선 노출할 메트릭. */
  primaryMetric: UsageMetric
  /** 과금/한도 기준을 사람이 읽는 문장으로 표현. */
  billingDriver: string
  /** 실무자가 반드시 맞춰야 하는 구성값. */
  config: readonly string[]
  /** 운영자가 콘솔에서 반복적으로 수행하는 주요 작업. */
  operatorTasks: readonly string[]
  /** self-serve 고객에게 권장하는 시작 플랜. */
  recommendedPlan: Plan
}

export type ReadinessStatus = 'ready' | 'needs_config' | 'watch'

export interface DeskReadinessItem {
  label: string
  description: string
  status: ReadinessStatus
}

export interface DeskReadiness {
  /** 통합 운영 판단을 위한 한 줄 요약. */
  summary: string
  /** DeskCloud가 중앙에서 책임지는 운영 경계. */
  controlPlane: string
  /** 각 Desk 런타임이 유지하는 실행 경계. */
  dataPlane: string
  /** 운영 배포 전 확인할 체크 항목. */
  checks: readonly DeskReadinessItem[]
}

export interface DeskDataObject {
  name: string
  description: string
}

export interface DeskGuideItem {
  title: string
  description: string
}

export interface DeskDetails {
  /** 제품 담당자/운영자가 읽는 긴 설명. */
  summary: string
  /** 이 Desk를 붙이면 좋은 대표 업무/제품 상황. */
  bestFor: readonly string[]
  /** 운영 콘솔에서 관리하거나 감사해야 하는 주요 데이터 객체. */
  dataModel: readonly DeskDataObject[]
  /** 운영자가 반복적으로 수행하는 관리 절차. */
  adminGuide: readonly DeskGuideItem[]
  /** 개발자가 서비스 도메인에 붙일 때의 순서. */
  integrationGuide: readonly string[]
  /** 가입회사/서비스 도메인별 격리 관점의 설명. */
  domainIsolation: string
}

/** 포털 안에서 각 제품 Desk 를 소개하는 마이크로사이트 경로. */
export function deskMicrositePath(desk: Pick<DeskEntry, 'id' | 'isCore'>): string {
  return desk.isCore ? '/docs' : `/desks/${desk.id}`
}

const OPS_BASE: Omit<DeskOperations, 'adminPath'> = {
  gatewayPath: '/api',
  primaryMetric: 'api_calls',
  billingDriver: 'API 호출과 이벤트를 테넌트 월간 사용량으로 합산합니다.',
  config: ['publishable key', 'secret key', 'CORS allowlist'],
  operatorTasks: ['테넌트 키 발급', '사용량 확인', '플랜 변경'],
  recommendedPlan: 'pro',
}

function ops(id: string, value: Partial<Omit<DeskOperations, 'adminPath'>>): DeskOperations {
  return {
    ...OPS_BASE,
    ...value,
    adminPath: `/dashboard?desk=${id}`,
  }
}

function requiredWorkspaceManifest(id: string) {
  const manifest = workspaceDeskManifestById(id)
  if (!manifest) throw new Error(`Missing workspace Desk manifest for ${id}`)
  return manifest
}

const SEO_GATEWAY_WORKSPACE = requiredWorkspaceManifest('seo-gateway')
const REMOTE_DEVTOOLS_WORKSPACE = requiredWorkspaceManifest('remote-devtools')

export const DESK_OPERATIONS: Readonly<Record<string, DeskOperations>> = {
  termsdesk: ops('termsdesk', {
    gatewayPath: '/terms',
    primaryMetric: 'events',
    billingDriver: '정책 조회, 동의 영수증, 전문가 의뢰 흐름을 이벤트로 집계합니다.',
    config: ['policy slugs', 'consent retention', 'expert routing', 'notification channels'],
    operatorTasks: ['정책 버전 게시', '동의 영수증 감사', '전문가 의뢰 트리아지'],
  }),
  surveydesk: ops('surveydesk', {
    gatewayPath: '/survey',
    primaryMetric: 'events',
    billingDriver: '응답 제출, NPS, 별점, 자유서술 수집량을 이벤트로 집계합니다.',
    config: ['appId', 'active survey', 'question schema', 'origin allowlist'],
    operatorTasks: ['설문 공개/비공개', '응답 CSV 내보내기', 'NPS/별점 분포 확인'],
  }),
  changelogdesk: ops('changelogdesk', {
    gatewayPath: '/changelog',
    primaryMetric: 'api_calls',
    billingDriver: '변경 로그 조회, 미확인 배지 계산, 게시 API 호출을 합산합니다.',
    config: ['release channels', 'audience rules', 'widget placement'],
    operatorTasks: ['릴리스 노트 게시', '채널별 노출 확인', '미확인 배지 점검'],
  }),
  reviewdesk: ops('reviewdesk', {
    gatewayPath: '/review',
    primaryMetric: 'events',
    billingDriver: '리뷰 작성, 평점 제출, 하이라이트 집계를 이벤트로 계산합니다.',
    config: ['subject IDs', 'moderation rules', 'display policy'],
    operatorTasks: ['리뷰 승인/숨김', '평점 분포 확인', '후기 하이라이트 선정'],
  }),
  mediadesk: ops('mediadesk', {
    gatewayPath: '/media',
    primaryMetric: 'storage_mb',
    billingDriver: '원본 업로드, 변환 파생본, 공개 자산 저장량을 기준으로 합니다.',
    config: ['storage visibility', 'transform presets', 'signed URL policy'],
    operatorTasks: ['자산 정리', '변환 캐시 점검', '공개/비공개 정책 변경'],
    recommendedPlan: 'scale',
  }),
  notifydesk: ops('notifydesk', {
    gatewayPath: '/notify',
    primaryMetric: 'events',
    billingDriver: '이메일, 웹훅, 인앱 알림 발송 건수를 이벤트로 집계합니다.',
    config: ['templates', 'recipient keys', 'channel fallback', 'webhook retries'],
    operatorTasks: ['템플릿 발행', '발송 실패 재시도', '인앱 인박스 상태 확인'],
  }),
  moderationdesk: ops('moderationdesk', {
    gatewayPath: '/moderation',
    primaryMetric: 'api_calls',
    billingDriver: '텍스트/이미지 검사, 신고 접수, 규칙 매칭 API 호출을 합산합니다.',
    config: ['blocked terms', 'report categories', 'auto action rules'],
    operatorTasks: ['신고 큐 처리', '규칙 업데이트', '자동 조치 로그 감사'],
  }),
  realtimedesk: ops('realtimedesk', {
    gatewayPath: '/realtime',
    primaryMetric: 'api_calls',
    billingDriver: '채널 연결, presence, broadcast, REST 호출을 월간 사용량으로 합산합니다.',
    config: ['channel namespace', 'presence TTL', 'socket.io path'],
    operatorTasks: ['채널 상태 점검', '온라인 사용자 확인', 'WS 장애 확인'],
    recommendedPlan: 'scale',
  }),
  searchdesk: ops('searchdesk', {
    gatewayPath: '/search',
    primaryMetric: 'api_calls',
    billingDriver: '문서 색인, 검색 쿼리, 클릭/하이라이트 조회 호출을 합산합니다.',
    config: ['index schema', 'ranking weights', 'facet fields', 'reindex policy'],
    operatorTasks: ['문서 재색인', '쿼리 로그 분석', '랭킹/패싯 조정'],
    recommendedPlan: 'scale',
  }),
  communitydesk: ops('communitydesk', {
    gatewayPath: '/community',
    primaryMetric: 'events',
    billingDriver: '게시글, 댓글, 반응, 신고 이벤트를 테넌트별로 집계합니다.',
    config: ['board slugs', 'member mapping', 'category policy', 'reaction rules'],
    operatorTasks: ['게시글 고정/숨김', '댓글 검수', '카테고리 운영'],
  }),
  chatdesk: ops('chatdesk', {
    gatewayPath: '/chat',
    primaryMetric: 'events',
    billingDriver: '대화 생성, 메시지 전송, 읽음 처리 이벤트를 합산합니다.',
    config: ['conversation kind', 'member IDs', 'socket.io path', 'retention policy'],
    operatorTasks: ['대화 상태 확인', '시스템 메시지 발송', '읽음/전송 실패 점검'],
    recommendedPlan: 'scale',
  }),
  addesk: ops('addesk', {
    gatewayPath: '/ad',
    primaryMetric: 'events',
    billingDriver: '광고 노출, 클릭, 슬롯 서빙 이벤트를 기준으로 합니다.',
    config: ['slot IDs', 'campaign weights', 'creative assets', 'frequency caps'],
    operatorTasks: ['캠페인 활성화', 'CTR 확인', '크리에이티브 교체'],
  }),
  authdesk: ops('authdesk', {
    gatewayPath: '/authdesk',
    primaryMetric: 'api_calls',
    billingDriver: '가입, 로그인, 세션 검증, JWT 갱신 호출을 합산합니다.',
    config: ['session TTL', 'password policy', 'allowed origins', 'JWT audience'],
    operatorTasks: ['사용자 상태 확인', '세션 정책 변경', '로그인 실패 분석'],
  }),
  filedesk: ops('filedesk', {
    gatewayPath: '/file',
    primaryMetric: 'storage_mb',
    billingDriver: '파일 업로드 저장량, 다운로드 서명 URL, 공개/비공개 파일 수를 함께 봅니다.',
    config: ['bucket visibility', 'max file size', 'signed URL TTL', 'retention policy'],
    operatorTasks: ['파일 삭제/복구', '서명 URL 점검', '스토리지 사용량 관리'],
    recommendedPlan: 'scale',
  }),
  'seo-gateway': ops('seo-gateway', {
    gatewayPath: SEO_GATEWAY_WORKSPACE.gatewayPath,
    primaryMetric: SEO_GATEWAY_WORKSPACE.primaryMetric,
    billingDriver:
      '봇 렌더, 캐시 hit/miss, 워밍, Lighthouse/VisualDiff 실행을 렌더 이벤트로 집계합니다.',
    config: ['origin URL', 'route rules', 'cache TTL/SWR', 'bot detection', 'admin token'],
    operatorTasks: ['렌더 라우트 관리', '캐시/워밍 점검', 'SEO 품질 게이트 확인'],
    recommendedPlan: SEO_GATEWAY_WORKSPACE.recommendedPlan,
  }),
  'remote-devtools': ops('remote-devtools', {
    gatewayPath: REMOTE_DEVTOOLS_WORKSPACE.gatewayPath,
    primaryMetric: REMOTE_DEVTOOLS_WORKSPACE.primaryMetric,
    billingDriver:
      '라이브 연결, 녹화 세션, 리플레이 조회, Jira/Slack/Sheets 연동 이벤트를 테넌트 사용량으로 합산합니다.',
    config: [
      'SDK script origin',
      'internal admin origin',
      'DeskCloud WS gateway',
      'PostgreSQL',
      'S3 backup',
    ],
    operatorTasks: ['녹화/라이브 세션 점검', 'SDK 허용 도메인 관리', 'Jira/Slack/Sheets 연동 확인'],
    recommendedPlan: REMOTE_DEVTOOLS_WORKSPACE.recommendedPlan,
  }),
}

export function deskOperations(desk: Pick<DeskEntry, 'id'>): DeskOperations {
  return DESK_OPERATIONS[desk.id] ?? ops(desk.id, {})
}

const READINESS_BASE: DeskReadiness = {
  summary:
    'DeskCloud 콘솔에서 가입회사, 서비스 도메인, 키, 사용량, 플랜을 통합 관리합니다. 실제 배포 전 서비스 origin과 서버 secret key 보관 경계를 확인하면 같은 테넌트 아래에서 안전하게 운영할 수 있습니다.',
  controlPlane: 'DeskCloud tenant, service origin allowlist, key rotation, usage, billing',
  dataPlane: 'DeskCloud API gateway and browser/server SDK runtime',
  checks: [
    {
      label: '서비스 도메인 등록',
      description: '운영 배포 전에 실제 제품 origin을 CORS allowlist에 등록합니다.',
      status: 'needs_config',
    },
    {
      label: 'pk/sk 키 경계',
      description: 'pk_ 키는 브라우저에만, sk_ 키는 서버/BFF 환경변수에만 배치합니다.',
      status: 'ready',
    },
    {
      label: '사용량 메트릭 확인',
      description: 'Desk별 primary metric이 월간 테넌트 사용량에 합산되는지 확인합니다.',
      status: 'watch',
    },
  ],
}

function readiness(value: Partial<DeskReadiness>): DeskReadiness {
  return {
    ...READINESS_BASE,
    ...value,
    checks: value.checks ?? READINESS_BASE.checks,
  }
}

export const DESK_READINESS: Readonly<Record<string, DeskReadiness>> = {
  'seo-gateway': readiness({
    summary: SEO_GATEWAY_WORKSPACE.readinessSummary,
    controlPlane: SEO_GATEWAY_WORKSPACE.controlPlane,
    dataPlane: SEO_GATEWAY_WORKSPACE.dataPlane,
    checks: [
      {
        label: '원본 SPA origin',
        description:
          '프리렌더링할 SPA origin을 서비스 도메인 allowlist와 Site 설정에 함께 등록합니다.',
        status: 'needs_config',
      },
      {
        label: '통합 gateway route',
        description:
          '봇 트래픽은 DeskCloud /seo-gateway 경계로 보내고 일반 사용자는 원본 SPA로 통과시킵니다.',
        status: 'ready',
      },
      {
        label: '캐시/품질 게이트',
        description: 'TTL, SWR, 워밍, Lighthouse, VisualDiff 결과를 배포 전 확인합니다.',
        status: 'watch',
      },
      {
        label: 'admin token 분리',
        description: 'Fastify admin UI 토큰은 sk_ 키처럼 서버 환경변수에만 보관합니다.',
        status: 'needs_config',
      },
    ],
  }),
  'remote-devtools': readiness({
    summary: REMOTE_DEVTOOLS_WORKSPACE.readinessSummary,
    controlPlane: REMOTE_DEVTOOLS_WORKSPACE.controlPlane,
    dataPlane: REMOTE_DEVTOOLS_WORKSPACE.dataPlane,
    checks: [
      {
        label: 'SDK origin allowlist',
        description:
          '디버깅 SDK를 삽입할 고객 서비스 origin만 DeskCloud 서비스 도메인으로 허용합니다.',
        status: 'needs_config',
      },
      {
        label: '통합 WS gateway',
        description:
          'SDK 스크립트와 WebSocket 연결은 DeskCloud /remote-devtools 경계를 사용합니다.',
        status: 'ready',
      },
      {
        label: 'org/origin namespace',
        description:
          '세션, CDP 이벤트, 리플레이 산출물이 조직 또는 origin 네임스페이스로 분리되는지 봅니다.',
        status: 'watch',
      },
      {
        label: '외부 연동 secret',
        description: 'Jira, Slack, Sheets, S3 credential은 테넌트별 secret 경계로 분리합니다.',
        status: 'needs_config',
      },
    ],
  }),
}

export function deskReadiness(desk: Pick<DeskEntry, 'id'>): DeskReadiness {
  return DESK_READINESS[desk.id] ?? READINESS_BASE
}

const DETAILS_BASE: DeskDetails = {
  summary:
    'DeskCloud의 모든 Desk는 가입회사 테넌트 단위로 키, 도메인 allowlist, 사용량, 플랜을 공유합니다. 서비스 도메인이 다르더라도 같은 콘솔에서 관리하고, 각 Desk는 자기 도메인 데이터만 분리해 운영합니다.',
  bestFor: [
    '단일 테넌트의 여러 서비스 도메인 운영',
    '공통 키/빌링/사용량 관리',
    'Desk별 기능을 점진적으로 도입',
  ],
  dataModel: [
    {
      name: 'Tenant',
      description: '가입회사 단위의 계정, 플랜, publishable key, secret key 해시입니다.',
    },
    {
      name: 'Service origin',
      description: '서비스 도메인별 CORS allowlist입니다. 브라우저 SDK 호출 범위를 제한합니다.',
    },
    {
      name: 'Usage counter',
      description: '월간 API 호출, 이벤트, 저장량, 좌석 사용량을 테넌트 단위로 합산합니다.',
    },
  ],
  adminGuide: [
    {
      title: '서비스 도메인 등록',
      description:
        '운영 콘솔 설정에서 실제 서비스를 제공하는 origin을 등록해 브라우저 SDK 호출을 제한합니다.',
    },
    {
      title: '키 분리 원칙 확인',
      description:
        'pk_ 키는 브라우저에 배포하고 sk_ 키는 서버/BFF에만 저장합니다. 분실 시 콘솔에서 즉시 회전합니다.',
    },
    {
      title: '사용량과 플랜 점검',
      description:
        'Desk별 primary metric을 확인하고 트래픽이 큰 도메인은 Pro/Scale 한도에 맞게 조정합니다.',
    },
  ],
  integrationGuide: [
    '운영 콘솔에서 가입회사 테넌트를 만들고 서비스 도메인 origin을 등록합니다.',
    '프론트엔드는 publishable key(pk_)와 endpoint로 브라우저 클라이언트를 생성합니다.',
    '서버 작업은 secret key(sk_)를 환경변수로 보관하고 /server 어드민 클라이언트에서만 호출합니다.',
  ],
  domainIsolation:
    '서비스 도메인은 tenant.corsOrigins allowlist로 격리합니다. 같은 회사의 여러 도메인은 같은 테넌트 키와 빌링을 공유하지만, 허용되지 않은 origin의 브라우저 호출은 차단하는 구조입니다.',
}

function details(value: Partial<DeskDetails>): DeskDetails {
  return {
    ...DETAILS_BASE,
    ...value,
    bestFor: value.bestFor ?? DETAILS_BASE.bestFor,
    dataModel: value.dataModel ?? DETAILS_BASE.dataModel,
    adminGuide: value.adminGuide ?? DETAILS_BASE.adminGuide,
    integrationGuide: value.integrationGuide ?? DETAILS_BASE.integrationGuide,
  }
}

export const DESK_DETAILS: Readonly<Record<string, DeskDetails>> = {
  termsdesk: details({
    summary:
      'TermsDesk는 약관, 개인정보처리방침, 서비스 고지, 동의 영수증을 버전 단위로 보관하는 컴플라이언스 Desk입니다. 정책 문서를 단순 CMS처럼 보여주는 데서 끝나지 않고, 어떤 사용자가 어떤 버전에 동의했는지까지 감사 가능한 이벤트로 남깁니다. 전문가 의뢰 흐름을 함께 두면 법무 검토, 첨부, 상태 변경, 알림까지 하나의 운영 큐에서 처리할 수 있습니다.',
    bestFor: [
      '약관/개인정보처리방침 버전 관리',
      '동의 이력 감사',
      '법무/노무/세무 전문가 의뢰 중계',
    ],
    dataModel: [
      {
        name: 'PolicyVersion',
        description: 'slug, 버전, 본문, 게시 상태를 가진 불변 정책 문서입니다.',
      },
      {
        name: 'ConsentReceipt',
        description: '사용자, 정책 버전, 동의 시각, 출처 도메인을 남기는 감사 영수증입니다.',
      },
      {
        name: 'ExpertRequest',
        description: '전문가 의뢰의 카테고리, 상태, 담당자, 첨부를 추적하는 운영 큐입니다.',
      },
      {
        name: 'PolicyAttachment',
        description: '정책 검토나 의뢰 처리에 필요한 증빙 파일 메타데이터입니다.',
      },
    ],
    adminGuide: [
      {
        title: '정책 버전 게시',
        description: '초안 검토 후 새 버전을 게시하고 이전 버전은 감사용으로 유지합니다.',
      },
      {
        title: '동의 영수증 감사',
        description: '서비스 도메인과 정책 slug 기준으로 동의 누락/구버전 동의를 확인합니다.',
      },
      {
        title: '전문가 의뢰 트리아지',
        description: '신규 의뢰를 카테고리와 긴급도로 분류하고 담당자에게 배정합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인별로 사용할 policy slug를 정하고 콘솔의 CORS allowlist에 origin을 등록합니다.',
      '프론트엔드는 현재 정책을 조회해 앱 UI로 렌더하고 사용자의 동의 이벤트를 기록합니다.',
      '서버는 secret key로 정책 게시, 의뢰 상태 변경, 첨부 감사 같은 운영 작업을 수행합니다.',
    ],
    domainIsolation:
      '각 서비스 도메인은 같은 회사 테넌트를 공유하되 policy slug와 origin으로 동의 기록을 분리합니다. 예를 들어 app.example.com과 admin.example.com의 동의 이벤트를 같은 콘솔에서 보되, origin 기준으로 감사할 수 있습니다.',
  }),
  surveydesk: details({
    summary:
      'SurveyDesk는 제품 안에 네이티브 설문과 피드백 수집 흐름을 붙이는 Desk입니다. NPS, 별점, 객관식, 자유서술을 같은 응답 모델로 수집하고 운영 콘솔에서 활성 설문, 응답 품질, 분포를 확인합니다. 외부 설문 링크로 이탈시키지 않고 서비스 도메인 안에서 수집하기 때문에 가입회사별 고객 피드백을 제품 맥락과 함께 남길 수 있습니다.',
    bestFor: ['NPS/별점 수집', '서비스 내 피드백 폼', '기능 출시 후 만족도 추적'],
    dataModel: [
      {
        name: 'SurveyDefinition',
        description: 'appId, 질문 스키마, 노출 기간, 활성 상태를 가진 설문 정의입니다.',
      },
      {
        name: 'Question',
        description: 'NPS, 별점, 객관식, 자유서술 같은 질문 타입과 선택지입니다.',
      },
      {
        name: 'SurveyResponse',
        description: '서비스 도메인, 사용자 컨텍스트, 질문별 답변을 가진 응답입니다.',
      },
      {
        name: 'SurveyAggregate',
        description: '평균, NPS, 선택지 분포, 응답 수를 계산한 조회 모델입니다.',
      },
    ],
    adminGuide: [
      {
        title: '활성 설문 전환',
        description: '서비스 도메인/appId별로 하나의 활성 설문을 지정하고 노출 기간을 관리합니다.',
      },
      {
        title: '응답 품질 점검',
        description: '반복 제출, 빈 응답, 극단값 분포를 확인해 분석에서 제외할지 결정합니다.',
      },
      {
        title: 'CSV 내보내기',
        description: '고객 성공/제품 팀이 분석할 수 있도록 기간·도메인 기준으로 응답을 추출합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인과 appId를 정하고 설문 질문 스키마를 등록합니다.',
      '브라우저 SDK로 활성 설문을 조회한 뒤 앱의 모달, 사이드 패널, 설정 화면에 렌더합니다.',
      '응답 제출 후 제품 이벤트와 함께 사용량 이벤트가 집계되는지 확인합니다.',
    ],
    domainIsolation:
      'SurveyDesk는 appId와 origin을 함께 사용해 같은 회사의 여러 서비스 도메인 설문을 분리합니다. 도메인별 활성 설문과 응답 집계가 섞이지 않도록 콘솔에서 origin allowlist를 먼저 확정합니다.',
  }),
  changelogdesk: details({
    summary:
      'ChangelogDesk는 릴리스 노트와 제품 변경사항을 채널별로 발행하고, 앱 내부의 What’s new 패널이나 미확인 배지로 보여주는 Desk입니다. 단순 게시판이 아니라 사용자군, 채널, 확인 상태를 함께 추적해 고객이 실제로 어떤 변경사항을 봤는지 운영자가 판단할 수 있게 합니다.',
    bestFor: ['릴리스 노트 발행', 'What’s new 패널', '미확인 변경사항 배지'],
    dataModel: [
      {
        name: 'ReleaseNote',
        description: '버전, 채널, 제목, 본문, 게시 상태를 가진 변경사항 항목입니다.',
      },
      { name: 'AudienceRule', description: '플랜, 역할, 서비스 도메인 기준 노출 규칙입니다.' },
      {
        name: 'Acknowledgement',
        description: '사용자 또는 세션이 릴리스 노트를 확인한 기록입니다.',
      },
      {
        name: 'Channel',
        description: 'stable, beta, internal처럼 변경사항을 분리하는 발행 채널입니다.',
      },
    ],
    adminGuide: [
      {
        title: '릴리스 노트 작성',
        description: '변경 유형과 영향도를 명확히 작성하고 채널을 지정해 게시합니다.',
      },
      {
        title: '노출 대상 점검',
        description: '도메인/플랜/역할 기준으로 의도한 사용자에게만 노출되는지 확인합니다.',
      },
      {
        title: '미확인 배지 확인',
        description: '확인율이 낮은 변경사항은 앱 내 배지나 알림 노출 위치를 조정합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인별 릴리스 채널과 audience rule을 정합니다.',
      '브라우저 SDK로 wall 또는 unread count를 조회해 앱의 알림 영역에 렌더합니다.',
      '사용자가 읽은 항목은 acknowledgement로 기록해 미확인 배지를 줄입니다.',
    ],
    domainIsolation:
      '릴리스 노트는 같은 테넌트 안에서도 channel과 audience rule로 분리합니다. 운영 콘솔에서는 도메인별로 어떤 변경사항이 노출되는지 확인하고, 내부 도메인용 베타 노트가 공개 도메인으로 새지 않게 관리합니다.',
  }),
  reviewdesk: details({
    summary:
      'ReviewDesk는 제품, 콘텐츠, 전문가, 상품 같은 대상에 리뷰와 별점을 붙이는 Desk입니다. 평점 평균만 제공하지 않고 승인/숨김 상태, 하이라이트, 신고 흐름까지 운영할 수 있어 공개 후기 영역을 안전하게 관리할 수 있습니다.',
    bestFor: ['제품/콘텐츠 리뷰', '별점과 후기 하이라이트', '후기 검수 큐'],
    dataModel: [
      {
        name: 'ReviewSubject',
        description: '리뷰가 붙는 상품, 플랜, 콘텐츠, 전문가 같은 대상 식별자입니다.',
      },
      {
        name: 'Review',
        description: '작성자, 별점, 본문, 상태, 서비스 도메인 출처를 가진 후기입니다.',
      },
      {
        name: 'RatingAggregate',
        description: '평균, 개수, 별점 분포를 빠르게 조회하기 위한 집계 모델입니다.',
      },
      {
        name: 'ReviewHighlight',
        description: '운영자가 선정한 대표 후기나 마케팅 노출용 하이라이트입니다.',
      },
    ],
    adminGuide: [
      { title: '검수 큐 처리', description: '신규 리뷰를 승인, 숨김, 보류 상태로 분류합니다.' },
      {
        title: '평점 이상치 확인',
        description: '도메인별 급격한 평점 변화나 반복 리뷰를 확인합니다.',
      },
      {
        title: '하이라이트 선정',
        description: '공개 페이지에 노출할 대표 후기를 주기적으로 업데이트합니다.',
      },
    ],
    integrationGuide: [
      '리뷰 대상 subjectId 체계를 먼저 정합니다.',
      '브라우저 SDK로 리뷰 목록과 aggregate를 조회해 앱 UI로 렌더합니다.',
      '작성/신고/검수는 서비스 정책에 맞춰 publishable 또는 server admin 흐름으로 분리합니다.',
    ],
    domainIsolation:
      'ReviewDesk는 subjectId와 origin 기준으로 리뷰를 분리합니다. 같은 상품이라도 국가/브랜드 도메인이 다르면 콘솔에서 도메인별 평점 분포를 따로 확인할 수 있게 운영합니다.',
  }),
  mediadesk: details({
    summary:
      'MediaDesk는 이미지와 미디어 자산 업로드, 변환, 서명 URL, 공개/비공개 정책을 관리하는 Desk입니다. 아바타, 썸네일, 첨부 이미지처럼 서비스 도메인마다 필요한 프리셋을 운영하고 원본과 파생본 저장량을 요금 메트릭으로 추적합니다.',
    bestFor: ['이미지 업로드와 리사이즈', 'WebP/AVIF 변환', '서명 URL 기반 비공개 자산'],
    dataModel: [
      {
        name: 'Asset',
        description: '원본 파일, 폴더, MIME 타입, 가시성, 소유자 정보를 가진 미디어 자산입니다.',
      },
      {
        name: 'Derivative',
        description: '리사이즈/포맷 변환으로 생성된 파생본과 캐시 메타데이터입니다.',
      },
      {
        name: 'TransformPreset',
        description: '서비스 도메인별 썸네일, 카드 이미지, 원본 제한 규칙입니다.',
      },
      {
        name: 'SignedUrl',
        description: '비공개 자산을 제한 시간 동안 제공하는 다운로드/보기 URL입니다.',
      },
    ],
    adminGuide: [
      {
        title: '스토리지 사용량 점검',
        description: '원본과 파생본 저장량을 확인하고 Scale 플랜 한도에 맞게 정리합니다.',
      },
      {
        title: '프리셋 관리',
        description: '서비스 도메인별 이미지 비율과 포맷 정책을 관리합니다.',
      },
      {
        title: '가시성 전환',
        description: '공개/비공개 전환과 signed URL TTL을 서비스 정책에 맞게 조정합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인에서 사용할 폴더 네임스페이스와 transform preset을 정합니다.',
      '브라우저 또는 서버 SDK로 업로드하고 반환된 asset URL을 앱 데이터에 저장합니다.',
      '비공개 자산은 서버에서 secret key로 signed URL을 발급해 클라이언트에 전달합니다.',
    ],
    domainIsolation:
      'MediaDesk는 폴더 네임스페이스, visibility, origin allowlist로 도메인별 자산을 분리합니다. 같은 회사의 여러 브랜드 도메인이 같은 스토리지를 쓰더라도 공개 URL 정책과 프리셋은 도메인별로 운영합니다.',
  }),
  notifydesk: details({
    summary:
      'NotifyDesk는 이메일, 웹훅, 인앱 알림을 템플릿과 발송 이벤트로 관리하는 Desk입니다. 메시지 템플릿을 도메인별로 분리하고, 발송 실패, 재시도, 수신자 인박스 상태를 운영 콘솔에서 추적합니다.',
    bestFor: ['트랜잭션 이메일', '웹훅/인앱 알림', '알림 템플릿과 재시도 관리'],
    dataModel: [
      {
        name: 'Template',
        description: '채널, 로케일, 변수 스키마, 발행 상태를 가진 알림 템플릿입니다.',
      },
      { name: 'Notification', description: '수신자, 채널, 페이로드, 상태를 가진 발송 단위입니다.' },
      {
        name: 'DeliveryAttempt',
        description: '외부 제공자 응답, 실패 사유, 재시도 횟수를 기록합니다.',
      },
      { name: 'InboxItem', description: '사용자 인앱 알림 센터에 렌더할 읽음/미읽음 항목입니다.' },
    ],
    adminGuide: [
      {
        title: '템플릿 발행',
        description: '서비스 도메인별 브랜드 문구와 변수를 검증한 뒤 템플릿을 발행합니다.',
      },
      {
        title: '실패 재시도',
        description: '일시 실패와 영구 실패를 구분하고 필요한 발송만 재시도합니다.',
      },
      {
        title: '수신자 상태 확인',
        description: '중요 알림이 수신자의 인앱 인박스에 남았는지 점검합니다.',
      },
    ],
    integrationGuide: [
      '도메인별 템플릿 키와 recipientId 체계를 정합니다.',
      '서버에서 secret key로 중요 알림을 발송하고 브라우저 SDK로 인앱 인박스를 조회합니다.',
      '웹훅 채널은 실패 정책과 재시도 한도를 콘솔에서 관리합니다.',
    ],
    domainIsolation:
      'NotifyDesk는 템플릿 키와 recipient namespace를 서비스 도메인별로 나눕니다. 운영 콘솔의 도메인 allowlist는 인앱 조회 범위를 제한하고, 서버 발송은 테넌트 secret key로 중앙 통제합니다.',
  }),
  moderationdesk: details({
    summary:
      'ModerationDesk는 사용자 생성 콘텐츠를 검사하고 신고, 규칙, 자동 조치 로그를 운영하는 Desk입니다. 텍스트/이미지 검사 결과와 운영자 판정을 함께 남겨 도메인별 커뮤니티 정책을 일관되게 적용할 수 있습니다.',
    bestFor: ['금칙어/위험 콘텐츠 검사', '사용자 신고 처리', '자동 숨김/경고 정책'],
    dataModel: [
      {
        name: 'ModerationRule',
        description: '금칙어, 카테고리, 점수 임계값, 자동 조치 정책입니다.',
      },
      { name: 'ModerationJob', description: '검사 대상 콘텐츠, verdict, score, 처리 상태입니다.' },
      {
        name: 'UserReport',
        description: '사용자 신고 사유, 신고자, 대상 콘텐츠, 처리 결과입니다.',
      },
      { name: 'ActionLog', description: '숨김, 경고, 복구 같은 운영 조치 감사 로그입니다.' },
    ],
    adminGuide: [
      {
        title: '신고 큐 처리',
        description: '서비스 도메인별 신고를 우선순위와 위험도로 분류합니다.',
      },
      {
        title: '규칙 업데이트',
        description: '금칙어와 자동 조치 임계값을 도메인 정책에 맞게 업데이트합니다.',
      },
      {
        title: '조치 감사',
        description: '자동 조치가 과도하지 않은지 주기적으로 표본 감사합니다.',
      },
    ],
    integrationGuide: [
      '검사할 콘텐츠 타입과 report category를 정의합니다.',
      '콘텐츠 작성 전후 moderation.check를 호출해 결과에 따라 UI 또는 서버 저장을 제어합니다.',
      '운영자는 secret key로 신고 상태와 규칙을 관리합니다.',
    ],
    domainIsolation:
      'ModerationDesk는 도메인별 정책 차이를 rule set으로 분리합니다. 같은 회사라도 공개 커뮤니티와 내부 협업 도메인은 서로 다른 신고 카테고리와 자동 조치 기준을 둘 수 있습니다.',
  }),
  realtimedesk: details({
    summary:
      'RealtimeDesk는 WebSocket 채널, presence, broadcast를 제공하는 Desk입니다. 라이브 커서, 온라인 사용자, 실시간 알림 같은 기능을 붙이되 채널 네임스페이스와 origin allowlist로 서비스 도메인 간 이벤트가 섞이지 않게 운영합니다.',
    bestFor: ['라이브 커서/공동 편집', '온라인 상태', '실시간 브로드캐스트'],
    dataModel: [
      {
        name: 'Channel',
        description: 'room, tenant, domain namespace가 포함된 실시간 통신 단위입니다.',
      },
      { name: 'PresenceState', description: '접속 사용자, 마지막 heartbeat, 메타데이터입니다.' },
      {
        name: 'BroadcastEvent',
        description: '채널로 전송된 이벤트 타입과 페이로드 메타데이터입니다.',
      },
      {
        name: 'ConnectionLog',
        description: '연결/해제, 오류, 인증 실패를 추적하는 운영 로그입니다.',
      },
    ],
    adminGuide: [
      { title: '채널 상태 점검', description: '도메인별 활성 채널과 연결 수를 확인합니다.' },
      {
        title: 'Presence TTL 조정',
        description: '네트워크 상태에 맞춰 온라인 표시 만료 시간을 조정합니다.',
      },
      {
        title: '장애 로그 확인',
        description: '인증 실패, socket path 오류, origin mismatch를 점검합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인별 channel namespace와 socket.io path를 정합니다.',
      '브라우저 SDK로 연결한 뒤 room 단위로 subscribe/broadcast를 수행합니다.',
      '서버 이벤트는 secret key로 브로드캐스트해 신뢰 경계를 분리합니다.',
    ],
    domainIsolation:
      'RealtimeDesk는 origin allowlist와 channel namespace를 함께 사용합니다. 같은 테넌트의 app.example.com과 studio.example.com은 같은 빌링을 공유하지만 채널 prefix를 다르게 두어 이벤트를 격리합니다.',
  }),
  searchdesk: details({
    summary:
      'SearchDesk는 문서 색인, 즉시 검색, 하이라이트, 패싯, 쿼리 로그를 제공하는 Desk입니다. 서비스 도메인별 인덱스 스키마와 랭킹 규칙을 분리해 문서가 섞이지 않게 관리하고, 검색 품질을 운영 콘솔에서 지속적으로 조정합니다.',
    bestFor: ['문서/콘텐츠 검색', '도움말/상품 즉시 검색', '검색 로그 기반 품질 개선'],
    dataModel: [
      {
        name: 'SearchIndex',
        description: '도메인별 문서 스키마, 필드, 랭킹 가중치를 가진 인덱스입니다.',
      },
      {
        name: 'IndexedDocument',
        description: '검색 가능한 문서 본문, 메타데이터, 권한 정보를 가진 레코드입니다.',
      },
      { name: 'QueryLog', description: '검색어, 결과 수, 클릭 여부, 도메인 출처를 기록합니다.' },
      { name: 'SynonymRule', description: '동의어, 오타 보정, 금칙 검색어 규칙입니다.' },
    ],
    adminGuide: [
      {
        title: '재색인',
        description: '문서 스키마나 랭킹 변경 후 도메인별로 안전하게 재색인합니다.',
      },
      {
        title: '무결과 검색어 분석',
        description: '결과가 없는 쿼리를 보고 문서 보강이나 동의어를 추가합니다.',
      },
      {
        title: '랭킹 조정',
        description: '클릭 로그를 기준으로 필드 가중치와 패싯 구성을 조정합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인별 index schema와 권한 필드를 정의합니다.',
      '서버에서 문서를 색인하고 브라우저 SDK로 검색 UI를 렌더합니다.',
      '쿼리 로그를 주기적으로 확인해 무결과/저클릭 검색어를 개선합니다.',
    ],
    domainIsolation:
      'SearchDesk는 index name과 origin 기준으로 검색 범위를 분리합니다. 같은 회사 테넌트 안에서도 고객 포털, 내부 관리자, 문서 사이트의 검색 인덱스를 별도로 운영할 수 있습니다.',
  }),
  communitydesk: details({
    summary:
      'CommunityDesk는 게시판, 카페, 포럼형 커뮤니티를 멀티테넌트로 운영하는 Desk입니다. 글, 댓글, 반응, 카테고리, 신고 흐름을 제공하며 서비스 도메인별 board slug로 커뮤니티를 분리할 수 있습니다.',
    bestFor: ['공지/게시판', '고객 커뮤니티', '카테고리형 포럼'],
    dataModel: [
      { name: 'Board', description: '도메인과 board slug로 구분되는 게시판 단위입니다.' },
      { name: 'Post', description: '작성자, 카테고리, 본문, 고정/숨김 상태를 가진 게시글입니다.' },
      { name: 'Comment', description: '게시글에 달린 댓글, 부모 댓글, 검수 상태입니다.' },
      { name: 'Reaction', description: '좋아요, 북마크, 투표 같은 사용자 반응 이벤트입니다.' },
    ],
    adminGuide: [
      {
        title: '게시글 고정/숨김',
        description: '공지나 문제 글을 도메인별 게시판 정책에 맞게 처리합니다.',
      },
      {
        title: '댓글 검수',
        description: '신고 댓글과 자동 검수 결과를 보고 승인/숨김을 결정합니다.',
      },
      {
        title: '카테고리 운영',
        description: '도메인별 카테고리 구조와 권한을 주기적으로 정리합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인과 board slug를 먼저 설계합니다.',
      '브라우저 SDK로 게시글 목록과 상세를 조회하고 앱 UI로 렌더합니다.',
      '신고/숨김/고정 같은 운영 작업은 서버 어드민 클라이언트로 처리합니다.',
    ],
    domainIsolation:
      'CommunityDesk는 board slug와 origin으로 커뮤니티를 분리합니다. 같은 회사가 고객 커뮤니티와 파트너 포럼을 동시에 운영해도 게시글과 권한 정책을 도메인별로 나눌 수 있습니다.',
  }),
  chatdesk: details({
    summary:
      'ChatDesk는 1:1 채팅, 쪽지, 읽음 표시, 시스템 메시지를 제공하는 Desk입니다. 실시간 연결은 RealtimeDesk 패턴을 따르며 대화방, 멤버, 메시지 보존 정책을 서비스 도메인별로 운영합니다.',
    bestFor: ['1:1 고객 메시징', '사용자 간 DM', '시스템 메시지/읽음 표시'],
    dataModel: [
      {
        name: 'Conversation',
        description: '대화 종류, 멤버, 상태, 도메인 namespace를 가진 대화방입니다.',
      },
      {
        name: 'Message',
        description: '본문, 작성자, 전송 상태, 첨부, 시스템 여부를 가진 메시지입니다.',
      },
      { name: 'ReadReceipt', description: '멤버별 읽음 위치와 읽은 시각입니다.' },
      { name: 'RetentionPolicy', description: '도메인별 메시지 보존 기간과 삭제 정책입니다.' },
    ],
    adminGuide: [
      {
        title: '대화 상태 확인',
        description: '대화방 생성, 멤버, 최근 메시지, 전송 실패를 확인합니다.',
      },
      {
        title: '시스템 메시지 발송',
        description: '공지나 운영 알림을 서버 권한으로 특정 대화방에 보냅니다.',
      },
      {
        title: '보존 정책 점검',
        description: '법적/서비스 정책에 맞춰 메시지 보존 기간을 확인합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인별 conversation kind와 memberId 체계를 정의합니다.',
      '브라우저 SDK로 대화방을 생성/조회하고 메시지 UI는 앱에서 직접 렌더합니다.',
      '시스템 메시지, 강제 종료, 감사 작업은 secret key로 수행합니다.',
    ],
    domainIsolation:
      'ChatDesk는 conversation namespace와 origin allowlist로 대화를 분리합니다. 고객 지원 채팅과 사용자 DM을 같은 테넌트에서 운영하더라도 kind와 도메인을 분리해 접근 범위를 제어합니다.',
  }),
  addesk: details({
    summary:
      'AdDesk는 슬롯 기반 광고와 배너를 가중치로 송출하고 노출/클릭 이벤트를 집계하는 Desk입니다. 외부 광고 서버가 필요 없는 인하우스 캠페인 운영에 맞춰 서비스 도메인별 슬롯, 캠페인, 빈도 제한을 관리합니다.',
    bestFor: ['인하우스 배너 송출', '캠페인/슬롯 운영', '노출·클릭 추적'],
    dataModel: [
      { name: 'AdSlot', description: '서비스 도메인의 UI 위치와 허용 크기를 정의하는 슬롯입니다.' },
      { name: 'Campaign', description: '기간, 가중치, 타깃, 활성 상태를 가진 광고 캠페인입니다.' },
      {
        name: 'Creative',
        description: '이미지, 링크, 문구, 추적 파라미터를 가진 광고 소재입니다.',
      },
      {
        name: 'ImpressionEvent',
        description: '노출, 클릭, 슬롯, 캠페인, 도메인을 기록하는 이벤트입니다.',
      },
    ],
    adminGuide: [
      { title: '캠페인 활성화', description: '기간과 가중치를 확인한 뒤 캠페인을 활성화합니다.' },
      {
        title: 'CTR 확인',
        description: '도메인/슬롯별 노출 대비 클릭률을 보고 소재를 조정합니다.',
      },
      {
        title: '빈도 제한 점검',
        description: '동일 사용자에게 과도하게 노출되지 않도록 frequency cap을 확인합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인별 slot ID와 허용 creative 크기를 정의합니다.',
      '브라우저 SDK로 ad.serve를 호출하고 앱의 광고 컴포넌트로 렌더합니다.',
      '노출/클릭 이벤트가 누락되지 않도록 뷰포트 진입과 클릭 핸들러에 연결합니다.',
    ],
    domainIsolation:
      'AdDesk는 slot ID와 campaign rule을 도메인별로 분리합니다. 같은 회사의 여러 서비스에서 공통 캠페인을 쓰더라도 슬롯 정책과 노출 빈도는 도메인 단위로 관리합니다.',
  }),
  authdesk: details({
    summary:
      'AuthDesk는 이메일/비밀번호 회원가입, 로그인, 세션 검증, JWT 갱신을 멀티테넌트로 제공하는 인증 Desk입니다. 자체 인증을 빠르게 붙이되 서비스 도메인별 allowed origin, JWT audience, 세션 TTL을 운영자가 통제할 수 있게 설계합니다.',
    bestFor: ['드롭인 회원가입/로그인', 'JWT 세션', '도메인별 인증 정책'],
    dataModel: [
      { name: 'User', description: '테넌트 안의 사용자 계정, 이메일, 상태, 생성 시각입니다.' },
      {
        name: 'Session',
        description: '로그인 세션, 만료 시각, refresh 상태, 서비스 도메인 출처입니다.',
      },
      { name: 'JwtAudience', description: '토큰을 사용할 서비스 도메인 또는 API audience입니다.' },
      {
        name: 'PasswordPolicy',
        description: '비밀번호 길이, 복잡도, 잠금 정책 같은 인증 규칙입니다.',
      },
    ],
    adminGuide: [
      {
        title: '사용자 상태 확인',
        description: '잠금, 비활성, 이메일 확인 상태를 운영 콘솔에서 확인합니다.',
      },
      {
        title: '세션 정책 변경',
        description: '서비스 도메인별 세션 TTL과 refresh 정책을 조정합니다.',
      },
      {
        title: '로그인 실패 분석',
        description: 'origin mismatch, 비밀번호 실패, 잠금 이벤트를 구분해 조치합니다.',
      },
    ],
    integrationGuide: [
      '로그인을 제공할 서비스 도메인을 CORS allowlist와 JWT audience에 맞춥니다.',
      '브라우저 SDK로 signup/login을 호출하고 반환된 토큰을 앱 세션 저장소에 보관합니다.',
      '서버 API는 JWT audience와 tenant를 함께 검증해 도메인 간 토큰 오용을 막습니다.',
    ],
    domainIsolation:
      'AuthDesk는 allowed origin과 JWT audience로 도메인별 인증 경계를 만듭니다. 같은 회사 테넌트의 여러 앱이 같은 사용자 풀을 공유할 수 있지만, 토큰 사용처는 audience로 제한합니다.',
  }),
  filedesk: details({
    summary:
      'FileDesk는 범용 파일 업로드, 공개/비공개 가시성, signed URL 다운로드를 제공하는 스토리지 Desk입니다. MediaDesk가 이미지 변환에 초점을 맞춘다면 FileDesk는 문서, 첨부, 백오피스 파일처럼 원본 파일 보관과 접근 제어에 집중합니다.',
    bestFor: ['문서/첨부 파일 업로드', '비공개 파일 다운로드', '보존 기간과 signed URL 정책'],
    dataModel: [
      {
        name: 'FileObject',
        description: '파일명, contentType, 크기, bucket, visibility, owner를 가진 파일입니다.',
      },
      {
        name: 'BucketPolicy',
        description: '도메인별 공개/비공개 기본값, 최대 파일 크기, 허용 확장자입니다.',
      },
      {
        name: 'SignedDownload',
        description: '제한 시간 동안 유효한 비공개 파일 다운로드 권한입니다.',
      },
      { name: 'RetentionRule', description: '파일 삭제/보존 기간과 복구 가능 기간을 정의합니다.' },
    ],
    adminGuide: [
      {
        title: '파일 삭제/복구',
        description: '오업로드나 정책 위반 파일을 삭제하고 필요 시 복구합니다.',
      },
      {
        title: '서명 URL 점검',
        description: '민감 파일의 signed URL TTL과 접근 로그를 확인합니다.',
      },
      {
        title: '스토리지 정리',
        description: '도메인별 저장량을 확인하고 불필요한 오래된 파일을 정리합니다.',
      },
    ],
    integrationGuide: [
      '서비스 도메인별 bucket visibility와 최대 파일 크기를 정합니다.',
      '브라우저 또는 서버 SDK로 파일을 업로드하고 파일 ID를 업무 데이터에 연결합니다.',
      '비공개 다운로드는 서버에서 signed URL을 발급해 권한 있는 사용자에게만 제공합니다.',
    ],
    domainIsolation:
      'FileDesk는 bucket namespace와 origin allowlist로 도메인별 파일 접근을 분리합니다. 같은 회사의 고객 포털과 내부 관리자 파일이 같은 테넌트에 있더라도 bucket policy로 공개 범위를 나눕니다.',
  }),
  'seo-gateway': details({
    summary:
      'SEOGatewayDesk는 JavaScript SPA를 검색 봇과 링크 프리뷰 크롤러가 읽을 수 있는 정적 HTML로 렌더링하는 프리렌더링/SEO 게이트웨이 Desk입니다. Fastify 기반 렌더 데이터플레인과 Puppeteer 풀, 캐시, SWR, 라우트 규칙, Lighthouse/VisualDiff 품질 게이트를 유지하면서 DeskCloud 콘솔에서는 가입회사·서비스 도메인·사용량·요금 한도를 통합 관리합니다. 기존 패키지명은 SEO/OSS 자산 보존을 위해 @heejun/spa-seo-gateway-*로 유지하고, 제품 표시명은 패밀리 톤에 맞춰 SEOGatewayDesk로 통일합니다.',
    bestFor: ['SPA 검색 노출 개선', '봇 전용 프리렌더링', 'Lighthouse/VisualDiff 품질 게이트'],
    dataModel: [
      {
        name: 'Site',
        description:
          'origin URL, route rules, 캐시 정책, 활성 상태를 가진 서비스 도메인 단위 설정입니다.',
      },
      {
        name: 'RouteRule',
        description:
          '패턴, TTL, waitUntil, waitSelector, ignore 플래그를 가진 렌더 라우팅 규칙입니다.',
      },
      {
        name: 'RenderJob',
        description: '봇 요청 또는 워밍 작업으로 생성되는 렌더 실행, 소요 시간, 결과 상태입니다.',
      },
      {
        name: 'QualityReport',
        description:
          'Lighthouse 점수, VisualDiff 결과, schema.org JSON-LD 추론 결과를 묶은 품질 리포트입니다.',
      },
    ],
    adminGuide: [
      {
        title: '서비스 origin 등록',
        description:
          '검색 노출이 필요한 SPA 도메인을 등록하고 SSR 대상 경로만 route rule로 제한합니다.',
      },
      {
        title: '캐시/워밍 운영',
        description:
          'TTL, SWR, sitemap 워밍, Redis 상태를 확인해 cold render 비용과 지연을 줄입니다.',
      },
      {
        title: 'SEO 품질 게이트 확인',
        description:
          'Lighthouse, schema, visual diff 결과를 보고 배포 전 검색 노출 품질을 검증합니다.',
      },
    ],
    integrationGuide: [
      'DeskCloud 서비스 도메인 allowlist에 원본 SPA origin과 게이트웨이 운영 origin을 등록합니다.',
      'Fastify gateway는 @heejun/spa-seo-gateway-core와 admin-ui 패키지를 workspace에서 사용합니다.',
      '봇 트래픽은 CDN/nginx/Caddy에서 게이트웨이로 보내고 일반 사용자는 원본 SPA로 통과시킵니다.',
    ],
    domainIsolation:
      'SEOGatewayDesk는 DeskCloud 서비스 도메인 allowlist, Site origin, route rule namespace로 도메인별 렌더 범위를 분리합니다. 같은 가입회사가 여러 SPA를 운영해도 각 origin의 캐시, 워밍, 품질 리포트, admin token 범위를 나눠 관리합니다.',
  }),
  'remote-devtools': details({
    summary:
      'RemoteDevTools는 Chrome DevTools Protocol 기반의 원격 디버깅 Desk입니다. 고객 서비스에 SDK를 삽입하면 콘솔, 네트워크, DOM, 런타임 이벤트를 수집하고, rrweb 기반 세션 녹화/재생으로 문제 상황을 운영자가 다시 확인할 수 있습니다. 소스는 deskcloud 모노레포의 desks/remote-devtools로 통합했고, DevTools 벤더 프론트엔드와 TypeORM CDP 데이터플레인은 보존하면서 DeskCloud 운영 콘솔에서는 가입회사, 서비스 도메인, 사용량, 연동 상태를 통합 관리합니다.',
    bestFor: ['원격 웹앱 디버깅', '세션 녹화/리플레이', 'Jira/Slack/Google Sheets 연동'],
    dataModel: [
      {
        name: 'DebugSession',
        description: '라이브 또는 녹화 모드의 룸, recordId, 디바이스, URL, 사용자 컨텍스트입니다.',
      },
      {
        name: 'CdpEvent',
        description:
          'Network, Runtime, DOM, Screen 이벤트를 시간순으로 보관하는 디버깅 로그입니다.',
      },
      {
        name: 'ReplayArtifact',
        description: 'rrweb 이벤트, 스크린샷, S3 백업 파일처럼 세션 재생에 필요한 산출물입니다.',
      },
      {
        name: 'IssueIntegration',
        description: 'Jira 티켓, Slack 알림, Google Sheets 테스트 케이스 템플릿 연동 설정입니다.',
      },
    ],
    adminGuide: [
      {
        title: '세션 큐 모니터링',
        description:
          '라이브 세션과 녹화 세션을 구분하고 실패한 WebSocket 연결이나 빈 리플레이를 확인합니다.',
      },
      {
        title: 'SDK 허용 도메인 관리',
        description:
          '디버깅 SDK를 삽입할 고객 서비스 origin만 허용해 외부 도메인에서 세션을 만들지 못하게 합니다.',
      },
      {
        title: '연동 상태 점검',
        description:
          'Jira 티켓 생성, Slack 알림, Google Sheets 템플릿 조회, S3 백업 실패를 운영 콘솔에서 확인합니다.',
      },
    ],
    integrationGuide: [
      'DeskCloud 테넌트의 서비스 도메인 allowlist에 디버깅 대상 서비스를 등록합니다.',
      '대상 웹앱에 remote-debug-sdk 또는 UMD 스크립트를 삽입하고 DeskCloud 통합 WebSocket 게이트웨이를 연결합니다.',
      '운영자는 RemoteDevTools 콘솔에서 라이브 세션, 녹화 리플레이, 티켓/알림 연동 상태를 확인합니다.',
    ],
    domainIsolation:
      'RemoteDevTools는 DeskCloud 통합 라우트 아래에서 Internal Admin, SDK/WS gateway, 고객 서비스 origin의 책임을 나눕니다. DeskCloud에서는 가입회사 테넌트와 서비스 도메인 allowlist를 통합 관리하고, desks/remote-devtools의 PostgreSQL/세션 데이터는 org 또는 origin 네임스페이스로 분리합니다.',
  }),
}

export function deskDetails(desk: Pick<DeskEntry, 'id'>): DeskDetails {
  return DESK_DETAILS[desk.id] ?? DETAILS_BASE
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
  if (desk.id === 'seo-gateway') {
    return `import Fastify from 'fastify'
import { browserPool, render } from '@heejun/spa-seo-gateway-core'
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui'

const app = Fastify()
await registerAdminUI(app, { adminToken: process.env.ADMIN_TOKEN! })

app.get('/render', async (req, reply) => {
  const url = String(req.query.url)
  const html = await render({ url, pool: browserPool })
  return reply.type('text/html').send(html)
})`
  }

  if (desk.id === 'remote-devtools') {
    const operations = deskOperations(desk)
    const base =
      desk.integrationMode === 'workspace'
        ? `${DESKCLOUD_PUBLIC_URL}${operations.gatewayPath}`
        : (desk.liveUrl ?? `${DESKCLOUD_PUBLIC_URL}${operations.gatewayPath}`)
    const src = `${base}/sdk/index.umd.js`
    return `<script>
  function handleRemoteDebugSdkLoad() {
    window.RemoteDebugSdk?.createDebugger()
  }
</script>
<script src="${src}" onload="handleRemoteDebugSdkLoad()"></script>`
  }

  if (!desk.sdkFactory || !desk.sdkVar) return restSnippet('/api/billing/plans')
  const endpoint = desk.liveUrl ?? apiEndpoint()
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
    liveUrl: TERMSDESK_PUBLIC_URL,
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
  {
    id: 'seo-gateway',
    name: 'SEOGatewayDesk',
    tagline: 'SPA 프리렌더링·SEO 게이트웨이',
    what: 'JavaScript SPA를 검색 봇과 링크 프리뷰 크롤러가 읽을 수 있는 HTML로 렌더링하고, 라우트·캐시·워밍·Lighthouse·VisualDiff를 운영하는 개발자용 Desk입니다.',
    icon: Globe2,
    tone: 'accent',
    status: 'live',
    metrics: ['프리렌더', '캐시/SWR', 'Lighthouse', 'VisualDiff'],
    integrationMode: 'workspace',
    integrationPackage: SEO_GATEWAY_WORKSPACE.integrationPackage,
    workspacePath: SEO_GATEWAY_WORKSPACE.workspacePath,
    sourceRepositoryUrl: SEO_GATEWAY_WORKSPACE.sourceRepositoryUrl,
  },
  {
    id: 'remote-devtools',
    name: 'RemoteDevTools',
    tagline: '원격 디버깅·세션 리플레이',
    what: 'Chrome DevTools Protocol 기반 원격 콘솔·네트워크·DOM 수집과 rrweb 세션 녹화/재생, Jira·Slack·Google Sheets·S3 연동을 제공하는 개발자용 Desk입니다.',
    icon: Bug,
    tone: 'warning',
    status: 'live',
    metrics: ['라이브 세션', '녹화 리플레이', 'CDP 이벤트', '외부 연동'],
    integrationMode: 'workspace',
    integrationPackage: REMOTE_DEVTOOLS_WORKSPACE.integrationPackage,
    workspacePath: REMOTE_DEVTOOLS_WORKSPACE.workspacePath,
    sourceRepositoryUrl: REMOTE_DEVTOOLS_WORKSPACE.sourceRepositoryUrl,
  },
]

/** 코어를 제외한 "제품" Desk 들. */
export const PRODUCT_DESKS: readonly DeskEntry[] = DESK_CATALOG.filter((d) => !d.isCore)

/** 직접 디렉터리 아이콘(랜딩 등에서 작은 그리드용). */
export const DIRECTORY_ICON = LayoutGrid
