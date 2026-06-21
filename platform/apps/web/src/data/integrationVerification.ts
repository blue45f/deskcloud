import {
  PRODUCT_DESKS,
  deskDetails,
  deskMicrositePath,
  deskOperations,
  deskReadiness,
  type DeskEntry,
} from './deskCatalog'
import { FULL_VERIFICATION_MATRIX, TERMSDESK_RUNTIME } from './docsContent'

export type IntegrationContractStatus = 'verified' | 'failed'

export interface DeskIntegrationVerification {
  id: string
  name: string
  mode: 'native' | 'workspace' | 'linked'
  micrositePath: string
  adminPath: string
  gatewayPath: string
  contractStatus: IntegrationContractStatus
  contractIssues: readonly string[]
  readyCheckCount: number
  needsConfigCount: number
  watchCheckCount: number
  runtimeBoundary: string
  proofPoints: readonly string[]
}

export interface PlatformIntegrationAudit {
  productDeskCount: number
  verifiedDeskCount: number
  failedDeskCount: number
  micrositeRouteCount: number
  operationRouteCount: number
  verificationAreaCount: number
  requiredAreaCount: number
  missingRequiredAreas: readonly string[]
  criticalIssues: readonly string[]
  openConfigItems: number
  watchItems: number
  publicRoutes: readonly string[]
  micrositeRoutes: readonly string[]
  workspaceDeskIds: readonly string[]
  linkedDeskIds: readonly string[]
  termsDeskBrokerageUrl: string
  termsDeskExpertsUrl: string
  deskChecks: readonly DeskIntegrationVerification[]
}

export const REQUIRED_VERIFICATION_AREAS = [
  '공개 포털',
  '문서 허브',
  'Desk 카탈로그',
  'TermsDesk 마이크로사이트',
  'TermsDesk 의뢰 중계',
  'Workspace manifest API',
  '운영 콘솔',
  '문의 관리 보드',
  '디자인 시스템',
  '통합 빌드/테스트',
] as const

export const PUBLIC_SMOKE_ROUTES = [
  '/',
  '/catalog',
  '/pricing',
  '/docs',
  '/design',
  '/sitemap',
  '/login',
  '/signup',
  '/admin/inquiries',
] as const

export function buildPlatformIntegrationAudit(
  desks: readonly DeskEntry[] = PRODUCT_DESKS
): PlatformIntegrationAudit {
  const deskChecks = desks.map(buildDeskIntegrationVerification)
  const matrixAreas = new Set(FULL_VERIFICATION_MATRIX.map((item) => item.area))
  const missingRequiredAreas = REQUIRED_VERIFICATION_AREAS.filter((area) => !matrixAreas.has(area))
  const failedDeskIssues = deskChecks.flatMap((check) =>
    check.contractIssues.map((issue) => `${check.name}: ${issue}`)
  )

  return {
    productDeskCount: desks.length,
    verifiedDeskCount: deskChecks.filter((check) => check.contractStatus === 'verified').length,
    failedDeskCount: deskChecks.filter((check) => check.contractStatus === 'failed').length,
    micrositeRouteCount: deskChecks.filter((check) => check.micrositePath.startsWith('/desks/'))
      .length,
    operationRouteCount: deskChecks.filter((check) => check.adminPath.startsWith('/dashboard'))
      .length,
    verificationAreaCount: FULL_VERIFICATION_MATRIX.length,
    requiredAreaCount: REQUIRED_VERIFICATION_AREAS.length,
    missingRequiredAreas,
    criticalIssues: [
      ...missingRequiredAreas.map((area) => `검증 매트릭스 누락: ${area}`),
      ...failedDeskIssues,
    ],
    openConfigItems: deskChecks.reduce((sum, check) => sum + check.needsConfigCount, 0),
    watchItems: deskChecks.reduce((sum, check) => sum + check.watchCheckCount, 0),
    publicRoutes: PUBLIC_SMOKE_ROUTES,
    micrositeRoutes: deskChecks.map((check) => check.micrositePath),
    workspaceDeskIds: deskChecks
      .filter((check) => check.mode === 'workspace')
      .map((check) => check.id),
    linkedDeskIds: deskChecks.filter((check) => check.mode === 'linked').map((check) => check.id),
    termsDeskBrokerageUrl: `${TERMSDESK_RUNTIME}/app/marketplace`,
    termsDeskExpertsUrl: `${TERMSDESK_RUNTIME}/experts`,
    deskChecks,
  }
}

