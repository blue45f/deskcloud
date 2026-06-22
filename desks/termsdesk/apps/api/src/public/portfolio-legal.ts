import {
  applyTemplateVars,
  computeContentHash,
  type PolicyType,
  type PublicRenderDto,
  unresolvedTemplateVars,
} from '@termsdesk/shared'

export const TERMSDESK_PUBLIC_BASE_URL = 'https://desk-platform.vercel.app/termsdesk'
const PUBLISHED_AT = '2026-06-08T00:00:00.000Z'

export interface SitemapEntry {
  loc: string
  lastmod: string
}

export interface PortfolioPolicy {
  slug: string
  name: string
  type: PolicyType
  body: string
  versionLabel: string
  changeSummary: string
  effectiveAt: string
  publishedAt: string
}

export interface PortfolioProject {
  slug: string
  name: string
  description: string
  supportUrl: string
  /** 프로젝트 아이콘 URL(http(s)) — 없으면 공개 페이지가 이니셜 모노그램으로 폴백. */
  logoUrl?: string
  policies: PortfolioPolicy[]
}

interface ProjectSeed {
  slug: string
  name: string
  description: string
  personalData: string
  serviceScope: string
  supportScope: string
  /** 프로젝트 아이콘 URL(http(s)) — 라이브 도메인 확정 시 채운다. */
  logoUrl?: string
  extraPolicies?: PortfolioPolicy[]
  /** terms-of-service / privacy-policy 의 공유 템플릿 대신 프로젝트 특화 본문으로 대체(slug 매칭). */
  policyOverrides?: PortfolioPolicy[]
}

function termsBody(project: ProjectSeed): string {
  return `제1조 (목적)
이 이용약관은 {{company_name}}가 제공하는 ${project.name} 서비스의 이용 조건, 이용자와 운영자의 권리와 의무, 책임 범위를 정합니다.

제2조 (서비스 범위)
${project.serviceScope}

제3조 (계정과 이용자 책임)
이용자는 본인의 계정과 접근 권한을 직접 관리해야 하며, 서비스 이용 과정에서 관계 법령, 타인의 권리, 커뮤니티 운영 기준을 침해해서는 안 됩니다.

제4조 (콘텐츠와 데이터)
이용자가 입력하거나 게시한 콘텐츠의 책임은 원칙적으로 이용자에게 있습니다. 운영자는 보안, 장애 대응, 법령 준수, 서비스 품질 개선을 위해 필요한 범위에서 데이터를 처리할 수 있습니다.

제5조 (문의와 신고)
${project.supportScope} 문의, 제휴 제안, 버그 신고는 TermsDesk 중앙 지원 보드에서 접수하며, 운영자는 접수 내용의 긴급도와 영향 범위에 따라 검토합니다.

제6조 (약관 변경)
본 약관은 서비스 개선, 법령 변경, 운영 정책 변경에 따라 개정될 수 있습니다. 게시된 정본과 변경 이력은 TermsDesk에서 버전과 해시로 관리됩니다.`
}

function privacyBody(project: ProjectSeed): string {
  return `제1조 (처리 목적)
{{company_name}}는 ${project.name} 서비스 제공, 계정 운영, 보안 유지, 고객 지원, 기능 개선을 위해 개인정보를 처리합니다.

제2조 (처리 항목)
서비스 성격에 따라 처리될 수 있는 정보는 다음과 같습니다.
- 계정 정보: 이메일, 이름 또는 닉네임, 로그인 식별자
- 서비스 이용 정보: 접속 기록, 사용 로그, 설정, 작성 콘텐츠
- 도메인별 정보: ${project.personalData}
- 문의 정보: 문의 유형, 연락처, 제목, 본문, 처리 상태

제3조 (보유 기간)
개인정보는 처리 목적 달성, 회원 탈퇴, 법정 보관 기간 만료 중 먼저 도래하는 시점까지 보유합니다. 단, 분쟁 대응, 보안 감사, 법령상 의무 이행을 위해 필요한 기록은 관계 법령에 따라 보관할 수 있습니다.

제4조 (제3자 제공과 처리위탁)
운영자는 이용자 동의 또는 법령 근거 없이 개인정보를 제3자에게 제공하지 않습니다. 인프라, 인증, 분석, 고객 지원 등 서비스 운영에 필요한 처리위탁이 있는 경우 필요한 범위로 제한합니다.

제5조 (이용자 권리)
이용자는 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 요청은 TermsDesk 중앙 지원 보드 또는 서비스 내 고객 지원 채널을 통해 접수합니다.

제6조 (안전성 확보)
운영자는 접근 권한 제한, 로그 점검, 전송 구간 암호화, 비밀정보 분리, 최소 수집 원칙을 적용해 개인정보를 보호합니다.`
}

