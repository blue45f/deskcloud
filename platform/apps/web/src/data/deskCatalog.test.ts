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

    expect(workspaceDesks.map((desk) => desk.id).toSorted()).toEqual([
      'aidigestdesk',
      'remote-devtools',
      'seo-gateway',
    ])

    for (const desk of workspaceDesks) {
      const operations = deskOperations(desk)
      const details = deskDetails(desk)
      const readiness = deskReadiness(desk)

      expect(desk.workspacePath).toMatch(/^desks\//)
      expect(desk.integrationPackage).toBeTruthy()
      expect(desk.sourceRepositoryUrl).toMatch(/^https:\/\/github\.com\/blue45f\//)
      expect(desk.liveUrl).toBeUndefined()
      expect(operations.recommendedPlan).toBeTruthy()
      expect(details.summary).toContain(desk.name)
      expect(details.domainIsolation).toContain('DeskCloud')
      expect(DESK_READINESS).toHaveProperty(desk.id)
      expect(readiness.summary).toContain('DeskCloud')
      expect(readiness.controlPlane).toContain('DeskCloud')
      expect(readiness.dataPlane).toContain(desk.workspacePath)
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
})
