import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  InquiryCategory,
  InquiryDto,
  InquiryListDto,
  InquiryStatus,
  UpdateInquiryInput,
} from '@termsdesk/shared'

export interface InquiryFilter {
  status?: InquiryStatus
  category?: InquiryCategory
  site?: string
}

export const inquiryKeys = {
  all: ['inquiries'] as const,
  list: (filter: InquiryFilter) => ['inquiries', 'list', filter] as const,
  one: (id: string) => ['inquiry', id] as const,
}

export function useInquiries(filter: InquiryFilter = {}) {
  return useQuery({
    queryKey: inquiryKeys.list(filter),
    queryFn: () =>
      api.get<InquiryListDto>('inquiries', {
        status: filter.status,
        category: filter.category,
        site: filter.site,
      }),
  })
}

export function useInquiry(id: string | undefined) {
  return useQuery({
    queryKey: inquiryKeys.one(id ?? ''),
    queryFn: () => api.get<InquiryDto>(`inquiries/${id}`),
    enabled: Boolean(id),
  })
}

export function useUpdateInquiry(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateInquiryInput) => api.patch<InquiryDto>(`inquiries/${id}`, input),
    // 낙관적 갱신 — 상태·메모는 가역 조작이라 보드/상세 캐시에 즉시 반영. 실패 시 스냅샷 롤백.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: inquiryKeys.all })
      await qc.cancelQueries({ queryKey: inquiryKeys.one(id) })
      const previousLists = qc.getQueriesData<InquiryListDto>({ queryKey: inquiryKeys.all })
      const previousOne = qc.getQueryData<InquiryDto>(inquiryKeys.one(id))
      const apply = (q: InquiryDto): InquiryDto => ({
        ...q,
        status: input.status ?? q.status,
        adminNote: input.adminNote === undefined ? q.adminNote : input.adminNote,
      })
      qc.setQueriesData<InquiryListDto>({ queryKey: inquiryKeys.all }, (data) =>
        data ? { ...data, items: data.items.map((it) => (it.id === id ? apply(it) : it)) } : data
      )
      qc.setQueryData<InquiryDto>(inquiryKeys.one(id), (q) => (q ? apply(q) : q))
      return { previousLists, previousOne }
    },
    onError: (_e, _input, ctx) => {
      for (const [key, data] of ctx?.previousLists ?? []) qc.setQueryData(key, data)
      if (ctx?.previousOne) qc.setQueryData(inquiryKeys.one(id), ctx.previousOne)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: inquiryKeys.all })
      void qc.invalidateQueries({ queryKey: inquiryKeys.one(id) })
    },
  })
}
