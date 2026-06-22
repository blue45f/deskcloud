import { PRODUCT_DESKS } from './deskCatalog'

const termsdesk = PRODUCT_DESKS.find((desk) => desk.id === 'termsdesk')

export const TERMSDESK_RUNTIME = termsdesk?.liveUrl ?? 'https://desk-platform.vercel.app/termsdesk'

export const TUTORIALS = [
  {
    title: '가입회사와 서비스 도메인 등록',
    summary: '테넌트 생성, pk_/sk_ 키 발급, origin allowlist 등록까지 콘솔 운영의 첫 경로입니다.',
    steps: ['POST /api/tenants', '서비스 origin 등록', '대시보드에서 키/사용량 확인'],
    href: '/signup',
  },
  {
    title: '첫 Desk SDK 붙이기',
    summary: '카탈로그에서 Desk를 고르고 createXClient 패턴으로 앱 컴포넌트에 직접 렌더합니다.',
    steps: ['pnpm add @heejun/deskcloud', 'createXClient 생성', 'pk_ 키와 endpoint 주입'],
    href: '/catalog',
  },
  {
    title: 'Workspace Desk 운영 검증',
    summary:
      'SEOGatewayDesk와 RemoteDevTools가 별도 제품이 아니라 통합 manifest에 묶였는지 확인합니다.',
    steps: ['GET /api/workspace-desks', '콘솔 parity 확인', 'gateway path와 adminPath 대조'],
    href: '/dashboard?desk=seo-gateway',
  },
  {
    title: 'TermsDesk 약관 의뢰 중계 접근',
    summary:
      'DeskPlatform 마이크로사이트에서 TermsDesk 런타임으로 이동해 의뢰자, 전문가, 운영자 큐를 확인합니다.',
    steps: [
      'TermsDesk 마이크로사이트 열기',
      '의뢰 중계 열기',
      'marketplace/requests/moderation 확인',
    ],
    href: '/desks/termsdesk',
  },
] as const

export const SAMPLE_SITES = [
  {
    title: 'DeskPlatform 통합 포털',
    href: 'https://desk-platform.vercel.app',
    kind: 'production',
    description: '카탈로그, 문서, 운영 콘솔, Desk 마이크로사이트의 단일 진입점입니다.',
  },
  {
    title: 'TermsDesk 의뢰 중계',
    href: `${TERMSDESK_RUNTIME}/app/marketplace`,
    kind: 'production',
    description: '약관 작성·검토·개정 의뢰 마켓플레이스와 운영 큐로 들어가는 실제 런타임입니다.',
  },
  {
    title: 'TermsDesk 전문가 디렉터리',
    href: `${TERMSDESK_RUNTIME}/experts`,
    kind: 'public',
    description: '인증 없이 전문가 목록과 공개 프로필이 렌더되는 샘플 공개 사이트입니다.',
  },
  {
    title: 'Workspace manifest API',
    href: 'https://desk-platform.vercel.app/api/workspace-desks',
    kind: 'api',
    description: 'SEOGatewayDesk와 RemoteDevTools의 통합 운영 manifest를 확인합니다.',
  },
] as const

export const ROLE_MANUALS = [
  {
    audience: '개발자',
    title: 'SDK 통합 매뉴얼',
    href: '#quickstart',
    outcome: '한 패키지로 Desk별 createXClient 패턴을 붙이고 브라우저 pk_ 경계를 검증합니다.',
    steps: [
      '패키지 설치',
      'Desk별 클라이언트 생성',
      'publishable key와 endpoint 주입',
      '콘솔에서 사용량 확인',
    ],
    checks: ['SDK 스니펫 복사', 'CORS allowlist 일치', '브라우저 콘솔 오류 없음'],
  },
  {
    audience: '운영자',
    title: '가입회사 운영 콘솔 매뉴얼',
    href: '#operations',
    outcome: '테넌트, 서비스 도메인, 키 회전, 사용량, 플랜을 같은 control-plane에서 관리합니다.',
    steps: ['테넌트 생성', '서비스 origin 등록', 'sk_ 키 보관', '월간 사용량/플랜 확인'],
    checks: ['secret key 서버 보관', 'origin allowlist 최소화', 'billing/usage API 401 경계 확인'],
  },
  {
    audience: '약관 운영자',
    title: 'TermsDesk 의뢰 중계 매뉴얼',
    href: '#sample-sites',
    outcome: 'DeskPlatform에서 TermsDesk 런타임으로 이동해 의뢰자·전문가·운영 큐를 확인합니다.',
    steps: [
      'TermsDesk 마이크로사이트 열기',
      '의뢰 중계 열기',
      '전문가 디렉터리 확인',
      '인증 필요 API 401 확인',
    ],
    checks: ['marketplace 200', 'experts 200', 'protected API 401', '마이크로사이트 CTA 표시'],
  },
  {
    audience: '플랫폼 관리자',
    title: 'Workspace Desk 통합 매뉴얼',
    href: '#verification-matrix',
    outcome:
      'SEOGatewayDesk와 RemoteDevTools가 분리 제품이 아니라 DeskCloud manifest로 운영됩니다.',
    steps: [
      'workspace manifest 조회',
      '콘솔 parity 확인',
      'gateway/admin path 대조',
      'developer Desk verify 실행',
    ],
    checks: [
      'manifest item count 일치',
      'liveUrl 없음',
      'adminPath /dashboard 통일',
      'source repo deskcloud',
    ],
  },
] as const

