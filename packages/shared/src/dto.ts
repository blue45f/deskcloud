import type { SurveyQuestion } from './schemas'

/** 위젯/대시보드에 노출되는 설문 표현(서버 직렬화 결과). */
export interface SurveyDto {
  appId: string
  version: number
  title: string
  intro: string | null
  questions: SurveyQuestion[]
  active: boolean
  createdAt: string
  updatedAt: string
}

/** 위젯용 활성 설문 — 활성본이 없으면 active:false 로 빈 표현을 줄 수도 있으나,
 * 현재 API 는 활성본 없으면 404 를 반환한다(SurveyDto 그대로 사용). */
export type ActiveSurveyDto = SurveyDto

/** 응답 제출 영수증 — 제출자에게 돌려주는 최소 정보(본문 미반환). */
export interface ResponseReceiptDto {
  id: string
  appId: string
  surveyVersion: number
  createdAt: string
}

/** 어드민 응답 목록의 단건. */
export interface ResponseDto {
  id: string
  appId: string
  surveyVersion: number
  answers: Record<string, unknown>
  respondentUserId: string | null
  respondentEmail: string | null
  meta: { pageUrl?: string; userAgent?: string; referrer?: string } | null
  createdAt: string
}

/** 어드민 응답 목록(페이지네이션). */
export interface ResponseListDto {
  items: ResponseDto[]
  /** 같은 필터의 전체 건수(X-Total-Count 헤더와 동일 값). */
  total: number
  offset: number
  limit: number
}
