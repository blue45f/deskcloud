import { describe, expect, it } from 'vitest'

import { PRODUCT_DESKS } from './deskCatalog'
import {
  PUBLIC_SMOKE_ROUTES,
  REQUIRED_VERIFICATION_AREAS,
  buildPlatformIntegrationAudit,
} from './integrationVerification'

describe('platform integration verification audit', () => {
  it('covers every product Desk with microsite, dashboard, gateway, and runbook contracts', () => {
    const audit = buildPlatformIntegrationAudit()

    expect(audit.productDeskCount).toBe(PRODUCT_DESKS.length)
    expect(audit.productDeskCount).toBeGreaterThanOrEqual(17)
    expect(audit.verifiedDeskCount).toBe(PRODUCT_DESKS.length)
    expect(audit.failedDeskCount).toBe(0)
    expect(audit.criticalIssues).toEqual([])
    expect(audit.micrositeRouteCount).toBe(PRODUCT_DESKS.length)
    expect(audit.operationRouteCount).toBe(PRODUCT_DESKS.length)
    expect(audit.micrositeRoutes).toEqual(PRODUCT_DESKS.map((desk) => `/desks/${desk.id}`))

    for (const check of audit.deskChecks) {
      expect(check.contractStatus).toBe('verified')
      expect(check.contractIssues).toEqual([])
      expect(check.adminPath).toBe(`/dashboard?desk=${check.id}`)
      expect(check.gatewayPath).toMatch(/^\/[a-z]/)
      expect(
        check.readyCheckCount + check.needsConfigCount + check.watchCheckCount
      ).toBeGreaterThanOrEqual(3)
      expect(check.proofPoints).toEqual(
        expect.arrayContaining([
          `microsite:/desks/${check.id}`,
          `admin:/dashboard?desk=${check.id}`,
        ])
      )
    }
  })

  it('keeps the full verification matrix synchronized with public smoke routes', () => {
    const audit = buildPlatformIntegrationAudit()

    expect(audit.verificationAreaCount).toBeGreaterThanOrEqual(REQUIRED_VERIFICATION_AREAS.length)
    expect(audit.requiredAreaCount).toBe(REQUIRED_VERIFICATION_AREAS.length)
    expect(audit.missingRequiredAreas).toEqual([])
    expect(audit.publicRoutes).toEqual([...PUBLIC_SMOKE_ROUTES])
    expect(audit.publicRoutes).toEqual(
      expect.arrayContaining([
        '/',
        '/catalog',
        '/pricing',
        '/docs',
        '/design',
        '/sitemap',
        '/login',
        '/signup',
        '/admin/inquiries',
      ])
    )
    expect(REQUIRED_VERIFICATION_AREAS).toContain('운영 증거 트랙')
  })

  it('exposes executable evidence tracks for full integration verification', () => {
    const audit = buildPlatformIntegrationAudit()

    expect(audit.executionTrackCount).toBe(5)
    expect(audit.executionTargetCount).toBe(
      audit.executionTracks.reduce((sum, track) => sum + track.targetCount, 0)
    )
    expect(audit.executionTracks.map((track) => track.id)).toEqual([
      'static-contracts',
      'rendered-routes',
      'workspace-control-plane',
      'termsdesk-runtime',
      'admin-boundaries',
    ])

    for (const track of audit.executionTracks) {
      expect(track.targetCount).toBeGreaterThan(0)
      expect(track.command.length).toBeGreaterThan(10)
      expect(track.evidence.length).toBeGreaterThan(10)
      expect(track.command).not.toMatch(/(?:pk|sk)_[a-z0-9]+/i)
    }

    expect(audit.executionTracks.find((track) => track.id === 'rendered-routes')?.targetCount).toBe(
      PUBLIC_SMOKE_ROUTES.length + PRODUCT_DESKS.length
    )
    expect(
      audit.executionTracks.find((track) => track.id === 'workspace-control-plane')?.command
    ).toBe('pnpm run verify:prod-platform')
    expect(
      audit.executionTracks.find((track) => track.id === 'workspace-control-plane')?.targetCount
    ).toBe(2)
    expect(audit.executionTracks.find((track) => track.id === 'termsdesk-runtime')?.command).toBe(
      'curl -I https://3.107.235.143.nip.io/app/marketplace'
    )
    expect(
      audit.executionTracks.find((track) => track.id === 'admin-boundaries')?.evidence
    ).toContain('X-Admin-Token')
  })

  it('keeps special integration boundaries explicit for TermsDesk, AIDigestDesk, and workspace Desks', () => {
    const audit = buildPlatformIntegrationAudit()
    const termsdesk = audit.deskChecks.find((check) => check.id === 'termsdesk')
    const aiDigest = audit.deskChecks.find((check) => check.id === 'aidigestdesk')
    const seoGateway = audit.deskChecks.find((check) => check.id === 'seo-gateway')
    const remoteDevtools = audit.deskChecks.find((check) => check.id === 'remote-devtools')

    expect(audit.termsDeskBrokerageUrl).toBe('https://3.107.235.143.nip.io/app/marketplace')
    expect(audit.termsDeskExpertsUrl).toBe('https://3.107.235.143.nip.io/experts')
    expect(termsdesk?.runtimeBoundary).toBe('external runtime:https://3.107.235.143.nip.io')

    expect(aiDigest?.mode).toBe('linked')
    expect(aiDigest?.runtimeBoundary).toContain('https://github.com/blue45f/aidigestdesk')
    expect(audit.linkedDeskIds).toEqual(['aidigestdesk'])

    expect(seoGateway?.mode).toBe('workspace')
    expect(remoteDevtools?.mode).toBe('workspace')
    expect(audit.workspaceDeskIds.toSorted()).toEqual(['remote-devtools', 'seo-gateway'])
    expect(seoGateway?.runtimeBoundary).toBe('workspace:desks/seo-gateway')
    expect(remoteDevtools?.runtimeBoundary).toBe('workspace:desks/remote-devtools')
  })
})