function refundBody(projectName: string, scope: string): string {
  return `제1조 (목적)
이 환불·취소 정책은 ${projectName}에서 유료 기능, 예약, 결제, 정산이 발생하는 경우의 취소와 환불 기준을 안내합니다.

제2조 (기본 원칙)
${scope}

제3조 (예외)
법령상 청약철회 제한 사유, 이미 제공이 완료된 디지털 콘텐츠, 이용자가 명시적으로 즉시 이행에 동의한 서비스는 환불이 제한될 수 있습니다.

제4조 (문의)
환불·취소 문의는 TermsDesk 중앙 지원 보드의 사이트 문의 또는 버그 신고 채널로 접수합니다.`
}

function policy(
  slug: string,
  name: string,
  type: PolicyType,
  body: string,
  changeSummary = 'TermsDesk 중앙 게시본으로 이전'
): PortfolioPolicy {
  return {
    slug,
    name,
    type,
    body,
    versionLabel: 'v1',
    changeSummary,
    effectiveAt: PUBLISHED_AT,
    publishedAt: PUBLISHED_AT,
  }
}

const seeds: ProjectSeed[] = [
  {
    slug: 'promptmarket',
    name: 'PromptMarket',
    description: '프롬프트 판매·구매 마켓플레이스',
    serviceScope:
      '프롬프트 등록, 검색, 구매, 리뷰, 판매자 정산, 관리자 검수 기능을 제공합니다. 디지털 콘텐츠 거래 특성상 상품 설명과 권리 범위를 명확히 표시해야 합니다.',
    personalData:
      '판매자 프로필, 구매·정산 기록, 리뷰, 프롬프트 등록 메타데이터, 결제 및 세금 처리를 위한 최소 정보',
    supportScope: '프롬프트 거래, 판매자 온보딩, 결제·정산, 콘텐츠 권리 이슈와 관련된',
  },
  {
    slug: 'family-care-platform',
    name: 'Family Care Platform',
    logoUrl: 'https://family-care-platform.vercel.app/icon-192.png',
    description: '가족 돌봄 운영·예약·커뮤니티 플랫폼',
    serviceScope:
      '돌봄 일정, 센터 정보, 공개 커뮤니티 데모, 담당자 계정 운영, 이용자 권리 요청과 관련된 기능을 제공합니다.',
    personalData:
      '돌봄 일정, 보호자 연락 정보, 센터 담당자 정보, 권리 요청 내용, 공개 커뮤니티 활동 기록',
    supportScope: '센터 도입, 계정 접근, 돌봄 일정, 개인정보 권리 요청과 관련된',
  },
  {
    slug: 'offhours',
    name: 'Offhours',
    description: '비정형 공간 예약·결제·정산 플랫폼',
    serviceScope:
      '공간 검색, 예약 요청, 결제, 호스트 정산, 청소 SLA와 제휴 업체 매칭을 지원합니다.',
    personalData: '호스트 사업자 정보, 예약자 연락처, 결제·정산 기록, 예약 변경·취소 이력',
    supportScope: '공간 예약, 호스트 입점, 제휴 청소, 결제·환불과 관련된',
    extraPolicies: [
      policy(
        'refund-policy',
        '취소·환불 정책',
        'refund',
        refundBody(
          'Offhours',
          '예약 취소와 환불은 공간별 취소 정책, 이용 시작 시점, 결제 수단의 정산 상태를 함께 고려해 처리합니다. 호스트 귀책, 시스템 장애, 중복 결제는 확인 후 우선 환불합니다.'
        )
      ),
    ],
  },
  {
    slug: 'pettography',
    name: 'Pettography',
    logoUrl: 'https://pettography.vercel.app/icon.svg',
    description: '희귀 반려동물 정보·병원·샵·분양 포털',
    serviceScope:
      '종별 케어 가이드, 병원·샵 정보, 분양·입양 게시판, 입점 신청, 상담·문의 기능을 제공합니다.',
    personalData: '반려동물 프로필, 입양·분양 게시 정보, 입점 신청 연락처, 문의 및 상담 내용',
    supportScope: '데이터 오류, 입점·제휴, 분양 게시, 케어 정보와 관련된',
  },
  {
    slug: 'proto-live',
    name: 'ProtoLive',
    logoUrl: 'https://proto-live.vercel.app/favicon.svg',
    description: '라이브 프로토타입 투자 관심 매칭 플랫폼',
    serviceScope:
      '초기 프로젝트 공개, 라이브 데모 검증, 투자 관심 기록, 고지·개인정보 동의 확인 흐름을 제공합니다.',
    personalData: '프로젝트 제출자 정보, 투자 관심 연락 동의, 데모 사용 로그, 제안 메시지',
    supportScope: '프로젝트 등록, 투자 관심, 데모 검증, 개인정보 연락 동의와 관련된',
  },
  {
    slug: 'remote-devtools',
    name: 'Remote DevTools',
    logoUrl: 'https://desk-platform.vercel.app/remote-devtools/favicon-192.png',
    description: '웹 원격 디버깅·세션 재현 플랫폼',
    serviceScope:
      '웹 세션 녹화, 원격 디버깅, 콘솔·네트워크 이벤트 재현, 버그 티켓용 요약 기능을 제공합니다.',
    personalData: '디버깅 세션 메타데이터, 브라우저·기기 정보, 콘솔·네트워크 로그, 티켓 요약',
    supportScope: 'SDK 연동, 세션 녹화, 보안·프라이버시, 재현 불가 버그와 관련된',
  },
  {
    slug: 'resume',
    name: 'Resume Gongbang',
    logoUrl: 'https://resume-gongbang.vercel.app/favicon.svg',
    description: '이력서 작성·분석·채용 준비 플랫폼',
    serviceScope:
      '이력서 작성, AI 분석, 피드백 게시판, 채용 파이프라인, 포트폴리오 관리 기능을 제공합니다.',
    personalData: '이력서 전문, 경력·학력·연락처, AI 분석 요청, 채용 지원 상태, 피드백 게시물',
    supportScope: '이력서 분석, 개인정보 처리, 결제, 피드백 게시판과 관련된',
    extraPolicies: [
      policy(
        'refund-policy',
        '환불 정책',
        'refund',
        refundBody(
          'Resume Gongbang',
          '구독·유료 기능 환불은 결제일, 사용량, 즉시 제공된 디지털 기능 사용 여부, 관련 법령상 청약철회 기준을 기준으로 처리합니다.'
        )
      ),
    ],
  },
  {
    slug: 'rotifolk',
    name: 'Rotifolk',
    logoUrl: 'https://rotifolk.vercel.app/favicon.svg',
    description: '와인·커피·차 로테이션 모임 매칭 플랫폼',
    serviceScope:
      '모임 개설, 참가 신청, 매칭 카드, 연락처 공개 정책, 제휴 장소 디렉터리와 환불·안전 정책을 제공합니다.',
    personalData: '프로필, 선호 모임 정보, 연락처 공개 설정, 매칭·채팅 기록, 결제·환불 기록',
    supportScope: '모임 운영, 제휴 장소, 연락처 공개, 환불·노쇼와 관련된',
    extraPolicies: [
      policy(
        'refund-policy',
        '이용·환불 정책',
        'refund',
        refundBody(
          'Rotifolk',
          '모임 환불은 개최 시점, 호스트 확정 여부, 장소 예약 비용, 노쇼 여부, 커뮤니티 안전 기준 위반 여부를 함께 고려합니다.'
        )
      ),
    ],
  },
  {
    slug: 'spa-seo-gateway',
    name: 'SPA SEO Gateway',
    logoUrl: 'https://spa-seo-gateway.vercel.app/favicon.svg',
    description: 'SPA 사전 렌더링·검색 노출 게이트웨이',
    serviceScope:
      'SPA 페이지 렌더링, 캐시, 보안 헤더, OpenAI·Anthropic 공급자 연동 패키지와 CLI를 제공합니다.',
    personalData: '렌더링 대상 URL, 요청 로그, 설정 파일, 관리자 계정과 운영 로그',
    supportScope: '렌더링 오류, 캐시 정책, 공급자 연동, 라이브러리 사용과 관련된',
  },
  {
    slug: 'multi-environment-setting',
    name: 'Multi Environment Setting',
    description: '멀티 환경 배포·인프라 샘플과 운영 런북',
    serviceScope:
      'AWS·CloudFront·S3·GitHub OIDC 등 다중 환경 배포 샘플, 미리보기 정리, 운영 런북을 제공합니다.',
    personalData: '배포 환경 이름, 운영 로그, 이슈 재현 정보, 권한 요청과 관련된 최소 연락 정보',
    supportScope: '인프라 샘플, 배포 권한, 런북 오류, 보안 헤더와 관련된',
  },
  {
    slug: 'termsdesk',
    name: 'TermsDesk',
    description: '약관·정책 버전 관리와 변조 방지 게시 SaaS',
    serviceScope:
      '약관·정책 문서의 버전 관리, 공개 게시, 해시 검증, 동의 영수증, 감사 로그와 API 연동을 제공합니다.',
    personalData: '조직 계정, 약관·정책 문서, API 키 메타데이터, 동의 영수증, 지원 문의 내용',
    supportScope: '약관 연동, API 키, 공개 게시, 동의 영수증과 관련된',
  },
]

