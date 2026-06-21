import { describe, expect, it } from 'vitest'

import {
  WORKSPACE_DESK_IDS,
  WORKSPACE_DESK_MANIFEST,
  getWorkspaceDesksManifest,
  workspaceDeskManifestById,
} from './workspace-desks'

describe('workspace Desk manifest', () => {
  it('keeps absorbed non-native Desk source-of-truth in DeskCloud', () => {
    const manifest = getWorkspaceDesksManifest()

    expect(manifest.sourceOfTruth).toBe('/Users/hjunkim/WebstormProjects/deskcloud')
    expect(manifest.controlPlane).toContain('DeskCloud')
    expect(manifest.standaloneRuntimePolicy).toContain('별도 운영 제품으로 분리하지 않는다')
    expect(manifest.items.map((item) => item.id)).toEqual([...WORKSPACE_DESK_IDS])
  })

  it('keeps every workspace Desk addressable from console, microsite, and gateway boundaries', () => {
    for (const item of WORKSPACE_DESK_MANIFEST) {
      expect(item.integrationStatus).toBe('workspace_integrated')
      expect(item.workspacePath).toBe(`desks/${item.id}`)
      expect(item.sourceRepositoryUrl).toMatch(/^https:\/\/github\.com\/blue45f\//)
      expect(item.liveUrl).toBeNull()
      expect(item.gatewayPath).toBe(`/${item.id}`)
      expect(item.adminPath).toBe(`/dashboard?desk=${item.id}`)
      expect(item.micrositePath).toBe(`/desks/${item.id}`)
      expect(item.controlPlane).toContain('DeskCloud')
      expect(item.dataPlane).toContain(item.workspacePath)
      expect(item.readinessSummary.length).toBeGreaterThan(80)
      expect(workspaceDeskManifestById(item.id)).toBe(item)
    }
  })
})
