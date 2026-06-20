import { api } from './api'

import type {
  AdminEntryListDto,
  ChangelogEntryDto,
  CreateEntryInput,
  CreateTenantInput,
  OkDto,
  TenantDto,
  TenantWithKeysDto,
  UpdateEntryInput,
  UpdateTenantInput,
} from '@changelogdesk/shared'

// ── 테넌트(외부 온보딩) ──────────────────────────────────────────────────────

/** 셀프서브 가입(공개) — pk/sk 발급. secretKey 는 이 응답에서만 1회 노출. */
export function signup(input: CreateTenantInput): Promise<TenantWithKeysDto> {
  return api.publicPost<TenantWithKeysDto>('tenants', input)
}

/** 현재 자격증명의 테넌트 조회(설정·pk·사용량). */
export function getTenant(): Promise<TenantDto> {
  return api.get<TenantDto>('admin/tenant')
}

/** 테넌트 설정 변경 — corsOrigins / plan. */
export function updateTenant(input: UpdateTenantInput): Promise<TenantDto> {
  return api.put<TenantDto>('admin/tenant', input)
}

/** 키 회전 — 새 pk/sk 발급. secretKey 1회 노출. */
export function rotateKeys(): Promise<TenantWithKeysDto> {
  return api.post<TenantWithKeysDto>('admin/tenant/rotate-keys')
}

// ── 체인지로그 항목 CRUD ─────────────────────────────────────────────────────

/** 항목 목록(게시·미게시 모두, 최신순). */
export function listEntries(): Promise<AdminEntryListDto> {
  return api.get<AdminEntryListDto>('admin/changelog')
}

/** 항목 단건. */
export function getEntry(id: string): Promise<ChangelogEntryDto> {
  return api.get<ChangelogEntryDto>(`admin/changelog/${id}`)
}

/** 항목 생성(isPublished=true 면 즉시 게시). */
export function createEntry(input: CreateEntryInput): Promise<ChangelogEntryDto> {
  return api.post<ChangelogEntryDto>('admin/changelog', input)
}

/** 항목 수정(부분 갱신·게시 토글). */
export function updateEntry(id: string, input: UpdateEntryInput): Promise<ChangelogEntryDto> {
  return api.put<ChangelogEntryDto>(`admin/changelog/${id}`, input)
}

/** 항목 삭제. */
export function deleteEntry(id: string): Promise<OkDto> {
  return api.delete<OkDto>(`admin/changelog/${id}`)
}
