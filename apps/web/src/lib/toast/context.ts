import { createContext } from 'react'

export type ToastTone = 'neutral' | 'success' | 'error'

export type ToastInput = {
  /** 본문 메시지. */
  message: string
  /** 톤(아이콘·색상). 기본 neutral. */
  tone?: ToastTone
  /** 자동 닫힘까지 ms. 기본 2600. 0 이하이면 자동 닫지 않는다. */
  durationMs?: number
}

export type ToastApi = {
  /** 토스트를 띄운다. 반환값은 수동 제거용 id. */
  show: (input: ToastInput | string) => string
  /** id로 토스트를 제거한다. */
  dismiss: (id: string) => void
}

/**
 * 전역 토스트 API. Provider 밖에서 호출되면 no-op(SSR/테스트 안전).
 * 컴포넌트 파일이 아니므로 react-refresh 제약과 무관하게 상수 export 가능.
 */
export const ToastContext = createContext<ToastApi>({
  show: () => '',
  dismiss: () => {},
})
