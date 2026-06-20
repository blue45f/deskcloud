import { api } from './api'

import type {
  FileListDto,
  FileStatsDto,
  TenantCredentialsDto,
  TenantDto,
} from '@filedesk/shared'


/** 공개 가입 — pk_/sk_ 키쌍 발급(인증 불요). */
export function signup(input: {
  name: string
  corsOrigins?: string[]
}): Promise<TenantCredentialsDto> {
  return api.post<TenantCredentialsDto>('tenants', input, false)
}

/** 내 테넌트 조회(sk_) — 로그인 검증에 사용. */
export function getTenant(): Promise<TenantDto> {
  return api.get<TenantDto>('tenant')
}

/** 파일 목록(sk_). */
export function listFiles(query: {
  limit?: number
  offset?: number
  visibility?: 'public' | 'private'
}): Promise<FileListDto> {
  return api.get<FileListDto>('files', query)
}

/** 파일 통계(sk_). */
export function getStats(): Promise<FileStatsDto> {
  return api.get<FileStatsDto>('files/stats')
}

/** 파일 삭제(sk_). */
export function deleteFile(id: string): Promise<{ deleted: boolean; id: string }> {
  return api.delete<{ deleted: boolean; id: string }>(`files/${id}`)
}
