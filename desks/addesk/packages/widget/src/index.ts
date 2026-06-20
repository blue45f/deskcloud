/**
 * @addesk/widget — 임베드 배너 광고 위젯.
 *
 * - React 소비자: `import { AdSlot } from '@addesk/widget'`
 * - 클라이언트(SDK)만 필요: `import { createAdDeskClient } from '@addesk/widget'`
 * - 바닐라(비-React) 사이트: `@addesk/widget/vanilla` 또는 IIFE 빌드(window.AdDesk)
 *
 * 위젯은 publishable(`pk_`) 키로 슬롯에 활성 크리에이티브를 서빙받아 노출하고, 노출/클릭을
 * 추적한다(브라우저 노출 안전). 캠페인/크리에이티브/슬롯 CRUD·통계는 서버에서 secret(`sk_`) 키를
 * 쓴다. 서버는 Origin 도 테넌트별로 검사한다.
 */
export {
  createAdDeskClient,
  AdDeskError,
  type AdDeskClient,
  type AdDeskClientOptions,
  type ServeDto,
  type TrackReceiptDto,
} from './client'

export { AdSlot, type AdSlotProps } from './react'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_RADIUS, type WidgetTheme } from './styles'

export { mount, init, type MountOptions, type WidgetHandle } from './vanilla'
