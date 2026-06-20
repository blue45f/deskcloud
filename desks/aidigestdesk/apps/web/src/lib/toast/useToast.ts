import { useContext } from 'react'

import { ToastContext, type ToastApi } from './context'

/** Provider 내부 어디서든 토스트를 띄우는 훅. */
export function useToast(): ToastApi {
  return useContext(ToastContext)
}
