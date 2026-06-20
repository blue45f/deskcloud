import { useQuery } from '@tanstack/react-query'

import { api } from './api'

import type { ApiKeyUsageDto, ConsentTrendPointDto, ReconsentStatusDto } from '@termsdesk/shared'

/**
 * 대시보드 운영 인사이트. 카드별 권한이 다르므로(consent.read / policy.read / apikey.manage)
 * 403 은 재시도하지 않고 카드 단위로 조용히 숨긴다.
 */
const noRetryOn403 = (failureCount: number, error: unknown) => {
  const status = (error as { status?: number }).status
  if (status === 403 || status === 401) return false
  return failureCount < 2
}

export function useConsentTrend(days = 30) {
  return useQuery({
    queryKey: ['insights', 'consent-trend', days],
    queryFn: () => api.get<ConsentTrendPointDto[]>('insights/consents/daily', { days }),
    retry: noRetryOn403,
  })
}

export function useReconsentStatus() {
  return useQuery({
    queryKey: ['insights', 'reconsent'],
    queryFn: () => api.get<ReconsentStatusDto[]>('insights/reconsent'),
    retry: noRetryOn403,
  })
}

export function useApiKeyUsage() {
  return useQuery({
    queryKey: ['insights', 'apikeys'],
    queryFn: () => api.get<ApiKeyUsageDto>('insights/apikeys'),
    retry: noRetryOn403,
  })
}
