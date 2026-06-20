import { api } from './api'

import type {
  CampaignDto,
  CreateCampaignInput,
  CreateCreativeInput,
  CreateSlotInput,
  CreativeDto,
  SlotDto,
  StatsDto,
  TenantCreatedDto,
  TenantDto,
  UploadImageInput,
  UploadResultDto,
} from '@addesk/shared'

/** 공개 가입 — pk_/sk_ 키쌍 발급(인증 불요). */
export function signup(input: { name: string; corsOrigins?: string[] }): Promise<TenantCreatedDto> {
  return api.post<TenantCreatedDto>('tenants', input, false)
}

/** 내 테넌트 조회(sk_) — 로그인 검증에 사용. */
export function getTenant(): Promise<TenantDto> {
  return api.get<TenantDto>('tenant')
}

/* ── 통계 ──────────────────────────────────────────────────────────────────── */

export function getStats(): Promise<StatsDto> {
  return api.get<StatsDto>('ads/stats')
}

/* ── 캠페인 ────────────────────────────────────────────────────────────────── */

export function listCampaigns(): Promise<CampaignDto[]> {
  return api.get<CampaignDto[]>('ads/campaigns')
}

export function createCampaign(input: CreateCampaignInput): Promise<CampaignDto> {
  return api.post<CampaignDto>('ads/campaigns', input)
}

export function deleteCampaign(id: string): Promise<{ deleted: boolean; id: string }> {
  return api.delete<{ deleted: boolean; id: string }>(`ads/campaigns/${id}`)
}

/* ── 크리에이티브 ──────────────────────────────────────────────────────────── */

export function listCreatives(): Promise<CreativeDto[]> {
  return api.get<CreativeDto[]>('ads/creatives')
}

export function createCreative(input: CreateCreativeInput): Promise<CreativeDto> {
  return api.post<CreativeDto>('ads/creatives', input)
}

/** 이미지 업로드(sk_) — AdDesk 가 호스팅하는 절대 URL 을 받아 imageUrl 로 쓴다. */
export function uploadImage(input: UploadImageInput): Promise<UploadResultDto> {
  return api.post<UploadResultDto>('ads/uploads', input)
}

/** File → data: URL(base64) 로 읽는다(업로드 입력의 data 필드). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다'))
    reader.readAsDataURL(file)
  })
}

export function deleteCreative(id: string): Promise<{ deleted: boolean; id: string }> {
  return api.delete<{ deleted: boolean; id: string }>(`ads/creatives/${id}`)
}

/* ── 슬롯 ──────────────────────────────────────────────────────────────────── */

export function listSlots(): Promise<SlotDto[]> {
  return api.get<SlotDto[]>('ads/slots')
}

export function createSlot(input: CreateSlotInput): Promise<SlotDto> {
  return api.post<SlotDto>('ads/slots', input)
}

export function deleteSlot(id: string): Promise<{ deleted: boolean; id: string }> {
  return api.delete<{ deleted: boolean; id: string }>(`ads/slots/${id}`)
}