export const PORTFOLIO_PROJECTS: PortfolioProject[] = seeds.map((seed) => {
  // 프로젝트 특화 본문이 있으면 공유 템플릿 대신 사용(slug 매칭), 없으면 기존 v1 템플릿.
  const override = (slug: string) => seed.policyOverrides?.find((p) => p.slug === slug)
  return {
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    supportUrl: `${TERMSDESK_PUBLIC_BASE_URL}/support/${seed.slug}`,
    logoUrl: seed.logoUrl,
    policies: [
      override('terms-of-service') ??
        policy('terms-of-service', '이용약관', 'terms', termsBody(seed)),
      override('privacy-policy') ??
        policy('privacy-policy', '개인정보처리방침', 'privacy', privacyBody(seed)),
      ...(seed.extraPolicies ?? []),
    ],
  }
})

export function getPortfolioProject(projectSlug: string): PortfolioProject | undefined {
  return PORTFOLIO_PROJECTS.find((project) => project.slug === projectSlug)
}

export function findPortfolioPolicy(
  projectSlug: string,
  policySlug: string
): { project: PortfolioProject; policy: PortfolioPolicy } | undefined {
  const project = getPortfolioProject(projectSlug)
  const policy = project?.policies.find((candidate) => candidate.slug === policySlug)
  return project && policy ? { project, policy } : undefined
}

