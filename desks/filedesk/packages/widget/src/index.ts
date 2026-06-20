/**
 * @filedesk/widget — 임베드 파일 업로드 위젯.
 *
 * - React 소비자: `import { FileUpload } from '@filedesk/widget'`
 * - 클라이언트(SDK)만 필요: `import { createFileDeskClient } from '@filedesk/widget'`
 * - 바닐라(비-React) 사이트: `@filedesk/widget/vanilla` 또는 IIFE 빌드(window.FileDesk)
 *
 * 위젯은 publishable(`pk_`) 키로 파일을 업로드한다(브라우저 노출 안전). 목록·삭제·통계는
 * 서버에서 secret(`sk_`) 키를 쓴다. 서버는 Origin 도 테넌트별로 검사한다.
 */
export {
  createFileDeskClient,
  FileDeskError,
  type FileDeskClient,
  type FileDeskClientOptions,
  type UploadInput,
  type UploadOptions,
  type UploadResultDto,
  type Visibility,
} from './client'

export { FileUpload, type FileUploadProps } from './react'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export { mount, init, type MountOptions, type WidgetHandle } from './vanilla'
