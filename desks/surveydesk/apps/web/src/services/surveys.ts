import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  CreateSurveyInput,
  ResponseDto,
  ResponseListDto,
  SurveyDto,
  SurveySummary,
  UpdateSurveyInput,
} from '@surveydesk/shared'

/* ──────────────────────────────────────────────────────────────────────────
   어드민 설문·응답·집계 데이터 훅. 모든 요청은 api 클라이언트가 X-Admin-Token 을
   자동으로 싣는다(app/adminStore). appId 별로 캐시 키를 분리한다.
   ────────────────────────────────────────────────────────────────────────── */

export const surveysKey = (appId: string) => ['surveys', appId] as const
export const summaryKey = (appId: string) => ['summary', appId] as const
export const responsesKey = (appId: string, offset: number, limit: number) =>
  ['responses', appId, offset, limit] as const

/** appId 의 설문 버전 목록(최신순). */
export function useSurveys(appId: string) {
  return useQuery({
    queryKey: surveysKey(appId),
    queryFn: () => api.get<SurveyDto[]>(`admin/surveys/${appId}`),
    enabled: appId.length > 0,
  })
}

/** appId 의 집계(활성/최신 버전 기준). 설문이 없으면 404 → data 는 undefined. */
export function useSummary(appId: string) {
  return useQuery({
    queryKey: summaryKey(appId),
    queryFn: () => api.get<SurveySummary>(`admin/surveys/${appId}/summary`),
    enabled: appId.length > 0,
    retry: false,
  })
}

export interface ResponsesPage extends ResponseListDto {
  totalCount: number | null
}

/** appId 의 응답 목록(페이지네이션). X-Total-Count 헤더도 함께 읽는다. */
export function useResponses(appId: string, offset: number, limit: number) {
  return useQuery({
    queryKey: responsesKey(appId, offset, limit),
    queryFn: async (): Promise<ResponsesPage> => {
      const { data, totalCount } = await api.getWithHeaders<ResponseListDto>(
        `admin/surveys/${appId}/responses`,
        { offset, limit }
      )
      return { ...data, totalCount: totalCount ?? data.total }
    },
    enabled: appId.length > 0,
    placeholderData: (prev) => prev,
  })
}

/**
 * 전체 응답을 페이지 단위로 모아 한 배열로 반환한다(CSV 내보내기용). 서버는 offset/limit
 * 만 지원하므로 클라이언트가 순차로 끝까지 읽는다. 안전장치로 최대치를 둔다.
 */
export async function fetchAllResponses(
  appId: string,
  { pageSize = 200, max = 50_000 }: { pageSize?: number; max?: number } = {}
): Promise<ResponseDto[]> {
  const all: ResponseDto[] = []
  let offset = 0
  for (;;) {
    const { data } = await api.getWithHeaders<ResponseListDto>(`admin/surveys/${appId}/responses`, {
      offset,
      limit: pageSize,
    })
    all.push(...data.items)
    offset += data.items.length
    if (data.items.length < pageSize || all.length >= max || data.items.length === 0) break
  }
  return all
}

/** 새 설문 버전 생성(비활성). */
export function useCreateSurvey(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSurveyInput) => api.post<SurveyDto>(`admin/surveys/${appId}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: surveysKey(appId) }),
  })
}

/** 설문(특정 버전) 수정. */
export function useUpdateSurvey(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ version, input }: { version: number; input: UpdateSurveyInput }) =>
      api.put<SurveyDto>(`admin/surveys/${appId}/${version}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: surveysKey(appId) })
      void qc.invalidateQueries({ queryKey: summaryKey(appId) })
    },
  })
}

/** 설문(특정 버전) 활성화 — 기존 활성본은 자동 비활성. */
export function useActivateSurvey(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (version: number) =>
      api.post<SurveyDto>(`admin/surveys/${appId}/${version}/activate`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: surveysKey(appId) })
      void qc.invalidateQueries({ queryKey: summaryKey(appId) })
    },
  })
}
