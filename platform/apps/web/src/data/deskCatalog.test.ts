import {
  WORKSPACE_DESKS_MANIFEST,
  WORKSPACE_DESK_MANIFEST,
  workspaceDeskManifestById,
} from '@desk/shared/browser'
import { describe, expect, it } from 'vitest'

import {
  DESK_DETAILS,
  DESK_OPERATIONS,
  DESK_READINESS,
  PRODUCT_DESKS,
  apiEndpoint,
  deskDetails,
  deskMicrositePath,
  deskOperations,
  deskReadiness,
  sdkSnippet,
} from './deskCatalog'
import { buildWorkspaceDeskConsoleState } from './workspaceDeskConsole'

describe('DeskCloud catalog contracts', () => {
  it('keeps every product Desk wired to operations, details, and console routes', () => {
    const ids = PRODUCT_DESKS.map((desk) => desk.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(17)

    for (const desk of PRODUCT_DESKS) {
      expect(DESK_OPERATIONS).toHaveProperty(desk.id)
      expect(DESK_DETAILS).toHaveProperty(desk.id)

      const operations = deskOperations(desk)
      const details = deskDetails(desk)
      const readiness = deskReadiness(desk)

      expect(operations.adminPath).toBe(`/dashboard?desk=${desk.id}`)
      expect(operations.gatewayPath).toMatch(/^\/[a-z]/)
      expect(operations.config.length).toBeGreaterThan(0)
      expect(operations.operatorTasks.length).toBeGreaterThan(0)
      expect(details.summary.length).toBeGreaterThan(80)
      expect(details.bestFor.length).toBeGreaterThan(0)
      expect(details.dataModel.length).toBeGreaterThan(0)
      expect(details.adminGuide.length).toBeGreaterThan(0)
      expect(details.integrationGuide.length).toBeGreaterThan(0)
      expect(details.domainIsolation.length).toBeGreaterThan(40)
      expect(readiness.summary.length).toBeGreaterThan(80)
      expect(readiness.controlPlane.length).toBeGreaterThan(20)
      expect(readiness.dataPlane.length).toBeGreaterThan(20)
      expect(readiness.checks.length).toBeGreaterThanOrEqual(3)
      for (const check of readiness.checks) {
        expect(['ready', 'needs_config', 'watch']).toContain(check.status)
        expect(check.label.length).toBeGreaterThan(3)
        expect(check.description.length).toBeGreaterThan(20)
      }
      expect(deskMicrositePath(desk)).toBe(`/desks/${desk.id}`)
    }
  })

  it('keeps absorbed non-native Desks integrated as workspace Desks', () => {
    const workspaceDesks = PRODUCT_DESKS.filter((desk) => desk.integrationMode === 'workspace')
    const manifestIds = WORKSPACE_DESK_MANIFEST.map((item) => item.id)

    expect(workspaceDesks.map((desk) => desk.id).toSorted()).toEqual([...manifestIds].toSorted())

    for (const desk of workspaceDesks) {
      const manifest = workspaceDeskManifestById(desk.id)
      const operations = deskOperations(desk)
      const details = deskDetails(desk)
      const readiness = deskReadiness(desk)

      expect(manifest).toBeDefined()
      expect(desk.workspacePath).toBe(manifest?.workspacePath)
      expect(desk.integrationPackage).toBe(manifest?.integrationPackage)
      expect(desk.sourceRepositoryUrl).toBe(manifest?.sourceRepositoryUrl)
      expect(desk.liveUrl).toBeUndefined()
      expect(operations.gatewayPath).toBe(manifest?.gatewayPath)
      expect(operations.primaryMetric).toBe(manifest?.primaryMetric)
      expect(operations.recommendedPlan).toBe(manifest?.recommendedPlan)
      expect(details.summary).toContain(desk.name)
      expect(details.domainIsolation).toContain('DeskCloud')
      expect(DESK_READINESS).toHaveProperty(desk.id)
      expect(readiness.summary).toBe(manifest?.readinessSummary)
      expect(readiness.controlPlane).toBe(manifest?.controlPlane)
      expect(readiness.dataPlane).toBe(manifest?.dataPlane)
    }
  })

  it('serves workspace Desk snippets from integrated runtime boundaries', () => {
    const aiDigest = PRODUCT_DESKS.find((desk) => desk.id === 'aidigestdesk')
    const seoGateway = PRODUCT_DESKS.find((desk) => desk.id === 'seo-gateway')
    const remoteDevtools = PRODUCT_DESKS.find((desk) => desk.id === 'remote-devtools')

    expect(aiDigest).toBeDefined()
    expect(seoGateway).toBeDefined()
    expect(remoteDevtools).toBeDefined()

    const aiDigestSnippet = sdkSnippet(aiDigest!)
    const seoSnippet = sdkSnippet(seoGateway!)
    const remoteSnippet = sdkSnippet(remoteDevtools!)

    expect(aiDigest?.name).toBe('AIDigestDesk')
    expect(aiDigestSnippet).toContain('@aidigestdesk/content')
    expect(aiDigestSnippet).toContain('getSourceSnapshotCandidates')

    expect(seoGateway?.name).toBe('SEOGatewayDesk')
    expect(seoSnippet).toContain('@heejun/spa-seo-gateway-core')
    expect(seoSnippet).toContain('registerAdminUI')
    expect(seoSnippet).toContain('Fastify')

    expect(remoteDevtools?.name).toBe('RemoteDevTools')
    expect(remoteSnippet).toContain(`${apiEndpoint()}/remote-devtools/sdk/index.umd.js`)
    expect(remoteSnippet).toContain('RemoteDebugSdk')
    expect(remoteSnippet).not.toContain('remote-devtools.vercel.app')
  })

  it('keeps TermsDesk brokerage access pointed at the live TermsDesk runtime', () => {
    const termsdesk = PRODUCT_DESKS.find((desk) => desk.id === 'termsdesk')

    expect(termsdesk).toBeDefined()
    expect(termsdesk?.liveUrl).toBe('https://3.107.235.143.nip.io')
    expect(deskOperations(termsdesk!).gatewayPath).toBe('/terms')
    expect(sdkSnippet(termsdesk!)).toContain("endpoint: 'https://3.107.235.143.nip.io'")
  })

  it('keeps developer-tool Desks under the DeskCloud control plane', () => {
    const developerDeskIds = ['seo-gateway', 'remote-devtools'] as const

    for (const id of developerDeskIds) {
      const desk = PRODUCT_DESKS.find((candidate) => candidate.id === id)

      expect(desk).toBeDefined()
      expect(desk?.integrationMode).toBe('workspace')
      expect(desk?.workspacePath).toBe(`desks/${id}`)
      expect(desk?.liveUrl).toBeUndefined()

      const operations = deskOperations(desk!)
      const details = deskDetails(desk!)
      const readiness = deskReadiness(desk!)

      expect(operations.adminPath).toBe(`/dashboard?desk=${id}`)
      expect(operations.gatewayPath).toBe(`/${id}`)
      expect(details.summary).toContain('DeskCloud')
      expect(details.summary).toContain('콘솔')
      expect(details.integrationGuide.join('\n')).toContain('DeskCloud')
      expect(readiness.summary).toContain('분리 운영')
      expect(readiness.controlPlane).toContain('DeskCloud')
      expect(readiness.checks.map((check) => check.status)).toContain('needs_config')
    }
  })

  it('builds a console control-plane state from the live workspace manifest contract', () => {
    const workspaceDesks = PRODUCT_DESKS.filter((desk) => desk.integrationMode === 'workspace')
    const state = buildWorkspaceDeskConsoleState(workspaceDesks, WORKSPACE_DESKS_MANIFEST)

    expect(state.apiReachable).toBe(true)
    expect(state.apiItemCount).toBe(WORKSPACE_DESK_MANIFEST.length)
    expect(state.catalogItemCount).toBe(workspaceDesks.length)
    expect(state.missingFromApi).toEqual([])
    expect(state.extraFromApi).toEqual([])
    expect(state.policyVerified).toBe(true)
    expect(state.controlPlane).toContain('admin console')

    for (const item of state.items) {
      expect(item.syncStatus).toBe('api_synced')
      expect(item.mismatchedFields).toEqual([])
      expect(item.apiItem?.adminPath).toBe(`/dashboard?desk=${item.desk.id}`)
      expect(item.apiItem?.micrositePath).toBe(`/desks/${item.desk.id}`)
      expect(item.apiItem?.liveUrl).toBeNull()
    }
  })

  it('keeps the workspace console usable when the manifest API is unavailable', () => {
    const workspaceDesks = PRODUCT_DESKS.filter((desk) => desk.integrationMode === 'workspace')
    const state = buildWorkspaceDeskConsoleState(workspaceDesks)

    expect(state.apiReachable).toBe(false)
    expect(state.apiItemCount).toBe(0)
    expect(state.catalogItemCount).toBe(workspaceDesks.length)
    expect(state.missingFromApi).toEqual(workspaceDesks.map((desk) => desk.id))
    expect(state.extraFromApi).toEqual([])
    expect(state.policyVerified).toBe(false)
    expect(state.items.map((item) => item.syncStatus)).toEqual(
      workspaceDesks.map(() => 'api_missing')
    )
  })
})
