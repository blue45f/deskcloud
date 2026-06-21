import type { DeskEntry } from './deskCatalog'
import type { WorkspaceDeskManifestItem, WorkspaceDesksManifestDto } from '@desk/shared/browser'

export type WorkspaceDeskManifestSyncStatus = 'api_synced' | 'api_field_mismatch' | 'api_missing'

export interface WorkspaceDeskConsoleItem {
  desk: DeskEntry
  apiItem?: WorkspaceDeskManifestItem
  syncStatus: WorkspaceDeskManifestSyncStatus
  mismatchedFields: readonly string[]
}

export interface WorkspaceDeskConsoleState {
  apiReachable: boolean
  apiItemCount: number
  catalogItemCount: number
  missingFromApi: readonly string[]
  extraFromApi: readonly string[]
  policyVerified: boolean
  sourceOfTruth?: string
  controlPlane?: string
  standaloneRuntimePolicy?: string
  items: readonly WorkspaceDeskConsoleItem[]
}

const POLICY_KEYWORDS = ['분리하지 않는다', 'DeskCloud control-plane'] as const

export function buildWorkspaceDeskConsoleState(
  workspaceDesks: readonly DeskEntry[],
  manifest?: WorkspaceDesksManifestDto
): WorkspaceDeskConsoleState {
  const apiItems = manifest?.items ?? []
  const apiById = new Map<string, WorkspaceDeskManifestItem>(
    apiItems.map((item) => [item.id, item])
  )
  const catalogById = new Map<string, DeskEntry>(workspaceDesks.map((desk) => [desk.id, desk]))
  const apiIds = new Set<string>(apiById.keys())
  const catalogIds = new Set<string>(catalogById.keys())

  const missingFromApi = workspaceDesks.map((desk) => desk.id).filter((id) => !apiIds.has(id))
  const extraFromApi = apiItems.map((item) => item.id).filter((id) => !catalogIds.has(id))

  return {
    apiReachable: Boolean(manifest),
    apiItemCount: apiItems.length,
    catalogItemCount: workspaceDesks.length,
    missingFromApi,
    extraFromApi,
    policyVerified: POLICY_KEYWORDS.every((keyword) =>
      manifest?.standaloneRuntimePolicy.includes(keyword)
    ),
    sourceOfTruth: manifest?.sourceOfTruth,
    controlPlane: manifest?.controlPlane,
    standaloneRuntimePolicy: manifest?.standaloneRuntimePolicy,
    items: workspaceDesks.map((desk) => {
      const apiItem = apiById.get(desk.id)
      if (!apiItem) {
        return {
          desk,
          syncStatus: 'api_missing',
          mismatchedFields: [],
        }
      }

      const mismatchedFields = manifestMismatchedFields(desk, apiItem)

      return {
        desk,
        apiItem,
        syncStatus: mismatchedFields.length === 0 ? 'api_synced' : 'api_field_mismatch',
        mismatchedFields,
      }
    }),
  }
}

function manifestMismatchedFields(
  desk: DeskEntry,
  apiItem: WorkspaceDeskManifestItem
): readonly string[] {
  const expected = {
    id: desk.id,
    name: desk.name,
    integrationStatus: 'workspace_integrated',
    workspacePath: desk.workspacePath,
    integrationPackage: desk.integrationPackage,
    sourceRepositoryUrl: desk.sourceRepositoryUrl,
    liveUrl: null,
    adminPath: `/dashboard?desk=${desk.id}`,
    micrositePath: `/desks/${desk.id}`,
  }

  return Object.entries(expected)
    .filter(([key, value]) => apiItem[key as keyof WorkspaceDeskManifestItem] !== value)
    .map(([key]) => key)
}