export function buildDeskIntegrationVerification(desk: DeskEntry): DeskIntegrationVerification {
  const operations = deskOperations(desk)
  const details = deskDetails(desk)
  const readiness = deskReadiness(desk)
  const mode = desk.integrationMode ?? 'native'
  const micrositePath = deskMicrositePath(desk)
  const contractIssues = collectContractIssues(desk)
  const statusCounts = readiness.checks.reduce(
    (acc, check) => ({
      ready: acc.ready + (check.status === 'ready' ? 1 : 0),
      needsConfig: acc.needsConfig + (check.status === 'needs_config' ? 1 : 0),
      watch: acc.watch + (check.status === 'watch' ? 1 : 0),
    }),
    { ready: 0, needsConfig: 0, watch: 0 }
  )

  return {
    id: desk.id,
    name: desk.name,
    mode,
    micrositePath,
    adminPath: operations.adminPath,
    gatewayPath: operations.gatewayPath,
    contractStatus: contractIssues.length > 0 ? 'failed' : 'verified',
    contractIssues,
    readyCheckCount: statusCounts.ready,
    needsConfigCount: statusCounts.needsConfig,
    watchCheckCount: statusCounts.watch,
    runtimeBoundary: runtimeBoundaryLabel(desk),
    proofPoints: [
      `microsite:${micrositePath}`,
      `admin:${operations.adminPath}`,
      `gateway:${operations.gatewayPath}`,
      `details:${details.dataModel.length} objects`,
      `runbook:${details.adminGuide.length} steps`,
    ],
  }
}

function collectContractIssues(desk: DeskEntry): string[] {
  const operations = deskOperations(desk)
  const details = deskDetails(desk)
  const readiness = deskReadiness(desk)
  const mode = desk.integrationMode ?? 'native'
  const issues: string[] = []

  if (deskMicrositePath(desk) !== `/desks/${desk.id}`) {
    issues.push('마이크로사이트 경로가 제품 Desk 라우팅 규칙과 다릅니다.')
  }
  if (operations.adminPath !== `/dashboard?desk=${desk.id}`) {
    issues.push('운영 허브 adminPath가 대시보드 선택 규칙과 다릅니다.')
  }
  if (!operations.gatewayPath.startsWith('/')) {
    issues.push('gatewayPath가 절대 경로가 아닙니다.')
  }
  if (operations.config.length === 0 || operations.operatorTasks.length === 0) {
    issues.push('필수 구성 또는 운영 작업 설명이 비어 있습니다.')
  }
  if (
    details.summary.length < 80 ||
    details.dataModel.length === 0 ||
    details.adminGuide.length === 0
  ) {
    issues.push('서비스 상세 설명, 관리 데이터, 운영 런북 중 하나가 부족합니다.')
  }
  if (readiness.checks.length < 3) {
    issues.push('통합 운영 readiness 체크가 3개 미만입니다.')
  }
  if (mode === 'native' && !desk.sdkFactory) {
    issues.push('네이티브 Desk인데 SDK browser client factory가 없습니다.')
  }
  if (mode === 'workspace') {
    if (!desk.workspacePath?.startsWith('desks/')) {
      issues.push('workspace Desk의 source path가 desks/* 아래가 아닙니다.')
    }
    if (desk.liveUrl) {
      issues.push('workspace Desk는 standalone liveUrl을 가지면 안 됩니다.')
    }
  }
  if (mode === 'linked') {
    if (!desk.integrationPackage || !desk.sourceRepositoryUrl) {
      issues.push('linked Desk의 패키지 또는 원본 저장소 정보가 없습니다.')
    }
  }
  if (desk.id === 'termsdesk' && desk.liveUrl !== TERMSDESK_RUNTIME) {
    issues.push('TermsDesk 의뢰 중계 런타임 URL이 문서 기준과 다릅니다.')
  }
  if (desk.id === 'aidigestdesk' && mode !== 'linked') {
    issues.push('AIDigestDesk는 SaaS Desk가 아니라 linked 독립 운영 항목이어야 합니다.')
  }

  return issues
}

function runtimeBoundaryLabel(desk: DeskEntry): string {
  if (desk.id === 'termsdesk') return `external runtime:${TERMSDESK_RUNTIME}`
  if (desk.integrationMode === 'workspace') return `workspace:${desk.workspacePath}`
  if (desk.integrationMode === 'linked') return `linked:${desk.sourceRepositoryUrl}`
  return 'DeskCloud native SDK/API'
}
