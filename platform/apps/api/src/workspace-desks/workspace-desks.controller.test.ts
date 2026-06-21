import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { WorkspaceDesksController } from './workspace-desks.controller'

describe('WorkspaceDesksController', () => {
  const controller = new WorkspaceDesksController()

  it('returns the DeskCloud workspace Desk manifest', () => {
    const manifest = controller.list()

    expect(manifest.sourceOfTruth).toBe('/Users/hjunkim/WebstormProjects/deskcloud')
    expect(manifest.controlPlane).toContain('DeskCloud')
    expect(manifest.items.map((item) => item.id).toSorted()).toEqual([
      'remote-devtools',
      'seo-gateway',
    ])
  })

  it('returns developer-tool workspace Desks without standalone live URLs', () => {
    for (const id of ['seo-gateway', 'remote-devtools'] as const) {
      const item = controller.get(id)

      expect(item.integrationStatus).toBe('workspace_integrated')
      expect(item.gatewayPath).toBe(`/${id}`)
      expect(item.adminPath).toBe(`/dashboard?desk=${id}`)
      expect(item.liveUrl).toBeNull()
      expect(item.readinessSummary).toContain('분리 운영')
      expect(item.controlPlane).toContain('DeskCloud')
      expect(item.dataPlane).toContain(`desks/${id}`)
    }
  })

  it('rejects unknown workspace Desk ids', () => {
    expect(() => controller.get('remote-devtools-old')).toThrow(NotFoundException)
    expect(() => controller.get('aidigestdesk')).toThrow(NotFoundException)
  })
})
