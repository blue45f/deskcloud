import { useQuery } from '@tanstack/react-query'

import { api } from './api'

import type { ConsentReceiptDto } from '@termsdesk/shared'

export interface ConsentFilter {
  subjectRef?: string
  policySlug?: string
  decision?: string
  method?: string
  from?: string
  to?: string
}

export function useConsents(filter: ConsentFilter = {}) {
  return useQuery({
    queryKey: ['consents', filter],
    queryFn: () =>
      api.get<ConsentReceiptDto[]>('consents', {
        subjectRef: filter.subjectRef,
        policySlug: filter.policySlug,
        decision: filter.decision,
        method: filter.method,
        from: filter.from,
        to: filter.to,
      }),
  })
}

export function useSubjectHistory(subjectRef: string | undefined) {
  return useQuery({
    queryKey: ['consent-history', subjectRef],
    queryFn: () => api.get<ConsentReceiptDto[]>(`consents/subject/${subjectRef}`),
    enabled: Boolean(subjectRef),
  })
}