export const FULL_VERIFICATION_MATRIX = [
  {
    area: '공개 포털',
    entry: '/',
    expected: '랜딩 첫 화면, 카탈로그/요금제/문서 CTA, 헤더 내비게이션이 렌더됩니다.',
    proof: 'HTTP 200 + Playwright page identity + console warning/error 0',
    command: 'curl -I https://desk-platform.vercel.app/',
  },
  {
    area: '문서 허브',
    entry: '/docs',
    expected: '설치, 튜토리얼, 샘플 사이트, 역할별 매뉴얼, 전수 검증 매트릭스가 보입니다.',
    proof: 'heading visibility + hash navigation + 샘플 URL href 확인',
    command: 'curl -I https://desk-platform.vercel.app/docs',
  },
  {
    area: 'Desk 카탈로그',
    entry: '/catalog',
    expected: '모든 PRODUCT_DESKS가 마이크로사이트와 운영 설명으로 연결됩니다.',
    proof: 'catalog contract test + microsite route smoke',
    command: 'pnpm --filter @desk/web test',
  },
  {
    area: 'TermsDesk 마이크로사이트',
    entry: '/desks/termsdesk',
    expected: '의뢰 중계 열기와 전문가 디렉터리 CTA가 실제 런타임으로 연결됩니다.',
    proof: 'CTA href 확인 + desktop/mobile screenshot + console warning/error 0',
    command: 'curl -I https://desk-platform.vercel.app/desks/termsdesk',
  },
  {
    area: 'TermsDesk 의뢰 중계',
    entry: `${TERMSDESK_RUNTIME}/app/marketplace`,
    expected: '약관 의뢰 marketplace가 200으로 열리고 운영 큐 진입점이 살아 있습니다.',
    proof: 'HTTP 200 + protected API 401 경계 확인',
    command: `curl -I ${TERMSDESK_RUNTIME}/app/marketplace`,
  },
  {
    area: 'Workspace manifest API',
    entry: '/api/workspace-desks',
    expected: 'SEOGatewayDesk와 RemoteDevTools만 workspace_integrated manifest로 반환됩니다.',
    proof: 'API 200 + shared manifest/controller test',
    command: 'curl -I https://desk-platform.vercel.app/api/workspace-desks',
  },
  {
    area: '운영 콘솔',
    entry: '/dashboard',
    expected:
      'sk_ 세션 경계 안에서 tenant, service origin, usage, workspace Desk 패널을 관리합니다.',
    proof: 'RequireAuth 경계 + DashboardPage workspace state test',
    command: 'pnpm --filter @desk/web typecheck',
  },
  {
    area: '운영 증거 트랙',
    entry: '/dashboard#integration-verification',
    expected:
      '정적 계약, 렌더드 라우트, workspace manifest, TermsDesk 런타임, 어드민 경계를 같은 패널에서 확인합니다.',
    proof: 'integrationVerification contract test + rendered dashboard smoke',
    command: 'pnpm --filter @desk/web test -- integrationVerification',
  },
  {
    area: '문의 관리 보드',
    entry: '/admin/inquiries',
    expected: 'X-Admin-Token 기반 문의 운영 보드가 상태/origin 필터를 제공합니다.',
    proof: 'admin inquiries data contract test + route smoke',
    command: 'curl -I https://desk-platform.vercel.app/admin/inquiries',
  },
  {
    area: '디자인 시스템',
    entry: '/design',
    expected: '토큰, 컴포넌트, 상태 표면이 제품 UI와 같은 디자인 언어로 렌더됩니다.',
    proof: 'desktop/mobile render + no framework overlay',
    command: 'curl -I https://desk-platform.vercel.app/design',
  },
  {
    area: '통합 빌드/테스트',
    entry: 'pnpm run verify',
    expected: 'lint, typecheck, build, test가 pnpm/Turbo workspace 전체에서 통과합니다.',
    proof: 'Turbo task success summary',
    command: 'pnpm run verify',
  },
] as const

export const SAMPLE_UX_CHECKS = [
  {
    target: '첫 화면',
    expectation:
      '첫 viewport에서 제품명, 주 CTA, 현재 경계(live/workspace/linked)가 바로 보여야 합니다.',
  },
  {
    target: '모바일 레이아웃',
    expectation: '390px 폭에서 CTA, 코드 스니펫, 테이블 대체 카드가 겹치거나 잘리지 않아야 합니다.',
  },
  {
    target: '외부 샘플 링크',
    expectation:
      'TermsDesk marketplace/experts와 Workspace manifest API 링크가 실제 운영 URL을 가리켜야 합니다.',
  },
  {
    target: '복사 가능한 예제',
    expectation: '코드 블록은 키보드 포커스, 가로 스크롤, 복사 버튼 상태를 제공해야 합니다.',
  },
  {
    target: '콘솔 건강도',
    expectation:
      '렌더링 중 framework overlay, console warning/error, stale chunk 복구 실패가 없어야 합니다.',
  },
  {
    target: '긴 텍스트',
    expectation:
      '서비스별 설명, URL, API path, 한글 문장이 카드/표 영역 밖으로 넘치지 않아야 합니다.',
  },
] as const
