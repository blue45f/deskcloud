/**
 * @authdesk/widget — 임베드 인증 위젯.
 *
 * - React 소비자: `import { AuthForm } from '@authdesk/widget'`
 * - 클라이언트(SDK)만 필요: `import { createAuthDeskClient } from '@authdesk/widget'`
 * - 바닐라(비-React) 사이트: `@authdesk/widget/vanilla` 또는 IIFE 빌드(window.AuthDesk)
 *
 * 위젯은 publishable(`pk_`) 키로 end-user 를 가입/로그인시킨다(브라우저 노출 안전).
 * 사용자 목록·통계는 서버에서 secret(`sk_`) 키를 쓴다. 서버는 Origin 도 테넌트별로 검사한다.
 */
export {
  createAuthDeskClient,
  AuthDeskError,
  type AuthDeskClient,
  type AuthDeskClientOptions,
  type AuthResultDto,
  type EndUserDto,
  type LoginInput,
  type RegisterInput,
} from './client'

export { AuthForm, type AuthFormProps, type AuthMode } from './react'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export { mount, init, type MountOptions, type WidgetHandle } from './vanilla'
