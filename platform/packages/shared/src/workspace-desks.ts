import type { Plan, UsageMetric } from './constants'

export const WORKSPACE_DESK_IDS = ['aidigestdesk', 'seo-gateway', 'remote-devtools'] as const
export type WorkspaceDeskId = (typeof WORKSPACE_DESK_IDS)[number]

export type WorkspaceDeskKind = 'content' | 'render_gateway' | 'debugging'
export type WorkspaceDeskIntegrationStatus = 'workspace_integrated'

export interface WorkspaceDeskManifestItem {
  id: WorkspaceDeskId
  name: string
  kind: WorkspaceDeskKind
  integrationStatus: WorkspaceDeskIntegrationStatus
  workspacePath: string
  integrationPackage: string
  sourceRepositoryUrl: string
  liveUrl: null
  gatewayPath: string
  adminPath: string
  micrositePath: string
  primaryMetric: UsageMetric
  recommendedPlan: Plan
  controlPlane: string
  dataPlane: string
  readinessSummary: string
}

export interface WorkspaceDesksManifestDto {
  sourceOfTruth: string
  controlPlane: string
  standaloneRuntimePolicy: string
  items: readonly WorkspaceDeskManifestItem[]
}

export const WORKSPACE_DESK_MANIFEST: readonly WorkspaceDeskManifestItem[] = [
  {
    id: 'aidigestdesk',
    name: 'AIDigestDesk',
    kind: 'content',
    integrationStatus: 'workspace_integrated',
    workspacePath: 'desks/aidigestdesk',
    integrationPackage: '@aidigestdesk/content',
    sourceRepositoryUrl: 'https://github.com/blue45f/aidigestdesk',
    liveUrl: null,
    gatewayPath: '/aidigest',
    adminPath: '/dashboard?desk=aidigestdesk',
    micrositePath: '/desks/aidigestdesk',
    primaryMetric: 'events',
    recommendedPlan: 'pro',
    controlPlane:
      'DeskCloud tenant, Pages base path, source snapshot usage, editorial export audit',
    dataPlane: 'desks/aidigestdesk Vite portal and @aidigestdesk/content package',
    readinessSummary:
      'AIDigestDesk는 공개 콘텐츠 포털과 편집 데이터플레인을 유지하면서 DeskCloud에서 서비스 도메인, 콘텐츠 운영 이벤트, export run을 통합 관리합니다.',
  },
  {
    id: 'seo-gateway',
    name: 'SEOGatewayDesk',
    kind: 'render_gateway',
    integrationStatus: 'workspace_integrated',
    workspacePath: 'desks/seo-gateway',
    integrationPackage: '@heejun/spa-seo-gateway-core',
    sourceRepositoryUrl: 'https://github.com/blue45f/spa-seo-gateway',
    liveUrl: null,
    gatewayPath: '/seo-gateway',
    adminPath: '/dashboard?desk=seo-gateway',
    micrositePath: '/desks/seo-gateway',
    primaryMetric: 'api_calls',
    recommendedPlan: 'scale',
    controlPlane: 'DeskCloud tenant, service origin, gateway path, render usage, plan limit',
    dataPlane: 'desks/seo-gateway Fastify renderer, Puppeteer pool, cache/SWR, quality gates',
    readinessSummary:
      'SEOGatewayDesk는 별도 제품으로 분리 운영하지 않습니다. Fastify 렌더 데이터플레인은 desks/seo-gateway에 두고, 가입회사·서비스 도메인·렌더 사용량·요금 한도는 DeskCloud 콘솔에서 통합 운영합니다.',
  },
  {
    id: 'remote-devtools',
    name: 'RemoteDevTools',
    kind: 'debugging',
    integrationStatus: 'workspace_integrated',
    workspacePath: 'desks/remote-devtools',
    integrationPackage: 'remote-debug-sdk',
    sourceRepositoryUrl: 'https://github.com/blue45f/remote-devtools',
    liveUrl: null,
    gatewayPath: '/remote-devtools',
    adminPath: '/dashboard?desk=remote-devtools',
    micrositePath: '/desks/remote-devtools',
    primaryMetric: 'events',
    recommendedPlan: 'scale',
    controlPlane:
      'DeskCloud tenant, SDK allowed origin, WS gateway, session usage, integration status',
    dataPlane: 'desks/remote-devtools NestJS/TypeORM CDP gateway, rrweb replay, S3 backup',
    readinessSummary:
      'RemoteDevTools도 분리 운영 대상이 아닙니다. CDP/rrweb/WebSocket 데이터플레인은 desks/remote-devtools에 보존하고, 조직·origin·세션 사용량·연동 상태는 DeskCloud 운영 콘솔에서 통합 관리합니다.',
  },
]

export const WORKSPACE_DESKS_MANIFEST: WorkspaceDesksManifestDto = {
  sourceOfTruth: '/Users/hjunkim/WebstormProjects/deskcloud',
  controlPlane:
    'DeskCloud tenant, service origin allowlist, key rotation, usage, plan, billing, admin console',
  standaloneRuntimePolicy:
    'Workspace Desk는 별도 운영 제품으로 분리하지 않는다. 성능 또는 세션 상태가 중요한 데이터플레인만 각 workspace path에 보존하고, 고객 운영 경계는 DeskCloud control-plane으로 통합한다.',
  items: WORKSPACE_DESK_MANIFEST,
}

export function workspaceDeskManifestById(id: string): WorkspaceDeskManifestItem | undefined {
  return WORKSPACE_DESK_MANIFEST.find((item) => item.id === id)
}

export function getWorkspaceDesksManifest(): WorkspaceDesksManifestDto {
  return WORKSPACE_DESKS_MANIFEST
}
