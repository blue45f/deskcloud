/**
 * @surveydesk/widget — 임베드 피드백 위젯.
 *
 * - React 소비자: `import { FeedbackWidget } from '@surveydesk/widget'`
 * - 클라이언트만 필요: `import { createSurveyDeskClient } from '@surveydesk/widget'`
 * - 바닐라(비-React) 사이트: `@surveydesk/widget/vanilla` 또는 IIFE 빌드(window.SurveyDesk)
 */
export {
  createSurveyDeskClient,
  NoActiveSurveyError,
  SurveyDeskError,
  type ResponseReceiptDto,
  type SubmitResponseInput,
  type SurveyDeskClient,
  type SurveyDeskClientOptions,
  type SurveyDto,
} from './client'

export { FeedbackWidget, type FeedbackWidgetProps, type WidgetPosition } from './react'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export { mount, init, type MountOptions, type WidgetHandle } from './vanilla'