/**
 * 색인 대상 공개 URL(랜딩 + 공개 약관 + 지원 보드)을 sitemap.xml 문자열로 직렬화.
 * 카탈로그(PORTFOLIO_PROJECTS) 기준으로 동적 생성되므로 프로젝트·정책 추가 시 자동 반영됩니다.
 * DB 정책은 sitemap 에 포함하지 않는다 — 하드코딩 카탈로그(전부 공개)만 색인 대상이므로
 * 비공개(private) 정책이 sitemap 으로 노출될 경로가 구조적으로 없다.
 */
export function buildPortfolioSitemapXml(extraEntries: SitemapEntry[] = []): string {
  const entries: SitemapEntry[] = [{ loc: `${TERMSDESK_PUBLIC_BASE_URL}/`, lastmod: PUBLISHED_AT }]
  for (const project of PORTFOLIO_PROJECTS) {
    for (const policy of project.policies) {
      entries.push({
        loc: `${TERMSDESK_PUBLIC_BASE_URL}/p/${project.slug}/${policy.slug}`,
        lastmod: policy.publishedAt,
      })
    }
    entries.push({ loc: project.supportUrl, lastmod: PUBLISHED_AT })
  }
  entries.push(...extraEntries)

  const urls = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${entry.loc}</loc>\n    <lastmod>${entry.lastmod.slice(0, 10)}</lastmod>\n  </url>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export async function renderPortfolioPolicy(
  projectSlug: string,
  policySlug: string,
  opts: { vars: Record<string, string | undefined> }
): Promise<PublicRenderDto> {
  const match = findPortfolioPolicy(projectSlug, policySlug)
  if (!match) {
    throw new Error(`Unknown portfolio policy: ${projectSlug}/${policySlug}`)
  }

  const { project, policy } = match
  const vars = { company_name: project.name, ...opts.vars }
  const body = applyTemplateVars(policy.body, vars)
  const contentHash = await computeContentHash(policy.body)

  return {
    orgName: project.name,
    orgLogoUrl: project.logoUrl ?? null,
    policySlug: policy.slug,
    name: policy.name,
    type: policy.type,
    locale: 'ko',
    versionId: `${project.slug}:${policy.slug}:${policy.versionLabel}`,
    versionLabel: policy.versionLabel,
    contentHash,
    body,
    effectiveAt: policy.effectiveAt,
    publishedAt: policy.publishedAt,
    changeSummary: policy.changeSummary,
    availableVersions: [policy.versionLabel],
    unresolvedVars: unresolvedTemplateVars(policy.body, vars),
  }
}
